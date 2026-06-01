import { pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';

import type { ExtensionBackendModule } from './extensionBackendRunner.js';
import type {
  ExtensionBackendWorkerBackendContextOptions,
  ExtensionBackendWorkerCapabilityResponse,
  ExtensionBackendWorkerParentMessage,
  ExtensionBackendWorkerRequest,
  ExtensionBackendWorkerResponse,
} from './extensionBackendWorkerProtocol.js';
import { withExtensionProcessGuard } from './extensionProcessGuard.js';

const backendModuleCache = new Map<string, { cacheKey: string; module: Promise<ExtensionBackendModule> }>();
const pendingCapabilities = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
let nextCapabilityRequestId = 0;

if (!parentPort) {
  throw new Error('extensionBackendWorker must run as a worker thread.');
}

function loadModule(extensionId: string, compiled: { path: string; hash: string }): Promise<ExtensionBackendModule> {
  const cacheKey = `${compiled.path}:${compiled.hash}`;
  const cached = backendModuleCache.get(extensionId);
  if (cached?.cacheKey === cacheKey) {
    return cached.module;
  }

  const module = withExtensionProcessGuard(
    extensionId,
    'backend import',
    () => import(`${pathToFileURL(compiled.path).href}?v=${encodeURIComponent(compiled.hash)}`) as Promise<ExtensionBackendModule>,
  );
  backendModuleCache.set(extensionId, { cacheKey, module });
  return module;
}

function callHostCapability(extensionId: string, capability: string, operation: string, input?: unknown): Promise<unknown> {
  const id = ++nextCapabilityRequestId;
  return new Promise((resolve, reject) => {
    pendingCapabilities.set(id, { resolve, reject });
    parentPort!.postMessage({ id, kind: 'capabilityRequest', extensionId, capability, operation, input });
  });
}

function handleCapabilityResponse(response: ExtensionBackendWorkerCapabilityResponse): void {
  const pending = pendingCapabilities.get(response.id);
  if (!pending) return;
  pendingCapabilities.delete(response.id);

  if (response.ok) pending.resolve(response.result);
  else pending.reject(new Error(response.error));
}

function createWorkerBackendContext(extensionId: string, options: ExtensionBackendWorkerBackendContextOptions = {}): Record<string, unknown> {
  const runtimeScope = options.runtimeScope ?? 'shared';
  return {
    extensionId,
    runtimeScope,
    profile: runtimeScope,
    ...(options.toolContext ? { toolContext: options.toolContext } : {}),
    log: {
      info: (message: string, fields?: Record<string, unknown>) => callHostCapability(extensionId, 'log', 'info', { message, fields }),
      warn: (message: string, fields?: Record<string, unknown>) => callHostCapability(extensionId, 'log', 'warn', { message, fields }),
      error: (message: string, fields?: Record<string, unknown>) => callHostCapability(extensionId, 'log', 'error', { message, fields }),
    },
    storage: {
      get: (key: string) => callHostCapability(extensionId, 'storage', 'get', { key }),
      put: (key: string, value: unknown, options?: { expectedVersion?: number }) =>
        callHostCapability(extensionId, 'storage', 'put', { key, value, expectedVersion: options?.expectedVersion }),
      delete: (key: string) => callHostCapability(extensionId, 'storage', 'delete', { key }),
      list: (prefix?: string) => callHostCapability(extensionId, 'storage', 'list', { prefix }),
    },
    shell: {
      exec: (input: unknown) => callHostCapability(extensionId, 'shell', 'exec', input),
    },
    ui: {
      invalidate: (topics: string | string[]) => callHostCapability(extensionId, 'ui', 'invalidate', { topics }),
    },
  };
}

async function handleRequest(request: ExtensionBackendWorkerRequest): Promise<ExtensionBackendWorkerResponse> {
  try {
    if (request.type === 'loadModule') {
      await loadModule(request.extensionId, request.compiled);
      return { id: request.id, ok: true };
    }

    if (request.type === 'hasExport') {
      const backend = await loadModule(request.extensionId, request.compiled);
      return { id: request.id, ok: true, result: typeof backend[request.exportName] === 'function' };
    }

    if (request.type === 'runExport') {
      const backend = await loadModule(request.extensionId, request.compiled);
      const handler = backend[request.exportName];
      if (typeof handler !== 'function') {
        throw new Error(`Extension backend export not found: ${request.exportName}`);
      }
      const contextOptions = typeof request.context === 'object' ? request.context : undefined;
      const args = request.context ? [...request.args, createWorkerBackendContext(request.extensionId, contextOptions)] : request.args;
      const result = await (handler as (...args: unknown[]) => unknown)(...args);
      return { id: request.id, ok: true, result };
    }

    if (request.type === 'clearModule') {
      backendModuleCache.delete(request.extensionId);
      return { id: request.id, ok: true };
    }

    const _exhaustive: never = request;
    return _exhaustive;
  } catch (error) {
    return { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

parentPort.on('message', (message: ExtensionBackendWorkerParentMessage) => {
  if ('kind' in message && message.kind === 'capabilityResponse') {
    handleCapabilityResponse(message);
    return;
  }

  if (!('type' in message)) return;
  const request = message;
  void handleRequest(request).then((response) => {
    parentPort!.postMessage(response);
  });
});
