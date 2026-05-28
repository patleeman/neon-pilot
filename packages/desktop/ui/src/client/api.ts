import type { RelatedConversationSearchResult } from '../conversation/relatedConversationSearch';
import { getDesktopBridge } from '../desktop/desktopBridge';
import type {
  ExtensionCommandRegistration,
  ExtensionDoctorReport,
  ExtensionInstallSummary,
  ExtensionKeybindingRegistration,
  ExtensionManifest,
  ExtensionMentionRegistration,
  ExtensionQuickOpenRegistration,
  ExtensionRouteCapability,
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
  ConversationBootstrapState,
  ConversationCheckpointReviewContext,
  ConversationCommitCheckpointRecord,
  ConversationContentSearchResult,
  ConversationContextDocRef,
  ConversationSummaryRecord,
  DesktopConversationState,
  FilePickerResult,
  GatewayProviderId,
  GatewayState,
  GatewayStatus,
  InjectedPromptMessage,
  InstructionFilesState,
  LiveSessionCreateResult,
  LiveSessionExportResult,
  LiveSessionMeta,
  LiveSessionPresenceState,
  MemoryData,
  PromptAttachmentRefInput,
  PromptImageInput,
  SecretsState,
  SkillFoldersState,
  SystemPromptAggregate,
  SystemPromptPoint,
  SystemPromptTemplateState,
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

export interface ExtensionRegistryApiState {
  extensions: ExtensionInstallSummary[];
  routes: ExtensionRouteSummary[];
  surfaces: ExtensionSurfaceSummary[];
  settings: Record<string, unknown>;
}

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
const pendingExtensionActionPaths = new Map<string, Promise<string>>();

async function requireDesktopBridge(action: string): Promise<NonNullable<ReturnType<typeof getDesktopBridge>>> {
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    return desktopBridge;
  }

  throw new Error(`${action} requires the desktop shell.`);
}

async function getMemoryData(): Promise<MemoryData> {
  const cacheKey = '__current__';
  const pending = pendingMemoryRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = resolveExtensionActionPathByRouteCapability('knowledgeFiles', 'readMemory')
    .then((actionPath) => extensionPost<{ ok: true; result: MemoryData } | { ok: false; error: string }>(actionPath, {}))
    .then((response) => {
      if (response.ok === false) {
        throw new Error(response.error || 'Memory data is unavailable.');
      }
      return response.result;
    })
    .finally(() => {
      pendingMemoryRequests.delete(cacheKey);
    });
  pendingMemoryRequests.set(cacheKey, request);
  return request;
}

function extensionHasRouteCapability(extension: ExtensionInstallSummary, capability: ExtensionRouteCapability): boolean {
  return Boolean(
    extension.manifest.contributes?.views?.some((view) => view.routeCapabilities?.includes(capability)) ||
    extension.surfaces?.some((surface) => surface.routeCapabilities?.includes(capability)),
  );
}

async function resolveExtensionActionPathByRouteCapability(capability: ExtensionRouteCapability, actionId: string): Promise<string> {
  const cacheKey = `${capability}:${actionId}`;
  const pending = pendingExtensionActionPaths.get(cacheKey);
  if (pending) return pending;

  const request = api
    .extensionInstallations()
    .then((extensions) => {
      const extension = extensions.find(
        (candidate) =>
          candidate.enabled &&
          extensionHasRouteCapability(candidate, capability) &&
          (candidate.backendActions ?? candidate.manifest.backend?.actions ?? []).some((action) => action.id === actionId),
      );
      if (!extension) {
        throw new Error(`No enabled extension provides ${capability}.${actionId}.`);
      }
      return `/extensions/${encodeURIComponent(extension.id)}/actions/${encodeURIComponent(actionId)}`;
    })
    .finally(() => {
      pendingExtensionActionPaths.delete(cacheKey);
    });
  pendingExtensionActionPaths.set(cacheKey, request);
  return request;
}

export function normalizeDurableRunLogTailParam(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(1000, value) : undefined;
}

export function normalizeConversationContentSearchLimit(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(100, value) : 80;
}

export function normalizeKnowledgeSearchLimit(value: unknown): number {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(50, value) : 20;
}

export const api = {
  // ── Core ──────────────────────────────────────────────────────────────────
  status: async () => get<AppStatus>('/status'),
  daemon: async () => get<DaemonState>('/daemon'),
  extensions: async () => extensionGet<ExtensionManifest[]>('/extensions'),
  extensionInstallations: async () => extensionGet<ExtensionInstallSummary[]>('/extensions/installed'),
  extensionRegistry: async () => extensionGet<ExtensionRegistryApiState>('/extensions/registry'),
  extensionCriticalRegistry: async () => extensionGet<ExtensionRegistryApiState>('/extensions/registry/critical'),
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
  deleteExtension: async (extensionId: string) =>
    extensionDelete<{ ok: true; extensionId: string; deleted: boolean }>(`/extensions/${encodeURIComponent(extensionId)}`),
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
  sessions: async () => get<SessionMeta[]>('/sessions'),
  sessionMeta: async (id: string) => get<SessionMeta>(`/sessions/${encodeURIComponent(id)}/meta`),
  sessionDetail: async (
    id: string,
    options?: {
      tailBlocks?: number;
      includeToolBlocks?: boolean;
      knownSessionSignature?: string;
      knownBlockOffset?: number;
      knownTotalBlocks?: number;
      knownLastBlockId?: string;
    },
  ) => {
    const params = new URLSearchParams();
    if (options?.tailBlocks !== undefined) params.set('tailBlocks', String(options.tailBlocks));
    if (options?.includeToolBlocks === false) params.set('includeToolBlocks', 'false');
    if (options?.knownSessionSignature) params.set('knownSessionSignature', options.knownSessionSignature);
    if (options?.knownBlockOffset !== undefined) params.set('knownBlockOffset', String(options.knownBlockOffset));
    if (options?.knownTotalBlocks !== undefined) params.set('knownTotalBlocks', String(options.knownTotalBlocks));
    if (options?.knownLastBlockId) params.set('knownLastBlockId', options.knownLastBlockId);
    const query = params.toString();
    return get<SessionDetailResult>(`/sessions/${encodeURIComponent(id)}${query ? `?${query}` : ''}`);
  },
  sessionBlock: async (id: string, blockId: string) => {
    return get<DisplayBlock>(`/sessions/${encodeURIComponent(id)}/blocks/${encodeURIComponent(blockId)}`);
  },
  sessionEntryBlocks: async (id: string, entryIds: string[]) => {
    return post<{ blocks: DisplayBlock[] }>(`/sessions/${encodeURIComponent(id)}/entry-blocks`, { entryIds });
  },
  sessionSearchIndex: async (sessionIds: string[]) => {
    return post<{ index: Record<string, string> }>('/sessions/search-index', { sessionIds });
  },
  relatedConversationResults: async (input: {
    sessions: SessionMeta[];
    searchIndex: Record<string, string>;
    summaries: Record<string, ConversationSummaryRecord>;
    query: string;
    workspaceCwd?: string | null;
    selectedRelatedThreadIds?: string[];
    limit?: number;
  }) =>
    post<{
      searchResults: RelatedConversationSearchResult[];
      recentResults: RelatedConversationSearchResult[];
      visibleResults: RelatedConversationSearchResult[];
    }>('/related-conversations/results', input),
  conversationContentSearch: async (query: string, limit = 80) =>
    post<ConversationContentSearchResult>('/sessions/search', { query, limit: normalizeConversationContentSearchLimit(limit) }),
  conversationSummaries: async (sessionIds: string[]) =>
    post<{ summaries: Record<string, ConversationSummaryRecord> }>('/conversation-summaries', { sessionIds }),

  skillFolders: async () => get<SkillFoldersState>('/skill-folders'),
  updateSkillFolders: async (skillDirs: string[]) => patch<SkillFoldersState>('/skill-folders', { skillDirs }),
  instructions: async () => get<InstructionFilesState>('/instructions'),
  updateInstructions: async (instructionFiles: string[]) => patch<InstructionFilesState>('/instructions', { instructionFiles }),
  systemPromptTemplate: async () => get<SystemPromptTemplateState>('/system-prompt-template'),
  updateSystemPromptTemplate: async (template: string) => patch<SystemPromptTemplateState>('/system-prompt-template', { template }),

  // ── Models ────────────────────────────────────────────────────────────────
  models: async () => get<ModelState>('/models'),
  modelProviders: async () => get<ModelProviderState>('/model-providers'),
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
  ) => patch<ModelProviderState>(`/model-providers/${encodeURIComponent(provider)}`, input),
  deleteModelProvider: async (provider: string) => del<ModelProviderState>(`/model-providers/${encodeURIComponent(provider)}`),
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
  ) => patch<ModelProviderState>(`/model-providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(input.modelId)}`, input),
  deleteModelProviderModel: async (provider: string, modelId: string) =>
    del<ModelProviderState>(`/model-providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(modelId)}`),
  defaultCwd: async () => get<DefaultCwdState>('/default-cwd'),
  tools: async () => get<ToolsState>('/tools'),
  setModel: async (model: string) =>
    patch<{ currentModel: string | null; currentThinkingLevel?: string | null; currentServiceTier?: string | null }>('/model-preferences', {
      model,
    }),
  updateModelPreferences: async (input: { model?: string; visionModel?: string; thinkingLevel?: string; serviceTier?: string }) =>
    patch<{ currentModel: string | null; currentThinkingLevel?: string | null; currentServiceTier?: string | null }>(
      '/model-preferences',
      input,
    ),
  updateDefaultCwd: async (cwd: string | null) => patch<DefaultCwdState>('/default-cwd', { cwd }),
  providerAuth: async () => get<ProviderAuthState>('/provider-auth'),
  setProviderApiKey: async (provider: string, apiKey: string) =>
    patch<ProviderAuthState>(`/provider-auth/${encodeURIComponent(provider)}/api-key`, { apiKey }),
  removeProviderCredential: async (provider: string) => del<ProviderAuthState>(`/provider-auth/${encodeURIComponent(provider)}`),
  startProviderOAuthLogin: async (provider: string) =>
    post<ProviderOAuthLoginState>(`/provider-auth/${encodeURIComponent(provider)}/oauth`),
  providerOAuthLogin: async (loginId: string) => get<ProviderOAuthLoginState>(`/provider-auth/oauth/${encodeURIComponent(loginId)}`),
  submitProviderOAuthLoginInput: async (loginId: string, value: string) =>
    post<ProviderOAuthLoginState>(`/provider-auth/oauth/${encodeURIComponent(loginId)}/input`, { value }),
  cancelProviderOAuthLogin: async (loginId: string) =>
    post<ProviderOAuthLoginState>(`/provider-auth/oauth/${encodeURIComponent(loginId)}/cancel`),
  openConversationTabs: async () =>
    get<{
      sessionIds: string[];
      pinnedSessionIds: string[];
      archivedSessionIds: string[];
      workspacePaths: string[];
      activeConversationId?: string | null;
      remoteControlledConversationIds?: string[];
    }>('/ui/open-conversations'),
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
    return patch<{
      ok: true;
      sessionIds: string[];
      pinnedSessionIds: string[];
      archivedSessionIds: string[];
      workspacePaths: string[];
      activeConversationId?: string | null;
      remoteControlledConversationIds?: string[];
    }>('/ui/open-conversations', request);
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
  tasks: async () => get<ScheduledTaskSummary[]>('/tasks'),
  taskDetail: async (id: string) => get<ScheduledTaskDetail>(`/tasks/${encodeURIComponent(id)}`),
  taskSchedulerHealth: async () => get<ScheduledTaskSchedulerHealth>('/tasks/scheduler/health'),
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
    return post<ScheduledTaskDetail>('/tasks', input);
  },
  setTaskEnabled: async (id: string, enabled: boolean) => {
    return patch<ScheduledTaskDetail>(`/tasks/${encodeURIComponent(id)}`, { enabled });
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
    return patch<ScheduledTaskDetail>(`/tasks/${encodeURIComponent(id)}`, input);
  },
  taskLog: async (id: string) => {
    return get<{ path: string; log: string }>(`/tasks/${encodeURIComponent(id)}/log`);
  },
  deleteTask: async (id: string) => {
    return del<{ ok: true }>(`/tasks/${encodeURIComponent(id)}`);
  },
  runTaskNow: async (id: string) => {
    return post<unknown>(`/tasks/${encodeURIComponent(id)}/run`);
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
  runs: async () => get<DurableRunListResult>('/runs'),
  durableRun: async (id: string) => get<DurableRunDetailResult>(`/runs/${encodeURIComponent(id)}`),
  durableRunLog: async (id: string, tail?: number) => {
    const normalizedTail = normalizeDurableRunLogTailParam(tail);
    return get<{ path: string; log: string }>(
      `/runs/${encodeURIComponent(id)}/log${normalizedTail ? `?tail=${encodeURIComponent(String(normalizedTail))}` : ''}`,
    );
  },
  markDurableRunAttentionRead: async (id: string, read = true) => {
    return post<{ ok: true }>(`/runs/${encodeURIComponent(id)}/attention`, { read });
  },
  cancelDurableRun: async (id: string) => {
    return post<{ cancelled: boolean; runId: string; reason?: string }>(`/runs/${encodeURIComponent(id)}/cancel`);
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
    return (await requireDesktopBridge('Picking folders')).pickFolder(request);
  },
  pickFiles: async (cwd?: string) => post<FilePickerResult>('/file-picker', cwd !== undefined ? { cwd } : {}),

  // ── Memory browser ────────────────────────────────────────────────────────
  memory: () => getMemoryData(),

  markConversationAttentionRead: async (id: string, read = true) => {
    return post<{ ok: true }>(`/conversations/${encodeURIComponent(id)}/attention`, { read });
  },

  // ── Live sessions ─────────────────────────────────────────────────────────
  liveSession: async (id: string) => get<LiveSessionMeta & { live: boolean }>(`/live-sessions/${encodeURIComponent(id)}`),
  liveSessionContext: async (id: string) => get<LiveSessionContext>(`/live-sessions/${encodeURIComponent(id)}/context`),
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
      includeToolBlocks?: boolean;
      knownSessionSignature?: string;
      knownBlockOffset?: number;
      knownTotalBlocks?: number;
      knownLastBlockId?: string;
    },
  ) => {
    const startedAtMs = performance.now();
    const params = new URLSearchParams();
    if (options?.tailBlocks !== undefined) params.set('tailBlocks', String(options.tailBlocks));
    if (options?.includeToolBlocks === false) params.set('includeToolBlocks', 'false');
    if (options?.knownSessionSignature) params.set('knownSessionSignature', options.knownSessionSignature);
    if (options?.knownBlockOffset !== undefined) params.set('knownBlockOffset', String(options.knownBlockOffset));
    if (options?.knownTotalBlocks !== undefined) params.set('knownTotalBlocks', String(options.knownTotalBlocks));
    if (options?.knownLastBlockId) params.set('knownLastBlockId', options.knownLastBlockId);
    const query = params.toString();
    const result = await get<ConversationBootstrapState>(`/conversations/${encodeURIComponent(id)}/bootstrap${query ? `?${query}` : ''}`);
    recordClientPerfTiming({
      name: 'desktop.conversationBootstrap',
      startedAtMs,
      meta: {
        conversationId: id,
        tailBlocks: options?.tailBlocks,
        hasKnownSessionSignature: Boolean(options?.knownSessionSignature),
        serverPerf: result.perf,
      },
    });
    return result;
  },
  desktopConversationState: async (id: string, options?: { tailBlocks?: number; includeToolBlocks?: boolean }) => {
    const startedAtMs = performance.now();
    const params = new URLSearchParams();
    if (options?.tailBlocks !== undefined) params.set('tailBlocks', String(options.tailBlocks));
    if (options?.includeToolBlocks === false) params.set('includeToolBlocks', 'false');
    const query = params.toString();
    const result = await get<DesktopConversationState>(`/conversations/${encodeURIComponent(id)}/state${query ? `?${query}` : ''}`);
    recordClientPerfTiming({
      name: 'desktop.conversationState',
      startedAtMs,
      meta: {
        conversationId: id,
        tailBlocks: options?.tailBlocks,
        serverPerf: result.perf,
      },
    });
    return result;
  },
  conversationPlansWorkspace: async () => get<ConversationAutomationWorkspaceState>('/conversation-plans/workspace'),
  conversationArtifacts: async (id: string) =>
    get<{ conversationId: string; artifacts: ConversationArtifactSummary[] }>(`/conversations/${encodeURIComponent(id)}/artifacts`),
  conversationArtifact: async (id: string, artifactId: string) => {
    return get<{ conversationId: string; artifact: ConversationArtifactRecord }>(
      `/conversations/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(artifactId)}`,
    );
  },
  conversationCheckpoints: async (id: string) =>
    get<{ conversationId: string; checkpoints: ConversationCommitCheckpointSummary[] }>(
      `/conversations/${encodeURIComponent(id)}/checkpoints`,
    ),
  conversationCheckpoint: async (id: string, checkpointId: string) => {
    return get<{ conversationId: string; checkpoint: ConversationCommitCheckpointRecord }>(
      `/conversations/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}`,
    );
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
  conversationAttachments: async (id: string) =>
    get<{ conversationId: string; attachments: ConversationAttachmentSummary[] }>(`/conversations/${encodeURIComponent(id)}/attachments`),
  conversationAttachment: async (id: string, attachmentId: string) => {
    return get<{ conversationId: string; attachment: ConversationAttachmentRecord }>(
      `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  },
  conversationAttachmentAsset: async (
    id: string,
    attachmentId: string,
    asset: 'source' | 'preview',
    revision?: number,
  ): Promise<ConversationAttachmentAssetData> => {
    const params = new URLSearchParams({ asset });
    if (revision !== undefined) params.set('revision', String(revision));
    return get<ConversationAttachmentAssetData>(
      `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/asset?${params.toString()}`,
    );
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
    return post<{ conversationId: string; attachment: ConversationAttachmentRecord }>(
      `/conversations/${encodeURIComponent(id)}/attachments`,
      input,
    );
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
    return patch<{ conversationId: string; attachment: ConversationAttachmentRecord }>(
      `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
      input,
    );
  },
  deferredResumes: async (id: string) =>
    get<{ conversationId: string; resumes: DeferredResumeSummary[] }>(`/conversations/${encodeURIComponent(id)}/deferred-resumes`),
  scheduleDeferredResume: async (id: string, input: { delay: string; prompt?: string; behavior?: 'steer' | 'followUp' }) => {
    return post<{ conversationId: string; resumes: DeferredResumeSummary[] }>(
      `/conversations/${encodeURIComponent(id)}/deferred-resumes`,
      input,
    );
  },
  fireDeferredResumeNow: async (id: string, resumeId: string) => {
    return post<{ conversationId: string; firedId: string; resumes: DeferredResumeSummary[] }>(
      `/conversations/${encodeURIComponent(id)}/deferred-resumes/${encodeURIComponent(resumeId)}/fire`,
    );
  },
  cancelDeferredResume: async (id: string, resumeId: string) => {
    return del<{ conversationId: string; cancelledId: string; resumes: DeferredResumeSummary[] }>(
      `/conversations/${encodeURIComponent(id)}/deferred-resumes/${encodeURIComponent(resumeId)}`,
    );
  },
  changeConversationCwd: async (id: string, cwd: string | null, surfaceId?: string, workspaceCwd?: string | null) => {
    return patch(`/conversations/${encodeURIComponent(id)}/cwd`, {
      cwd,
      ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  duplicateConversation: async (id: string) => {
    return requestJson<{ newSessionId: string; sessionFile: string }>('POST', `/conversations/${encodeURIComponent(id)}/duplicate`);
  },
  renameConversation: async (id: string, name: string, surfaceId?: string) => {
    return patch<{ ok: true; title: string }>(`/conversations/${encodeURIComponent(id)}/title`, {
      name,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  updateGoal: async (id: string, input: { objective?: string }) => {
    return patch(`/conversations/${encodeURIComponent(id)}/goal`, input);
  },
  conversationModelPreferences: async (id: string) =>
    get<{
      currentModel: string | null;
      currentThinkingLevel?: string | null;
      currentServiceTier?: string | null;
      hasExplicitServiceTier?: boolean;
    }>(`/conversations/${encodeURIComponent(id)}/model-preferences`),
  updateConversationModelPreferences: async (
    id: string,
    input: { model?: string | null; thinkingLevel?: string | null; serviceTier?: string | null },
    surfaceId?: string,
  ) => {
    return patch(`/conversations/${encodeURIComponent(id)}/model-preferences`, {
      ...input,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  recoverConversation: async (id: string) => {
    const startedAtMs = performance.now();
    const result = await post<{
      conversationId: string;
      live: boolean;
      recovered: boolean;
      replayedPendingOperation?: boolean;
      usedFallbackPrompt?: boolean;
      perf?: Record<string, number>;
    }>(`/conversations/${encodeURIComponent(id)}/recover`);
    recordClientPerfTiming({
      name: 'desktop.recoverConversation',
      startedAtMs,
      meta: { conversationId: id, recoveredConversationId: result.conversationId, serverPerf: result.perf ?? null },
    });
    return result;
  },
  prewarmLiveSession: async (cwd?: string) => post<{ ok: true }>('/live-sessions/prewarm', { cwd }),

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
      allowedToolNames?: string[];
    },
  ) => {
    const startedAtMs = performance.now();
    const result = await post<LiveSessionCreateResult>('/live-sessions', {
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
      ...(options?.allowedToolNames !== undefined ? { allowedToolNames: options.allowedToolNames } : {}),
    });
    recordClientPerfTiming({
      name: 'desktop.createLiveSession',
      startedAtMs,
      meta: { hasPrompt: Boolean(text?.trim()), hasCwd: Boolean(cwd?.trim()), serverPerf: result.perf ?? null },
    });
    return result;
  },

  resumeSession: async (sessionFile: string, cwd?: string) => {
    return post<{ id: string }>('/live-sessions/resume', { sessionFile, ...(cwd ? { cwd } : {}) });
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
    const startedAtMs = performance.now();
    const result = await post<{
      ok: true;
      accepted: true;
      delivery: 'started' | 'queued';
      referencedTaskIds: string[];
      referencedMemoryDocIds: string[];
      referencedKnowledgeFileIds: string[];
      referencedAttachmentIds: string[];
      relatedConversationPointerWarnings?: string[];
      perf?: Record<string, number>;
    }>(`/live-sessions/${encodeURIComponent(id)}/prompt`, {
      text,
      behavior,
      ...(surfaceId ? { surfaceId } : {}),
      images,
      attachmentRefs,
      contextMessages,
      relatedConversationIds,
    });
    recordClientPerfTiming({
      name: 'desktop.promptSession',
      startedAtMs,
      meta: {
        conversationId: id,
        promptLength: text.length,
        imageCount: images?.length ?? 0,
        contextMessageCount: contextMessages?.length ?? 0,
        relatedConversationCount: relatedConversationIds?.length ?? 0,
        serverPerf: result.perf ?? null,
      },
    });
    return result;
  },

  restoreQueuedMessage: async (
    id: string,
    input: { behavior: 'steer' | 'followUp'; index: number; previewId?: string },
    surfaceId?: string,
  ) => {
    void surfaceId;
    return post<{ ok: true; text: string; images: Array<{ type: 'image'; data: string; mimeType: string; name?: string }> }>(
      `/live-sessions/${encodeURIComponent(id)}/restore-queued-message`,
      {
        behavior: input.behavior,
        index: input.index,
        ...(input.previewId ? { previewId: input.previewId } : {}),
      },
    );
  },
  clearQueuedMessages: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return post<{
      ok: true;
      items: Array<{
        behavior: 'steer' | 'followUp';
        text: string;
        images: Array<{ type: 'image'; data: string; mimeType: string; name?: string }>;
        author: 'user' | 'agent';
      }>;
    }>(`/live-sessions/${encodeURIComponent(id)}/clear-queued-messages`);
  },
  takeoverLiveSession: async (id: string, surfaceId: string) => {
    return post<LiveSessionPresenceState>(`/live-sessions/${encodeURIComponent(id)}/take-over`, { surfaceId });
  },
  compactSession: async (id: string, customInstructions?: string, surfaceId?: string) => {
    void surfaceId;
    return post<{ ok: true; result: unknown }>(`/live-sessions/${encodeURIComponent(id)}/compact`, { customInstructions });
  },
  exportSession: async (id: string, outputPath?: string) => {
    return post<LiveSessionExportResult>(`/live-sessions/${encodeURIComponent(id)}/export`, { outputPath });
  },
  reloadSession: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return post<{ ok: true }>(`/live-sessions/${encodeURIComponent(id)}/reload`);
  },
  abortSession: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return post<{ ok: true }>(`/live-sessions/${encodeURIComponent(id)}/abort`);
  },

  destroySession: async (id: string, surfaceId?: string) => {
    void surfaceId;
    return post<{ ok: true }>(`/live-sessions/${encodeURIComponent(id)}/destroy`);
  },

  forkEntries: async (id: string) => get<LiveSessionForkEntry[]>(`/live-sessions/${encodeURIComponent(id)}/fork-entries`),
  branchSession: async (id: string, entryId: string, surfaceId?: string) => {
    return post<LiveSessionForkResult>(`/live-sessions/${encodeURIComponent(id)}/branch`, {
      entryId,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },
  forkSession: async (
    id: string,
    entryId: string,
    options?: { preserveSource?: boolean; beforeEntry?: boolean; branchKind?: 'fork' | 'rewind' },
    surfaceId?: string,
  ) => {
    return post<LiveSessionForkResult>(`/live-sessions/${encodeURIComponent(id)}/fork`, {
      entryId,
      preserveSource: options?.preserveSource,
      beforeEntry: options?.beforeEntry,
      branchKind: options?.branchKind,
      ...(surfaceId ? { surfaceId } : {}),
    });
  },

  executeLiveSessionBash: async (id: string, command: string, options?: { excludeFromContext?: boolean }) =>
    post<{ ok: true; result: unknown }>(`/live-sessions/${encodeURIComponent(id)}/execute-bash`, {
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
