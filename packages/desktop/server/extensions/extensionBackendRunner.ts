import { pathToFileURL } from 'node:url';

import { withExtensionProcessGuard } from './extensionProcessGuard.js';

export type ExtensionBackendModule = Record<string, unknown>;

export interface ExtensionBackendLoadTarget {
  path: string;
  hash: string;
}

export interface ExtensionBackendRunner {
  loadModule(extensionId: string, compiled: ExtensionBackendLoadTarget): Promise<ExtensionBackendModule>;
  clearModule(extensionId: string): void;
  run<T>(extensionId: string, operation: string, handler: () => Promise<T> | T): Promise<T>;
}

const backendModuleCache = new Map<string, { cacheKey: string; module: Promise<ExtensionBackendModule> }>();

export function createInProcessExtensionBackendRunner(): ExtensionBackendRunner {
  return {
    loadModule(extensionId, compiled) {
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
    },
    clearModule(extensionId) {
      backendModuleCache.delete(extensionId);
    },
    run(extensionId, operation, handler) {
      return withExtensionProcessGuard(extensionId, operation, () => Promise.resolve(handler()));
    },
  };
}

let extensionBackendRunner: ExtensionBackendRunner = createInProcessExtensionBackendRunner();

export function getExtensionBackendRunner(): ExtensionBackendRunner {
  return extensionBackendRunner;
}

export function setExtensionBackendRunnerForTests(runner: ExtensionBackendRunner | undefined): void {
  extensionBackendRunner = runner ?? createInProcessExtensionBackendRunner();
}
