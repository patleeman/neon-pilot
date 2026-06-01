import { pathToFileURL } from 'node:url';

import { recordExtensionHostAuditEvent } from './extensionHostAudit.js';
import { withExtensionProcessGuard } from './extensionProcessGuard.js';

export type ExtensionBackendModule = Record<string, unknown>;
export type ExtensionBackendFunction = (...args: unknown[]) => unknown;

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
  hasExport(extensionId: string, compiled: ExtensionBackendLoadTarget, exportName: string): Promise<boolean>;
  loadAgentFactory(extensionId: string, compiled: ExtensionBackendLoadTarget, exportName: string): Promise<ExtensionBackendFunction>;
  runExport<T>(
    extensionId: string,
    compiled: ExtensionBackendLoadTarget,
    exportName: string,
    operation: ExtensionBackendOperation,
    invoke: (handler: (...args: unknown[]) => unknown) => Promise<T> | T,
  ): Promise<T>;
  run<T>(extensionId: string, operation: ExtensionBackendOperation, handler: () => Promise<T> | T): Promise<T>;
}

export class ExtensionBackendExportNotFoundError extends Error {
  constructor(readonly exportName: string) {
    super(`Extension backend export not found: ${exportName}`);
    this.name = 'ExtensionBackendExportNotFoundError';
  }
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

export function serializeExtensionBackendOperation(operation: ExtensionBackendOperation): ExtensionBackendOperation {
  return {
    type: operation.type,
    label: operation.label,
    ...(operation.exportName ? { exportName: operation.exportName } : {}),
    ...(operation.target ? { target: operation.target } : {}),
  };
}

const backendModuleCache = new Map<string, { cacheKey: string; module: Promise<ExtensionBackendModule> }>();

async function auditBackendOperation<T>(extensionId: string, operation: ExtensionBackendOperation, handler: () => Promise<T>): Promise<T> {
  const serializedOperation = serializeExtensionBackendOperation(operation);
  const started = Date.now();
  try {
    const result = await handler();
    recordExtensionHostAuditEvent({
      requestType: 'backend',
      requestName: `${extensionId}:${serializedOperation.label}`,
      ok: true,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    recordExtensionHostAuditEvent({
      requestType: 'backend',
      requestName: `${extensionId}:${serializedOperation.label}`,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function createInProcessExtensionBackendRunner(): ExtensionBackendRunner {
  const runner: ExtensionBackendRunner = {
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
    async hasExport(extensionId, compiled, exportName) {
      const backend = await runner.loadModule(extensionId, compiled);
      return typeof backend[exportName] === 'function';
    },
    async loadAgentFactory(extensionId, compiled, exportName) {
      const backend = await runner.loadModule(extensionId, compiled);
      const candidate = exportName === 'default' ? backend.default : backend[exportName];
      if (typeof candidate !== 'function') {
        throw new ExtensionBackendExportNotFoundError(exportName);
      }

      if (candidate.length === 0) {
        const built = await runner.run(
          extensionId,
          extensionBackendOperation('agent-factory-builder', 'agent extension factory builder', { exportName, target: exportName }),
          () => (candidate as () => unknown)(),
        );
        if (typeof built !== 'function') {
          throw new Error(`Extension agent factory builder did not return a function: ${exportName}`);
        }
        return built as ExtensionBackendFunction;
      }

      return candidate as ExtensionBackendFunction;
    },
    async runExport(extensionId, compiled, exportName, operation, invoke) {
      const backend = await runner.loadModule(extensionId, compiled);
      const handler = backend[exportName];
      if (typeof handler !== 'function') {
        throw new ExtensionBackendExportNotFoundError(exportName);
      }
      return runner.run(extensionId, { ...operation, exportName: operation.exportName ?? exportName }, () =>
        invoke(handler as (...args: unknown[]) => unknown),
      );
    },
    run(extensionId, operation, handler) {
      return auditBackendOperation(extensionId, operation, () =>
        withExtensionProcessGuard(extensionId, operation.label, () => Promise.resolve(handler())),
      );
    },
  };
  return runner;
}

let extensionBackendRunner: ExtensionBackendRunner = createInProcessExtensionBackendRunner();

export function getExtensionBackendRunner(): ExtensionBackendRunner {
  return extensionBackendRunner;
}

export function setExtensionBackendRunnerForTests(runner: ExtensionBackendRunner | undefined): void {
  extensionBackendRunner = runner ?? createInProcessExtensionBackendRunner();
}
