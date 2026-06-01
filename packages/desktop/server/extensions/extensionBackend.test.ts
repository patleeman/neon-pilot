import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { invokeExtensionAction, loadExtensionAgentFactory, loadExtensionBackend } from './extensionBackend.js';
import { resolveExtensionBackendLoadTarget, resolvePrebuiltSystemExtensionBackend } from './extensionBackendLoadTarget.js';
import { setExtensionBackendRunnerForTests } from './extensionBackendRunner.js';
import { isExtensionEnabled, setExtensionEnabled } from './extensionRegistry.js';

const TEST_EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../extensions/system-auto-mode');

const ORIGINAL_STATE_ROOT = process.env.NEON_PILOT_STATE_ROOT;

afterEach(() => {
  setExtensionBackendRunnerForTests(undefined);
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
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      run,
    });

    await expect(invokeExtensionAction('runner-action-ext', 'doThing', { ok: true })).resolves.toEqual({
      ok: true,
      result: { input: { ok: true }, via: 'runner' },
    });

    expect(loadModule).toHaveBeenCalledWith(
      'runner-action-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
    );
    expect(run).toHaveBeenCalledWith(
      'runner-action-ext',
      { type: 'action', label: 'action doThing', target: 'doThing' },
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
    const run = vi.fn(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler());
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      run,
    });

    await expect(loadExtensionAgentFactory('runner-agent-builder-ext', 'create')).resolves.toBe(factory);

    expect(create).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      'runner-agent-builder-ext',
      { type: 'agent-factory-builder', label: 'agent extension factory builder', target: 'create' },
      expect.any(Function),
    );
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
