import { pathToFileURL } from 'node:url';
import { parentPort } from 'node:worker_threads';

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

if (!parentPort) {
  throw new Error('extensionBackendWorker must run as a worker thread.');
}

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

function callHostCapability(extensionId: string, capability: string, operation: string, input?: unknown): Promise<unknown> {
  const id = ++nextCapabilityRequestId;
  return new Promise((resolve, reject) => {
    pendingCapabilities.set(id, { resolve, reject });
    parentPort!.postMessage({ id, kind: 'capabilityRequest', extensionId, capability, operation, input });
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
  const liveSessionResourceOptions = options.liveSessionResourceOptions ?? {
    additionalExtensionPaths: [],
    additionalSkillPaths: [],
    additionalPromptTemplatePaths: [],
    additionalThemePaths: [],
  };
  return {
    extensionId,
    runtimeScope,
    profile: runtimeScope,
    runtimeDir,
    runtimeSettingsFilePath,
    profileSettingsFilePath: runtimeSettingsFilePath,
    ...(options.toolContext ? { toolContext: options.toolContext } : {}),
    runtime: {
      getRepoRoot: () => repoRoot,
      getLiveSessionResourceOptions: () => liveSessionResourceOptions,
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
      exec: (input: unknown) => callHostCapability(extensionId, 'shell', 'exec', input),
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
      const result = await (handler as (...args: unknown[]) => unknown)(...args);
      return { id: request.id, ok: true, result };
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
