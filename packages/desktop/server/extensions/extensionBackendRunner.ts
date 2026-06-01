import { pathToFileURL } from 'node:url';

import { recordExtensionHostAuditEvent } from './extensionHostAudit.js';
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
  | 'backend-import'
  | 'protocol'
  | 'route'
  | 'self-test-action'
  | 'service-health-check'
  | 'service-startup'
  | 'subscription';

export interface ExtensionBackendOperation {
  type: ExtensionBackendOperationType;
  label: string;
  exportName?: string;
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
  options: { exportName?: string; target?: string } = {},
): ExtensionBackendOperation {
  return {
    type,
    label,
    ...(options.exportName ? { exportName: options.exportName } : {}),
    ...(options.target ? { target: options.target } : {}),
  };
}

const backendModuleCache = new Map<string, { cacheKey: string; module: Promise<ExtensionBackendModule> }>();

async function auditBackendOperation<T>(extensionId: string, operation: ExtensionBackendOperation, handler: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await handler();
    recordExtensionHostAuditEvent({
      requestType: 'backend',
      requestName: `${extensionId}:${operation.label}`,
      ok: true,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    recordExtensionHostAuditEvent({
      requestType: 'backend',
      requestName: `${extensionId}:${operation.label}`,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function createInProcessExtensionBackendRunner(): ExtensionBackendRunner {
  return {
    loadModule(extensionId, compiled) {
      const cacheKey = `${compiled.path}:${compiled.hash}`;
      const cached = backendModuleCache.get(extensionId);
      if (cached?.cacheKey === cacheKey) {
        return cached.module;
      }

      const module = auditBackendOperation(
        extensionId,
        extensionBackendOperation('backend-import', 'backend import', { target: compiled.path }),
        () =>
          withExtensionProcessGuard(
            extensionId,
            'backend import',
            () => import(`${pathToFileURL(compiled.path).href}?v=${encodeURIComponent(compiled.hash)}`) as Promise<ExtensionBackendModule>,
          ),
      );
      backendModuleCache.set(extensionId, { cacheKey, module });
      return module;
    },
    clearModule(extensionId) {
      backendModuleCache.delete(extensionId);
    },
    run(extensionId, operation, handler) {
      return auditBackendOperation(extensionId, operation, () =>
        withExtensionProcessGuard(extensionId, operation.label, () => Promise.resolve(handler())),
      );
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
