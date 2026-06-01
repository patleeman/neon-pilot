import { logError, logInfo, logWarn } from '../shared/logging.js';
import type { ExtensionBackendWorkerCapabilityRequest } from './extensionBackendWorkerProtocol.js';
import { deleteExtensionState, listExtensionState, readExtensionState, writeExtensionState } from './extensionStorage.js';

type ExtensionLogLevel = 'info' | 'warn' | 'error';

interface ExtensionBackendCapabilityLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

interface ExtensionBackendCapabilityStorage {
  get(extensionId: string, key: string): unknown;
  put(extensionId: string, key: string, value: unknown, options?: { expectedVersion?: number }): unknown;
  delete(extensionId: string, key: string): unknown;
  list(extensionId: string, prefix?: string): unknown;
}

export type ExtensionBackendCapabilityDispatcher = (request: ExtensionBackendWorkerCapabilityRequest) => Promise<unknown> | unknown;

export interface ExtensionBackendCapabilityDispatcherOptions {
  log?: ExtensionBackendCapabilityLogger;
  storage?: ExtensionBackendCapabilityStorage;
}

function normalizeLogInput(input: unknown): { message: string; fields?: Record<string, unknown> } {
  if (!input || typeof input !== 'object') {
    throw new Error('Log capability input must be an object.');
  }
  const candidate = input as { message?: unknown; fields?: unknown };
  if (typeof candidate.message !== 'string') {
    throw new Error('Log capability input must include a string message.');
  }
  if (candidate.fields !== undefined && (!candidate.fields || typeof candidate.fields !== 'object' || Array.isArray(candidate.fields))) {
    throw new Error('Log capability fields must be an object when provided.');
  }
  return {
    message: candidate.message,
    ...(candidate.fields ? { fields: candidate.fields as Record<string, unknown> } : {}),
  };
}

function dispatchLogCapability(
  logger: ExtensionBackendCapabilityLogger,
  request: ExtensionBackendWorkerCapabilityRequest,
): undefined {
  if (request.operation !== 'info' && request.operation !== 'warn' && request.operation !== 'error') {
    throw new Error(`Unsupported log capability operation: ${request.operation}`);
  }
  const level = request.operation as ExtensionLogLevel;
  const { message, fields } = normalizeLogInput(request.input);
  logger[level](`extension:${request.extensionId} ${message}`, fields);
  return undefined;
}

function normalizeRecordInput(input: unknown, capability: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${capability} capability input must be an object.`);
  }
  return input as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function dispatchStorageCapability(
  storage: ExtensionBackendCapabilityStorage,
  request: ExtensionBackendWorkerCapabilityRequest,
): unknown {
  const input = normalizeRecordInput(request.input, 'Storage');

  if (request.operation === 'get') {
    return storage.get(request.extensionId, requireString(input.key, 'Storage key'));
  }

  if (request.operation === 'put') {
    const key = requireString(input.key, 'Storage key');
    const expectedVersion = input.expectedVersion;
    if (expectedVersion !== undefined && typeof expectedVersion !== 'number') {
      throw new Error('Storage expectedVersion must be a number when provided.');
    }
    return storage.put(request.extensionId, key, input.value, expectedVersion === undefined ? undefined : { expectedVersion });
  }

  if (request.operation === 'delete') {
    return storage.delete(request.extensionId, requireString(input.key, 'Storage key'));
  }

  if (request.operation === 'list') {
    const prefix = input.prefix;
    if (prefix !== undefined && typeof prefix !== 'string') {
      throw new Error('Storage prefix must be a string when provided.');
    }
    return storage.list(request.extensionId, prefix);
  }

  throw new Error(`Unsupported storage capability operation: ${request.operation}`);
}

export function createExtensionBackendCapabilityDispatcher(
  options: ExtensionBackendCapabilityDispatcherOptions = {},
): ExtensionBackendCapabilityDispatcher {
  const logger = options.log ?? { info: logInfo, warn: logWarn, error: logError };
  const storage = options.storage ?? {
    get: (extensionId: string, key: string) => readExtensionState(extensionId, key)?.value ?? null,
    put: (extensionId: string, key: string, value: unknown, storageOptions?: { expectedVersion?: number }) => {
      writeExtensionState(extensionId, key, value, storageOptions ? { expectedVersion: storageOptions.expectedVersion } : {});
      return { ok: true };
    },
    delete: (extensionId: string, key: string) => deleteExtensionState(extensionId, key),
    list: (extensionId: string, prefix = '') =>
      listExtensionState(extensionId, prefix).map((document) => ({ key: document.key, value: document.value })),
  };
  return (request) => {
    if (request.capability === 'log') {
      return dispatchLogCapability(logger, request);
    }
    if (request.capability === 'storage') {
      return dispatchStorageCapability(storage, request);
    }
    throw new Error(`Unsupported extension backend capability: ${request.capability}`);
  };
}
