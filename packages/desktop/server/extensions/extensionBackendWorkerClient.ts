import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

import type { ExtensionBackendLoadTarget } from './extensionBackendRunner.js';
import type {
  ExtensionBackendWorkerBackendContextOptions,
  ExtensionBackendWorkerCapabilityEvent,
  ExtensionBackendWorkerCapabilityRequest,
  ExtensionBackendWorkerCapabilityResponse,
  ExtensionBackendWorkerMessage,
  ExtensionBackendWorkerRequest,
  ExtensionBackendWorkerResponse,
  ExtensionBackendWorkerRouteStreamEvent,
} from './extensionBackendWorkerProtocol.js';

interface PendingRequest {
  resolve: (response: ExtensionBackendWorkerResponse & { ok: true }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  cleanup?: () => void;
}

export interface ExtensionBackendWorkerClientOptions {
  workerUrl?: URL;
  timeoutMs?: number;
  capabilityDispatcher?: (
    request: ExtensionBackendWorkerCapabilityRequest,
    emit: (event: ExtensionBackendWorkerCapabilityEvent) => void,
  ) => Promise<unknown> | unknown;
}

const EXTENSION_BACKEND_WORKER_URL_GLOBAL = Symbol.for('neon-pilot.extensionBackendWorkerUrl');

type ExtensionBackendWorkerUrlGlobal = typeof globalThis & {
  [EXTENSION_BACKEND_WORKER_URL_GLOBAL]?: URL;
};

export function setDefaultExtensionBackendWorkerUrl(workerUrl: URL | undefined): void {
  if (workerUrl) {
    (globalThis as ExtensionBackendWorkerUrlGlobal)[EXTENSION_BACKEND_WORKER_URL_GLOBAL] = workerUrl;
  } else {
    delete (globalThis as ExtensionBackendWorkerUrlGlobal)[EXTENSION_BACKEND_WORKER_URL_GLOBAL];
  }
}

function getDefaultExtensionBackendWorkerUrl(): URL {
  const configured = (globalThis as ExtensionBackendWorkerUrlGlobal)[EXTENSION_BACKEND_WORKER_URL_GLOBAL];
  if (configured) return configured;

  const candidates = [
    pathToFileURL(join(process.cwd(), 'server/dist/extensions/extensionBackendWorker.js')),
    pathToFileURL(join(process.cwd(), 'packages/desktop/server/dist/extensions/extensionBackendWorker.js')),
    new URL('./extensionBackendWorker.js', import.meta.url),
    new URL('../extensions/extensionBackendWorker.js', import.meta.url),
  ];
  return candidates.find((candidate) => existsSync(fileURLToPath(candidate))) ?? candidates[0]!;
}

export class ExtensionBackendWorkerClient {
  private worker: Worker | undefined;
  private workerError: Error | undefined;
  private boundExtensionId: string | undefined;
  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly routeStreams = new Map<string, RouteStreamState>();

  constructor(private readonly options: ExtensionBackendWorkerClientOptions = {}) {}

  async loadModule(extensionId: string, compiled: ExtensionBackendLoadTarget): Promise<void> {
    await this.send({ id: 0, type: 'loadModule', extensionId, compiled });
  }

  async hasExport(extensionId: string, compiled: ExtensionBackendLoadTarget, exportName: string): Promise<boolean> {
    const response = await this.send({ id: 0, type: 'hasExport', extensionId, compiled, exportName });
    return response.result === true;
  }

  async runExport(
    extensionId: string,
    compiled: ExtensionBackendLoadTarget,
    exportName: string,
    args: unknown[],
    options: {
      timeoutMs?: number;
      signal?: AbortSignal;
      context?: 'backend' | ({ type: 'backend' } & ExtensionBackendWorkerBackendContextOptions);
    } = {},
  ): Promise<unknown> {
    const { signal, ...requestOptions } = options;
    const response = await this.send({ id: 0, type: 'runExport', extensionId, compiled, exportName, args, ...requestOptions }, { signal });
    return this.deserializeWorkerResult(response.result);
  }

  async clearModule(extensionId: string): Promise<void> {
    await this.send({ id: 0, type: 'clearModule', extensionId });
  }

  async dispose(): Promise<void> {
    const worker = this.worker;
    this.worker = undefined;
    this.rejectAll(new Error('Extension backend worker disposed.'));
    await worker?.terminate();
  }

  private ensureWorker(): Worker {
    if (this.workerError && this.worker) {
      throw new Error(`Extension backend worker is unavailable: ${this.workerError.message}`);
    }
    if (this.worker) {
      return this.worker;
    }

    this.workerError = undefined;
    const worker = new Worker(this.options.workerUrl ?? getDefaultExtensionBackendWorkerUrl(), { execArgv: [] });
    worker.on('message', (message: ExtensionBackendWorkerMessage) => this.handleMessage(message));
    worker.on('error', (error) => this.handleError(error));
    worker.on('exit', (code) => this.handleExit(code));
    this.worker = worker;
    return worker;
  }

  private send(
    request: ExtensionBackendWorkerRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<ExtensionBackendWorkerResponse & { ok: true }> {
    const worker = this.ensureWorker();
    this.bindExtensionId(request.extensionId);
    const id = ++this.nextRequestId;
    const outbound = { ...request, id };
    const signal = options.signal;

    return new Promise((resolve, reject) => {
      const abortListener = () => {
        worker.postMessage({ kind: 'abortRequest', requestId: id });
        if (this.options.capabilityDispatcher) {
          void Promise.resolve(
            this.options.capabilityDispatcher(
              {
                id: 0,
                kind: 'capabilityRequest',
                extensionId: request.extensionId,
                capability: 'shell',
                operation: 'abortOwner',
                input: { workerRequestId: id },
                context: { workerRequestId: id },
              },
              (event) => this.worker?.postMessage(event),
            ),
          ).catch(() => undefined);
        }
      };
      const cleanup = () => {
        signal?.removeEventListener('abort', abortListener);
      };
      const timeout = setTimeout(
        () => {
          this.pending.delete(id);
          cleanup();
          reject(new Error(`Extension backend worker ${request.type} timed out.`));
        },
        ('timeoutMs' in request && request.timeoutMs ? request.timeoutMs : undefined) ?? this.options.timeoutMs ?? 30_000,
      );

      signal?.addEventListener('abort', abortListener, { once: true });
      this.pending.set(id, { resolve, reject, timeout, cleanup });
      try {
        worker.postMessage(outbound);
        if (signal?.aborted) abortListener();
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(message: ExtensionBackendWorkerMessage): void {
    if ('kind' in message && message.kind === 'capabilityRequest') {
      void this.handleCapabilityRequest(message);
      return;
    }
    if ('kind' in message && message.kind === 'routeStreamEvent') {
      this.handleRouteStreamEvent(message);
      return;
    }

    if (!('ok' in message)) return;
    const response = message;
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    clearTimeout(pending.timeout);
    pending.cleanup?.();

    if (response.ok) pending.resolve(response);
    else pending.reject(new Error(response.error));
  }

  private async handleCapabilityRequest(request: ExtensionBackendWorkerCapabilityRequest): Promise<void> {
    const response = await this.dispatchCapabilityRequest(request);
    this.worker?.postMessage(response);
  }

  private async dispatchCapabilityRequest(
    request: ExtensionBackendWorkerCapabilityRequest,
  ): Promise<ExtensionBackendWorkerCapabilityResponse> {
    try {
      if (this.boundExtensionId !== request.extensionId) {
        throw new Error(`Extension backend capability request identity mismatch: expected ${this.boundExtensionId ?? 'none'}.`);
      }
      if (!this.options.capabilityDispatcher) {
        throw new Error('No extension backend capability dispatcher configured.');
      }
      const result = await this.options.capabilityDispatcher(request, (event) => this.worker?.postMessage(event));
      return { id: request.id, kind: 'capabilityResponse', ok: true, result };
    } catch (error) {
      return {
        id: request.id,
        kind: 'capabilityResponse',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private bindExtensionId(extensionId: string): void {
    if (!this.boundExtensionId) {
      this.boundExtensionId = extensionId;
      return;
    }
    if (this.boundExtensionId !== extensionId) {
      throw new Error(`Extension backend worker client is bound to ${this.boundExtensionId}, not ${extensionId}.`);
    }
  }

  private handleError(error: Error): void {
    this.workerError = error;
    this.rejectAll(error);
  }

  private handleExit(code: number): void {
    if (code !== 0 && this.worker) {
      const error = this.workerError ?? new Error(`Extension backend worker exited unexpectedly (code ${String(code)}).`);
      this.workerError = error;
      this.rejectAll(error);
    }
    this.worker = undefined;
  }

  private rejectAll(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.cleanup?.();
      pending.reject(error);
    }
    this.pending.clear();
    for (const [handleId, stream] of this.routeStreams) {
      this.routeStreams.delete(handleId);
      stream.error = error;
      stream.resolve?.();
    }
  }

  private deserializeWorkerResult(result: unknown): unknown {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
    const candidate = result as { stream?: unknown; events?: unknown };
    if (candidate.stream !== 'sse' || !candidate.events || typeof candidate.events !== 'object') return result;
    const eventMarker = candidate.events as { __extensionWorkerRouteStream?: unknown; handleId?: unknown };
    if (eventMarker.__extensionWorkerRouteStream !== true || typeof eventMarker.handleId !== 'string') return result;
    return {
      ...(result as Record<string, unknown>),
      events: this.createRouteStreamIterable(eventMarker.handleId),
    };
  }

  private createRouteStreamIterable(handleId: string): AsyncIterable<unknown> {
    const stream: RouteStreamState = { queue: [] };
    this.routeStreams.set(handleId, stream);
    const close = () => {
      if (stream.closed) return;
      stream.closed = true;
      stream.done = true;
      this.routeStreams.delete(handleId);
      this.worker?.postMessage({ kind: 'routeStreamCancel', handleId });
      stream.resolve?.();
    };
    return {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          for (;;) {
            if (stream.queue.length > 0) return { value: stream.queue.shift(), done: false };
            if (stream.error) throw stream.error;
            if (stream.done) {
              this.routeStreams.delete(handleId);
              return { value: undefined, done: true };
            }
            await new Promise<void>((resolve) => {
              stream.resolve = resolve;
            });
            stream.resolve = undefined;
          }
        },
        return: async () => {
          close();
          return { value: undefined, done: true };
        },
      }),
    };
  }

  private handleRouteStreamEvent(event: ExtensionBackendWorkerRouteStreamEvent): void {
    const stream = this.routeStreams.get(event.handleId);
    if (!stream) return;
    if ('event' in event) {
      stream.queue.push(event.event);
    } else if ('error' in event) {
      stream.error = new Error(event.error);
    } else {
      stream.done = true;
    }
    stream.resolve?.();
  }
}

interface RouteStreamState {
  queue: unknown[];
  done?: boolean;
  error?: Error;
  closed?: boolean;
  resolve?: () => void;
}

export class ExtensionBackendWorkerPool {
  private readonly clients = new Map<string, ExtensionBackendWorkerClient>();

  constructor(private readonly options: ExtensionBackendWorkerClientOptions = {}) {}

  async loadModule(extensionId: string, compiled: ExtensionBackendLoadTarget): Promise<void> {
    await this.getClient(extensionId).loadModule(extensionId, compiled);
  }

  async hasExport(extensionId: string, compiled: ExtensionBackendLoadTarget, exportName: string): Promise<boolean> {
    return this.getClient(extensionId).hasExport(extensionId, compiled, exportName);
  }

  async runExport(
    extensionId: string,
    compiled: ExtensionBackendLoadTarget,
    exportName: string,
    args: unknown[],
    options: {
      timeoutMs?: number;
      signal?: AbortSignal;
      context?: 'backend' | ({ type: 'backend' } & ExtensionBackendWorkerBackendContextOptions);
    } = {},
  ): Promise<unknown> {
    return this.getClient(extensionId).runExport(extensionId, compiled, exportName, args, options);
  }

  async clearModule(extensionId: string): Promise<void> {
    await this.getClient(extensionId).clearModule(extensionId);
  }

  async disposeExtension(extensionId: string): Promise<void> {
    const client = this.clients.get(extensionId);
    if (!client) return;
    this.clients.delete(extensionId);
    await client.dispose();
  }

  async dispose(): Promise<void> {
    const clients = [...this.clients.values()];
    this.clients.clear();
    await Promise.all(clients.map((client) => client.dispose()));
  }

  private getClient(extensionId: string): ExtensionBackendWorkerClient {
    let client = this.clients.get(extensionId);
    if (!client) {
      client = new ExtensionBackendWorkerClient(this.options);
      this.clients.set(extensionId, client);
    }
    return client;
  }
}
