import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

import { init, parse } from 'es-module-lexer';

interface ExtensionProcessGuardContext {
  extensionId: string;
  operation: string;
}

const guardContext = new AsyncLocalStorage<ExtensionProcessGuardContext>();
let installed = false;

export const forbiddenExtensionBackendNativeImports = new Set([
  'child_process',
  'node:child_process',
  'cluster',
  'node:cluster',
  'worker_threads',
  'node:worker_threads',
]);

export class ExtensionProcessTerminationBlockedError extends Error {
  readonly extensionId: string;
  readonly operation: string;
  readonly api: string;

  constructor(context: ExtensionProcessGuardContext, api: string) {
    super(`Extension "${context.extensionId}" attempted to terminate the application via ${api} during ${context.operation}.`);
    this.name = 'ExtensionProcessTerminationBlockedError';
    this.extensionId = context.extensionId;
    this.operation = context.operation;
    this.api = api;
  }
}

export class ExtensionBackendNativeImportBlockedError extends Error {
  readonly extensionId: string;
  readonly operation: string;
  readonly specifier: string;
  readonly path: string;

  constructor(context: ExtensionProcessGuardContext, specifier: string, path: string) {
    super(`Extension "${context.extensionId}" attempted to import forbidden native module "${specifier}" during ${context.operation}.`);
    this.name = 'ExtensionBackendNativeImportBlockedError';
    this.extensionId = context.extensionId;
    this.operation = context.operation;
    this.specifier = specifier;
    this.path = path;
  }
}

function blockIfExtensionContext(api: string): void {
  const context = guardContext.getStore();
  if (context) {
    throw new ExtensionProcessTerminationBlockedError(context, api);
  }
}

function patchProcessTerminationApis(): void {
  if (installed) return;
  installed = true;

  const originalExit = process.exit.bind(process);
  const originalAbort = process.abort.bind(process);
  const originalKill = process.kill.bind(process);

  process.exit = ((code?: string | number | null | undefined): never => {
    blockIfExtensionContext('process.exit');
    return originalExit(code as never);
  }) as typeof process.exit;

  process.abort = (() => {
    blockIfExtensionContext('process.abort');
    return originalAbort();
  }) as typeof process.abort;

  process.kill = ((pid: number, signal?: NodeJS.Signals | number | 0): boolean => {
    const context = guardContext.getStore();
    if (context && pid === process.pid) {
      throw new ExtensionProcessTerminationBlockedError(context, 'process.kill(process.pid)');
    }
    return originalKill(pid, signal as never);
  }) as typeof process.kill;
}

export async function withExtensionProcessGuard<T>(extensionId: string, operation: string, fn: () => Promise<T>): Promise<T> {
  patchProcessTerminationApis();
  return guardContext.run({ extensionId, operation }, fn);
}

export async function assertExtensionBackendNativeImportsAllowed(extensionId: string, operation: string, entryPath: string): Promise<void> {
  await init;
  const context = { extensionId, operation };
  const pending = [resolve(entryPath)];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const currentPath = pending.pop()!;
    if (visited.has(currentPath) || !existsSync(currentPath)) continue;
    visited.add(currentPath);

    const source = readFileSync(currentPath, 'utf8');
    const [imports] = parse(source);
    for (const importRecord of imports) {
      const specifier = importRecord.n;
      if (!specifier) continue;
      if (forbiddenExtensionBackendNativeImports.has(specifier)) {
        throw new ExtensionBackendNativeImportBlockedError(context, specifier, currentPath);
      }
      const childPath = resolveRelativeModuleSpecifier(currentPath, specifier);
      if (childPath) pending.push(childPath);
    }
  }
}

function resolveRelativeModuleSpecifier(fromPath: string, specifier: string): string | undefined {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return undefined;
  const resolved = resolve(dirname(fromPath), specifier);
  if (extname(resolved)) return resolved;
  for (const extension of ['.mjs', '.js', '.cjs']) {
    const candidate = `${resolved}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
