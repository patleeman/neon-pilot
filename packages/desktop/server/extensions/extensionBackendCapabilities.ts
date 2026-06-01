import { logError, logInfo, logWarn } from '../shared/logging.js';
import type { ExtensionBackendWorkerCapabilityRequest } from './extensionBackendWorkerProtocol.js';

type ExtensionLogLevel = 'info' | 'warn' | 'error';

interface ExtensionBackendCapabilityLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export type ExtensionBackendCapabilityDispatcher = (request: ExtensionBackendWorkerCapabilityRequest) => Promise<unknown> | unknown;

export interface ExtensionBackendCapabilityDispatcherOptions {
  log?: ExtensionBackendCapabilityLogger;
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

export function createExtensionBackendCapabilityDispatcher(
  options: ExtensionBackendCapabilityDispatcherOptions = {},
): ExtensionBackendCapabilityDispatcher {
  const logger = options.log ?? { info: logInfo, warn: logWarn, error: logError };
  return (request) => {
    if (request.capability === 'log') {
      return dispatchLogCapability(logger, request);
    }
    throw new Error(`Unsupported extension backend capability: ${request.capability}`);
  };
}
