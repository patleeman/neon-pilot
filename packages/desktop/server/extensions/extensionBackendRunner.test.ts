import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createInProcessExtensionBackendRunner, extensionBackendOperation, serializeExtensionBackendOperation } from './extensionBackendRunner.js';
import { clearExtensionHostAuditEvents, listExtensionHostAuditEvents } from './extensionHostAudit.js';

describe('extensionBackendRunner', () => {
  beforeEach(() => {
    clearExtensionHostAuditEvents();
  });

  it('audits backend handler execution without recording inputs', async () => {
    const runner = createInProcessExtensionBackendRunner();

    await expect(
      runner.run('ext-audit', extensionBackendOperation('action', 'action doThing', { target: 'doThing' }), () => ({ ok: true, secret: 'input' })),
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
