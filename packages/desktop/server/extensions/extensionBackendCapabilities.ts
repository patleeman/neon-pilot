import { resolveSecret } from '../secrets/secretStore.js';
import { type AppEventTopic, invalidateAppTopics } from '../shared/appEvents.js';
import { logError, logInfo, logWarn } from '../shared/logging.js';
import type { ExtensionBackendWorkerCapabilityRequest } from './extensionBackendWorkerProtocol.js';
import { createExtensionGitCapability, createExtensionShellCapability } from './extensionShell.js';
import { deleteExtensionState, listExtensionState, readExtensionState, writeExtensionState } from './extensionStorage.js';

type ExtensionLogLevel = 'info' | 'warn' | 'error';

interface ExtensionBackendCapabilityLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

interface ExtensionBackendCapabilityGit {
  status(input: { cwd: string }): Promise<unknown> | unknown;
  diff(input: { cwd: string; path?: string; staged?: boolean }): Promise<unknown> | unknown;
  log(input: { cwd: string; maxCount?: number }): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilityStorage {
  get(extensionId: string, key: string): unknown;
  put(extensionId: string, key: string, value: unknown, options?: { expectedVersion?: number }): unknown;
  delete(extensionId: string, key: string): unknown;
  list(extensionId: string, prefix?: string): unknown;
}

interface ExtensionBackendCapabilityShell {
  exec(input: {
    command: string;
    args?: string[];
    cwd?: string;
    timeoutMs?: number;
    maxBuffer?: number;
    env?: Record<string, string>;
  }): Promise<unknown> | unknown;
}

interface ExtensionBackendCapabilitySecrets {
  get(extensionId: string, secretId: string): string | undefined;
}

interface ExtensionBackendCapabilityUi {
  invalidate(topics: string | string[]): unknown;
}

export type ExtensionBackendCapabilityDispatcher = (request: ExtensionBackendWorkerCapabilityRequest) => Promise<unknown> | unknown;

export interface ExtensionBackendCapabilityDispatcherOptions {
  git?: ExtensionBackendCapabilityGit;
  log?: ExtensionBackendCapabilityLogger;
  secrets?: ExtensionBackendCapabilitySecrets;
  shell?: ExtensionBackendCapabilityShell;
  storage?: ExtensionBackendCapabilityStorage;
  ui?: ExtensionBackendCapabilityUi;
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

function dispatchLogCapability(logger: ExtensionBackendCapabilityLogger, request: ExtensionBackendWorkerCapabilityRequest): undefined {
  if (request.operation !== 'info' && request.operation !== 'warn' && request.operation !== 'error') {
    throw new Error(`Unsupported log capability operation: ${request.operation}`);
  }
  const level = request.operation as ExtensionLogLevel;
  const { message, fields } = normalizeLogInput(request.input);
  logger[level](`extension:${request.extensionId} ${message}`, fields);
  return undefined;
}

function dispatchGitCapability(git: ExtensionBackendCapabilityGit, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  const input = normalizeRecordInput(request.input, 'Git');

  if (request.operation === 'status') {
    return git.status({ cwd: requireString(input.cwd, 'Git cwd') });
  }

  if (request.operation === 'diff') {
    const path = input.path;
    const staged = input.staged;
    if (path !== undefined && typeof path !== 'string') {
      throw new Error('Git path must be a string when provided.');
    }
    if (staged !== undefined && typeof staged !== 'boolean') {
      throw new Error('Git staged must be a boolean when provided.');
    }
    return git.diff({ cwd: requireString(input.cwd, 'Git cwd'), ...(path === undefined ? {} : { path }), ...(staged === undefined ? {} : { staged }) });
  }

  if (request.operation === 'log') {
    const maxCount = input.maxCount;
    if (maxCount !== undefined && typeof maxCount !== 'number') {
      throw new Error('Git maxCount must be a number when provided.');
    }
    return git.log({ cwd: requireString(input.cwd, 'Git cwd'), ...(maxCount === undefined ? {} : { maxCount }) });
  }

  throw new Error(`Unsupported git capability operation: ${request.operation}`);
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

function dispatchStorageCapability(storage: ExtensionBackendCapabilityStorage, request: ExtensionBackendWorkerCapabilityRequest): unknown {
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

function dispatchSecretsCapability(secrets: ExtensionBackendCapabilitySecrets, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'get') {
    throw new Error(`Unsupported secrets capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'Secrets');
  return secrets.get(request.extensionId, requireString(input.secretId, 'Secret id'));
}

function optionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings when provided.`);
  }
  return value;
}

function optionalStringRecord(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object when provided.`);
  }
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string')) {
    throw new Error(`${label} values must be strings.`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function optionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number') {
    throw new Error(`${label} must be a number when provided.`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string when provided.`);
  }
  return value;
}

function dispatchShellCapability(shell: ExtensionBackendCapabilityShell, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'exec') {
    throw new Error(`Unsupported shell capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'Shell');
  return shell.exec({
    command: requireString(input.command, 'Shell command'),
    ...(input.args !== undefined ? { args: optionalStringArray(input.args, 'Shell args') } : {}),
    ...(input.cwd !== undefined ? { cwd: optionalString(input.cwd, 'Shell cwd') } : {}),
    ...(input.timeoutMs !== undefined ? { timeoutMs: optionalNumber(input.timeoutMs, 'Shell timeoutMs') } : {}),
    ...(input.maxBuffer !== undefined ? { maxBuffer: optionalNumber(input.maxBuffer, 'Shell maxBuffer') } : {}),
    ...(input.env !== undefined ? { env: optionalStringRecord(input.env, 'Shell env') } : {}),
  });
}

function dispatchUiCapability(ui: ExtensionBackendCapabilityUi, request: ExtensionBackendWorkerCapabilityRequest): unknown {
  if (request.operation !== 'invalidate') {
    throw new Error(`Unsupported ui capability operation: ${request.operation}`);
  }
  const input = normalizeRecordInput(request.input, 'UI');
  const topics = input.topics;
  if (typeof topics !== 'string' && (!Array.isArray(topics) || topics.some((topic) => typeof topic !== 'string'))) {
    throw new Error('UI topics must be a string or array of strings.');
  }
  return ui.invalidate(topics);
}

export function createExtensionBackendCapabilityDispatcher(
  options: ExtensionBackendCapabilityDispatcherOptions = {},
): ExtensionBackendCapabilityDispatcher {
  const git = options.git ?? createExtensionGitCapability();
  const logger = options.log ?? { info: logInfo, warn: logWarn, error: logError };
  const secrets = options.secrets ?? { get: (extensionId: string, secretId: string) => resolveSecret(extensionId, secretId) };
  const shell = options.shell ?? createExtensionShellCapability();
  const ui = options.ui ?? {
    invalidate: (topics: string | string[]) => {
      const items = Array.isArray(topics) ? topics : [topics];
      invalidateAppTopics(...(items as AppEventTopic[]));
    },
  };
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
    if (request.capability === 'git') {
      return dispatchGitCapability(git, request);
    }
    if (request.capability === 'log') {
      return dispatchLogCapability(logger, request);
    }
    if (request.capability === 'shell') {
      return dispatchShellCapability(shell, request);
    }
    if (request.capability === 'secrets') {
      return dispatchSecretsCapability(secrets, request);
    }
    if (request.capability === 'storage') {
      return dispatchStorageCapability(storage, request);
    }
    if (request.capability === 'ui') {
      return dispatchUiCapability(ui, request);
    }
    throw new Error(`Unsupported extension backend capability: ${request.capability}`);
  };
}
