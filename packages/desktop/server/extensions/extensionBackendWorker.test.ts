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
});
