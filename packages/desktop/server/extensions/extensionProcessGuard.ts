import { AsyncLocalStorage } from 'node:async_hooks';

interface ExtensionProcessGuardContext {
  extensionId: string;
  operation: string;
}

const guardContext = new AsyncLocalStorage<ExtensionProcessGuardContext>();
let installed = false;

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
