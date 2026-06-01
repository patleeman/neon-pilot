import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerThreads = vi.hoisted(() => {
  interface MockWorkerInstance {
    url: URL;
    options?: unknown;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    on(event: string, listener: (...args: unknown[]) => void): MockWorkerInstance;
    emit(event: string, ...args: unknown[]): boolean;
  }

  const instances: MockWorkerInstance[] = [];

  function MockWorker(this: MockWorkerInstance, url: URL, options?: unknown) {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    this.url = url;
    this.options = options;
    this.postMessage = vi.fn();
    this.terminate = vi.fn(async () => 0);

    this.on = (event, listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return this;
    };

    this.emit = (event, ...args) => {
      for (const listener of listeners.get(event) ?? []) listener(...args);
      return true;
    };

    instances.push(this);
  }

  return { Worker: vi.fn(MockWorker), instances };
});

vi.mock('node:worker_threads', () => ({ Worker: workerThreads.Worker }));

import { ExtensionBackendWorkerClient, ExtensionBackendWorkerPool } from './extensionBackendWorkerClient.js';

describe('ExtensionBackendWorkerClient', () => {
  beforeEach(() => {
    workerThreads.Worker.mockClear();
    workerThreads.instances.length = 0;
  });

  it('sends backend import requests to the worker', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });
    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;

    expect(worker.postMessage).toHaveBeenCalledWith({
      id: 1,
      type: 'loadModule',
      extensionId: 'ext',
      compiled: { path: '/tmp/backend.mjs', hash: 'hash-1' },
    });

    worker.emit('message', { id: 1, ok: true });
    await expect(load).resolves.toBeUndefined();
  });

  it('returns backend export availability from the worker', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });
    const hasExport = client.hasExport('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'doThing');
    const worker = workerThreads.instances[0]!;

    expect(worker.postMessage).toHaveBeenCalledWith({
      id: 1,
      type: 'hasExport',
      extensionId: 'ext',
      compiled: { path: '/tmp/backend.mjs', hash: 'hash-1' },
      exportName: 'doThing',
    });

    worker.emit('message', { id: 1, ok: true, result: true });
    await expect(hasExport).resolves.toBe(true);
  });

  it('rejects pending requests when the worker fails', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });
    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;

    worker.emit('error', new Error('worker exploded'));

    await expect(load).rejects.toThrow('worker exploded');
  });

  it('uses a separate backend worker per extension in the worker pool', async () => {
    const pool = new ExtensionBackendWorkerPool({ workerUrl: new URL('file:///worker.js') });
    const first = pool.loadModule('ext-a', { path: '/tmp/a.mjs', hash: 'hash-a' });
    const firstWorker = workerThreads.instances[0]!;
    firstWorker.emit('message', { id: 1, ok: true });
    await first;

    const second = pool.loadModule('ext-b', { path: '/tmp/b.mjs', hash: 'hash-b' });
    const secondWorker = workerThreads.instances[1]!;
    secondWorker.emit('message', { id: 1, ok: true });
    await second;

    const firstAgain = pool.hasExport('ext-a', { path: '/tmp/a.mjs', hash: 'hash-a' }, 'doThing');
    firstWorker.emit('message', { id: 2, ok: true, result: true });
    await expect(firstAgain).resolves.toBe(true);

    expect(workerThreads.instances).toHaveLength(2);
    expect(firstWorker.postMessage).toHaveBeenNthCalledWith(1, {
      id: 1,
      type: 'loadModule',
      extensionId: 'ext-a',
      compiled: { path: '/tmp/a.mjs', hash: 'hash-a' },
    });
    expect(secondWorker.postMessage).toHaveBeenCalledWith({
      id: 1,
      type: 'loadModule',
      extensionId: 'ext-b',
      compiled: { path: '/tmp/b.mjs', hash: 'hash-b' },
    });
    expect(firstWorker.postMessage).toHaveBeenNthCalledWith(2, {
      id: 2,
      type: 'hasExport',
      extensionId: 'ext-a',
      compiled: { path: '/tmp/a.mjs', hash: 'hash-a' },
      exportName: 'doThing',
    });
  });
});
