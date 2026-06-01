import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerThreads = vi.hoisted(() => ({
  messageHandler: undefined as undefined | ((message: unknown) => void),
  parentPort: {
    on: vi.fn((event: string, handler: (message: unknown) => void) => {
      if (event === 'message') workerThreads.messageHandler = handler;
    }),
    postMessage: vi.fn(),
  },
}));

vi.mock('node:worker_threads', () => ({ parentPort: workerThreads.parentPort }));

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function waitForPostMessage(message: unknown): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    if (workerThreads.parentPort.postMessage.mock.calls.some(([candidate]) => expect.objectContaining(message).asymmetricMatch(candidate))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(workerThreads.parentPort.postMessage).toHaveBeenCalledWith(message);
}

async function loadWorker(): Promise<void> {
  vi.resetModules();
  workerThreads.messageHandler = undefined;
  await import('./extensionBackendWorker.js');
}

describe('extensionBackendWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs backend exports with host-mediated log capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(input, ctx) {
  await ctx.log.warn('worker ran', { ok: input.ok });
  return { ok: input.ok };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 10,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-1' },
      exportName: 'doThing',
      args: [{ ok: true }],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'log',
      operation: 'warn',
      input: { message: 'worker ran', fields: { ok: true } },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });
    await flushPromises();

    expect(workerThreads.parentPort.postMessage).toHaveBeenCalledWith({ id: 10, ok: true, result: { ok: true } });
  });

  it('runs backend exports with host-mediated event publish capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.events.publish({ event: 'task:completed', payload: { taskId: 'task-1' } });
  return { ok: true };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 15,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-events' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'events',
      operation: 'publish',
      input: { event: 'task:completed', payload: { taskId: 'task-1' } },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });
    await waitForPostMessage({ id: 15, ok: true, result: { ok: true } });
  });

  it('runs backend exports with host-mediated git capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return await ctx.git.status({ cwd: '/repo' });
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 20,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-git' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'git',
      operation: 'status',
      input: { cwd: '/repo' },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { porcelain: '## main' } });
    await waitForPostMessage({ id: 20, ok: true, result: { porcelain: '## main' } });
  });

  it('runs backend exports with host-mediated notification capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.notify.toast('Saved', 'info');
  const badge = await ctx.notify.setBadge(2);
  await ctx.notify.clearBadge();
  const available = await ctx.notify.isSystemAvailable();
  const delivered = await ctx.notify.system({ title: 'Title', message: 'Body' });
  return { badge, available, delivered };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 25,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-notify' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'toast',
      input: { message: 'Saved', type: 'info' },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'setBadge',
      input: { count: 2 },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { badge: 2, aggregated: 2 } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'clearBadge',
    });
    workerThreads.messageHandler?.({ id: 3, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({
      id: 4,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'isSystemAvailable',
    });
    workerThreads.messageHandler?.({ id: 4, kind: 'capabilityResponse', ok: true, result: true });

    await waitForPostMessage({
      id: 5,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'system',
      input: { title: 'Title', message: 'Body' },
    });
    workerThreads.messageHandler?.({ id: 5, kind: 'capabilityResponse', ok: true, result: true });

    await waitForPostMessage({
      id: 25,
      ok: true,
      result: { badge: { badge: 2, aggregated: 2 }, available: true, delivered: true },
    });
  });

  it('returns export execution errors when host capabilities fail', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.log.error('worker failed');
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 20,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-2' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'log',
      operation: 'error',
      input: { message: 'worker failed', fields: undefined },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: false, error: 'capability denied' });
    await waitForPostMessage({ id: 20, ok: false, error: 'capability denied' });
  });

  it('runs backend exports with host-mediated storage capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.storage.put('tasks/one', { done: false }, { expectedVersion: 1 });
  const value = await ctx.storage.get('tasks/one');
  const list = await ctx.storage.list('tasks/');
  const deleted = await ctx.storage.delete('tasks/one');
  return { value, list, deleted };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 30,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-3' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'put',
      input: { key: 'tasks/one', value: { done: false }, expectedVersion: 1 },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'get',
      input: { key: 'tasks/one' },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { done: false } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'list',
      input: { prefix: 'tasks/' },
    });
    workerThreads.messageHandler?.({
      id: 3,
      kind: 'capabilityResponse',
      ok: true,
      result: [{ key: 'tasks/one', value: { done: false } }],
    });

    await waitForPostMessage({
      id: 4,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'delete',
      input: { key: 'tasks/one' },
    });
    workerThreads.messageHandler?.({ id: 4, kind: 'capabilityResponse', ok: true, result: { ok: true, deleted: true } });

    await waitForPostMessage({
      id: 30,
      ok: true,
      result: {
        value: { done: false },
        list: [{ key: 'tasks/one', value: { done: false } }],
        deleted: { ok: true, deleted: true },
      },
    });
  });

  it('runs backend exports with host-mediated shell exec', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return await ctx.shell.exec({ command: 'git', args: ['status', '--short'], cwd: '/repo', timeoutMs: 1000 });
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 40,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-4' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'exec',
      input: { command: 'git', args: ['status', '--short'], cwd: '/repo', timeoutMs: 1000 },
    });
    workerThreads.messageHandler?.({
      id: 1,
      kind: 'capabilityResponse',
      ok: true,
      result: { command: 'git', args: ['status', '--short'], stdout: '', stderr: '', executionWrappers: [] },
    });

    await waitForPostMessage({
      id: 40,
      ok: true,
      result: { command: 'git', args: ['status', '--short'], stdout: '', stderr: '', executionWrappers: [] },
    });
  });

  it('runs backend exports with host-mediated secrets reads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return { secret: await ctx.secrets.get('apiKey') };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 50,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-5' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'secrets',
      operation: 'get',
      input: { secretId: 'apiKey' },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: 'stored-secret' });

    await waitForPostMessage({ id: 50, ok: true, result: { secret: 'stored-secret' } });
  });

  it('runs backend exports with host-mediated telemetry records', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.telemetry.record({ category: 'worker', name: 'done', count: 1 });
  return { ok: true };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 55,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-telemetry' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'telemetry',
      operation: 'record',
      input: { category: 'worker', name: 'done', count: 1 },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({ id: 55, ok: true, result: { ok: true } });
  });

  it('runs backend exports with host-mediated UI invalidation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.ui.invalidate(['sessions', 'checkpoints']);
  return { ok: true };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 60,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-6' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'ui',
      operation: 'invalidate',
      input: { topics: ['sessions', 'checkpoints'] },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({ id: 60, ok: true, result: { ok: true } });
  });
});
