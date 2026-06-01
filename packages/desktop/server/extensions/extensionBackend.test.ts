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
