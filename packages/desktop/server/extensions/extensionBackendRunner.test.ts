import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInProcessExtensionBackendRunner,
  createWorkerImportExtensionBackendRunner,
  extensionBackendOperation,
  serializeExtensionBackendOperation,
} from './extensionBackendRunner.js';
import { clearExtensionHostAuditEvents, listExtensionHostAuditEvents } from './extensionHostAudit.js';

describe('extensionBackendRunner', () => {
  beforeEach(() => {
    clearExtensionHostAuditEvents();
  });

  it('audits backend handler execution without recording inputs', async () => {
    const runner = createInProcessExtensionBackendRunner();

    await expect(
      runner.run('ext-audit', extensionBackendOperation('action', 'action doThing', { target: 'doThing' }), () => ({
        ok: true,
        secret: 'input',
      })),
    ).resolves.toEqual({ ok: true, secret: 'input' });

    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-audit:action doThing',
        ok: true,
      }),
    ]);
    expect(listExtensionHostAuditEvents()[0]).not.toHaveProperty('payload');
    expect(listExtensionHostAuditEvents()[0]).not.toHaveProperty('body');
    expect(listExtensionHostAuditEvents()[0]).not.toHaveProperty('target');
  });

  it('audits backend handler failures and rethrows', async () => {
    const runner = createInProcessExtensionBackendRunner();

    await expect(
      runner.run('ext-audit-fail', extensionBackendOperation('subscription', 'subscription changed'), () => {
        throw new Error('handler failed');
      }),
    ).rejects.toThrow('handler failed');

    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-audit-fail:subscription changed',
        ok: false,
        error: 'handler failed',
      }),
    ]);
  });

  it('audits backend imports at the runner boundary', async () => {
    const runner = createInProcessExtensionBackendRunner();
    const packageRoot = await mkdtemp(join(tmpdir(), 'pa-ext-runner-'));
    const dist = join(packageRoot, 'dist');
    mkdirSync(dist);
    const backendPath = join(dist, 'backend.mjs');
    writeFileSync(backendPath, 'export const value = 42;\n');

    await expect(runner.loadModule('ext-import-audit', { path: backendPath, hash: 'test-1' })).resolves.toMatchObject({ value: 42 });

    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-import-audit:backend import',
        ok: true,
      }),
    ]);
  });

  it('can load backend imports through the worker import runner', async () => {
    const client = {
      loadModule: vi.fn(async () => undefined),
      clearModule: vi.fn(async () => undefined),
      hasExport: vi.fn(async () => true),
      runExport: vi.fn(async () => ({ ok: true })),
    };
    const runner = createWorkerImportExtensionBackendRunner(client);

    await expect(runner.loadModule('ext-worker-import', { path: '/tmp/backend.mjs', hash: 'hash-1' })).resolves.toEqual({});
    await expect(runner.hasExport('ext-worker-import', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'doThing')).resolves.toBe(true);
    runner.clearModule('ext-worker-import');

    expect(client.loadModule).toHaveBeenCalledWith('ext-worker-import', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    expect(client.hasExport).toHaveBeenCalledWith('ext-worker-import', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'doThing');
    expect(client.clearModule).toHaveBeenCalledWith('ext-worker-import');
    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-worker-import:backend import',
        ok: true,
      }),
    ]);
  });

  it('runs backend exports through the worker import runner when explicitly requested', async () => {
    const client = {
      loadModule: vi.fn(async () => undefined),
      clearModule: vi.fn(async () => undefined),
      hasExport: vi.fn(async () => true),
      runExport: vi.fn(async () => ({ via: 'worker' })),
    };
    const fallback = createInProcessExtensionBackendRunner();
    const fallbackRunExport = vi.spyOn(fallback, 'runExport');
    const runner = createWorkerImportExtensionBackendRunner(client, fallback);

    await expect(
      runner.runWorkerExport(
        'ext-worker-run',
        { path: '/tmp/backend.mjs', hash: 'hash-1' },
        'doThing',
        extensionBackendOperation('self-test-action', 'self-test action doThing', { target: 'doThing' }),
        [{ ok: true }],
        { context: { type: 'backend', toolContext: { conversationId: 'self-test' } } },
      ),
    ).resolves.toEqual({ via: 'worker' });

    expect(client.runExport).toHaveBeenCalledWith(
      'ext-worker-run',
      { path: '/tmp/backend.mjs', hash: 'hash-1' },
      'doThing',
      [{ ok: true }],
      { context: { type: 'backend', toolContext: { conversationId: 'self-test' } } },
    );
    expect(fallbackRunExport).not.toHaveBeenCalled();
    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-worker-run:self-test action doThing',
        ok: true,
      }),
    ]);
  });

  it('loads, resolves, and executes backend exports at the runner boundary', async () => {
    const runner = createInProcessExtensionBackendRunner();
    const packageRoot = await mkdtemp(join(tmpdir(), 'pa-ext-runner-export-'));
    const dist = join(packageRoot, 'dist');
    mkdirSync(dist);
    const backendPath = join(dist, 'backend.mjs');
    writeFileSync(backendPath, 'export function doThing(input) { return { input, via: "runExport" }; }\n');

    await expect(
      runner.runExport(
        'ext-export-audit',
        { path: backendPath, hash: 'test-1' },
        'doThing',
        extensionBackendOperation('action', 'action doThing', { exportName: 'doThing', target: 'doThing' }),
        (handler) => handler({ ok: true }),
      ),
    ).resolves.toEqual({ input: { ok: true }, via: 'runExport' });

    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-export-audit:backend import',
        ok: true,
      }),
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-export-audit:action doThing',
        ok: true,
      }),
    ]);
  });

  it('checks backend export availability through the runner boundary', async () => {
    const runner = createInProcessExtensionBackendRunner();
    const packageRoot = await mkdtemp(join(tmpdir(), 'pa-ext-runner-has-export-'));
    const dist = join(packageRoot, 'dist');
    mkdirSync(dist);
    const backendPath = join(dist, 'backend.mjs');
    writeFileSync(backendPath, 'export function doThing() { return true; }\nexport const notHandler = true;\n');

    await expect(runner.hasExport('ext-has-export', { path: backendPath, hash: 'test-1' }, 'doThing')).resolves.toBe(true);
    await expect(runner.hasExport('ext-has-export', { path: backendPath, hash: 'test-1' }, 'notHandler')).resolves.toBe(false);
    await expect(runner.hasExport('ext-has-export', { path: backendPath, hash: 'test-1' }, 'missing')).resolves.toBe(false);
  });

  it('normalizes agent factory builders at the runner boundary', async () => {
    const runner = createInProcessExtensionBackendRunner();
    const packageRoot = await mkdtemp(join(tmpdir(), 'pa-ext-runner-agent-factory-'));
    const dist = join(packageRoot, 'dist');
    mkdirSync(dist);
    const backendPath = join(dist, 'backend.mjs');
    writeFileSync(backendPath, 'export function create() { return function agentFactory(pi) { pi.registered = true; }; }\n');

    const factory = await runner.loadAgentFactory('ext-agent-factory', { path: backendPath, hash: 'test-1' }, 'create');
    const pi = {};
    factory(pi);

    expect(pi).toEqual({ registered: true });
    expect(listExtensionHostAuditEvents()).toEqual([
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-agent-factory:backend import',
        ok: true,
      }),
      expect.objectContaining({
        requestType: 'backend',
        requestName: 'ext-agent-factory:agent extension factory builder',
        ok: true,
      }),
    ]);
  });

  it('serializes operation descriptors to wire-safe metadata only', () => {
    const operation = {
      ...extensionBackendOperation('action', 'action doThing', { exportName: 'doThing', target: 'doThing' }),
      handler: () => 'nope',
      payload: { secret: true },
    };

    expect(serializeExtensionBackendOperation(operation)).toEqual({
      type: 'action',
      label: 'action doThing',
      exportName: 'doThing',
      target: 'doThing',
    });
  });
});
