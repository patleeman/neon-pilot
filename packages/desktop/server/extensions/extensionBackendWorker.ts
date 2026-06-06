import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';

import { prependNeonPilotCliBin } from '../cliEnvironment.js';

import type { ExtensionBackendModule } from './extensionBackendRunner.js';
import type {
  ExtensionBackendWorkerBackendContextOptions,
  ExtensionBackendWorkerCapabilityEvent,
  ExtensionBackendWorkerCapabilityResponse,
  ExtensionBackendWorkerParentMessage,
  ExtensionBackendWorkerRequest,
  ExtensionBackendWorkerResponse,
} from './extensionBackendWorkerProtocol.js';
import { withExtensionProcessGuard } from './extensionProcessGuard.js';

const backendModuleCache = new Map<string, { cacheKey: string; module: Promise<ExtensionBackendModule> }>();
const pendingCapabilities = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const shellHandleCallbacks = new Map<
  string,
  {
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    onExit?: (event: { code: number | null; signal: string | null }) => void;
  }
>();
let nextCapabilityRequestId = 0;
let nextShellHandleId = 0;
let nextRouteStreamHandleId = 0;
const extensionCapabilityScope = new AsyncLocalStorage<{ extensionId: string; contextOptions?: ExtensionBackendWorkerBackendContextOptions }>();
const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');
const EXTENSION_HOST_CAPABILITY_EVENT_HANDLERS = Symbol.for('neon-pilot.extensionHostCapabilityEventHandlers');

type ExtensionBackendWorkerGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
  [EXTENSION_HOST_CAPABILITY_EVENT_HANDLERS]?: Set<(event: ExtensionBackendWorkerCapabilityEvent) => void>;
};

if (!parentPort) {
  throw new Error('extensionBackendWorker must run as a worker thread.');
}

(globalThis as ExtensionBackendWorkerGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE] = (capability, operation, input) => {
  const scope = extensionCapabilityScope.getStore();
  if (!scope) {
    throw new Error('Extension host capability bridge is unavailable outside an active extension backend worker request.');
  }
  return callHostCapability(scope.extensionId, capability, operation, input, scope.contextOptions);
};

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

function callHostCapability(
  extensionId: string,
  capability: string,
  operation: string,
  input?: unknown,
  contextOptions?: ExtensionBackendWorkerBackendContextOptions,
): Promise<unknown> {
  const id = ++nextCapabilityRequestId;
  return new Promise((resolve, reject) => {
    pendingCapabilities.set(id, { resolve, reject });
    parentPort!.postMessage({
      id,
      kind: 'capabilityRequest',
      extensionId,
      capability,
      operation,
      input,
      ...(contextOptions ? { context: contextOptions } : {}),
    });
  });
}

function handleCapabilityResponse(response: ExtensionBackendWorkerCapabilityResponse): void {
  const pending = pendingCapabilities.get(response.id);
  if (!pending) return;
  pendingCapabilities.delete(response.id);

  if (response.ok) pending.resolve(response.result);
  else pending.reject(new Error(response.error));
}

function handleCapabilityEvent(event: ExtensionBackendWorkerCapabilityEvent): void {
  for (const handler of (globalThis as ExtensionBackendWorkerGlobal)[EXTENSION_HOST_CAPABILITY_EVENT_HANDLERS] ?? []) {
    handler(event);
  }

  if (event.capability !== 'shell') return;
  const input = event.input && typeof event.input === 'object' && !Array.isArray(event.input) ? (event.input as Record<string, unknown>) : null;
  const handleId = typeof input?.handleId === 'string' ? input.handleId : '';
  const callbacks = shellHandleCallbacks.get(handleId);
  if (!callbacks) return;

  if (event.operation === 'stdout' && typeof input?.chunk === 'string') {
    callbacks.onStdout?.(input.chunk);
    return;
  }
  if (event.operation === 'stderr' && typeof input?.chunk === 'string') {
    callbacks.onStderr?.(input.chunk);
    return;
  }
  if (event.operation === 'exit') {
    shellHandleCallbacks.delete(handleId);
    callbacks.onExit?.({
      code: typeof input?.code === 'number' ? input.code : null,
      signal: typeof input?.signal === 'string' ? input.signal : null,
    });
  }
}

function createWorkerBackendContext(extensionId: string, options: ExtensionBackendWorkerBackendContextOptions = {}): Record<string, unknown> {
  const runtimeScope = options.runtimeScope ?? 'shared';
  const repoRoot = options.repoRoot ?? process.cwd();
  const runtimeDir = options.runtimeDir ?? process.cwd();
  const runtimeSettingsFilePath = options.runtimeSettingsFilePath ?? '';
  const authFile = options.authFile ?? '';
  const stateRoot = options.stateRoot ?? '';
  const modelWriteContext = {
    runtimeScope,
    repoRoot,
    ...(authFile ? { authFile } : {}),
    ...(stateRoot ? { stateRoot } : {}),
  };
  const liveSessionResourceOptions = options.liveSessionResourceOptions ?? {
    additionalExtensionPaths: [],
    additionalSkillPaths: [],
    additionalPromptTemplatePaths: [],
    additionalThemePaths: [],
  };
  const extensionBinDirs =
    Array.isArray(liveSessionResourceOptions.additionalExtensionPaths)
      ? liveSessionResourceOptions.additionalExtensionPaths
          .filter((extensionPath): extensionPath is string => typeof extensionPath === 'string')
          .map((extensionPath) => path.join(extensionPath, 'bin'))
          .filter((binDir) => existsSync(binDir))
      : [];
  const shellEnv = (inputEnv?: unknown): Record<string, string> | undefined => {
    const env =
      inputEnv && typeof inputEnv === 'object' && !Array.isArray(inputEnv)
        ? Object.fromEntries(Object.entries(inputEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : {};
    const baseEnvInput = { ...env, PATH: env.PATH ?? process.env.PATH ?? '' };
    const baseEnv = Object.fromEntries(
      Object.entries(prependNeonPilotCliBin(baseEnvInput)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    if (extensionBinDirs.length === 0) return baseEnv;
    const pathParts = (baseEnv.PATH ?? '').split(path.delimiter).filter(Boolean);
    return {
      ...baseEnv,
      PATH: [...extensionBinDirs, ...pathParts.filter((part) => !extensionBinDirs.includes(part))].join(path.delimiter),
    };
  };
  return {
    extensionId,
    runtimeScope,
    profile: runtimeScope,
    runtimeDir,
    runtimeSettingsFilePath,
    profileSettingsFilePath: runtimeSettingsFilePath,
    ...(options.toolContext
      ? {
          toolContext: {
            ...options.toolContext,
            ...(options.toolContext.updateHandleId
              ? {
                  onUpdate: (update: unknown) =>
                    callHostCapability(extensionId, 'toolContext', 'update', {
                      handleId: options.toolContext?.updateHandleId,
                      update,
                    }),
                }
              : {}),
          },
        }
      : {}),
    ...(options.agentToolContext ? { agentToolContext: options.agentToolContext } : {}),
    runtime: {
      getRepoRoot: () => repoRoot,
      getLiveSessionResourceOptions: () => liveSessionResourceOptions,
      refreshSkillMcpConfig: () =>
        callHostCapability(extensionId, 'runtime', 'refreshSkillMcpConfig', {
          runtimeScope,
          repoRoot,
          runtimeDir,
        }),
    },
    log: {
      info: (message: string, fields?: Record<string, unknown>) => callHostCapability(extensionId, 'log', 'info', { message, fields }),
      warn: (message: string, fields?: Record<string, unknown>) => callHostCapability(extensionId, 'log', 'warn', { message, fields }),
      error: (message: string, fields?: Record<string, unknown>) => callHostCapability(extensionId, 'log', 'error', { message, fields }),
    },
    events: {
      publish: (input: { event: string; payload: unknown }) => callHostCapability(extensionId, 'events', 'publish', input),
    },
    conversations: {
      get: (conversationId: string) => callHostCapability(extensionId, 'conversations', 'get', { conversationId }),
      create: (input?: {
        cwd?: string;
        live?: boolean;
        title?: string;
        prompt?: string;
        initialPrompt?: string;
        model?: string | null;
        thinkingLevel?: string | null;
        serviceTier?: string | null;
        allowedToolNames?: string[];
      }) => callHostCapability(extensionId, 'conversations', 'create', input ?? {}),
      setActiveTools: (conversationId: string, toolNames: string[]) =>
        callHostCapability(extensionId, 'conversations', 'setActiveTools', { conversationId, toolNames }),
      appendCustomEntry: (conversationId: string, customType: string, data?: unknown) =>
        callHostCapability(extensionId, 'conversations', 'appendCustomEntry', { conversationId, customType, data }),
      appendTranscriptBlock: (input: { conversationId: string; blockType: string; data: unknown; title?: string; blockId?: string }) =>
        callHostCapability(extensionId, 'conversations', 'appendTranscriptBlock', input),
      updateTranscriptBlock: (input: { conversationId: string; blockType: string; blockId: string; data: unknown; title?: string }) =>
        callHostCapability(extensionId, 'conversations', 'updateTranscriptBlock', input),
      getWorkspace: () =>
        callHostCapability(extensionId, 'conversations', 'getWorkspace', {
          runtimeScope,
          runtimeSettingsFilePath,
        }),
      updateWorkspace: (input: {
        openConversationIds?: string[] | null;
        pinnedConversationIds?: string[] | null;
        archivedConversationIds?: string[] | null;
        activeConversationId?: string | null;
        workspacePaths?: string[] | null;
        remoteControlledConversationIds?: string[] | null;
      }) => callHostCapability(extensionId, 'conversations', 'updateWorkspace', { ...input, runtimeScope, runtimeSettingsFilePath }),
      rollback: (conversationId: string, count: number) =>
        callHostCapability(extensionId, 'conversations', 'rollback', { conversationId, count }),
      ensureLive: (conversationId: string, options?: { cwd?: string }) =>
        callHostCapability(extensionId, 'conversations', 'ensureLive', { conversationId, ...(options?.cwd ? { cwd: options.cwd } : {}) }),
      sendMessage: (
        conversationId: string,
        text: string,
        options?: { steer?: boolean; images?: Array<{ data: string; mimeType: string; name?: string }> },
      ) => callHostCapability(extensionId, 'conversations', 'sendMessage', { conversationId, text, ...(options ?? {}) }),
      runTurn: (
        conversationId: string,
        text: string,
        options?: {
          cwd?: string;
          steer?: boolean;
          images?: Array<{ data: string; mimeType: string; name?: string }>;
          timeoutMs?: number;
        },
      ) => callHostCapability(extensionId, 'conversations', 'runTurn', { conversationId, text, ...(options ?? {}) }),
      abort: (conversationId: string) => callHostCapability(extensionId, 'conversations', 'abort', { conversationId }),
      compact: (conversationId: string, customInstructions?: string) =>
        callHostCapability(extensionId, 'conversations', 'compact', {
          conversationId,
          ...(customInstructions !== undefined ? { customInstructions } : {}),
        }),
      fork: (input: { conversationId: string; targetCwd?: string; cwd?: string; title?: string }) =>
        callHostCapability(extensionId, 'conversations', 'fork', input),
      setTitle: (conversationId: string, title: string) =>
        callHostCapability(extensionId, 'conversations', 'setTitle', { conversationId, title }),
      metadata: {
        get: (input: { conversationId: string; namespace?: string }) =>
          callHostCapability(extensionId, 'conversations', 'metadata.get', { ...input, profile: runtimeScope }),
        set: (input: { conversationId: string; namespace?: string; values: Record<string, unknown> }) =>
          callHostCapability(extensionId, 'conversations', 'metadata.set', { ...input, profile: runtimeScope }),
        query: (input: {
          namespace?: string;
          where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
          limit?: number;
        }) => callHostCapability(extensionId, 'conversations', 'metadata.query', { ...input, profile: runtimeScope }),
      },
    },
    extensions: {
      listActions: () => callHostCapability(extensionId, 'extensions', 'listActions'),
      getStatus: (targetExtensionId: string) =>
        callHostCapability(extensionId, 'extensions', 'getStatus', { extensionId: targetExtensionId }),
      setEnabled: (targetExtensionId: string, enabled: boolean) =>
        callHostCapability(extensionId, 'extensions', 'setEnabled', { extensionId: targetExtensionId, enabled }),
    },
    git: {
      status: (input: unknown) => callHostCapability(extensionId, 'git', 'status', input),
      diff: (input: unknown) => callHostCapability(extensionId, 'git', 'diff', input),
      log: (input: unknown) => callHostCapability(extensionId, 'git', 'log', input),
    },
    models: {
      list: () => callHostCapability(extensionId, 'models', 'list'),
      saveProvider: (input: unknown) =>
        callHostCapability(extensionId, 'models', 'saveProvider', { input, ...modelWriteContext }),
      saveProviderModel: (input: unknown) =>
        callHostCapability(extensionId, 'models', 'saveProviderModel', { input, ...modelWriteContext }),
      deleteProvider: (provider: string) =>
        callHostCapability(extensionId, 'models', 'deleteProvider', { provider, ...modelWriteContext }),
      deleteProviderModel: (input: unknown) =>
        callHostCapability(extensionId, 'models', 'deleteProviderModel', { input, ...modelWriteContext }),
    },
    notify: {
      toast: (message: string, type?: 'info' | 'warning' | 'error') => callHostCapability(extensionId, 'notify', 'toast', { message, type }),
      system: (input: unknown) => callHostCapability(extensionId, 'notify', 'system', input),
      setBadge: (count: number) => callHostCapability(extensionId, 'notify', 'setBadge', { count }),
      clearBadge: () => callHostCapability(extensionId, 'notify', 'clearBadge'),
      isSystemAvailable: () => callHostCapability(extensionId, 'notify', 'isSystemAvailable'),
    },
    storage: {
      get: (key: string) => callHostCapability(extensionId, 'storage', 'get', { key }),
      put: (key: string, value: unknown, options?: { expectedVersion?: number }) =>
        callHostCapability(extensionId, 'storage', 'put', { key, value, expectedVersion: options?.expectedVersion }),
      delete: (key: string) => callHostCapability(extensionId, 'storage', 'delete', { key }),
      list: (prefix?: string) => callHostCapability(extensionId, 'storage', 'list', { prefix }),
    },
    shell: {
      exec: (input: unknown) => {
        const serializableInput: unknown = input && typeof input === 'object' && !Array.isArray(input) ? { ...(input as Record<string, unknown>) } : input;
        if (serializableInput && typeof serializableInput === 'object' && !Array.isArray(serializableInput)) {
          const record = serializableInput as Record<string, unknown>;
          const env = shellEnv(record.env);
          if (env) record.env = env;
        }
        return callHostCapability(extensionId, 'shell', 'exec', serializableInput);
      },
      spawn: async (input: {
        command?: unknown;
        args?: unknown;
        cwd?: unknown;
        env?: unknown;
        pty?: unknown;
        onStdout?: (chunk: string) => void;
        onStderr?: (chunk: string) => void;
        onExit?: (event: { code: number | null; signal: string | null }) => void;
      }) => {
        const handleId = `worker-shell-${++nextShellHandleId}`;
        const serializableInput: Record<string, unknown> = { ...(input ?? {}) };
        delete serializableInput.onStdout;
        delete serializableInput.onStderr;
        delete serializableInput.onExit;
        if (input?.onStdout) serializableInput.onStdout = true;
        if (input?.onStderr) serializableInput.onStderr = true;
        if (input?.onExit) serializableInput.onExit = true;
        if (input?.onStdout || input?.onStderr || input?.onExit) {
          shellHandleCallbacks.set(handleId, {
            ...(input.onStdout ? { onStdout: input.onStdout } : {}),
            ...(input.onStderr ? { onStderr: input.onStderr } : {}),
            ...(input.onExit ? { onExit: input.onExit } : {}),
          });
        }
        const env = shellEnv(serializableInput.env);
        if (env) serializableInput.env = env;
        const result = (await callHostCapability(extensionId, 'shell', 'spawn', { handleId, ...serializableInput })) as {
          pid?: number | null;
          usingPty?: boolean;
          executionWrappers?: Array<{ id: string; label?: string }>;
        };
        return {
          pid: result.pid ?? null,
          usingPty: result.usingPty === true,
          executionWrappers: result.executionWrappers ?? [],
          kill: () => {
            shellHandleCallbacks.delete(handleId);
            return callHostCapability(extensionId, 'shell', 'kill', { handleId });
          },
          write: (data: string) => callHostCapability(extensionId, 'shell', 'write', { handleId, data }),
          resize: (cols: number, rows: number) => callHostCapability(extensionId, 'shell', 'resize', { handleId, cols, rows }),
        };
      },
    },
    filesystem: {
      requestRoot: (input?: { kind?: string; cwd?: string; access?: string[]; reason?: string; prefix?: string }) =>
        createWorkerFilesystemRoot(extensionId, input ?? {}),
      workspace: (input?: { cwd?: string; access?: string[]; reason?: string }) =>
        createWorkerFilesystemRoot(extensionId, { ...(input ?? {}), kind: 'workspace' }),
      app: (input?: { access?: string[]; reason?: string }) => createWorkerFilesystemRoot(extensionId, { ...(input ?? {}), kind: 'app' }),
      cache: (input?: { access?: string[]; reason?: string }) => createWorkerFilesystemRoot(extensionId, { ...(input ?? {}), kind: 'cache' }),
      temp: (input?: { access?: string[]; reason?: string; prefix?: string }) =>
        createWorkerFilesystemRoot(extensionId, { ...(input ?? {}), kind: 'temp' }),
    },
    secrets: {
      get: (secretId: string) => callHostCapability(extensionId, 'secrets', 'get', { secretId }),
    },
    telemetry: {
      record: (event: unknown) => callHostCapability(extensionId, 'telemetry', 'record', event),
    },
    ui: {
      invalidate: (topics: string | string[]) => callHostCapability(extensionId, 'ui', 'invalidate', { topics }),
    },
    workspace: {
      readText: (input: unknown) => callHostCapability(extensionId, 'workspace', 'readText', input),
      writeText: (input: unknown) => callHostCapability(extensionId, 'workspace', 'writeText', input),
      list: (input: unknown) => callHostCapability(extensionId, 'workspace', 'list', input),
    },
  };
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof value === 'object' && Symbol.asyncIterator in value);
}

function serializeRouteStreamResult(result: unknown): unknown {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
  const candidate = result as { stream?: unknown; events?: unknown };
  if (candidate.stream !== 'sse' || !isAsyncIterable(candidate.events)) return result;

  const handleId = `route-sse-${++nextRouteStreamHandleId}`;
  const { events, ...serializable } = candidate as Record<string, unknown>;
  void (async () => {
    try {
      for await (const event of events as AsyncIterable<unknown>) {
        parentPort!.postMessage({ kind: 'routeStreamEvent', handleId, event });
      }
      parentPort!.postMessage({ kind: 'routeStreamEvent', handleId, done: true });
    } catch (error) {
      parentPort!.postMessage({
        kind: 'routeStreamEvent',
        handleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return {
    ...serializable,
    stream: 'sse',
    events: { __extensionWorkerRouteStream: true, handleId },
  };
}

async function createWorkerFilesystemRoot(
  extensionId: string,
  input: { kind?: string; cwd?: string; access?: string[]; reason?: string; prefix?: string },
): Promise<Record<string, unknown>> {
  const result = (await callHostCapability(extensionId, 'filesystem', 'requestRoot', input)) as {
    handleId?: string;
    root?: unknown;
  };
  const handleId = result.handleId;
  if (!handleId) throw new Error('Filesystem root response missing handle id.');
  return workerFilesystemRoot(extensionId, handleId, result.root);
}

function workerFilesystemRoot(extensionId: string, handleId: string, root: unknown): Record<string, unknown> {
  const call = (operation: string, input: Record<string, unknown> = {}) =>
    callHostCapability(extensionId, 'filesystem', operation, { handleId, ...input });
  return {
    root,
    readBytes: (path: string, options?: { maxBytes?: number }) => call('readBytes', { path, ...(options ?? {}) }),
    readText: (path: string, options?: { maxBytes?: number }) => call('readText', { path, ...(options ?? {}) }),
    writeBytes: (path: string, data: Uint8Array, options?: { atomic?: boolean }) => call('writeBytes', { path, data, ...(options ?? {}) }),
    writeText: (path: string, data: string, options?: { atomic?: boolean }) => call('writeText', { path, data, ...(options ?? {}) }),
    readJson: (path: string, options?: { maxBytes?: number }) => call('readJson', { path, ...(options ?? {}) }),
    writeJson: (path: string, value: unknown, options?: { atomic?: boolean }) => call('writeJson', { path, value, ...(options ?? {}) }),
    list: (path?: string, options?: { depth?: number; excludeNames?: string[] }) =>
      call('list', { ...(path !== undefined ? { path } : {}), ...(options ?? {}) }),
    stat: (path: string) => call('stat', { path }),
    exists: (path: string) => call('exists', { path }),
    createDirectory: (path: string) => call('createDirectory', { path }),
    move: (from: string, to: string, options?: { overwrite?: boolean }) => call('move', { from, to, ...(options ?? {}) }),
    copyIn: (to: string, absoluteSource: string) => call('copyIn', { to, absoluteSource }),
    remove: (path: string, options?: { recursive?: boolean; force?: boolean }) => call('remove', { path, ...(options ?? {}) }),
    createTempWorkspace: async (options?: { prefix?: string }) => {
      const result = (await call('createTempWorkspace', options ?? {})) as { handleId?: string; root?: unknown };
      if (!result.handleId) throw new Error('Filesystem temp root response missing handle id.');
      return workerFilesystemRoot(extensionId, result.handleId, result.root);
    },
  };
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

    if (request.type === 'runExport') {
      const backend = await loadModule(request.extensionId, request.compiled);
      const handler = backend[request.exportName];
      if (typeof handler !== 'function') {
        throw new Error(`Extension backend export not found: ${request.exportName}`);
      }
      const contextOptions = typeof request.context === 'object' ? request.context : undefined;
      const args = request.context ? [...request.args, createWorkerBackendContext(request.extensionId, contextOptions)] : request.args;
      const result = await extensionCapabilityScope.run({ extensionId: request.extensionId, contextOptions }, () =>
        (handler as (...args: unknown[]) => unknown)(...args),
      );
      return { id: request.id, ok: true, result: serializeRouteStreamResult(result) };
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

parentPort.on('message', (message: ExtensionBackendWorkerParentMessage) => {
  if ('kind' in message && message.kind === 'capabilityResponse') {
    handleCapabilityResponse(message);
    return;
  }
  if ('kind' in message && message.kind === 'capabilityEvent') {
    handleCapabilityEvent(message);
    return;
  }

  if (!('type' in message)) return;
  const request = message;
  void handleRequest(request).then((response) => {
    parentPort!.postMessage(response);
  });
});
