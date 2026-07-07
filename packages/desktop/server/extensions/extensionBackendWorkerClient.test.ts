import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  ExtensionBackendWorkerClient,
  ExtensionBackendWorkerPool,
  setDefaultExtensionBackendWorkerUrl,
} from './extensionBackendWorkerClient.js';
import { ExtensionPermissionError } from './extensionPermissions.js';

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('ExtensionBackendWorkerClient', () => {
  const originalCwd = process.cwd();

  beforeEach(() => {
    workerThreads.Worker.mockClear();
    workerThreads.instances.length = 0;
    setDefaultExtensionBackendWorkerUrl(undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
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

  it('uses the configured process default worker URL when no explicit URL is provided', async () => {
    setDefaultExtensionBackendWorkerUrl(new URL('file:///configured-worker.js'));
    const client = new ExtensionBackendWorkerClient();

    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;
    worker.emit('message', { id: 1, ok: true });
    await load;

    expect(worker.url.href).toBe('file:///configured-worker.js');
  });

  it('falls back to the built worker path when running from bundled server chunks', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-worker-url-'));
    const workerPath = join(tempRoot, 'packages/desktop/server/dist/extensions/extensionBackendWorker.js');
    mkdirSync(join(tempRoot, 'packages/desktop/server/dist/extensions'), { recursive: true });
    writeFileSync(workerPath, '');
    process.chdir(tempRoot);

    try {
      const client = new ExtensionBackendWorkerClient();
      const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
      const worker = workerThreads.instances[0]!;
      worker.emit('message', { id: 1, ok: true });
      await load;

      expect(worker.url.href).toBe(pathToFileURL(realpathSync(workerPath)).href);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('falls back to the built worker path when cwd is packages/desktop', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-worker-url-'));
    const desktopRoot = join(tempRoot, 'packages/desktop');
    const workerPath = join(desktopRoot, 'server/dist/extensions/extensionBackendWorker.js');
    mkdirSync(join(desktopRoot, 'server/dist/extensions'), { recursive: true });
    writeFileSync(workerPath, '');
    process.chdir(desktopRoot);

    try {
      const client = new ExtensionBackendWorkerClient();
      const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
      const worker = workerThreads.instances[0]!;
      worker.emit('message', { id: 1, ok: true });
      await load;

      expect(worker.url.href).toBe(pathToFileURL(realpathSync(workerPath)).href);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
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
    const run = client.runExport('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'doThing', [{ ok: true }], { context: 'backend' });
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

  it('notifies the worker and host-owned shell handles when a running backend export is aborted', async () => {
    const capabilityDispatcher = vi.fn(async () => ({ ok: true, killed: 1 }));
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js'), capabilityDispatcher });
    const controller = new AbortController();
    const run = client.runExport('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'doThing', [], {
      context: 'backend',
      signal: controller.signal,
    });
    const worker = workerThreads.instances[0]!;

    controller.abort();

    expect(worker.postMessage).toHaveBeenLastCalledWith({ kind: 'abortRequest', requestId: 1 });
    await flushPromises();
    expect(capabilityDispatcher).toHaveBeenCalledWith(
      {
        id: 0,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'abortOwner',
        input: { workerRequestId: 1 },
        context: { workerRequestId: 1 },
      },
      expect.any(Function),
    );
    worker.emit('message', { id: 1, ok: true, result: { aborted: true } });
    await expect(run).resolves.toEqual({ aborted: true });
  });

  it('cancels worker route streams when the host iterator is closed', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });
    const run = client.runExport('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'stream', []);
    const worker = workerThreads.instances[0]!;

    worker.emit('message', {
      id: 1,
      ok: true,
      result: {
        stream: 'sse',
        events: { __extensionWorkerRouteStream: true, handleId: 'route-sse-1' },
      },
    });
    const result = (await run) as { events: AsyncIterable<unknown> };
    const iterator = result.events[Symbol.asyncIterator]();

    const next = iterator.next();
    worker.emit('message', { kind: 'routeStreamEvent', handleId: 'route-sse-1', event: { type: 'tick' } });
    await expect(next).resolves.toEqual({ value: { type: 'tick' }, done: false });

    await expect(iterator.return?.()).resolves.toEqual({ value: undefined, done: true });
    expect(worker.postMessage).toHaveBeenLastCalledWith({ kind: 'routeStreamCancel', handleId: 'route-sse-1' });
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

    expect(capabilityDispatcher).toHaveBeenCalledWith(
      {
        id: 99,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'log',
        operation: 'info',
        input: { message: 'hello' },
      },
      expect.any(Function),
    );
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 99,
      kind: 'capabilityResponse',
      ok: true,
      result: { ok: true },
    });
  });

  it('rejects worker capability requests with forged extension identities', async () => {
    const capabilityDispatcher = vi.fn(async () => ({ ok: true }));
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js'), capabilityDispatcher });

    const load = client.loadModule('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' });
    const worker = workerThreads.instances[0]!;
    worker.emit('message', { id: 1, ok: true });
    await load;

    worker.emit('message', {
      id: 99,
      kind: 'capabilityRequest',
      extensionId: 'system-runs',
      capability: 'telemetry',
      operation: 'readTrace',
      input: { since: '2026-05-22T00:00:00.000Z' },
    });
    await flushPromises();

    expect(capabilityDispatcher).not.toHaveBeenCalled();
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 99,
      kind: 'capabilityResponse',
      ok: false,
      error: 'Extension backend capability request identity mismatch: expected ext.',
    });
  });

  it('lets capability dispatchers emit host capability events back to the worker', async () => {
    const capabilityDispatcher = vi.fn(async (_request, emit) => {
      emit({
        kind: 'capabilityEvent',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'stdout',
        input: { handleId: 'handle-1', chunk: 'hello' },
      });
      return { ok: true };
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
      capability: 'shell',
      operation: 'spawn',
      input: { handleId: 'handle-1', command: 'echo' },
    });
    await flushPromises();

    expect(worker.postMessage).toHaveBeenCalledWith({
      kind: 'capabilityEvent',
      extensionId: 'ext',
      capability: 'shell',
      operation: 'stdout',
      input: { handleId: 'handle-1', chunk: 'hello' },
    });
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 100,
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

  it('returns structured permission dispatcher errors to the worker', async () => {
    const capabilityDispatcher = vi.fn(async () => {
      throw new ExtensionPermissionError('ext', 'documents:read', 'documents.listCollections');
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
      capability: 'documents',
      operation: 'listCollections',
      input: {},
    });
    await flushPromises();

    expect(worker.postMessage).toHaveBeenLastCalledWith({
      id: 100,
      kind: 'capabilityResponse',
      ok: false,
      error: 'Extension "ext" requires permission documents:read to use documents.listCollections.',
      deniedCapability: 'documents:read',
      capabilityContext: 'documents.listCollections',
    });
  });

  it('preserves structured permission metadata from worker export responses', async () => {
    const client = new ExtensionBackendWorkerClient({ workerUrl: new URL('file:///worker.js') });
    const run = client.runExport('ext', { path: '/tmp/backend.mjs', hash: 'hash-1' }, 'doThing', []);
    const worker = workerThreads.instances[0]!;

    worker.emit('message', {
      id: 1,
      ok: false,
      error: 'Extension "ext" requires permission documents:read to use documents.listCollections.',
      deniedCapability: 'documents:read',
      capabilityContext: 'documents.listCollections',
    });

    await expect(run).rejects.toMatchObject({
      message: 'Extension "ext" requires permission documents:read to use documents.listCollections.',
      deniedCapability: 'documents:read',
      capabilityContext: 'documents.listCollections',
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
