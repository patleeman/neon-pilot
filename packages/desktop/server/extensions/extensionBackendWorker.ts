import { pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';

import type { ExtensionBackendModule } from './extensionBackendRunner.js';
import type { ExtensionBackendWorkerRequest, ExtensionBackendWorkerResponse } from './extensionBackendWorkerProtocol.js';
import { withExtensionProcessGuard } from './extensionProcessGuard.js';

const backendModuleCache = new Map<string, { cacheKey: string; module: Promise<ExtensionBackendModule> }>();

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

parentPort.on('message', (request: ExtensionBackendWorkerRequest) => {
  void handleRequest(request).then((response) => {
    parentPort!.postMessage(response);
  });
});
