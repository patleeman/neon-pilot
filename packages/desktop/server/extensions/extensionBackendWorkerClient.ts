import { Worker } from 'node:worker_threads';

import type { ExtensionBackendLoadTarget } from './extensionBackendRunner.js';
import type { ExtensionBackendWorkerRequest, ExtensionBackendWorkerResponse } from './extensionBackendWorkerProtocol.js';

interface PendingRequest {
  resolve: (response: ExtensionBackendWorkerResponse & { ok: true }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface ExtensionBackendWorkerClientOptions {
  workerUrl?: URL;
  timeoutMs?: number;
}

export class ExtensionBackendWorkerClient {
  private worker: Worker | undefined;
  private workerError: Error | undefined;
  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(private readonly options: ExtensionBackendWorkerClientOptions = {}) {}

  async loadModule(extensionId: string, compiled: ExtensionBackendLoadTarget): Promise<void> {
    await this.send({ id: 0, type: 'loadModule', extensionId, compiled });
  }

  async hasExport(extensionId: string, compiled: ExtensionBackendLoadTarget, exportName: string): Promise<boolean> {
    const response = await this.send({ id: 0, type: 'hasExport', extensionId, compiled, exportName });
    return response.result === true;
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
    const worker = new Worker(this.options.workerUrl ?? new URL('./extensionBackendWorker.js', import.meta.url), { execArgv: [] });
    worker.on('message', (response: ExtensionBackendWorkerResponse) => this.handleMessage(response));
    worker.on('error', (error) => this.handleError(error));
    worker.on('exit', (code) => this.handleExit(code));
    this.worker = worker;
    return worker;
  }

  private send(request: ExtensionBackendWorkerRequest): Promise<ExtensionBackendWorkerResponse & { ok: true }> {
    const worker = this.ensureWorker();
    const id = ++this.nextRequestId;
    const outbound = { ...request, id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Extension backend worker ${request.type} timed out.`));
      }, this.options.timeoutMs ?? 30_000);

      this.pending.set(id, { resolve, reject, timeout });
      try {
        worker.postMessage(outbound);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(response: ExtensionBackendWorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    clearTimeout(pending.timeout);

    if (response.ok) pending.resolve(response);
    else pending.reject(new Error(response.error));
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
      pending.reject(error);
    }
    this.pending.clear();
  }
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
