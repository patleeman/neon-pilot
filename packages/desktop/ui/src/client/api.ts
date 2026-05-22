import { getDesktopBridge, readDesktopEnvironment } from '../desktop/desktopBridge';
import type {
  ExtensionCommandRegistration,
  ExtensionDoctorReport,
  ExtensionInstallSummary,
  ExtensionKeybindingRegistration,
  ExtensionManifest,
  ExtensionMentionRegistration,
  ExtensionQuickOpenRegistration,
  ExtensionRouteSummary,
  ExtensionSearchItem,
  ExtensionSearchProviderRegistration,
  ExtensionSlashCommandRegistration,
  ExtensionSurfaceSummary,
} from '../extensions/types';
import type {
  AppTelemetryEventRow,
  AppTelemetryLogBundleExport,
  AppTelemetryLogDiagnostics,
  CacheEfficiencyAggregate,
  CacheEfficiencyPoint,
  ContextPointerUsageResult,
  ConversationAttachmentAssetData,
  ConversationCheckpointReviewContext,
  ConversationCommitCheckpointRecord,
  ConversationContentSearchResult,
  ConversationContextDocRef,
  ConversationSummaryRecord,
  DesktopEnvironmentState,
  FilePickerResult,
  GatewayProviderId,
  GatewayState,
  GatewayStatus,
  InjectedPromptMessage,
  InstructionFilesState,
  LiveSessionMeta,
  MemoryData,
  PromptAttachmentRefInput,
  PromptImageInput,
  SecretsState,
  SkillFoldersState,
  SystemPromptAggregate,
  SystemPromptPoint,
  TelemetryDbMaintenanceResult,
  ToolFlowResult,
  ToolsState,
  TraceAgentLoop,
  TraceContextResponse,
  TraceCostRow,
  TraceModelUsage,
  TraceSummary,
  TraceThroughput,
  TraceTokenDaily,
  TraceToolHealth,
  UncommittedDiffResult,
  WorkspaceDiffOverlay,
  WorkspaceDirectoryListing,
  WorkspaceFileContent,
} from '../shared/types';
import { buildApiPath } from './apiBase';
import { recordApiTiming, recordClientPerfTiming } from './perfDiagnostics';

// ── Retry helpers for transient network errors (e.g. server restarts) ────────

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && /failed to fetch|network|ECONNREFUSED|ECONNRESET/i.test(error.message)) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(input, init);
      if (!res) throw new Error('fetch returned undefined');
      // Retry transient server errors (5xx) like transient network failures
      if (!res.ok && res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
        lastError = new Error(`Server error ${res.status} for ${input}`);
        await sleep(RETRY_DELAYS_MS[attempt] as number);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }

      await sleep(RETRY_DELAYS_MS[attempt] as number);
    }
  }

  throw lastError;
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function requestJson<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const requestPath = buildApiPath(path);
  const res = await fetchWithRetry(requestPath, {
    method,
    ...(method === 'GET'
      ? { cache: 'no-store' as const }
      : {
          headers: { 'Content-Type': 'application/json' },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
  });
  recordApiTiming(requestPath, res);
  if (!res.ok) throw new Error(await readApiError(res, requestPath));
  return readJsonResponse<T>(res, requestPath);
}

async function requestDesktopLocalApiJson<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const requestPath = buildApiPath(path);
  const desktopBridge = getDesktopBridge();
  if (desktopBridge && (await shouldUseDesktopLocalCapabilities())) {
    return (await desktopBridge.invokeLocalApi({ method, path: requestPath, body })) as T;
  }
  return requestJson<T>(method, path, body);
}

async function extensionGet<T>(path: string): Promise<T> {
  return requestDesktopLocalApiJson<T>('GET', path);
}

async function extensionPost<T>(path: string, body?: unknown): Promise<T> {
  return requestDesktopLocalApiJson<T>('POST', path, body);
}

async function extensionPut<T>(path: string, body?: unknown): Promise<T> {
  return requestDesktopLocalApiJson<T>('PUT', path, body);
}

async function extensionPatch<T>(path: string, body?: unknown): Promise<T> {
  return requestDesktopLocalApiJson<T>('PATCH', path, body);
}

async function extensionDelete<T>(path: string): Promise<T> {
  return requestDesktopLocalApiJson<T>('DELETE', path);
}

async function get<T>(path: string): Promise<T> {
  return requestJson<T>('GET', path);
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>('POST', path, body);
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>('PUT', path, body);
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>('PATCH', path, body);
}

async function del<T>(path: string): Promise<T> {
  return requestJson<T>('DELETE', path);
}

function formatResponsePreview(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, 160);
}

async function readJsonResponse<T>(res: Response, path: string): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const contentType = res.headers.get('Content-Type') ?? 'unknown content type';
    const preview = formatResponsePreview(text);
    throw new Error(`Expected JSON from ${path}, received ${contentType}${preview ? `: ${preview}` : ''}`);
  }
}

async function readApiError(res: Response, path?: string): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    if (typeof data.error === 'string' && data.error.trim().length > 0) {
      return data.error;
    }
  } catch {
    // Ignore non-JSON error bodies.
  }

  const preview = formatResponsePreview(text);
  return `${res.status} ${res.statusText}${path ? ` from ${path}` : ''}${preview ? `: ${preview}` : ''}`;
}

const pendingMemoryRequests = new Map<string, Promise<MemoryData>>();
let desktopEnvironmentPromise: Promise<DesktopEnvironmentState | null> | null = null;

async function requireLocalDesktopBridge(action: string): Promise<NonNullable<ReturnType<typeof getDesktopBridge>>> {
  const desktopBridge = getDesktopBridge();
  if (desktopBridge && (await shouldUseDesktopLocalCapabilities())) {
    return desktopBridge;
  }

  throw new Error(`${action} requires the local desktop host.`);
}

async function requireLocalDesktopConversationBridge(
  conversationId: string,
  action: string,
): Promise<NonNullable<ReturnType<typeof getDesktopBridge>>> {
  const desktopBridge = getDesktopBridge();
  if (desktopBridge && (await shouldUseDesktopLocalConversationCapabilities(conversationId))) {
    return desktopBridge;
  }

  throw new Error(`${action} requires the local desktop host.`);
}

/** Keep the cached promise retryable so transient failures don't permanently
 *  disable the desktop bridge path. Matching the same pattern in desktopEventSource.ts. */
async function readCachedDesktopEnvironment(): Promise<DesktopEnvironmentState | null> {
  if (!desktopEnvironmentPromise) {
    desktopEnvironmentPromise = readDesktopEnvironment().catch(() => {
      desktopEnvironmentPromise = null;
      return null;
    });
  }

  return desktopEnvironmentPromise;
}

async function getMemoryData(): Promise<MemoryData> {
  const cacheKey = '__current__';
  const pending = pendingMemoryRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = get<MemoryData>('/memory').finally(() => {
    pendingMemoryRequests.delete(cacheKey);
  });
  pendingMemoryRequests.set(cacheKey, request);
  return request;
}

async function shouldUseDesktopLocalCapabilities(): Promise<boolean> {
  if (!getDesktopBridge()) {
    return false;
  }

  const environment = await readCachedDesktopEnvironment();
  return environment?.activeHostKind === 'local';
}

async function shouldUseDesktopLocalConversationCapabilities(_conversationId: string): Promise<boolean> {
  return Boolean(getDesktopBridge()) && (await shouldUseDesktopLocalCapabilities());
}

export function normalizeDurableRunLogTailParam(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(1000, value) : undefined;
}

export function normalizeConversationContentSearchLimit(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(100, value) : 80;
}

export function normalizeVaultSearchLimit(value: unknown): number {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(50, value) : 20;
}

export const api = {
  // ── Core ──────────────────────────────────────────────────────────────────
  status: async () => {
    return (await requireLocalDesktopBridge('Reading app status')).readAppStatus();
  },
  daemon: async () => {
    return (await requireLocalDesktopBridge('Reading daemon state')).readDaemonState();
  },
  extensions: async () => extensionGet<ExtensionManifest[]>('/extensions'),
  extensionInstallations: async () => extensionGet<ExtensionInstallSummary[]>('/extensions/installed'),
  createExtension: async (input: {
    id: string;
    name: string;
    description?: string;
    template?: 'main-page' | 'right-rail' | 'workbench-detail';
  }) => extensionPost<{ ok: true; extension?: ExtensionInstallSummary; packageRoot: string }>('/extensions', input),
  importExtension: async (input: { zipPath: string }) =>
    extensionPost<{ ok: true; extension?: ExtensionInstallSummary; packageRoot: string }>('/extensions/import', input),
  cleanRoomImport: async (input: { zipPath: string }) =>
    extensionPost<{ ok: true; runId: string; logPath: string; prompt: string }>('/extensions/clean-room-import', input),
  extensionRoutes: async () => extensionGet<ExtensionRouteSummary[]>('/extensions/routes'),
  extensionSurfaces: async () => extensionGet<ExtensionSurfaceSummary[]>('/extensions/surfaces'),
  extensionCommands: async () => extensionGet<ExtensionCommandRegistration[]>('/extensions/commands'),
  executeExtensionCommand: async (commandId: string, input?: unknown) =>
    extensionPost<{ ok: true; result: unknown } | { ok: false; error: string }>(
      `/extensions/commands/${encodeURIComponent(commandId)}/execute`,
      input ?? {},
    ),
  acknowledgeExtensionCommand: async (requestId: string, handled: boolean) =>
    extensionPost<{ ok: true; acknowledged: boolean }>(`/extensions/commands/acks/${encodeURIComponent(requestId)}`, { handled }),
  extensionKeybindings: async () => extensionGet<ExtensionKeybindingRegistration[]>('/extensions/keybindings'),
  updateExtensionKeybinding: async (
    extensionId: string,
    keybindingId: string,
    input: {
      title?: string;
      command?: string;
      args?: unknown;
      scope?: 'global' | 'surface';
      packageType?: 'system' | 'user';
      keys?: string[];
      enabled?: boolean;
      reset?: boolean;
    },
  ) =>
    extensionPatch<{ ok: true }>(`/extensions/keybindings/${encodeURIComponent(extensionId)}/${encodeURIComponent(keybindingId)}`, input),
  extensionSlashCommands: async () => extensionGet<ExtensionSlashCommandRegistration[]>('/extensions/slash-commands'),
  extensionMentions: async () => extensionGet<ExtensionMentionRegistration[]>('/extensions/mentions'),
  extensionQuickOpen: async () => extensionGet<ExtensionQuickOpenRegistration[]>('/extensions/quick-open'),
  extensionSearchProviders: async () => extensionGet<ExtensionSearchProviderRegistration[]>('/extensions/search-providers'),
  extensionSearch: async (input: { query: string; limit?: number; providerId?: string }) =>
    extensionPost<{ providers: ExtensionSearchProviderRegistration[]; items: ExtensionSearchItem[] }>('/extensions/search', input),
  extensionManifest: async (extensionId: string) =>
    extensionGet<ExtensionManifest>(`/extensions/${encodeURIComponent(extensionId)}/manifest`),
  extensionSurfacesForExtension: async (extensionId: string) =>
    extensionGet<ExtensionSurfaceSummary[]>(`/extensions/${encodeURIComponent(extensionId)}/surfaces`),
  extensionStateList: async <T = unknown>(extensionId: string, prefix = '') =>
    extensionGet<Array<{ key: string; value: T; version: number; createdAt: number; updatedAt: number }>>(
      `/extensions/${encodeURIComponent(extensionId)}/state${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`,
    ),
  extensionState: async <T = unknown>(extensionId: string, key: string) =>
    extensionGet<{ key: string; value: T; version: number; createdAt: number; updatedAt: number }>(
      `/extensions/${encodeURIComponent(extensionId)}/state/${encodeURIComponent(key)}`,
    ),
  putExtensionState: async (extensionId: string, key: string, value: unknown, opts?: { expectedVersion?: number }) =>
    extensionPut<{ ok: true; key: string; version: number }>(
      `/extensions/${encodeURIComponent(extensionId)}/state/${encodeURIComponent(key)}`,
      {
        value,
        expectedVersion: opts?.expectedVersion,
      },
    ),
  deleteExtensionState: async (extensionId: string, key: string) =>
    extensionDelete<{ ok: true; deleted: boolean }>(`/extensions/${encodeURIComponent(extensionId)}/state/${encodeURIComponent(key)}`),
  startExtensionRun: async (extensionId: string, input: unknown) =>
    extensionPost<unknown>(`/extensions/${encodeURIComponent(extensionId)}/runs`, input),
  invokeExtensionAction: async (extensionId: string, actionId: string, input: unknown) =>
    extensionPost<{ ok: true; result: unknown } | { ok: false; error: string }>(
      `/extensions/${encodeURIComponent(extensionId)}/actions/${encodeURIComponent(actionId)}`,
      input,
    ),
  listExtensionActions: async () =>
    extensionGet<
      Array<{
        extensionId: string;
        extensionName: string;
        actions: Array<{ id: string; title?: string; description?: string }>;
      }>
    >('/extensions/actions'),
  extensionStatus: async (extensionId: string) =>
    extensionGet<{ enabled: boolean; healthy: boolean; errors?: string[] }>(`/extensions/${encodeURIComponent(extensionId)}/status`),
  extensionSelfTest: async (extensionId: string) =>
    extensionPost<{ ok: boolean; extensionId: string; checks: Array<{ name: string; ok: boolean; error?: string }> }>(
      `/extensions/${encodeURIComponent(extensionId)}/self-test`,
    ),
  extensionTelemetry: async (extensionId?: string) =>
    extensionGet<Array<{ extensionId: string; actionId: string; ok: boolean; durationMs: number; at: string; error?: string }>>(
      `/extensions/telemetry${extensionId ? `?extensionId=${encodeURIComponent(extensionId)}` : ''}`,
    ),
  reloadExtensions: async () => extensionPost<{ ok: boolean; reloaded: boolean; message: string }>('/extensions/reload'),
  updateExtension: async (extensionId: string, input: { enabled: boolean }) =>
    extensionPatch<{ ok: true; extension?: ExtensionInstallSummary; actionResult?: { ok: boolean; result?: unknown; error?: string } }>(
      `/extensions/${encodeURIComponent(extensionId)}`,
      input,
    ),
  buildExtension: async (extensionId: string) =>
    extensionPost<{ ok: true; extensionId: string; outputs: string[] }>(`/extensions/${encodeURIComponent(extensionId)}/build`),
  validateExtension: async (extensionId: string) =>
    extensionPost<ExtensionDoctorReport>(`/extensions/${encodeURIComponent(extensionId)}/validate`),
  reloadExtension: async (extensionId: string) =>
    extensionPost<{ ok: true; id: string; reloaded: boolean; message: string }>(`/extensions/${encodeURIComponent(extensionId)}/reload`),
  snapshotExtension: async (extensionId: string) =>
    extensionPost<{ ok: true; extensionId: string; snapshotPath: string }>(`/extensions/${encodeURIComponent(extensionId)}/snapshot`),
  exportExtension: async (extensionId: string) =>
    extensionPost<{ ok: true; extensionId: string; exportPath: string }>(`/extensions/${encodeURIComponent(extensionId)}/export`),
  sessions: async () => {
    return (await requireLocalDesktopBridge('Reading sessions')).readSessions();
  },
  sessionMeta: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading session metadata')).readSessionMeta(id);
  },
  sessionDetail: async (
    id: string,
    options?: {
      tailBlocks?: number;
      knownSessionSignature?: string;
      knownBlockOffset?: number;
      knownTotalBlocks?: number;
      knownLastBlockId?: string;
    },
  ) => {
    return (await requireLocalDesktopBridge('Reading session details')).readSessionDetail({ sessionId: id, ...options });
  },
  sessionBlock: async (id: string, blockId: string) => {
    return (await requireLocalDesktopBridge('Reading session blocks')).readSessionBlock({ sessionId: id, blockId });
  },
  sessionSearchIndex: async (sessionIds: string[]) => {
    return (await requireLocalDesktopBridge('Reading session search indexes')).readSessionSearchIndex(sessionIds);
  },
  conversationContentSearch: async (query: string, limit = 80) =>
    post<ConversationContentSearchResult>('/sessions/search', { query, limit: normalizeConversationContentSearchLimit(limit) }),
  conversationSummaries: async (sessionIds: string[]) =>
    post<{ summaries: Record<string, ConversationSummaryRecord> }>('/conversation-summaries', { sessionIds }),

  skillFolders: async () => get<SkillFoldersState>('/skill-folders'),
  updateSkillFolders: async (skillDirs: string[]) => patch<SkillFoldersState>('/skill-folders', { skillDirs }),
  instructions: async () => get<InstructionFilesState>('/instructions'),
  updateInstructions: async (instructionFiles: string[]) => patch<InstructionFilesState>('/instructions', { instructionFiles }),

  // ── Models ────────────────────────────────────────────────────────────────
  models: async () => {
    return (await requireLocalDesktopBridge('Reading models')).readModels();
  },
  modelProviders: async () => {
    return (await requireLocalDesktopBridge('Reading model providers')).readModelProviders();
  },
  saveModelProvider: async (
    provider: string,
    input: {
      baseUrl?: string;
      api?: string;
      apiKey?: string;
      authHeader?: boolean;
      headers?: Record<string, string>;
      compat?: Record<string, unknown>;
      modelOverrides?: Record<string, unknown>;
    },
  ) => {
    return (await requireLocalDesktopBridge('Saving model providers')).saveModelProvider({ provider, ...input });
  },
  deleteModelProvider: async (provider: string) => {
    return (await requireLocalDesktopBridge('Deleting model providers')).deleteModelProvider(provider);
  },
  saveModelProviderModel: async (
    provider: string,
    input: {
      modelId: string;
      name?: string;
      api?: string;
      baseUrl?: string;
      reasoning?: boolean;
      input?: Array<'text' | 'image'>;
      contextWindow?: number;
      maxTokens?: number;
      headers?: Record<string, string>;
      cost?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
      };
      compat?: Record<string, unknown>;
    },
  ) => {
    return (await requireLocalDesktopBridge('Saving model provider models')).saveModelProviderModel({ provider, ...input });
  },
  deleteModelProviderModel: async (provider: string, modelId: string) => {
    return (await requireLocalDesktopBridge('Deleting model provider models')).deleteModelProviderModel({ provider, modelId });
  },
  defaultCwd: async () => {
    return (await requireLocalDesktopBridge('Reading default cwd')).readDefaultCwd();
  },
  tools: async () => get<ToolsState>('/tools'),
  setModel: async (model: string) => {
    return (await requireLocalDesktopBridge('Updating model preferences')).updateModelPreferences({ model });
  },
  updateModelPreferences: async (input: { model?: string; visionModel?: string; thinkingLevel?: string; serviceTier?: string }) => {
    return (await requireLocalDesktopBridge('Updating model preferences')).updateModelPreferences(input);
  },
  updateDefaultCwd: async (cwd: string | null) => {
    return (await requireLocalDesktopBridge('Updating default cwd')).updateDefaultCwd(cwd);
  },
  providerAuth: async () => {
    return (await requireLocalDesktopBridge('Reading provider auth')).readProviderAuth();
  },
  setProviderApiKey: async (provider: string, apiKey: string) => {
    return (await requireLocalDesktopBridge('Setting provider API keys')).setProviderApiKey({ provider, apiKey });
  },
  removeProviderCredential: async (provider: string) => {
    return (await requireLocalDesktopBridge('Removing provider credentials')).removeProviderCredential(provider);
  },
  startProviderOAuthLogin: async (provider: string) => {
    return (await requireLocalDesktopBridge('Starting provider OAuth login')).startProviderOAuthLogin(provider);
  },
  providerOAuthLogin: async (loginId: string) => {
    return (await requireLocalDesktopBridge('Reading provider OAuth login')).readProviderOAuthLogin(loginId);
  },
  submitProviderOAuthLoginInput: async (loginId: string, value: string) => {
    return (await requireLocalDesktopBridge('Submitting provider OAuth input')).submitProviderOAuthLoginInput({ loginId, value });
  },
  cancelProviderOAuthLogin: async (loginId: string) => {
    return (await requireLocalDesktopBridge('Cancelling provider OAuth login')).cancelProviderOAuthLogin(loginId);
  },
  openConversationTabs: async () => {
    return (await requireLocalDesktopBridge('Reading open conversation tabs')).readOpenConversationTabs();
  },
  setOpenConversationTabs: async (
    sessionIds?: string[] | null,
    pinnedSessionIds?: string[] | null,
    archivedSessionIds?: string[] | null,
    workspacePaths?: string[] | null,
    activeConversationId?: string | null,
  ) => {
    const request = {
      ...(sessionIds !== undefined ? { sessionIds } : {}),
      ...(pinnedSessionIds !== undefined ? { pinnedSessionIds } : {}),
      ...(archivedSessionIds !== undefined ? { archivedSessionIds } : {}),
      ...(workspacePaths !== undefined ? { workspacePaths } : {}),
      ...(activeConversationId !== undefined ? { activeConversationId } : {}),
    };
    return (await requireLocalDesktopBridge('Updating open conversation tabs')).updateOpenConversationTabs(request);
  },
  savedWorkspacePaths: async () => {
    const { workspacePaths } = await api.openConversationTabs();
    return workspacePaths;
  },
  setSavedWorkspacePaths: async (workspacePaths: string[]) => {
    const { workspacePaths: savedPaths } = await api.setOpenConversationTabs(undefined, undefined, undefined, workspacePaths);
    return savedPaths;
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: async () => {
    return (await requireLocalDesktopBridge('Reading scheduled tasks')).readScheduledTasks();
  },
  taskDetail: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading scheduled task details')).readScheduledTaskDetail(id);
  },
  taskSchedulerHealth: async () => {
    const bridge = await requireLocalDesktopBridge('Reading scheduled task scheduler health');
    if (!bridge.readScheduledTaskSchedulerHealth) {
      throw new Error('Reading scheduled task scheduler health requires the local desktop host.');
    }
    return bridge.readScheduledTaskSchedulerHealth();
  },
  createTask: async (input: {
    title: string;
    enabled?: boolean;
    cron?: string | null;
    at?: string | null;
    model?: string | null;
    thinkingLevel?: string | null;
    cwd?: string | null;
    timeoutSeconds?: number | null;
    catchUpWindowSeconds?: number | null;
    prompt: string;
    targetType?: 'background-agent' | 'conversation' | null;
    threadMode?: 'dedicated' | 'existing' | 'none' | null;
    threadConversationId?: string | null;
  }) => {
    return (await requireLocalDesktopBridge('Creating scheduled tasks')).createScheduledTask(input);
  },
  setTaskEnabled: async (id: string, enabled: boolean) => {
    return (await requireLocalDesktopBridge('Updating scheduled tasks')).updateScheduledTask({ taskId: id, enabled });
  },
  saveTask: async (
    id: string,
    input: {
      title?: string;
      enabled?: boolean;
      cron?: string | null;
      at?: string | null;
      model?: string | null;
      thinkingLevel?: string | null;
      cwd?: string | null;
      timeoutSeconds?: number | null;
      catchUpWindowSeconds?: number | null;
      prompt?: string;
      targetType?: 'background-agent' | 'conversation' | null;
      threadMode?: 'dedicated' | 'existing' | 'none' | null;
      threadConversationId?: string | null;
    },
  ) => {
    return (await requireLocalDesktopBridge('Updating scheduled tasks')).updateScheduledTask({ taskId: id, ...input });
  },
  taskLog: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading scheduled task logs')).readScheduledTaskLog(id);
  },
  deleteTask: async (id: string) => {
    return (await requireLocalDesktopBridge('Deleting scheduled tasks')).deleteScheduledTask(id);
  },
  runTaskNow: async (id: string) => {
    return (await requireLocalDesktopBridge('Running scheduled tasks')).runScheduledTask(id);
  },
  automations: {
    list: () => api.tasks(),
    get: (taskId: string) => api.taskDetail(taskId),
    create: (input: Parameters<typeof api.createTask>[0]) => api.createTask(input),
    update: (taskId: string, input: Parameters<typeof api.saveTask>[1]) => api.saveTask(taskId, input),
    delete: (taskId: string) => api.deleteTask(taskId),
    run: (taskId: string) => api.runTaskNow(taskId),
    readLog: (taskId: string) => api.taskLog(taskId),
    readSchedulerHealth: () => api.taskSchedulerHealth(),
  },
  runs: async () => {
    return (await requireLocalDesktopBridge('Reading durable runs')).readDurableRuns();
  },
  durableRun: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading durable runs')).readDurableRun(id);
  },
  durableRunLog: async (id: string, tail?: number) => {
    return (await requireLocalDesktopBridge('Reading durable run logs')).readDurableRunLog({ runId: id, tail });
  },
  markDurableRunAttentionRead: async (id: string, read = true) => {
    return (await requireLocalDesktopBridge('Updating durable run attention')).markDurableRunAttention({ runId: id, read });
  },
  cancelDurableRun: async (id: string) => {
    return (await requireLocalDesktopBridge('Cancelling durable runs')).cancelDurableRun(id);
  },
  executions: async () => get<import('../shared/types').ExecutionListResult>('/executions'),
  conversationExecutions: async (
    conversationId: string,
    options: { active?: boolean; visibility?: 'primary' | 'system' | 'hidden' | 'visible' | 'all' } = {},
  ) => {
    const params = new URLSearchParams();
    if (options.active !== undefined) params.set('active', String(options.active));
    if (options.visibility) params.set('visibility', options.visibility);
    const query = params.toString();
    return get<import('../shared/types').ConversationExecutionsResult>(
      `/conversations/${encodeURIComponent(conversationId)}/executions${query ? `?${query}` : ''}`,
    );
  },
  execution: async (id: string) => get<import('../shared/types').ExecutionDetailResult>(`/executions/${encodeURIComponent(id)}`),
  executionLog: async (id: string, tail?: number) => {
    const normalizedTail = normalizeDurableRunLogTailParam(tail);
    return get<{ log: string; path: string }>(
      `/executions/${encodeURIComponent(id)}/log${normalizedTail ? `?tail=${encodeURIComponent(String(normalizedTail))}` : ''}`,
    );
  },
  cancelExecution: async (id: string) => post<{ cancelled: boolean; runId: string }>(`/executions/${encodeURIComponent(id)}/cancel`),
  rerunExecution: async (id: string) =>
    post<{ accepted: boolean; runId: string; sourceRunId?: string; logPath?: string }>(`/executions/${encodeURIComponent(id)}/rerun`),
  followUpExecution: async (id: string, prompt?: string) =>
    post<{ accepted: boolean; runId: string; sourceRunId?: string; logPath?: string }>(
      `/executions/${encodeURIComponent(id)}/follow-up`,
      prompt ? { prompt } : {},
    ),

  // ── Workspace helpers ────────────────────────────────────────────────────
  pickFolder: async (input?: string | { cwd?: string | null; prompt?: string | null }) => {
    const request =
      typeof input === 'string'
        ? { cwd: input }
        : {
            ...(input?.cwd !== undefined ? { cwd: input.cwd } : {}),
            ...(typeof input?.prompt === 'string' && input.prompt.trim().length > 0 ? { prompt: input.prompt.trim() } : {}),
          };
    return (await requireLocalDesktopBridge('Picking folders')).pickFolder(request);
  },
  pickFiles: async (cwd?: string) => post<FilePickerResult>('/file-picker', cwd !== undefined ? { cwd } : {}),

  // ── Memory browser ────────────────────────────────────────────────────────
  memory: () => getMemoryData(),

  markConversationAttentionRead: async (id: string, read = true) => {
    return (await requireLocalDesktopBridge('Updating conversation attention')).markConversationAttention({ conversationId: id, read });
  },

  // ── Live sessions ─────────────────────────────────────────────────────────
  liveSession: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading live sessions')).readLiveSession(id) as Promise<LiveSessionMeta & { live: boolean }>;
  },
  liveSessionContext: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading live session context')).readLiveSessionContext(id);
  },
  workspaceTree: async (cwd: string, path = '') => {
    const params = new URLSearchParams({ cwd });
    if (path) params.set('path', path);
    return get<WorkspaceDirectoryListing>(`/workspace/tree?${params.toString()}`);
  },
  workspaceFile: async (cwd: string, path: string, options?: { force?: boolean }) => {
    const params = new URLSearchParams({ cwd, path });
    if (options?.force) params.set('force', '1');
    return get<WorkspaceFileContent>(`/workspace/file?${params.toString()}`);
  },
  workspaceDiff: async (cwd: string, path: string) => {
    const params = new URLSearchParams({ cwd, path });
    return get<WorkspaceDiffOverlay>(`/workspace/diff?${params.toString()}`);
  },
  workspaceUncommittedDiff: async (cwd: string) => {
    return get<UncommittedDiffResult>(`/workspace/uncommitted-diff?cwd=${encodeURIComponent(cwd)}`);
  },
  writeWorkspaceFile: async (cwd: string, path: string, content: string) =>
    put<WorkspaceFileContent>('/workspace/file', { cwd, path, content }),
  createWorkspaceFile: async (cwd: string, path: string, content = '') =>
    put<WorkspaceFileContent>('/workspace/file', { cwd, path, content }),
  createWorkspaceFolder: async (cwd: string, path: string) => post<WorkspaceEntry>('/workspace/folder', { cwd, path }),
  deleteWorkspacePath: async (cwd: string, path: string) => {
    const params = new URLSearchParams({ cwd, path });
    return del<{ ok: boolean }>(`/workspace/path?${params.toString()}`);
  },
  renameWorkspacePath: async (cwd: string, path: string, newName: string) =>
    post<WorkspaceEntry>('/workspace/rename', { cwd, path, newName }),
  moveWorkspacePath: async (cwd: string, path: string, targetDir: string) =>
    post<WorkspaceEntry>('/workspace/move', { cwd, path, targetDir }),
  conversationBootstrap: async (
    id: string,
    options?: {
      tailBlocks?: number;
      knownSessionSignature?: string;
      knownBlockOffset?: number;
      knownTotalBlocks?: number;
      knownLastBlockId?: string;
    },
  ) => {
    return (await requireLocalDesktopBridge('Reading conversation bootstrap')).readConversationBootstrap({
      conversationId: id,
      ...options,
    });
  },
  conversationPlansWorkspace: async () => {
    return (await requireLocalDesktopBridge('Reading conversation plans workspace')).readConversationPlansWorkspace();
  },
  conversationArtifacts: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading conversation artifacts')).readConversationArtifacts(id);
  },
  conversationArtifact: async (id: string, artifactId: string) => {
    return (await requireLocalDesktopBridge('Reading conversation artifacts')).readConversationArtifact({ conversationId: id, artifactId });
  },
  conversationCheckpoints: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading conversation checkpoints')).readConversationCheckpoints(id);
  },
  conversationCheckpoint: async (id: string, checkpointId: string) => {
    return (await requireLocalDesktopBridge('Reading conversation checkpoints')).readConversationCheckpoint({
      conversationId: id,
      checkpointId,
    });
  },
  conversationCheckpointReviewContext: async (id: string, checkpointId: string) => {
    return get<ConversationCheckpointReviewContext>(
      `/conversations/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}/review-context`,
    );
  },
  createConversationCheckpointComment: async (id: string, checkpointId: string, input: { body: string; filePath?: string }) => {
    return post<{ conversationId: string; checkpoint: ConversationCommitCheckpointRecord }>(
      `/conversations/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}/comments`,
      input,
    );
  },
  conversationContextDocs: async (id: string) => {
    return get<{ conversationId: string; attachedContextDocs: ConversationContextDocRef[] }>(
      `/conversations/${encodeURIComponent(id)}/context-docs`,
    );
  },
  updateConversationContextDocs: async (id: string, docs: ConversationContextDocRef[]) => {
    return patch<{ conversationId: string; attachedContextDocs: ConversationContextDocRef[] }>(
      `/conversations/${encodeURIComponent(id)}/context-docs`,
      { docs },
    );
  },
  conversationAttachments: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading conversation attachments')).readConversationAttachments(id);
  },
  conversationAttachment: async (id: string, attachmentId: string) => {
    return (await requireLocalDesktopBridge('Reading conversation attachments')).readConversationAttachment({
      conversationId: id,
      attachmentId,
    });
  },
  conversationAttachmentAsset: async (
    id: string,
    attachmentId: string,
    asset: 'source' | 'preview',
    revision?: number,
  ): Promise<ConversationAttachmentAssetData> => {
    return (await requireLocalDesktopBridge('Reading conversation attachment assets')).readConversationAttachmentAsset({
      conversationId: id,
      attachmentId,
      asset,
      revision,
    });
  },
  createConversationAttachment: async (
    id: string,
    input: {
      kind?: 'excalidraw';
      title?: string;
      sourceData: string;
      sourceName?: string;
      sourceMimeType?: string;
      previewData: string;
      previewName?: string;
      previewMimeType?: string;
      note?: string;
    },
  ) => {
    return (await requireLocalDesktopBridge('Creating conversation attachments')).createConversationAttachment({
      conversationId: id,
      ...input,
    });
  },
  updateConversationAttachment: async (
    id: string,
    attachmentId: string,
    input: {
      title?: string;
      sourceData: string;
      sourceName?: string;
      sourceMimeType?: string;
      previewData: string;
      previewName?: string;
      previewMimeType?: string;
      note?: string;
    },
  ) => {
    return (await requireLocalDesktopBridge('Updating conversation attachments')).updateConversationAttachment({
      conversationId: id,
      attachmentId,
      ...input,
    });
  },
  deferredResumes: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading deferred resumes')).readConversationDeferredResumes(id);
  },
  scheduleDeferredResume: async (id: string, input: { delay: string; prompt?: string; behavior?: 'steer' | 'followUp' }) => {
    return (await requireLocalDesktopBridge('Scheduling deferred resumes')).scheduleConversationDeferredResume({
      conversationId: id,
      ...input,
    });
  },
  fireDeferredResumeNow: async (id: string, resumeId: string) => {
    return (await requireLocalDesktopBridge('Firing deferred resumes')).fireConversationDeferredResume({ conversationId: id, resumeId });
  },
  cancelDeferredResume: async (id: string, resumeId: string) => {
    return (await requireLocalDesktopBridge('Cancelling deferred resumes')).cancelConversationDeferredResume({
      conversationId: id,
      resumeId,
    });
  },
  changeConversationCwd: async (id: string, cwd: string, surfaceId?: string) => {
    return (await requireLocalDesktopConversationBridge(id, 'Changing conversation working directories')).changeConversationCwd({
      conversationId: id,
      cwd,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  duplicateConversation: async (id: string) => {
    return requestJson<{ newSessionId: string; sessionFile: string }>('POST', `/conversations/${encodeURIComponent(id)}/duplicate`);
  },
  renameConversation: async (id: string, name: string, surfaceId?: string) => {
    return (await requireLocalDesktopBridge('Renaming conversations')).renameConversation({
      conversationId: id,
      name,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  updateGoal: async (id: string, input: { objective?: string }) => {
    return (await requireLocalDesktopConversationBridge(id, 'Updating conversation goals')).updateConversationGoal({
      conversationId: id,
      ...input,
    });
  },
  conversationModelPreferences: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading conversation model preferences')).readConversationModelPreferences({
      conversationId: id,
    });
  },
  updateConversationModelPreferences: async (
    id: string,
    input: { model?: string | null; thinkingLevel?: string | null; serviceTier?: string | null },
    surfaceId?: string,
  ) => {
    return (await requireLocalDesktopConversationBridge(id, 'Updating conversation model preferences')).updateConversationModelPreferences({
      conversationId: id,
      ...input,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  recoverConversation: async (id: string) => {
    return (await requireLocalDesktopConversationBridge(id, 'Recovering conversations')).recoverConversation(id);
  },
  createLiveSession: async (
    cwd?: string,
    text?: string,
    options?: {
      workspaceCwd?: string | null;
      model?: string | null;
      thinkingLevel?: string | null;
      serviceTier?: string | null;
      behavior?: 'steer' | 'followUp';
      images?: Array<{ data: string; mimeType: string; name?: string }>;
      attachmentRefs?: unknown;
      contextMessages?: Array<{ customType: string; content: string }>;
      relatedConversationIds?: unknown;
    },
  ) => {
    const startedAtMs = performance.now();
    const result = await (
      await requireLocalDesktopBridge('Creating live sessions')
    ).createLiveSession({
      cwd,
      ...(options?.workspaceCwd !== undefined ? { workspaceCwd: options.workspaceCwd } : {}),
      ...(options?.model !== undefined ? { model: options.model } : {}),
      ...(options?.thinkingLevel !== undefined ? { thinkingLevel: options.thinkingLevel } : {}),
      ...(options?.serviceTier !== undefined ? { serviceTier: options.serviceTier } : {}),
      ...(text !== undefined ? { prompt: text } : {}),
      ...(options?.behavior !== undefined ? { behavior: options.behavior } : {}),
      ...(options?.images !== undefined ? { images: options.images } : {}),
      ...(options?.attachmentRefs !== undefined ? { attachmentRefs: options.attachmentRefs } : {}),
      ...(options?.contextMessages !== undefined ? { contextMessages: options.contextMessages } : {}),
      ...(options?.relatedConversationIds !== undefined ? { relatedConversationIds: options.relatedConversationIds } : {}),
    });
    recordClientPerfTiming({
      name: 'desktop.createLiveSession',
      startedAtMs,
      meta: { hasPrompt: Boolean(text?.trim()), hasCwd: Boolean(cwd?.trim()), serverPerf: result.perf ?? null },
    });
    return result;
  },

  resumeSession: async (sessionFile: string, cwd?: string) => {
    return (await requireLocalDesktopBridge('Resuming live sessions')).resumeLiveSession({ sessionFile, ...(cwd ? { cwd } : {}) });
  },

  promptSession: async (
    id: string,
    text: string,
    behavior?: 'steer' | 'followUp',
    images?: PromptImageInput[],
    attachmentRefs?: PromptAttachmentRefInput[],
    surfaceId?: string,
    contextMessages?: Array<Pick<InjectedPromptMessage, 'customType' | 'content'>>,
    relatedConversationIds?: string[],
  ) => {
    return (await requireLocalDesktopConversationBridge(id, 'Prompting live sessions')).submitLiveSessionPrompt({
      conversationId: id,
      text,
      behavior,
      ...(surfaceId ? { surfaceId } : {}),
      images,
      attachmentRefs,
      contextMessages,
      relatedConversationIds,
    });
  },

  restoreQueuedMessage: async (
    id: string,
    input: { behavior: 'steer' | 'followUp'; index: number; previewId?: string },
    surfaceId?: string,
  ) => {
    void surfaceId;
    return (await requireLocalDesktopConversationBridge(id, 'Restoring queued prompts')).restoreQueuedLiveSessionMessage({
      conversationId: id,
      behavior: input.behavior,
      index: input.index,
      ...(input.previewId ? { previewId: input.previewId } : {}),
    });
  },
  clearQueuedMessages: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return (await requireLocalDesktopConversationBridge(id, 'Clearing queued conversation prompts')).clearQueuedLiveSessionMessages({
      conversationId: id,
    });
  },
  takeoverLiveSession: async (id: string, surfaceId: string) => {
    return (await requireLocalDesktopConversationBridge(id, 'Taking over live sessions')).takeOverLiveSession({
      conversationId: id,
      surfaceId,
    });
  },
  compactSession: async (id: string, customInstructions?: string, surfaceId?: string) => {
    void surfaceId;
    return (await requireLocalDesktopConversationBridge(id, 'Compacting live sessions')).compactLiveSession({
      conversationId: id,
      customInstructions,
    });
  },
  exportSession: async (id: string, outputPath?: string) => {
    return (await requireLocalDesktopConversationBridge(id, 'Exporting live sessions')).exportLiveSession({
      conversationId: id,
      outputPath,
    });
  },
  reloadSession: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return (await requireLocalDesktopConversationBridge(id, 'Reloading live sessions')).reloadLiveSession(id);
  },
  abortSession: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return (await requireLocalDesktopConversationBridge(id, 'Stopping live sessions')).abortLiveSession(id);
  },

  destroySession: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return (await requireLocalDesktopConversationBridge(id, 'Destroying live sessions')).destroyLiveSession(id);
  },

  forkEntries: async (id: string) => {
    return (await requireLocalDesktopBridge('Reading live session fork entries')).readLiveSessionForkEntries(id);
  },
  branchSession: async (id: string, entryId: string, surfaceId?: string) => {
    return (await requireLocalDesktopConversationBridge(id, 'Branching live sessions')).branchLiveSession({
      conversationId: id,
      entryId,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  forkSession: async (id: string, entryId: string, options?: { preserveSource?: boolean; beforeEntry?: boolean }, surfaceId?: string) => {
    return (await requireLocalDesktopConversationBridge(id, 'Forking live sessions')).forkLiveSession({
      conversationId: id,
      entryId,
      preserveSource: options?.preserveSource,
      beforeEntry: options?.beforeEntry,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },

  executeLiveSessionBash: async (id: string, command: string, options?: { excludeFromContext?: boolean }) =>
    (await requireLocalDesktopConversationBridge(id, 'Running live-session bash commands')).executeLiveSessionBash({
      conversationId: id,
      command,
      excludeFromContext: options?.excludeFromContext,
    }),

  gateways: async () => get<GatewayState>('/gateways'),
  ensureGatewayConnection: async (provider: GatewayProviderId) => post<GatewayState>('/gateways/connections', { provider }),
  updateGatewayConnection: async (
    provider: GatewayProviderId,
    input: { status: GatewayStatus; enabled?: boolean; statusMessage?: string },
  ) => patch<GatewayState>(`/gateways/connections/${encodeURIComponent(provider)}`, input),
  attachGatewayConversation: async (input: {
    provider: GatewayProviderId;
    conversationId: string;
    conversationTitle?: string;
    externalChatId?: string;
    externalChatLabel?: string;
  }) => post<GatewayState>('/gateways/bindings', input),
  detachGatewayConversation: async (conversationId: string, provider?: GatewayProviderId) =>
    del<GatewayState>(
      `/gateways/bindings/${encodeURIComponent(conversationId)}${provider ? `?provider=${encodeURIComponent(provider)}` : ''}`,
    ),
  telegramGatewayToken: async () => get<{ configured: boolean }>('/gateways/telegram/token'),
  saveTelegramGatewayToken: async (token: string) =>
    post<{ configured: boolean; state: GatewayState }>('/gateways/telegram/token', { token }),
  deleteTelegramGatewayToken: async () => del<{ configured: boolean; state: GatewayState }>('/gateways/telegram/token'),
  saveTelegramGatewayChat: async (chatId: string) => post<GatewayState>('/gateways/telegram/chat', { chatId }),
  slackMcpAuthState: async () => get<{ authenticated: boolean }>('/gateways/slack-mcp/auth'),
  connectSlackMcp: async () => post<{ authenticated: boolean; state: GatewayState }>('/gateways/slack-mcp/auth', {}),
  disconnectSlackMcp: async () => del<{ authenticated: boolean; state: GatewayState }>('/gateways/slack-mcp/auth'),
  saveSlackMcpChannel: async (input: { channelId: string; channelLabel?: string }) =>
    post<GatewayState>('/gateways/slack-mcp/channel', input),
  attachSlackMcpChannel: async (input: {
    conversationId: string;
    conversationTitle?: string;
    externalChatId: string;
    externalChatLabel?: string;
  }) => post<GatewayState>('/gateways/slack-mcp/attach', input),

  // ── Traces ────────────────────────────────────────────────────────────
  tracesSummary: (range?: string) => get<TraceSummary>(`/traces/summary${range ? `?range=${range}` : ''}`),
  tracesModelUsage: (range?: string) =>
    get<{ models: TraceModelUsage[]; throughput: TraceThroughput[] }>(`/traces/model-usage${range ? `?range=${range}` : ''}`),
  tracesCostByConversation: (range?: string) => get<TraceCostRow[]>(`/traces/cost-by-conversation${range ? `?range=${range}` : ''}`),
  tracesToolHealth: (range?: string) => get<TraceToolHealth[]>(`/traces/tool-health${range ? `?range=${range}` : ''}`),
  tracesContext: (range?: string) => get<TraceContextResponse>(`/traces/context${range ? `?range=${range}` : ''}`),
  tracesAgentLoop: (range?: string) => get<TraceAgentLoop | null>(`/traces/agent-loop${range ? `?range=${range}` : ''}`),
  tracesTokensDaily: (range?: string) => get<TraceTokenDaily[]>(`/traces/tokens-daily${range ? `?range=${range}` : ''}`),
  tracesToolFlow: (range?: string) => get<ToolFlowResult>(`/traces/tool-flow${range ? `?range=${range}` : ''}`),
  tracesAutoMode: (range?: string) => get<AutoModeSummary>(`/traces/auto-mode${range ? `?range=${range}` : ''}`),
  tracesCacheEfficiency: (range?: string) =>
    get<{ series: CacheEfficiencyPoint[]; aggregate: CacheEfficiencyAggregate }>(
      `/traces/cache-efficiency${range ? `?range=${range}` : ''}`,
    ),
  tracesSystemPrompt: (range?: string) =>
    get<{ series: SystemPromptPoint[]; aggregate: SystemPromptAggregate }>(`/traces/system-prompt${range ? `?range=${range}` : ''}`),
  tracesContextPointers: (range?: string) => get<ContextPointerUsageResult>(`/traces/context-pointers${range ? `?range=${range}` : ''}`),
  tracesSessionIntegrity: (range?: string) => get<AppTelemetryEventRow[]>(`/traces/session-integrity${range ? `?range=${range}` : ''}`),
  telemetryLogs: () => get<AppTelemetryLogDiagnostics>('/telemetry/logs'),
  exportTelemetryLogs: (input?: { since?: string }) => post<AppTelemetryLogBundleExport>('/telemetry/logs/export', input ?? {}),
  maintainTelemetryDb: () => post<TelemetryDbMaintenanceResult>('/telemetry/db/maintenance'),

  // ── Unified settings store ──────────────────────────────────────

  settings: async () => get<Record<string, unknown>>('/settings'),
  settingsSchema: async () =>
    get<
      Array<{
        extensionId: string;
        key: string;
        type: string;
        default?: unknown;
        description?: string;
        group: string;
        enum?: string[];
        placeholder?: string;
        order: number;
      }>
    >('/settings/schema'),
  updateSettings: async (overrides: Record<string, unknown>) => patch<Record<string, unknown>>('/settings', overrides),

  // ── Secrets ─────────────────────────────────────────────────────

  secrets: async () => get<SecretsState>('/secrets'),
  setSecret: async (extensionId: string, secretId: string, value: string) =>
    put<SecretsState>(`/secrets/${encodeURIComponent(extensionId)}/${encodeURIComponent(secretId)}`, { value }),
  deleteSecret: async (extensionId: string, secretId: string) =>
    del<SecretsState>(`/secrets/${encodeURIComponent(extensionId)}/${encodeURIComponent(secretId)}`),
};
