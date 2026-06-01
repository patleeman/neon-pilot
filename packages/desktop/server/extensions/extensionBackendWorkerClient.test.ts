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

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

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

  it('sends backend export execution requests to the worker', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });
    const run = client.runExport(
      'ext',
      { path: '/tmp/backend.mjs', hash: 'hash-1' },
      'doThing',
      [{ ok: true }],
      { context: 'backend' },
    );
    const worker = workerThreads.instances[0]!;

    expect(worker.postMessage).toHaveBeenCalledWith({
      id: 1,
      type: 'runExport',
      extensionId: 'ext',
      compiled: { path: '/tmp/backend.mjs', hash: 'hash-1' },
      exportName: 'doThing',
      args: [{ ok: true }],
      context: 'backend',
    });

    worker.emit('message', { id: 1, ok: true, result: { ran: true } });
    await expect(run).resolves.toEqual({ ran: true });
  });

  it('routes backend export execution through the extension worker pool', async () => {
    const pool = new ExtensionBackendWorkerPool({ workerUrl: new URL('file:///worker.js') });
    const run = pool.runExport('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'doThing', []);
    const worker = workerThreads.instances[0]!;

    expect(worker.postMessage).toHaveBeenCalledWith({
      id: 1,
      type: 'runExport',
      extensionId: 'ext',
      compiled: { path: '/tmp/backend.mjs', hash: 'hash-1' },
      exportName: 'doThing',
      args: [],
    });

    worker.emit('message', { id: 1, ok: true, result: 'ok' });
    await expect(run).resolves.toBe('ok');
  });

  it('rejects pending requests when the worker fails', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });
    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;

    worker.emit('error', new Error('worker exploded'));

    await expect(load).rejects.toThrow('worker exploded');
  });

  it('dispatches worker capability requests through the host dispatcher', async () => {
    const capabilityDispatcher = vi.fn(async () => ({ ok: true }));
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js'), capabilityDispatcher });

    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;
    worker.emit('message', { id: 1, ok: true });
    await load;

    worker.emit('message', {
      id: 99,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'log',
      operation: 'info',
      input: { message: 'hello' },
    });
    await flushPromises();

    expect(capabilityDispatcher).toHaveBeenCalledWith({
      id: 99,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'log',
      operation: 'info',
      input: { message: 'hello' },
    });
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 99,
      kind: 'capabilityResponse',
      ok: true,
      result: { ok: true },
    });
  });

  it('returns capability dispatcher errors to the worker', async () => {
    const capabilityDispatcher = vi.fn(async () => {
      throw new Error('capability denied');
    });
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js'), capabilityDispatcher });

    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;
    worker.emit('message', { id: 1, ok: true });
    await load;

    worker.emit('message', {
      id: 100,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'storage',
      operation: 'get',
      input: { key: 'missing' },
    });
    await flushPromises();

    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 100,
      kind: 'capabilityResponse',
      ok: false,
      error: 'capability denied',
    });
  });

  it('fails closed when a worker requests a host capability without a dispatcher', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });

    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;
    worker.emit('message', { id: 1, ok: true });
    await load;

    worker.emit('message', {
      id: 101,
      kind: 'capabilityRequest',
      extensionId: 'ext',
      capability: 'storage',
      operation: 'get',
      input: { key: 'missing' },
    });
    await flushPromises();

    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 101,
      kind: 'capabilityResponse',
      ok: false,
      error: 'No extension backend capability dispatcher configured.',
    });
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
