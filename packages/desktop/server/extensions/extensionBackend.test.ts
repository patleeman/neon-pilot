import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  invokeExtensionAction,
  invokeExtensionRoute,
  loadExtensionAgentFactory,
  loadExtensionBackend,
  reloadExtensionBackend,
  runExtensionSelfTest,
  setWorkerImportBackendRunnerForTests,
} from './extensionBackend.js';
import { resolveExtensionBackendLoadTarget, resolvePrebuiltSystemExtensionBackend } from './extensionBackendLoadTarget.js';
import { setExtensionBackendRunnerForTests } from './extensionBackendRunner.js';
import { isExtensionEnabled, setExtensionEnabled } from './extensionRegistry.js';

const TEST_EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../extensions/system-auto-mode');

const ORIGINAL_STATE_ROOT = process.env.NEON_PILOT_STATE_ROOT;

const extensionServices = vi.hoisted(() => ({
  startExtensionServices: vi.fn(async () => undefined),
  stopExtensionServices: vi.fn(async () => undefined),
}));

vi.mock('./extensionServices.js', () => extensionServices);

afterEach(() => {
  vi.clearAllMocks();
  setExtensionBackendRunnerForTests(undefined);
  setWorkerImportBackendRunnerForTests(undefined);
  if (ORIGINAL_STATE_ROOT === undefined) delete process.env.NEON_PILOT_STATE_ROOT;
  else process.env.NEON_PILOT_STATE_ROOT = ORIGINAL_STATE_ROOT;
});

describe('extension backend action invocation', () => {
  it('refuses to invoke actions from disabled extensions before loading backend code', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'disabled-action-ext');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'disabled-action-ext',
        name: 'Disabled Action Ext',
        backend: {
          entry: 'missing-backend.js',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    setExtensionEnabled('disabled-action-ext', false, stateRoot);

    await expect(invokeExtensionAction('disabled-action-ext', 'doThing', {})).resolves.toEqual({
      ok: false,
      error: 'Cannot invoke action "doThing": extension "disabled-action-ext" is disabled.',
    });
  });

  it('blocks process termination from extension actions and disables the extension', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'exit-action-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'exit-action-ext',
        name: 'Exit Action Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function doThing() { process.exit(42); }\n');

    const result = await invokeExtensionAction('exit-action-ext', 'doThing', {});

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toContain('attempted to terminate the application via process.exit');
    expect(isExtensionEnabled('exit-action-ext', stateRoot)).toBe(false);
  });

  it('returns repeated action handler errors without disabling the extension', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'validation-action-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'validation-action-ext',
        name: 'Validation Action Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function doThing() { throw new Error("validation failed"); }\n');

    await invokeExtensionAction('validation-action-ext', 'doThing', {});
    await invokeExtensionAction('validation-action-ext', 'doThing', {});
    const result = await invokeExtensionAction('validation-action-ext', 'doThing', {});

    expect(result).toEqual({
      ok: false,
      error: 'Extension "validation-action-ext" action "doThing" failed: validation failed',
    });
    expect(isExtensionEnabled('validation-action-ext', stateRoot)).toBe(true);
  });

  it('blocks process termination during extension backend import', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'exit-import-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'exit-import-ext',
        name: 'Exit Import Ext',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'noop', handler: 'noop' }] },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'process.exit(42); export function noop() { return true; }\n');

    await expect(loadExtensionBackend('exit-import-ext')).rejects.toThrow('attempted to terminate the application via process.exit');
  });

  it('loads and executes backend actions through the extension backend runner seam', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'runner-action-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'runner-action-ext',
        name: 'Runner Action Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const loadModule = vi.fn(async () => ({ doThing: vi.fn((input: unknown) => ({ input, via: 'runner' })) }));
    const run = vi.fn(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler());
    const runExport = vi.fn(
      async (
        extensionId: string,
        compiled: { path: string; hash: string },
        exportName: string,
        operation: unknown,
        invoke: (handler: (...args: unknown[]) => unknown) => unknown,
      ) => {
        const backend = await loadModule(extensionId, compiled);
        return run(extensionId, operation, () => invoke(backend[exportName] as (...args: unknown[]) => unknown));
      },
    );
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      run,
      runExport,
    });

    await expect(invokeExtensionAction('runner-action-ext', 'doThing', { ok: true })).resolves.toEqual({
      ok: true,
      result: { input: { ok: true }, via: 'runner' },
    });

    expect(loadModule).toHaveBeenCalledWith(
      'runner-action-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
    );
    expect(runExport).toHaveBeenCalledWith(
      'runner-action-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
      'doThing',
      { type: 'action', label: 'action doThing', exportName: 'doThing', target: 'doThing' },
      expect.any(Function),
    );
  });

  it('runs explicitly worker-safe backend actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ text: 'No commit checkpoints saved for conversation conv-1.', action: 'list' })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-diffs', 'checkpoint', { action: 'list' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
        onUpdate: undefined,
      }),
    ).resolves.toEqual({
      ok: true,
      result: { text: 'No commit checkpoints saved for conversation conv-1.', action: 'list' },
    });

    expect(workerRunner.hasExport).toHaveBeenCalledWith(
      'system-diffs',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-diffs', 'dist', 'backend.mjs')) }),
      'checkpoint',
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-diffs',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-diffs', 'dist', 'backend.mjs')) }),
      'checkpoint',
      { type: 'action', label: 'action checkpoint', target: 'checkpoint' },
      [{ action: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('keeps manifest worker actions in-process when the input is not allowlisted', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(async (_extensionId, _compiled, _exportName, _operation, invoke) =>
        invoke(() => ({ action: 'unknown', via: 'in-process' })),
      ),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-diffs', 'checkpoint', { action: 'unknown' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
      }),
    ).resolves.toEqual({ ok: true, result: { action: 'unknown', via: 'in-process' } });

    expect(workerRunner.runWorkerExport).not.toHaveBeenCalled();
    expect(backendRunner.runExport).toHaveBeenCalled();
  });

  it('runs artifact backend actions through the worker runner when manifest-declared', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ text: 'No artifacts saved for conversation conv-1.', action: 'list' })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-artifacts', 'artifact', { action: 'list' }, undefined, {
        conversationId: 'conv-1',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { text: 'No artifacts saved for conversation conv-1.', action: 'list' },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-artifacts',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-artifacts', 'dist', 'backend.mjs')) }),
      'artifact',
      { type: 'action', label: 'action artifact', target: 'artifact' },
      [{ action: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: { conversationId: 'conv-1' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe conversation context menu actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true, conversationId: 'conv-1' })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-conversation-tools', 'copyConversationId', {
        conversationId: 'conv-1',
        sessionTitle: 'Architecture Notes',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, conversationId: 'conv-1' },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'copyConversationId',
      { type: 'action', label: 'action copyConversationId', target: 'copyConversationId' },
      [{ conversationId: 'conv-1', sessionTitle: 'Architecture Notes' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: undefined,
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe local dictation settings actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ settings: { enabled: false, model: 'base.en' } })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-local-dictation', 'readSettings', {})).resolves.toEqual({
      ok: true,
      result: { settings: { enabled: false, model: 'base.en' } },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-dictation',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-dictation', 'dist', 'backend.mjs')),
      }),
      'readSettings',
      { type: 'action', label: 'action readSettings', target: 'readSettings' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe todo actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    setExtensionEnabled('system-todo', true, stateRoot);
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ schemaVersion: 1, updatedAt: '2026-06-01T00:00:00.000Z', items: [] })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-todo', 'getState', { conversationId: 'conv-1' }, undefined, {
        conversationId: 'conv-1',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { schemaVersion: 1, updatedAt: '2026-06-01T00:00:00.000Z', items: [] },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-todo',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-todo', 'dist', 'backend.mjs')),
      }),
      'getState',
      { type: 'action', label: 'action getState', target: 'getState' },
      [{ conversationId: 'conv-1' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe code mode draft actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    setExtensionEnabled('system-code-mode', true, stateRoot);
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ enabled: true, createOptions: { allowedToolNames: ['exec_code'] }, applyAfterCreate: true })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-code-mode', 'prepareDraftConversation', {})).resolves.toEqual({
      ok: true,
      result: { enabled: true, createOptions: { allowedToolNames: ['exec_code'] }, applyAfterCreate: true },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-code-mode',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-code-mode', 'dist', 'backend.mjs')),
      }),
      'prepareDraftConversation',
      { type: 'action', label: 'action prepareDraftConversation', target: 'prepareDraftConversation' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('normalizes agent factory builders through the extension backend runner seam', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'runner-agent-builder-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'runner-agent-builder-ext',
        name: 'Runner Agent Builder Ext',
        backend: {
          entry: 'dist/backend.mjs',
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const factory = vi.fn();
    const create = vi.fn(() => factory);
    const loadModule = vi.fn(async () => ({ create }));
    const loadAgentFactory = vi.fn(async () => {
      const backend = await loadModule('runner-agent-builder-ext', { path: join(extensionRoot, 'dist', 'backend.mjs'), hash: 'test' });
      return run(
        'runner-agent-builder-ext',
        { type: 'agent-factory-builder', label: 'agent extension factory builder', exportName: 'create', target: 'create' },
        () => (backend.create as () => unknown)(),
      );
    });
    const run = vi.fn(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler());
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory,
      runExport: vi.fn(),
      run,
    });

    await expect(loadExtensionAgentFactory('runner-agent-builder-ext', 'create')).resolves.toBe(factory);

    expect(loadAgentFactory).toHaveBeenCalledWith(
      'runner-agent-builder-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
      'create',
    );
    expect(create).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      'runner-agent-builder-ext',
      { type: 'agent-factory-builder', label: 'agent extension factory builder', exportName: 'create', target: 'create' },
      expect.any(Function),
    );
  });

  it('loads and executes backend routes through the extension backend runner seam', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'runner-route-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'runner-route-ext',
        name: 'Runner Route Ext',
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/ping', handler: 'ping' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const loadModule = vi.fn(async () => ({ ping: vi.fn(() => ({ status: 201, body: { via: 'runner' } })) }));
    const run = vi.fn(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler());
    const runExport = vi.fn(
      async (
        extensionId: string,
        compiled: { path: string; hash: string },
        exportName: string,
        operation: unknown,
        invoke: (handler: (...args: unknown[]) => unknown) => unknown,
      ) => {
        const backend = await loadModule(extensionId, compiled);
        return run(extensionId, operation, () => invoke(backend[exportName] as (...args: unknown[]) => unknown));
      },
    );
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      run,
      runExport,
    });

    await expect(
      invokeExtensionRoute('runner-route-ext', 'GET', '/ping', { method: 'GET', path: '/ping', query: {}, params: {} }),
    ).resolves.toEqual({ status: 201, body: { via: 'runner' } });

    expect(runExport).toHaveBeenCalledWith(
      'runner-route-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
      'ping',
      { type: 'route', label: 'route GET /ping', exportName: 'ping', target: '/ping' },
      expect.any(Function),
    );
  });

  it('returns HTTP 500 when a backend route export is missing', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'missing-route-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'missing-route-ext',
        name: 'Missing Route Ext',
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/ping', handler: 'missing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');

    await expect(
      invokeExtensionRoute('missing-route-ext', 'GET', '/ping', { method: 'GET', path: '/ping', query: {}, params: {} }),
    ).resolves.toEqual({ status: 500, body: { error: 'Extension route handler not found: missing' } });
  });

  it('probes self-test backend imports and exports through the worker import runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'self-test-worker-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'self-test-worker-ext',
        name: 'Self Test Worker Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => false),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(runExtensionSelfTest('self-test-worker-ext')).resolves.toEqual({
      ok: false,
      extensionId: 'self-test-worker-ext',
      checks: [
        { name: 'backend import', ok: true },
        { name: 'action export: doThing', ok: false, error: 'Missing export doThing' },
      ],
    });

    expect(workerRunner.loadModule).toHaveBeenCalledWith(
      'self-test-worker-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
    );
    expect(workerRunner.hasExport).toHaveBeenCalledWith(
      'self-test-worker-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
      'doThing',
    );
  });

  it('runs product-critical self-test action smoke checks through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'system-diffs');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-diffs',
        name: 'System Diffs',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'checkpoint', handler: 'checkpoint' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function checkpoint() { return true; }\n');
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true })),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(runExtensionSelfTest('system-diffs')).resolves.toEqual({
      ok: true,
      extensionId: 'system-diffs',
      checks: [
        { name: 'backend import', ok: true },
        { name: 'action export: checkpoint', ok: true },
        { name: 'action smoke: checkpoint', ok: true },
      ],
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-diffs',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-diffs', 'dist', 'backend.mjs')) }),
      'checkpoint',
      { type: 'self-test-action', label: 'self-test action checkpoint', target: 'checkpoint' },
      [{ action: 'list' }],
      { context: { type: 'backend', toolContext: { conversationId: 'extension-self-test', cwd: process.cwd() } } },
    );
  });

  it('clears both backend runners before reloading a backend', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'reload-worker-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'reload-worker-ext',
        name: 'Reload Worker Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function doThing() { return true; }\n');

    const backendRunner = {
      loadModule: vi.fn(async () => ({ doThing: vi.fn() })),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(reloadExtensionBackend('reload-worker-ext')).resolves.toEqual({
      ok: true,
      extensionId: 'reload-worker-ext',
      rebuilt: false,
    });

    expect(extensionServices.stopExtensionServices).toHaveBeenCalledWith('reload-worker-ext');
    expect(backendRunner.clearModule).toHaveBeenCalledWith('reload-worker-ext');
    expect(workerRunner.clearModule).toHaveBeenCalledWith('reload-worker-ext');
    expect(backendRunner.loadModule).toHaveBeenCalledWith(
      'reload-worker-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
    );
    expect(extensionServices.startExtensionServices).toHaveBeenCalledOnce();
  });
});

describe('extension backend load targeting', () => {
  it('resolves prebuilt dist/backend.mjs for bundled system extensions', () => {
    const target = resolvePrebuiltSystemExtensionBackend({ source: 'system', packageRoot: TEST_EXTENSION_ROOT });

    expect(target).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
    expect(target?.hash).toMatch(/^prebuilt:/);
  });

  it('loads built-output backend entries directly', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'dist/backend.mjs')).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
  });

  it('resolves source manifest entries to built dist/backend.mjs artifacts', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'src/backend.ts')).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });

    expect(resolvePrebuiltSystemExtensionBackend({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT })).toBeNull();
  });
});
