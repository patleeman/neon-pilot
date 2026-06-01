import { pathToFileURL } from 'node:url';

import { withExtensionProcessGuard } from './extensionProcessGuard.js';

export type ExtensionBackendModule = Record<string, unknown>;

export interface ExtensionBackendLoadTarget {
  path: string;
  hash: string;
}

export type ExtensionBackendOperationType =
  | 'action'
  | 'agent-factory'
  | 'agent-factory-builder'
  | 'protocol'
  | 'route'
  | 'self-test-action'
  | 'service-health-check'
  | 'service-startup'
  | 'subscription';

export interface ExtensionBackendOperation {
  type: ExtensionBackendOperationType;
  label: string;
  target?: string;
}

export interface ExtensionBackendRunner {
  loadModule(extensionId: string, compiled: ExtensionBackendLoadTarget): Promise<ExtensionBackendModule>;
  clearModule(extensionId: string): void;
  run<T>(extensionId: string, operation: ExtensionBackendOperation, handler: () => Promise<T> | T): Promise<T>;
}

export function extensionBackendOperation(
  type: ExtensionBackendOperationType,
  label: string,
  options: { target?: string } = {},
): ExtensionBackendOperation {
  return {
    type,
    label,
    ...(options.target ? { target: options.target } : {}),
  };
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
      return withExtensionProcessGuard(extensionId, operation.label, () => Promise.resolve(handler()));
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
