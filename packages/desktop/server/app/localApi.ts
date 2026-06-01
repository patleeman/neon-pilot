import { EventEmitter } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainThread } from 'node:worker_threads';

import { installProcessLogging } from '../middleware/index.js';
installProcessLogging();

const DESKTOP_SCHEDULED_TASK_PROFILE = 'shared';
const DESKTOP_FORK_BOOTSTRAP_TAIL_BLOCKS = 24;

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir, getStateRoot, saveConversationCommitCheckpoint } from '@neon-pilot/core';
import { ensureAutomationThread } from '@neon-pilot/daemon';
import { loadDaemonConfig, resolveDaemonPaths } from '@neon-pilot/daemon';

import { readDaemonState } from '../automation/daemon.js';
import {
  cancelDurableRunCapability,
  listDurableRunsCapability,
  markDurableRunAttentionCapability,
  readDurableRunCapability,
  readDurableRunLogCapability,
} from '../automation/durableRunCapability.js';
import { getDurableRunSnapshot } from '../automation/durableRuns.js';
import {
  createScheduledTaskCapability,
  deleteScheduledTaskCapability,
  listScheduledTasksCapability,
  readScheduledTaskCapability,
  readScheduledTaskLogCapability,
  readScheduledTaskSchedulerHealth,
  runScheduledTaskCapability,
  updateScheduledTaskCapability,
} from '../automation/scheduledTaskCapability.js';
import { loadScheduledTasksForProfile } from '../automation/scheduledTasks.js';
import { buildScheduledTaskThreadDetail } from '../automation/scheduledTaskThreads.js';
import {
  createConversationAttachmentCapability,
  deleteConversationAttachmentCapability,
  readConversationArtifactCapability,
  readConversationArtifactsCapability,
  readConversationAttachmentCapability,
  readConversationAttachmentDownloadCapability,
  readConversationAttachmentsCapability,
  readConversationCommitCheckpointCapability,
  readConversationCommitCheckpointsCapability,
  updateConversationAttachmentCapability,
} from '../conversations/conversationAssetsCapability.js';
import { isMissingConversationBootstrapState, readConversationBootstrapState } from '../conversations/conversationBootstrap.js';
import {
  createConversationCheckpointCommit,
  normalizeCheckpointPaths,
  readRequiredCheckpointString,
} from '../conversations/conversationCheckpointCommit.js';
import { resolveNeutralChatCwd, resolveRequestedCwd } from '../conversations/conversationCwd.js';
import {
  cancelConversationDeferredResumeCapability,
  fireConversationDeferredResumeCapability,
  readConversationDeferredResumesCapability,
  scheduleConversationDeferredResumeCapability,
} from '../conversations/conversationDeferredResumeCapability.js';
import { applyConversationModelPreferencesToSessionManager } from '../conversations/conversationModelPreferences.js';
import { recoverConversationCapability } from '../conversations/conversationRecovery.js';
import { reserveConversationSession } from '../conversations/conversationReservation.js';
import { searchIndexedConversationContent } from '../conversations/conversationSearchIndex.js';
import {
  appendConversationOffshootDetachedMetadata,
  appendConversationWorkspaceMetadata,
  publishConversationSessionMetaChanged,
  readConversationModelPreferenceStateById,
  readConversationSessionMeta,
  renameStoredConversation,
  resolveConversationSessionFile,
  setConversationServiceContext,
  toggleConversationAttention,
} from '../conversations/conversationService.js';
import {
  inlineConversationBootstrapAssetsCapability,
  readConversationSessionBlockWithInlineAssetsCapability,
  readConversationSessionEntryBlocksWithInlineAssetsCapability,
} from '../conversations/conversationSessionAssetCapability.js';
import {
  readConversationSessionMetaCapability,
  readConversationSessionsCapability,
  readConversationSessionSearchIndexCapability,
} from '../conversations/conversationSessionCapability.js';
import { readDesktopConversationState } from '../conversations/desktopConversationState.js';
import { createAttentionEventFlusher } from '../conversations/liveDeferredResumes.js';
import {
  abortLiveSessionCapability,
  branchLiveSessionCapability,
  clearQueuedLiveSessionPromptsCapability,
  compactLiveSessionCapability,
  createLiveSessionCapability,
  destroyLiveSessionCapability,
  forkLiveSessionCapability,
  type LiveSessionCapabilityContext,
  manageLiveSessionParallelJobCapability,
  prewarmLiveSessionCapability,
  reloadLiveSessionCapability,
  restoreQueuedLiveSessionMessageCapability,
  resumeLiveSessionCapability,
  submitLiveSessionParallelPromptCapability,
  submitLiveSessionPromptCapability,
  takeOverLiveSessionCapability,
} from '../conversations/liveSessionCapability.js';
import {
  executeSessionBash,
  exportSessionHtml,
  getLiveSessionForkEntries,
  getLiveSessions as getLocalLiveSessions,
  isLive as isLiveSession,
  registry as liveRegistry,
  renameSession,
} from '../conversations/liveSessions.js';
import {
  createSessionFromExisting,
  destroySession,
  getAvailableModelObjects,
  updateLiveSessionModelPreferences,
} from '../conversations/liveSessions.js';
import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { createExtensionHostServerContextSnapshot } from '../extensions/extensionHostServerContext.js';
import { setWorkbenchBrowserToolHost, type WorkbenchBrowserToolHost } from '../extensions/workbenchBrowserToolHost.js';
import { listMemoryDocs, listSkillsForProfile } from '../knowledge/memoryDocs.js';
import type { ProviderDesktopCapabilityContext } from '../models/providerDesktopCapability.js';

// ── Model/provider modules ─────────────────────────────────────────────
// Keep the provider SDK/model table stack behind a typed loader so the local
// API module can become ready before model-provider routes are touched.
type ModelProviderModules = typeof import('../models/modelPreferences.js') &
  typeof import('../models/modelState.js') &
  typeof import('../models/providerAuth.js') &
  typeof import('../models/providerDesktopCapability.js');

let modelProviderModulesPromise: Promise<ModelProviderModules> | null = null;

function models(): Promise<ModelProviderModules> {
  modelProviderModulesPromise ??= Promise.all([
    import('../models/modelPreferences.js'),
    import('../models/modelState.js'),
    import('../models/providerAuth.js'),
    import('../models/providerDesktopCapability.js'),
  ]).then(([prefs, state, auth, caps]) => ({ ...prefs, ...state, ...auth, ...caps }));
  return modelProviderModulesPromise;
}
import type { ServerRouteContext } from '../routes/context.js';
import { registerServerRoutes } from '../routes/registerAll.js';
import { createSettingsStore } from '../settings/settingsStore.js';
import { invalidateAppTopics, publishAppEvent, subscribeAppEvents } from '../shared/appEvents.js';
import { logError, logWarn } from '../shared/logging.js';
import { readConversationPlansWorkspace } from '../ui/conversationPlanPreferences.js';
import { readSavedDefaultCwdPreferences, writeSavedDefaultCwdPreference } from '../ui/defaultCwdPreferences.js';
import { DEFAULT_RUNTIME_SETTINGS_FILE, persistSettingsWrite } from '../ui/settingsPersistence.js';
import { readSavedUiPreferences, writeSavedUiPreferences } from '../ui/uiPreferences.js';
import { readGitStatusSummaryWithTelemetry } from '../workspace/gitStatus.js';
import { pickFolderCapability } from '../workspace/workspaceDesktopCapability.js';
import { buildDesktopConversationGoalState, validateDesktopConversationGoalInput } from './localApiConversationGoal.js';
import { buildCriticalExtensionRegistryResponse } from './localApiExtensionRegistryPresentation.js';
import { validateDesktopModelPreferenceUpdate } from './localApiModelPreferences.js';
import { desktopOpenConversationTabsInvalidationTopics, validateDesktopOpenConversationTabsUpdate } from './localApiOpenTabs.js';
import { buildDesktopOpenConversationTabsResponse } from './localApiOpenTabsPresentation.js';
import { buildRelatedConversationResults } from './localApiRelatedConversations.js';
import { decodeLocalApiBody, readLocalApiError } from './localApiResponseParsing.js';
import { resolveRollbackLeafId, rewriteConversationSessionToLeaf, validateDesktopRollbackTurns } from './localApiRollback.js';
import { buildLocalApiQueryObject, buildLocalApiRoutePattern, findMatchingLocalApiRoute } from './localApiRouting.js';
import { normalizeDesktopScheduledTaskCreateInput } from './localApiScheduledTasks.js';
import { normalizeFastConversationSearchLimit, normalizeFastConversationSearchTerms } from './localApiSearch.js';
import { type DesktopLocalApiStreamEvent, subscribeDesktopLocalApiStreamByUrl } from './localApiStreams.js';
export { normalizeDesktopLocalApiTailBlocks } from './localApiTailBlocks.js';
import { buildDesktopAppBridgeEvent, shouldProcessDesktopAppEvent } from './localApiAppEvents.js';
import { buildAttachmentAssetResponse } from './localApiAttachmentAssetResponse.js';
import { assertAttentionTargetUpdated, buildDesktopOkResponse, resolveAttentionReadValue } from './localApiAttentionResponse.js';
import { buildExecuteLiveSessionBashResponse } from './localApiBashResponse.js';
import { buildConversationCheckpointRecordInput } from './localApiCheckpointRecord.js';
import {
  assertLocalLiveSessionCapabilityContext,
  assertLocalProviderDesktopCapabilityContext,
  assertLocalServerRouteContext,
} from './localApiContextAssertions.js';
import { readRequiredConversationId, readRequiredConversationName } from './localApiConversationBasics.js';
import { assertConversationBootstrapFound } from './localApiConversationBootstrapResponse.js';
import { assertDesktopConversationCwdDirectory, resolveDesktopConversationNextCwd } from './localApiConversationCwd.js';
import {
  buildChangedConversationCwdResponse,
  buildUnchangedConversationCwdResponse,
  resolvePreviousWorkspaceCwd,
} from './localApiConversationCwdPresentation.js';
import { normalizeDesktopConversationModelPreferenceUpdate } from './localApiConversationModelPreferences.js';
import { assertConversationFound, assertSessionFound } from './localApiConversationNotFound.js';
import { buildDesktopConversationSource, normalizeResolvedSessionFile } from './localApiConversationSource.js';
import { buildCreateLiveSessionPerf, shouldDispatchInitialLiveSessionPrompt } from './localApiCreateLiveSessionResponse.js';
import {
  buildExportLiveSessionResponse,
  normalizeExportLiveSessionConversationId,
  normalizeOptionalExportOutputPath,
} from './localApiExportLiveSession.js';
import { buildForkConversationInitialOptions, resolveForkConversationCwd } from './localApiForkConversation.js';
import { buildLiveSessionContextResponse } from './localApiLiveSessionContextResponse.js';
import {
  assertLiveConversationExists,
  buildDesktopLiveSessionResponse,
  normalizeRequiredLiveConversationId,
} from './localApiLiveSessionResponse.js';
import { buildDesktopMutationOkResponse, buildSavedModelPreferencePatch } from './localApiModelPreferenceResponse.js';
import { resolveLocalApiRepoRoot } from './localApiPaths.js';
import { normalizeRequiredProviderOAuthLoginId, shouldCloseProviderOAuthSubscription } from './localApiProviderOAuthSubscription.js';
import { buildRenameDesktopConversationResult, resolveRenamedStoredConversationTitle } from './localApiRenameConversation.js';
import { buildLocalApiRequestSocket, LOCAL_API_LOOPBACK_IP, LOCAL_API_REQUEST_PROTOCOL } from './localApiRequestDefaults.js';
import { normalizeLocalApiRequestHeaders, readLocalApiRequestHeader } from './localApiRequestHeaders.js';
import { buildLocalApiRequestUrl } from './localApiRequestUrl.js';
import { assertRollbackLiveSessionNotStreaming, buildRollbackConversationResponse } from './localApiRollbackResponse.js';
import { noopLocalApiUse, shouldRegisterLocalApiRoute } from './localApiRouteCollector.js';
import { readSessionDetailRouteResponse } from './localApiSessionDetailResponse.js';
import { buildDesktopCloseEvent, markSubscriptionClosed, shouldCloseSubscription } from './localApiSubscriptionClose.js';
import { createServerRouteContext } from './routeContext.js';
import { createRuntimeState } from './runtimeState.js';

function prewarmDesktopModelDefinitions(): void {
  const modelDefinitionsPrewarmTimer = setTimeout(() => {
    void models()
      .then((m) => m.prewarmModelDefinitions?.())
      .catch(() => {});
  }, 0);
  modelDefinitionsPrewarmTimer.unref?.();
}

type RouteHandler = (req: LocalApiRequest, res: LocalApiResponse) => unknown;

interface RegisteredRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

interface LocalApiRequest extends EventEmitter {
  method: string;
  path: string;
  url: string;
  originalUrl: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
  protocol: string;
  ip: string;
  socket: { remoteAddress: string };
  get(name: string): string | undefined;
}

export interface DesktopLocalApiDispatchResult {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

type DesktopAppBridgeEvent = { type: 'open' } | { type: 'event'; event: unknown } | { type: 'error'; message: string } | { type: 'close' };

export function setDesktopWorkbenchBrowserToolHost(host: WorkbenchBrowserToolHost | null): void {
  setWorkbenchBrowserToolHost(host);
}

class LocalApiResponse {
  statusCode = 200;
  headers = new Map<string, string>();
  bodyChunks: Uint8Array[] = [];
  ended = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(value: unknown): this {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.bodyChunks = [Buffer.from(JSON.stringify(value), 'utf-8')];
    this.ended = true;
    return this;
  }

  send(value: unknown): this {
    if (typeof value === 'string') {
      this.bodyChunks.push(Buffer.from(value, 'utf-8'));
      this.ended = true;
      return this;
    }

    if (value instanceof Uint8Array) {
      this.bodyChunks.push(value);
      this.ended = true;
      return this;
    }

    if (value instanceof ArrayBuffer) {
      this.bodyChunks.push(new Uint8Array(value));
      this.ended = true;
      return this;
    }

    if (value === undefined || value === null) {
      this.ended = true;
      return this;
    }

    return this.json(value);
  }

  sendFile(path: string): this {
    this.bodyChunks.push(readFileSync(path));
    this.ended = true;
    return this;
  }

  type(value: string): this {
    this.setHeader('Content-Type', value);
    return this;
  }

  setHeader(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  flushHeaders(): void {
    // No-op for in-process local requests.
  }

  write(chunk: string | Uint8Array): void {
    if (typeof chunk === 'string') {
      this.bodyChunks.push(Buffer.from(chunk, 'utf-8'));
      return;
    }

    this.bodyChunks.push(chunk);
  }

  end(chunk?: string | Uint8Array): void {
    if (typeof chunk === 'string') {
      this.bodyChunks.push(Buffer.from(chunk, 'utf-8'));
    } else if (chunk instanceof Uint8Array) {
      this.bodyChunks.push(chunk);
    }

    this.ended = true;
  }

  cookie(): this {
    return this;
  }

  clearCookie(): this {
    return this;
  }

  getBody(): Uint8Array {
    if (this.bodyChunks.length === 0) {
      return new Uint8Array();
    }

    return Buffer.concat(this.bodyChunks.map((chunk) => Buffer.from(chunk)));
  }
}

let localRoutesPromise: Promise<RegisteredRoute[]> | null = null;
let localContextsPromise: Promise<{ context: ServerRouteContext; perf: Record<string, number> }> | null = null;
let localServerRouteContext: ServerRouteContext | null = null;
let localLiveSessionCapabilityContext: LiveSessionCapabilityContext | null = null;
let localProviderDesktopCapabilityContext: ProviderDesktopCapabilityContext | null = null;

const LOCAL_API_DEFERRED_RESUME_POLL_MS = 3_000;
const EXTENSION_STARTUP_ACTIONS_DELAY_MS = 10_000;
function resolveRepoRoot(): string {
  const defaultRepoRoot = fileURLToPath(new URL('../../..', import.meta.url));
  return resolveLocalApiRepoRoot({
    envRepoRoot: process.env.NEON_PILOT_REPO_ROOT,
    envResourcesRoot: process.env.NEON_PILOT_RESOURCES_ROOT,
    defaultRepoRoot,
  });
}

function resolveDaemonRoot(): string {
  return resolveDaemonPaths(loadDaemonConfig().ipc.socketPath).root;
}

function createLocalApiRequest(input: {
  method: string;
  url: URL;
  params: Record<string, string>;
  body: unknown;
  headers?: Record<string, string>;
}): LocalApiRequest {
  const request = new EventEmitter() as LocalApiRequest;
  const normalizedHeaders = normalizeLocalApiRequestHeaders(input.headers);
  request.method = input.method;
  request.path = input.url.pathname;
  request.url = buildLocalApiRequestUrl(input.url.pathname, input.url.search);
  request.originalUrl = request.url;
  request.query = buildLocalApiQueryObject(input.url.searchParams);
  request.params = input.params;
  request.body = input.body;
  request.headers = normalizedHeaders;
  request.protocol = LOCAL_API_REQUEST_PROTOCOL;
  request.ip = LOCAL_API_LOOPBACK_IP;
  request.socket = buildLocalApiRequestSocket();
  request.get = (name: string) => readLocalApiRequestHeader(normalizedHeaders, name);
  return request;
}

function createRouteCollector(
  routes: RegisteredRoute[],
): Pick<
  { get: unknown; put: unknown; post: unknown; patch: unknown; delete: unknown; use: unknown },
  'get' | 'put' | 'post' | 'patch' | 'delete' | 'use'
> {
  const register =
    (method: RegisteredRoute['method']) =>
    (path: string, ...handlers: RouteHandler[]) => {
      const handler = handlers[handlers.length - 1];
      if (!shouldRegisterLocalApiRoute(handler)) {
        return;
      }

      const { pattern, keys } = buildLocalApiRoutePattern(path);
      routes.push({ method, path, pattern, keys, handler });
    };

  return {
    get: register('GET'),
    put: register('PUT'),
    post: register('POST'),
    patch: register('PATCH'),
    delete: register('DELETE'),
    use: noopLocalApiUse,
  };
}

async function buildLocalContexts(): Promise<{ context: ServerRouteContext; perf: Record<string, number> }> {
  const startedAtMs = performance.now();
  const repoRoot = resolveRepoRoot();
  const agentDir = getPiAgentRuntimeDir();
  const authFile = join(agentDir, 'auth.json');
  const settingsFile = DEFAULT_RUNTIME_SETTINGS_FILE;
  const pathsAtMs = performance.now();
  process.stderr.write(`[perf] buildLocalContexts: paths ${Math.round(pathsAtMs - startedAtMs)}ms\n`);

  const runtimeState = createRuntimeState({
    repoRoot,
    agentDir,
    logger: {
      warn: () => {
        // Ignore local desktop route-context warnings here.
      },
    },
  });
  const runtimeStateAtMs = performance.now();
  process.stderr.write(`[perf] buildLocalContexts: runtimeState ${Math.round(runtimeStateAtMs - pathsAtMs)}ms\n`);

  const flushAttentionEvents = createAttentionEventFlusher({
    getRuntimeScope: runtimeState.getRuntimeScope,
    getRepoRoot: () => repoRoot,
    getStateRoot,
    resolveDaemonRoot,
    publishConversationSessionMetaChanged,
  });

  if (isMainThread) {
    // Dynamic import — express (1.5MB) is only loaded when the dispatch
    // loop starts, not at module load time.
    void import('./bootstrap.js').then(({ startAttentionDispatchLoop }) => {
      startAttentionDispatchLoop({
        flushAttentionEvents,
        pollMs: LOCAL_API_DEFERRED_RESUME_POLL_MS,
      });
    });
  }
  const attentionAtMs = performance.now();
  process.stderr.write(`[perf] buildLocalContexts: attention ${Math.round(attentionAtMs - runtimeStateAtMs)}ms\n`);

  const context = createServerRouteContext({
    repoRoot,
    settingsFile,
    authFile,
    getRuntimeScope: runtimeState.getRuntimeScope,
    materializeWebRuntimeConfig: () => runtimeState.materializeRuntimeResources(),
    getStateRoot,
    serverPort: 0,
    getDefaultWebCwd: () => process.cwd(),
    resolveRequestedCwd,
    buildLiveSessionResourceOptions: runtimeState.buildLiveSessionResourceOptions,
    buildLiveSessionResourceOptionsAsync: runtimeState.buildLiveSessionResourceOptionsAsync,
    buildLiveSessionExtensionFactories: runtimeState.buildLiveSessionExtensionFactories,
    flushLiveDeferredResumes: flushAttentionEvents,
    getSavedUiPreferences: () => readSavedUiPreferences(settingsFile),
    listTasksForRuntimeScope: () => {
      const loaded = loadScheduledTasksForProfile(runtimeState.getRuntimeScope());
      const runtimeById = new Map(loaded.runtimeEntries.flatMap((task) => (task.id ? [[task.id, task] as const] : [])));

      return loaded.tasks.map((task) => {
        const taskWithThread = task.threadMode === 'dedicated' && !task.threadConversationId ? ensureAutomationThread(task.id) : task;
        const runtime = loaded.runtimeState[task.id] ?? runtimeById.get(task.id);
        const threadDetail = buildScheduledTaskThreadDetail(taskWithThread);
        return {
          id: taskWithThread.id,
          title: taskWithThread.title,
          filePath: taskWithThread.legacyFilePath,
          scheduleType: taskWithThread.schedule.type,
          running: runtime?.running ?? false,
          enabled: taskWithThread.enabled,
          cron: taskWithThread.schedule.type === 'cron' ? taskWithThread.schedule.expression : undefined,
          at: taskWithThread.schedule.type === 'at' ? taskWithThread.schedule.at : undefined,
          prompt: taskWithThread.prompt.split('\n')[0]?.slice(0, 120) ?? '',
          model: taskWithThread.modelRef,
          cwd: taskWithThread.cwd,
          ...(taskWithThread.catchUpWindowSeconds !== undefined ? { catchUpWindowSeconds: taskWithThread.catchUpWindowSeconds } : {}),
          threadConversationId: threadDetail.threadConversationId,
          threadTitle: threadDetail.threadTitle,
          lastStatus: runtime?.lastStatus,
          lastRunAt: runtime?.lastRunAt,
          lastSuccessAt: runtime?.lastSuccessAt,
          lastAttemptCount: runtime?.lastAttemptCount,
        };
      });
    },
    listMemoryDocs: () =>
      listMemoryDocs().map((doc) => ({
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        description: doc.description,
        path: doc.path,
        updated: doc.updated,
      })),
    listSkillsForRuntimeScope: () =>
      listSkillsForProfile(runtimeState.getRuntimeScope()).map((skill) => ({
        name: skill.name,
        source: skill.source,
        description: skill.description,
        path: skill.path,
      })),
    listProfileAgentItems: () => [],
    withTemporaryRuntimeAgentDir: (_profile, run) => runtimeState.withTemporaryRuntimeAgentDir(run),
    getDurableRunSnapshot: async (runId: string, tail: number) => (await getDurableRunSnapshot(runId, tail)) ?? null,
  });
  const routeContextAtMs = performance.now();
  process.stderr.write(`[perf] buildLocalContexts: routeContext ${Math.round(routeContextAtMs - attentionAtMs)}ms\n`);

  localServerRouteContext = context;

  const liveSessionCapabilityContext: LiveSessionCapabilityContext = {
    getRuntimeScope: context.getRuntimeScope,
    getRepoRoot: context.getRepoRoot,
    getDefaultWebCwd: context.getDefaultWebCwd,
    buildLiveSessionResourceOptions: context.buildLiveSessionResourceOptions,
    buildLiveSessionResourceOptionsAsync: context.buildLiveSessionResourceOptionsAsync,
    buildLiveSessionExtensionFactories: context.buildLiveSessionExtensionFactories,
    flushLiveDeferredResumes: context.flushLiveDeferredResumes,
    listTasksForRuntimeScope: context.listTasksForRuntimeScope,
    listMemoryDocs: context.listMemoryDocs,
  };
  localLiveSessionCapabilityContext = liveSessionCapabilityContext;

  // Warm the resource options cache synchronously (fast — ~100ms, reads
  // SKILL.md/template files from disk) so the first createLiveSession
  // doesn't pay that cost even if the extension factory load is deferred.
  context.buildLiveSessionResourceOptionsAsync?.(context.getRuntimeScope())?.catch(() => {});
  prewarmDesktopModelDefinitions();

  // Extension factory loading is slow (~9s, dynamic imports of extension
  // backend modules). Don't block startup — run in background so the
  // first API calls are fast. If the user creates a chat before this
  // finishes, only the first one pays the cold-build penalty.
  void prewarmLiveSessionCapability({}, localLiveSessionCapabilityContext).catch((error) => {
    logWarn('default live session prewarm failed', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  });

  localProviderDesktopCapabilityContext = {
    getRuntimeScope: context.getRuntimeScope,
    materializeWebRuntimeConfig: context.materializeWebRuntimeConfig,
    getAuthFile: context.getAuthFile,
    getStateRoot: context.getStateRoot,
  };
  setConversationServiceContext({
    getRuntimeScope: context.getRuntimeScope,
    getRepoRoot: context.getRepoRoot,
    getSavedUiPreferences: context.getSavedUiPreferences,
  });
  const capabilityContextAtMs = performance.now();

  if (isMainThread) {
    const startupGuard = await getExtensionHostClient().beginStartupGuard();
    if (startupGuard.safeMode) {
      publishAppEvent({
        type: 'notification',
        extensionId: 'core',
        message:
          startupGuard.disabledIds.length > 0
            ? `Extension safe mode disabled ${startupGuard.disabledIds.length} runtime extension(s) after an unclean startup.`
            : 'Extension safe mode detected an unclean startup; no runtime extensions were enabled.',
        severity: 'warning',
      });
    }

    // Runtime extension services are useful, but they are not chat-critical.
    // Keep their cold imports and service startup out of the initial conversation
    // creation and transcript navigation window.
    const startupActionsTimer = setTimeout(() => {
      void getExtensionHostClient()
        .startStartupActions({ serverContextSnapshot: createExtensionHostServerContextSnapshot(context) })
        .then(() => getExtensionHostClient().completeStartupGuard())
        .catch((error) => {
          logError('extension startup dispatch failed', { message: (error as Error).message });
          publishAppEvent({
            type: 'notification',
            extensionId: 'core',
            message: `Extension startup failed: ${(error as Error).message}`,
            severity: 'error',
          });
        });
    }, EXTENSION_STARTUP_ACTIONS_DELAY_MS);
    startupActionsTimer.unref?.();

    const backendHealthTimer = setTimeout(() => {
      void getExtensionHostClient().checkBackendHealth().catch((error) => {
        logError('extension backend health check dispatch failed', { message: (error as Error).message });
      });
    }, 60_000);
    backendHealthTimer.unref?.();
  }
  const startupSchedulingAtMs = performance.now();

  const perf = {
    contextPathsMs: Math.round(pathsAtMs - startedAtMs),
    contextRuntimeStateMs: Math.round(runtimeStateAtMs - pathsAtMs),
    contextAttentionMs: Math.round(attentionAtMs - runtimeStateAtMs),
    contextRouteContextMs: Math.round(routeContextAtMs - attentionAtMs),
    contextCapabilityContextMs: Math.round(capabilityContextAtMs - routeContextAtMs),
    contextStartupSchedulingMs: Math.round(startupSchedulingAtMs - capabilityContextAtMs),
    contextTotalMs: Math.round(startupSchedulingAtMs - startedAtMs),
  };
  return { context, perf };
}

async function getLocalContexts(): Promise<{ context: ServerRouteContext; perf: Record<string, number> }> {
  if (!localContextsPromise) {
    localContextsPromise = buildLocalContexts().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[desktop-backend] buildLocalContexts failed: ${message}\n`);
      // Keep the rejected promise cached so subsequent callers fail fast
      // instead of each triggering a fresh rebuild that times out.
      localServerRouteContext = null;
      localLiveSessionCapabilityContext = null;
      localProviderDesktopCapabilityContext = null;
      throw error;
    });
  }

  return localContextsPromise;
}

async function buildLocalRoutes(): Promise<RegisteredRoute[]> {
  const { context } = await getLocalContexts();
  const routes: RegisteredRoute[] = [];
  const appRouter = createRouteCollector(routes);
  registerServerRoutes({
    app: appRouter as never,
    context,
  });

  return routes;
}

async function getLocalRoutes(): Promise<RegisteredRoute[]> {
  if (!localRoutesPromise) {
    const start = performance.now();
    localRoutesPromise = buildLocalRoutes().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[desktop-backend] buildLocalRoutes failed: ${message}\n`);
      // Keep the rejected promise cached so subsequent callers fail fast
      // instead of each triggering a fresh rebuild that times out.
      localServerRouteContext = null;
      localLiveSessionCapabilityContext = null;
      localProviderDesktopCapabilityContext = null;
      throw error;
    });
    localRoutesPromise.then(() => {
      process.stderr.write(`[perf] buildLocalRoutes: ${Math.round(performance.now() - start)}ms\n`);
    });
  }

  return localRoutesPromise;
}

async function getLocalServerRouteContext(): Promise<ServerRouteContext> {
  await getLocalContexts();
  return assertLocalServerRouteContext(localServerRouteContext);
}

async function getLocalLiveSessionCapabilityContext(): Promise<LiveSessionCapabilityContext> {
  await getLocalContexts();
  return assertLocalLiveSessionCapabilityContext(localLiveSessionCapabilityContext);
}

async function getLocalProviderDesktopCapabilityContext(): Promise<ProviderDesktopCapabilityContext> {
  await getLocalContexts();
  return assertLocalProviderDesktopCapabilityContext(localProviderDesktopCapabilityContext);
}

async function getLocalLiveSessionCapabilityContextWithPerf(): Promise<{
  context: LiveSessionCapabilityContext;
  perf: Record<string, number>;
}> {
  const { perf } = await getLocalContexts();
  return {
    context: assertLocalLiveSessionCapabilityContext(localLiveSessionCapabilityContext),
    perf,
  };
}

export async function subscribeDesktopAppEvents(onEvent: (event: DesktopAppBridgeEvent) => void): Promise<() => void> {
  await getLocalRoutes();

  let closed = false;
  const emitEvent = (event: unknown) => {
    if (!shouldProcessDesktopAppEvent(closed)) {
      return;
    }

    onEvent(buildDesktopAppBridgeEvent(event));
  };

  onEvent({ type: 'open' });

  const unsubscribe = subscribeAppEvents((event) => {
    emitEvent(event);
  });

  return () => {
    if (!shouldCloseSubscription(closed)) {
      return;
    }

    closed = markSubscriptionClosed();
    unsubscribe();
    onEvent(buildDesktopCloseEvent());
  };
}

export async function subscribeDesktopLocalApiStream(
  path: string,
  onEvent: (event: DesktopLocalApiStreamEvent) => void,
): Promise<() => void> {
  await getLocalContexts();
  const url = new URL(path, 'http://desktop.local');
  return subscribeDesktopLocalApiStreamByUrl(url, onEvent);
}

function dispatchFastConversationContentSearch(input: { body?: unknown }): DesktopLocalApiDispatchResult | null {
  const body = input.body && typeof input.body === 'object' ? (input.body as { query?: unknown; limit?: unknown }) : {};
  const terms = normalizeFastConversationSearchTerms(body.query);
  if (!terms) return null;
  const matches = searchIndexedConversationContent({ terms, limit: normalizeFastConversationSearchLimit(body.limit) });
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: new TextEncoder().encode(
      JSON.stringify({
        query: terms.join(' '),
        mode: 'allTerms',
        scope: 'all',
        totalMatching: matches.length,
        returnedCount: matches.length,
        matches,
      }),
    ),
  };
}

function createDesktopLocalApiJsonResponse(value: unknown): DesktopLocalApiDispatchResult {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: new TextEncoder().encode(JSON.stringify(value)),
  };
}

function createDesktopLocalApiErrorResponse(
  statusCode: number,
  message: string,
): DesktopLocalApiDispatchResult {
  return {
    statusCode,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: new TextEncoder().encode(message),
  };
}

function getDesktopLocalApiErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (
    error.name === 'ConversationAssetCapabilityNotFoundError' ||
    error.name === 'ConversationDeferredResumeCapabilityNotFoundError'
  ) {
    return 404;
  }

  return /\bnot found\b/i.test(error.message) || error.message === '404 Not Found' ? 404 : 500;
}

async function readExtensionInstallSummariesWithRuntimeStateForLocalApi() {
  const [{ installSummaries }, runningServices] = await Promise.all([
    getExtensionHostClient().readRegistryPresentation(),
    getExtensionHostClient().listServices(),
  ]);
  const running = new Map(runningServices.map((service) => [`${service.extensionId}:${service.serviceId}`, service]));
  return installSummaries.map((summary) => ({
    ...summary,
    serviceStatuses: (Array.isArray(summary.services) ? summary.services : []).map((service) => {
      const extensionId = typeof summary.id === 'string' ? summary.id : '';
      const serviceId = typeof (service as { id?: unknown }).id === 'string' ? (service as { id: string }).id : '';
      const status = running.get(`${extensionId}:${serviceId}`);
      return { id: serviceId, running: Boolean(status), startedAt: status?.startedAt ?? null };
    }),
  }));
}

async function dispatchDesktopLocalProductApiRequest(input: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: URL;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<DesktopLocalApiDispatchResult | null> {
  const path = input.url.pathname;
  const method = input.method;

  if (method === 'GET' && path === '/api/status') return createDesktopLocalApiJsonResponse(await readDesktopAppStatus());
  if (method === 'GET' && path === '/api/daemon') return createDesktopLocalApiJsonResponse(await readDesktopDaemonState());
  if (method === 'GET' && path === '/api/sessions') {
    return createDesktopLocalApiJsonResponse(
      await readDesktopSessions({
        limit: input.url.searchParams.has('limit') ? Number(input.url.searchParams.get('limit')) : undefined,
      }),
    );
  }
  if (method === 'POST' && path === '/api/sessions/search-index') {
    const body = input.body as { sessionIds?: string[] } | undefined;
    return createDesktopLocalApiJsonResponse(await readDesktopSessionSearchIndex(body?.sessionIds ?? []));
  }
  if (method === 'POST' && path === '/api/related-conversations/results') {
    const body = input.body && typeof input.body === 'object' ? (input.body as Record<string, unknown>) : {};
    const providedSessions = Array.isArray(body.sessions) ? (body.sessions as Array<{ id?: unknown }>) : [];
    const requestedSessionIds = Array.isArray(body.sessionIds)
      ? body.sessionIds.filter((sessionId): sessionId is string => typeof sessionId === 'string')
      : [];
    let sessions = providedSessions;
    if (sessions.length === 0 && requestedSessionIds.length > 0) {
      const requestedSessionIdSet = new Set(requestedSessionIds);
      sessions = (await readDesktopSessions({ limit: Math.max(requestedSessionIds.length, 100) })).filter((session) =>
        requestedSessionIdSet.has(session.id),
      );
    }
    const providedSearchIndex =
      body.searchIndex && typeof body.searchIndex === 'object' ? (body.searchIndex as Record<string, unknown>) : null;
    const sessionIds = sessions.map((session) => session.id).filter((id): id is string => typeof id === 'string');
    const searchIndex =
      providedSearchIndex !== null
        ? providedSearchIndex
        : sessionIds.length === 0
          ? {}
          : (await readDesktopSessionSearchIndex(sessionIds)).index;
    return createDesktopLocalApiJsonResponse(
      buildRelatedConversationResults({
        ...body,
        sessions,
        searchIndex,
      }),
    );
  }

  const sessionMetaMatch = /^\/api\/sessions\/([^/]+)\/meta$/.exec(path);
  if (method === 'GET' && sessionMetaMatch) {
    return createDesktopLocalApiJsonResponse(await readDesktopSessionMeta(decodeURIComponent(sessionMetaMatch[1] ?? '')));
  }
  const sessionBlockMatch = /^\/api\/sessions\/([^/]+)\/blocks\/([^/]+)$/.exec(path);
  if (method === 'GET' && sessionBlockMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopSessionBlock({
        sessionId: decodeURIComponent(sessionBlockMatch[1] ?? ''),
        blockId: decodeURIComponent(sessionBlockMatch[2] ?? ''),
      }),
    );
  }
  const sessionEntryBlocksMatch = /^\/api\/sessions\/([^/]+)\/entry-blocks$/.exec(path);
  if (method === 'POST' && sessionEntryBlocksMatch) {
    const body = input.body && typeof input.body === 'object' ? (input.body as { entryIds?: unknown }) : {};
    const entryIds = Array.isArray(body.entryIds) ? body.entryIds.filter((entryId): entryId is string => typeof entryId === 'string') : [];
    return createDesktopLocalApiJsonResponse(
      await readDesktopSessionEntryBlocks({
        sessionId: decodeURIComponent(sessionEntryBlocksMatch[1] ?? ''),
        entryIds,
      }),
    );
  }
  const sessionDetailMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
  if (method === 'GET' && sessionDetailMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopSessionDetail({
        sessionId: decodeURIComponent(sessionDetailMatch[1] ?? ''),
        tailBlocks: input.url.searchParams.has('tailBlocks') ? Number(input.url.searchParams.get('tailBlocks')) : undefined,
        knownSessionSignature: input.url.searchParams.get('knownSessionSignature') ?? undefined,
        knownBlockOffset: input.url.searchParams.has('knownBlockOffset')
          ? Number(input.url.searchParams.get('knownBlockOffset'))
          : undefined,
        knownTotalBlocks: input.url.searchParams.has('knownTotalBlocks')
          ? Number(input.url.searchParams.get('knownTotalBlocks'))
          : undefined,
        knownLastBlockId: input.url.searchParams.get('knownLastBlockId') ?? undefined,
      }),
    );
  }

  if (method === 'GET' && path === '/api/models') return createDesktopLocalApiJsonResponse(await readDesktopModels());
  if (method === 'GET' && path === '/api/extensions/slash-commands') {
    return createDesktopLocalApiJsonResponse((await getExtensionHostClient().readRegistryPresentation()).slashCommandRegistrations);
  }
  if (method === 'GET' && path === '/api/extensions/mentions') {
    return createDesktopLocalApiJsonResponse((await getExtensionHostClient().readRegistryPresentation()).mentionRegistrations);
  }
  if (method === 'GET' && path === '/api/extensions/registry/critical') {
    return createDesktopLocalApiJsonResponse(
      buildCriticalExtensionRegistryResponse(
        (await getExtensionHostClient().readRegistryPresentation()).snapshot as unknown as Parameters<
          typeof buildCriticalExtensionRegistryResponse
        >[0],
      ),
    );
  }
  if (method === 'GET' && path === '/api/extensions/registry') {
    const [extensions, registryPresentation, settings] = await Promise.all([
      readExtensionInstallSummariesWithRuntimeStateForLocalApi(),
      getExtensionHostClient().readRegistryPresentation(),
      Promise.resolve(createSettingsStore().read()),
    ]);
    const snapshot = registryPresentation.snapshot;
    return createDesktopLocalApiJsonResponse({
      extensions,
      routes: snapshot.routes,
      surfaces: [...snapshot.surfaces, ...snapshot.views],
      settings,
    });
  }
  const extensionActionMatch = /^\/api\/extensions\/([^/]+)\/actions\/([^/]+)$/.exec(path);
  if (method === 'POST' && extensionActionMatch) {
    return createDesktopLocalApiJsonResponse(
      await getExtensionHostClient().invokeAction({
        extensionId: decodeURIComponent(extensionActionMatch[1] ?? ''),
        actionId: decodeURIComponent(extensionActionMatch[2] ?? ''),
        input: input.body,
        serverContextSnapshot: createExtensionHostServerContextSnapshot(await getLocalServerRouteContext()),
        signal: input.signal,
      }),
    );
  }
  if (method === 'PATCH' && path === '/api/model-preferences')
    return createDesktopLocalApiJsonResponse(
      await updateDesktopModelPreferences(input.body as Parameters<typeof updateDesktopModelPreferences>[0]),
    );
  if (method === 'GET' && path === '/api/model-providers') return createDesktopLocalApiJsonResponse(await readDesktopModelProviders());
  const modelProviderModelMatch = /^\/api\/model-providers\/([^/]+)\/models\/([^/]+)$/.exec(path);
  if (modelProviderModelMatch) {
    const provider = decodeURIComponent(modelProviderModelMatch[1] ?? '');
    const modelId = decodeURIComponent(modelProviderModelMatch[2] ?? '');
    if (method === 'PATCH')
      return createDesktopLocalApiJsonResponse(
        await saveDesktopModelProviderModel({
          provider,
          modelId,
          ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
        }),
      );
    if (method === 'DELETE') return createDesktopLocalApiJsonResponse(await deleteDesktopModelProviderModel({ provider, modelId }));
  }
  const modelProviderMatch = /^\/api\/model-providers\/([^/]+)$/.exec(path);
  if (modelProviderMatch) {
    const provider = decodeURIComponent(modelProviderMatch[1] ?? '');
    if (method === 'PATCH')
      return createDesktopLocalApiJsonResponse(
        await saveDesktopModelProvider({ provider, ...((input.body && typeof input.body === 'object' ? input.body : {}) as object) }),
      );
    if (method === 'DELETE') return createDesktopLocalApiJsonResponse(await deleteDesktopModelProvider(provider));
  }
  if (method === 'GET' && path === '/api/default-cwd') return createDesktopLocalApiJsonResponse(await readDesktopDefaultCwd());
  if (method === 'PATCH' && path === '/api/default-cwd')
    return createDesktopLocalApiJsonResponse(
      await updateDesktopDefaultCwd(
        ((input.body && typeof input.body === 'object' ? input.body : {}) as { cwd?: string | null }).cwd ?? null,
      ),
    );
  if (method === 'GET' && path === '/api/provider-auth') return createDesktopLocalApiJsonResponse(await readDesktopProviderAuth());
  const providerApiKeyMatch = /^\/api\/provider-auth\/([^/]+)\/api-key$/.exec(path);
  if (method === 'PATCH' && providerApiKeyMatch)
    return createDesktopLocalApiJsonResponse(
      await setDesktopProviderApiKey({
        provider: decodeURIComponent(providerApiKeyMatch[1] ?? ''),
        apiKey: ((input.body && typeof input.body === 'object' ? input.body : {}) as { apiKey?: string }).apiKey ?? '',
      }),
    );
  const providerOAuthStartMatch = /^\/api\/provider-auth\/([^/]+)\/oauth$/.exec(path);
  if (method === 'POST' && providerOAuthStartMatch)
    return createDesktopLocalApiJsonResponse(await startDesktopProviderOAuthLogin(decodeURIComponent(providerOAuthStartMatch[1] ?? '')));
  const providerCredentialMatch = /^\/api\/provider-auth\/([^/]+)$/.exec(path);
  if (method === 'DELETE' && providerCredentialMatch)
    return createDesktopLocalApiJsonResponse(await removeDesktopProviderCredential(decodeURIComponent(providerCredentialMatch[1] ?? '')));
  const providerOAuthInputMatch = /^\/api\/provider-auth\/oauth\/([^/]+)\/input$/.exec(path);
  if (method === 'POST' && providerOAuthInputMatch)
    return createDesktopLocalApiJsonResponse(
      await submitDesktopProviderOAuthLoginInput({
        loginId: decodeURIComponent(providerOAuthInputMatch[1] ?? ''),
        value: ((input.body && typeof input.body === 'object' ? input.body : {}) as { value?: string }).value ?? '',
      }),
    );
  const providerOAuthCancelMatch = /^\/api\/provider-auth\/oauth\/([^/]+)\/cancel$/.exec(path);
  if (method === 'POST' && providerOAuthCancelMatch)
    return createDesktopLocalApiJsonResponse(await cancelDesktopProviderOAuthLogin(decodeURIComponent(providerOAuthCancelMatch[1] ?? '')));
  const providerOAuthMatch = /^\/api\/provider-auth\/oauth\/([^/]+)$/.exec(path);
  if (method === 'GET' && providerOAuthMatch) {
    return createDesktopLocalApiJsonResponse(await readDesktopProviderOAuthLogin(decodeURIComponent(providerOAuthMatch[1] ?? '')));
  }
  if (method === 'GET' && path === '/api/ui/open-conversations') {
    return createDesktopLocalApiJsonResponse(await readDesktopOpenConversationTabs());
  }
  if (method === 'PATCH' && path === '/api/ui/open-conversations') {
    return createDesktopLocalApiJsonResponse(
      await updateDesktopOpenConversationTabs(input.body as Parameters<typeof updateDesktopOpenConversationTabs>[0]),
    );
  }

  if (method === 'GET' && path === '/api/tasks') return createDesktopLocalApiJsonResponse(await readDesktopScheduledTasks());
  if (method === 'GET' && path === '/api/tasks/scheduler/health') {
    return createDesktopLocalApiJsonResponse(await readDesktopScheduledTaskSchedulerHealth());
  }
  if (method === 'POST' && path === '/api/tasks') {
    return createDesktopLocalApiJsonResponse(
      await createDesktopScheduledTask(input.body as Parameters<typeof createDesktopScheduledTask>[0]),
    );
  }
  const taskLogMatch = /^\/api\/tasks\/([^/]+)\/log$/.exec(path);
  if (method === 'GET' && taskLogMatch) {
    return createDesktopLocalApiJsonResponse(await readDesktopScheduledTaskLog(decodeURIComponent(taskLogMatch[1] ?? '')));
  }
  const taskRunMatch = /^\/api\/tasks\/([^/]+)\/run$/.exec(path);
  if (method === 'POST' && taskRunMatch) {
    return createDesktopLocalApiJsonResponse(await runDesktopScheduledTask(decodeURIComponent(taskRunMatch[1] ?? '')));
  }
  const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(path);
  if (taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1] ?? '');
    if (method === 'GET') return createDesktopLocalApiJsonResponse(await readDesktopScheduledTaskDetail(taskId));
    if (method === 'PATCH') {
      return createDesktopLocalApiJsonResponse(
        await updateDesktopScheduledTask({ taskId, ...(input.body && typeof input.body === 'object' ? (input.body as object) : {}) }),
      );
    }
    if (method === 'DELETE') return createDesktopLocalApiJsonResponse(await deleteDesktopScheduledTask(taskId));
  }

  if (method === 'GET' && path === '/api/runs') return createDesktopLocalApiJsonResponse(await readDesktopDurableRuns());
  const runLogMatch = /^\/api\/runs\/([^/]+)\/log$/.exec(path);
  if (method === 'GET' && runLogMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopDurableRunLog({
        runId: decodeURIComponent(runLogMatch[1] ?? ''),
        tail: input.url.searchParams.has('tail') ? Number(input.url.searchParams.get('tail')) : undefined,
      }),
    );
  }
  const runCancelMatch = /^\/api\/runs\/([^/]+)\/cancel$/.exec(path);
  if (method === 'POST' && runCancelMatch) {
    return createDesktopLocalApiJsonResponse(await cancelDesktopDurableRun(decodeURIComponent(runCancelMatch[1] ?? '')));
  }
  const runAttentionMatch = /^\/api\/runs\/([^/]+)\/attention$/.exec(path);
  if (method === 'POST' && runAttentionMatch) {
    return createDesktopLocalApiJsonResponse(
      await markDesktopDurableRunAttention({
        runId: decodeURIComponent(runAttentionMatch[1] ?? ''),
        ...((input.body && typeof input.body === 'object' ? input.body : {}) as { read?: boolean }),
      }),
    );
  }
  const runMatch = /^\/api\/runs\/([^/]+)$/.exec(path);
  if (method === 'GET' && runMatch)
    return createDesktopLocalApiJsonResponse(await readDesktopDurableRun(decodeURIComponent(runMatch[1] ?? '')));

  if (method === 'POST' && path === '/api/live-sessions/prewarm') {
    return createDesktopLocalApiJsonResponse(
      await prewarmLiveSessionCapability(
        (input.body ?? {}) as Parameters<typeof prewarmLiveSessionCapability>[0],
        await getLocalLiveSessionCapabilityContext(),
      ),
    );
  }
  if (method === 'POST' && path === '/api/live-sessions/prewarm-options') {
    return createDesktopLocalApiJsonResponse(await prewarmDesktopLiveSessionOptions());
  }

  if (method === 'POST' && path === '/api/conversations/reserve') {
    const body = input.body && typeof input.body === 'object' ? (input.body as { cwd?: unknown }) : {};
    return createDesktopLocalApiJsonResponse(
      reserveConversationSession({
        cwd: typeof body.cwd === 'string' ? body.cwd : undefined,
        profile: 'shared',
      }),
    );
  }

  if (method === 'POST' && path === '/api/live-sessions') {
    return createDesktopLocalApiJsonResponse(
      await createDesktopLiveSession((input.body ?? {}) as Parameters<typeof createDesktopLiveSession>[0]),
    );
  }
  if (method === 'POST' && path === '/api/live-sessions/resume') {
    return createDesktopLocalApiJsonResponse(
      await resumeDesktopLiveSession((input.body ?? {}) as Parameters<typeof resumeDesktopLiveSession>[0]),
    );
  }
  const liveSessionActionMatch =
    /^\/api\/live-sessions\/([^/]+)\/(take-over|restore-queued-message|clear-queued-messages|compact|export|reload|destroy|branch|fork|prompt|execute-bash|abort)$/.exec(
      path,
    );
  if (method === 'POST' && liveSessionActionMatch) {
    const conversationId = decodeURIComponent(liveSessionActionMatch[1] ?? '');
    const action = liveSessionActionMatch[2];
    const body = (input.body && typeof input.body === 'object' ? input.body : {}) as object;
    if (action === 'take-over')
      return createDesktopLocalApiJsonResponse(
        await takeOverDesktopLiveSession({ conversationId, ...body } as Parameters<typeof takeOverDesktopLiveSession>[0]),
      );
    if (action === 'restore-queued-message')
      return createDesktopLocalApiJsonResponse(
        await restoreDesktopQueuedLiveSessionMessage({ conversationId, ...body } as Parameters<
          typeof restoreDesktopQueuedLiveSessionMessage
        >[0]),
      );
    if (action === 'clear-queued-messages')
      return createDesktopLocalApiJsonResponse(await clearDesktopQueuedLiveSessionMessages({ conversationId }));
    if (action === 'compact')
      return createDesktopLocalApiJsonResponse(
        await compactDesktopLiveSession({ conversationId, ...body } as Parameters<typeof compactDesktopLiveSession>[0]),
      );
    if (action === 'export')
      return createDesktopLocalApiJsonResponse(
        await exportDesktopLiveSession({ conversationId, ...body } as Parameters<typeof exportDesktopLiveSession>[0]),
      );
    if (action === 'reload') return createDesktopLocalApiJsonResponse(await reloadDesktopLiveSession({ conversationId }));
    if (action === 'destroy') return createDesktopLocalApiJsonResponse(await destroyDesktopLiveSession(conversationId));
    if (action === 'branch')
      return createDesktopLocalApiJsonResponse(
        await branchDesktopLiveSession({ conversationId, ...body } as Parameters<typeof branchDesktopLiveSession>[0]),
      );
    if (action === 'fork')
      return createDesktopLocalApiJsonResponse(
        await forkDesktopLiveSession({ conversationId, ...body } as Parameters<typeof forkDesktopLiveSession>[0]),
      );
    if (action === 'prompt')
      return createDesktopLocalApiJsonResponse(
        await submitDesktopLiveSessionPrompt({ conversationId, ...body } as Parameters<typeof submitDesktopLiveSessionPrompt>[0]),
      );
    if (action === 'execute-bash')
      return createDesktopLocalApiJsonResponse(
        await executeDesktopLiveSessionBash({ conversationId, ...body } as Parameters<typeof executeDesktopLiveSessionBash>[0]),
      );
    if (action === 'abort') return createDesktopLocalApiJsonResponse(await abortDesktopLiveSession(conversationId));
  }

  const liveSessionContextMatch = /^\/api\/live-sessions\/([^/]+)\/context$/.exec(path);
  if (method === 'GET' && liveSessionContextMatch) {
    return createDesktopLocalApiJsonResponse(await readDesktopLiveSessionContext(decodeURIComponent(liveSessionContextMatch[1] ?? '')));
  }
  const liveSessionForkEntriesMatch = /^\/api\/live-sessions\/([^/]+)\/fork-entries$/.exec(path);
  if (method === 'GET' && liveSessionForkEntriesMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopLiveSessionForkEntries(decodeURIComponent(liveSessionForkEntriesMatch[1] ?? '')),
    );
  }
  const liveSessionMatch = /^\/api\/live-sessions\/([^/]+)$/.exec(path);
  if (method === 'GET' && liveSessionMatch) {
    return createDesktopLocalApiJsonResponse(await readDesktopLiveSession(decodeURIComponent(liveSessionMatch[1] ?? '')));
  }

  const conversationBootstrapMatch = /^\/api\/conversations\/([^/]+)\/bootstrap$/.exec(path);
  if (method === 'GET' && conversationBootstrapMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopConversationBootstrap({
        conversationId: decodeURIComponent(conversationBootstrapMatch[1] ?? ''),
        tailBlocks: input.url.searchParams.has('tailBlocks') ? Number(input.url.searchParams.get('tailBlocks')) : undefined,
        knownSessionSignature: input.url.searchParams.get('knownSessionSignature') ?? undefined,
        knownBlockOffset: input.url.searchParams.has('knownBlockOffset')
          ? Number(input.url.searchParams.get('knownBlockOffset'))
          : undefined,
        knownTotalBlocks: input.url.searchParams.has('knownTotalBlocks')
          ? Number(input.url.searchParams.get('knownTotalBlocks'))
          : undefined,
        knownLastBlockId: input.url.searchParams.get('knownLastBlockId') ?? undefined,
      }),
    );
  }
  const conversationStateMatch = /^\/api\/conversations\/([^/]+)\/state$/.exec(path);
  if (method === 'GET' && conversationStateMatch) {
    const capabilityContext = await getLocalLiveSessionCapabilityContext();
    return createDesktopLocalApiJsonResponse(
      await readDesktopConversationState({
        conversationId: decodeURIComponent(conversationStateMatch[1] ?? ''),
        profile: capabilityContext.getRuntimeScope(),
        tailBlocks: input.url.searchParams.has('tailBlocks') ? Number(input.url.searchParams.get('tailBlocks')) : undefined,
      }),
    );
  }
  const conversationAttentionMatch = /^\/api\/conversations\/([^/]+)\/attention$/.exec(path);
  if (method === 'POST' && conversationAttentionMatch) {
    return createDesktopLocalApiJsonResponse(
      await markDesktopConversationAttention({
        conversationId: decodeURIComponent(conversationAttentionMatch[1] ?? ''),
        ...((input.body && typeof input.body === 'object' ? input.body : {}) as { read?: boolean }),
      }),
    );
  }
  const conversationCwdMatch = /^\/api\/conversations\/([^/]+)\/cwd$/.exec(path);
  if (method === 'PATCH' && conversationCwdMatch) {
    return createDesktopLocalApiJsonResponse(
      await changeDesktopConversationCwd({
        conversationId: decodeURIComponent(conversationCwdMatch[1] ?? ''),
        ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
      }),
    );
  }
  const conversationGoalMatch = /^\/api\/conversations\/([^/]+)\/goal$/.exec(path);
  if (method === 'PATCH' && conversationGoalMatch) {
    return createDesktopLocalApiJsonResponse(
      await updateDesktopConversationGoal({
        conversationId: decodeURIComponent(conversationGoalMatch[1] ?? ''),
        ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
      }),
    );
  }
  const conversationModelPreferencesMatch = /^\/api\/conversations\/([^/]+)\/model-preferences$/.exec(path);
  if (conversationModelPreferencesMatch) {
    const conversationId = decodeURIComponent(conversationModelPreferencesMatch[1] ?? '');
    if (method === 'GET') return createDesktopLocalApiJsonResponse(await readDesktopConversationModelPreferences(conversationId));
    if (method === 'PATCH') {
      return createDesktopLocalApiJsonResponse(
        await updateDesktopConversationModelPreferences({
          conversationId,
          ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
        }),
      );
    }
  }
  const conversationTitleMatch = /^\/api\/conversations\/([^/]+)\/title$/.exec(path);
  if (method === 'PATCH' && conversationTitleMatch) {
    return createDesktopLocalApiJsonResponse(
      await renameDesktopConversation({
        conversationId: decodeURIComponent(conversationTitleMatch[1] ?? ''),
        name: String((input.body && typeof input.body === 'object' ? (input.body as Record<string, unknown>).name : '') ?? ''),
      }),
    );
  }
  const conversationDeferredResumeActionMatch = /^\/api\/conversations\/([^/]+)\/deferred-resumes\/([^/]+)\/(fire)$/.exec(path);
  if (method === 'POST' && conversationDeferredResumeActionMatch) {
    return createDesktopLocalApiJsonResponse(
      await fireDesktopConversationDeferredResume({
        conversationId: decodeURIComponent(conversationDeferredResumeActionMatch[1] ?? ''),
        resumeId: decodeURIComponent(conversationDeferredResumeActionMatch[2] ?? ''),
      }),
    );
  }
  const conversationDeferredResumeMatch = /^\/api\/conversations\/([^/]+)\/deferred-resumes\/([^/]+)$/.exec(path);
  if (method === 'DELETE' && conversationDeferredResumeMatch) {
    return createDesktopLocalApiJsonResponse(
      await cancelDesktopConversationDeferredResume({
        conversationId: decodeURIComponent(conversationDeferredResumeMatch[1] ?? ''),
        resumeId: decodeURIComponent(conversationDeferredResumeMatch[2] ?? ''),
      }),
    );
  }
  const conversationDeferredResumesMatch = /^\/api\/conversations\/([^/]+)\/deferred-resumes$/.exec(path);
  if (conversationDeferredResumesMatch) {
    const conversationId = decodeURIComponent(conversationDeferredResumesMatch[1] ?? '');
    if (method === 'GET') return createDesktopLocalApiJsonResponse(await readDesktopConversationDeferredResumes(conversationId));
    if (method === 'POST') {
      return createDesktopLocalApiJsonResponse(
        await scheduleDesktopConversationDeferredResume({
          conversationId,
          ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
        }),
      );
    }
  }

  const conversationCheckpointMatch = /^\/api\/conversations\/([^/]+)\/checkpoints\/([^/]+)$/.exec(path);
  if (method === 'GET' && conversationCheckpointMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopConversationCheckpoint({
        conversationId: decodeURIComponent(conversationCheckpointMatch[1] ?? ''),
        checkpointId: decodeURIComponent(conversationCheckpointMatch[2] ?? ''),
      }),
    );
  }
  const conversationCheckpointsMatch = /^\/api\/conversations\/([^/]+)\/checkpoints$/.exec(path);
  if (method === 'GET' && conversationCheckpointsMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopConversationCheckpoints(decodeURIComponent(conversationCheckpointsMatch[1] ?? '')),
    );
  }

  const conversationArtifactMatch = /^\/api\/conversations\/([^/]+)\/artifacts\/([^/]+)$/.exec(path);
  if (method === 'GET' && conversationArtifactMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopConversationArtifact({
        conversationId: decodeURIComponent(conversationArtifactMatch[1] ?? ''),
        artifactId: decodeURIComponent(conversationArtifactMatch[2] ?? ''),
      }),
    );
  }
  const conversationArtifactsMatch = /^\/api\/conversations\/([^/]+)\/artifacts$/.exec(path);
  if (method === 'GET' && conversationArtifactsMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopConversationArtifacts(decodeURIComponent(conversationArtifactsMatch[1] ?? '')),
    );
  }

  const conversationAttachmentAssetMatch = /^\/api\/conversations\/([^/]+)\/attachments\/([^/]+)\/asset$/.exec(path);
  if (method === 'GET' && conversationAttachmentAssetMatch) {
    return createDesktopLocalApiJsonResponse(
      await readDesktopConversationAttachmentAsset({
        conversationId: decodeURIComponent(conversationAttachmentAssetMatch[1] ?? ''),
        attachmentId: decodeURIComponent(conversationAttachmentAssetMatch[2] ?? ''),
        asset: input.url.searchParams.get('asset') === 'preview' ? 'preview' : 'source',
        revision: input.url.searchParams.has('revision') ? Number(input.url.searchParams.get('revision')) : undefined,
      }),
    );
  }
  const conversationAttachmentMatch = /^\/api\/conversations\/([^/]+)\/attachments\/([^/]+)$/.exec(path);
  if (conversationAttachmentMatch) {
    const conversationId = decodeURIComponent(conversationAttachmentMatch[1] ?? '');
    const attachmentId = decodeURIComponent(conversationAttachmentMatch[2] ?? '');
    if (method === 'GET')
      return createDesktopLocalApiJsonResponse(await readDesktopConversationAttachment({ conversationId, attachmentId }));
    if (method === 'PATCH') {
      return createDesktopLocalApiJsonResponse(
        await updateDesktopConversationAttachment({
          conversationId,
          attachmentId,
          ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
        }),
      );
    }
    if (method === 'DELETE')
      return createDesktopLocalApiJsonResponse(await deleteDesktopConversationAttachment({ conversationId, attachmentId }));
  }
  const conversationAttachmentsMatch = /^\/api\/conversations\/([^/]+)\/attachments$/.exec(path);
  if (conversationAttachmentsMatch) {
    const conversationId = decodeURIComponent(conversationAttachmentsMatch[1] ?? '');
    if (method === 'GET') return createDesktopLocalApiJsonResponse(await readDesktopConversationAttachments(conversationId));
    if (method === 'POST') {
      return createDesktopLocalApiJsonResponse(
        await createDesktopConversationAttachment({
          conversationId,
          ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
        }),
      );
    }
  }

  return null;
}

export async function dispatchDesktopLocalApiRequest(input: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<DesktopLocalApiDispatchResult> {
  const startedAtMs = performance.now();
  process.stderr.write(`[perf] dispatch ${input.method} ${input.path}\n`);
  const url = new URL(input.path, 'http://desktop.local');
  let productResponse: DesktopLocalApiDispatchResult | null;
  try {
    productResponse = await dispatchDesktopLocalProductApiRequest({ method: input.method, url, body: input.body, signal: input.signal });
  } catch (error) {
    const statusCode = getDesktopLocalApiErrorStatus(error);
    const message = error instanceof Error ? error.message : String(error);
    const errorResponse = createDesktopLocalApiErrorResponse(statusCode, message);
    return {
      ...errorResponse,
      headers: {
        ...errorResponse.headers,
        'X-PA-Perf': JSON.stringify({
          localApi: {
            totalBeforeReturnMs: Math.round(performance.now() - startedAtMs),
            responseBytes: errorResponse.body.byteLength,
            fastPath: 'product',
          },
        }),
      },
    };
  }
  if (productResponse) {
    return {
      ...productResponse,
      headers: {
        ...productResponse.headers,
        'X-PA-Perf': JSON.stringify({
          localApi: {
            totalBeforeReturnMs: Math.round(performance.now() - startedAtMs),
            responseBytes: productResponse.body.byteLength,
            fastPath: 'product',
          },
        }),
      },
    };
  }

  if (input.method === 'POST' && url.pathname === '/api/sessions/search') {
    const fastResponse = dispatchFastConversationContentSearch({ body: input.body });
    if (fastResponse) {
      return {
        ...fastResponse,
        headers: {
          ...fastResponse.headers,
          'X-PA-Perf': JSON.stringify({
            localApi: {
              totalBeforeReturnMs: Math.round(performance.now() - startedAtMs),
              responseBytes: fastResponse.body.byteLength,
              fastPath: 'search',
            },
          }),
        },
      };
    }
  }

  const routes = await getLocalRoutes();
  const routesReadyAtMs = performance.now();
  const route = findMatchingLocalApiRoute(routes, input.method, url.pathname);

  if (!route) {
    return createDesktopLocalApiErrorResponse(404, `No local API route for ${input.method} ${url.pathname}`);
  }

  const match = route.pattern.exec(url.pathname);
  const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match?.[index + 1] ?? '')]));
  const req = createLocalApiRequest({
    method: input.method,
    url,
    params,
    body: input.body,
    headers: input.headers,
  });
  const res = new LocalApiResponse();

  const handlerStartedAtMs = performance.now();
  try {
    await route.handler(req, res);
  } catch (error) {
    const statusCode = getDesktopLocalApiErrorStatus(error);
    const message = error instanceof Error ? error.message : String(error);
    const errorResponse = createDesktopLocalApiErrorResponse(statusCode, message);
    return {
      ...errorResponse,
      headers: {
        ...errorResponse.headers,
        'X-PA-Perf': JSON.stringify({
          localApi: {
            routeLookupMs: Math.round(routesReadyAtMs - startedAtMs),
            handlerMs: Math.round(performance.now() - handlerStartedAtMs),
            totalBeforeReturnMs: Math.round(performance.now() - startedAtMs),
            responseBytes: errorResponse.body.byteLength,
          },
        }),
      },
    };
  }
  const handlerFinishedAtMs = performance.now();

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ended) {
    if (contentType.toLowerCase().includes('text/event-stream')) {
      throw new Error(`Local API stream requires subscribeDesktopLocalApiStream for ${input.method} ${url.pathname}`);
    }

    throw new Error(`Local API route did not complete for ${input.method} ${url.pathname}`);
  }

  const totalMs = Math.round(performance.now() - startedAtMs);
  if (totalMs > 100) {
    process.stderr.write(`[perf] dispatch ${input.method} ${url.pathname} → ${res.statusCode} in ${totalMs}ms\n`);
  }
  const body = res.getBody();
  return {
    statusCode: res.statusCode,
    headers: {
      ...Object.fromEntries(res.headers.entries()),
      'X-PA-Perf': JSON.stringify({
        localApi: {
          routeLookupMs: Math.round(routesReadyAtMs - startedAtMs),
          handlerMs: Math.round(handlerFinishedAtMs - handlerStartedAtMs),
          totalBeforeReturnMs: Math.round(performance.now() - startedAtMs),
          responseBytes: body.byteLength,
        },
      }),
    },
    body,
  };
}

export async function invokeDesktopLocalApi<T = unknown>(input: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<T> {
  const response = await dispatchDesktopLocalApiRequest(input);

  if (response.statusCode >= 400) {
    throw new Error(readLocalApiError(response));
  }

  const contentType = response.headers['content-type'] ?? '';
  const bodyText = decodeLocalApiBody(response.body);
  if (contentType.toLowerCase().includes('application/json')) {
    return (bodyText.length > 0 ? JSON.parse(bodyText) : null) as T;
  }

  return bodyText as T;
}

export async function readDesktopAppStatus() {
  const context = await getLocalServerRouteContext();
  return {
    profile: 'shared',
    repoRoot: context.getRepoRoot(),
    appRevision: process.env.NEON_PILOT_APP_REVISION,
  };
}

export async function readDesktopDaemonState() {
  return readDaemonState();
}

export async function readDesktopSessions(input: { limit?: number } = {}) {
  await getLocalServerRouteContext();
  return readConversationSessionsCapability(input);
}

export async function readDesktopSessionMeta(sessionId: string) {
  await getLocalServerRouteContext();
  const session = readConversationSessionMetaCapability(sessionId);
  assertSessionFound(Boolean(session));

  return session;
}

export async function readDesktopSessionSearchIndex(sessionIds: string[]) {
  return readConversationSessionSearchIndexCapability({ sessionIds });
}

export async function readDesktopModels() {
  const m = await models();
  return await m.readModelState(DEFAULT_RUNTIME_SETTINGS_FILE);
}

export async function updateDesktopModelPreferences(input: {
  model?: string | null;
  visionModel?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}) {
  validateDesktopModelPreferenceUpdate(input);

  const m = await models();
  const modelData = (await m.readModelState(DEFAULT_RUNTIME_SETTINGS_FILE)).models;
  persistSettingsWrite(
    (settingsFile) => {
      m.writeSavedModelPreferences(buildSavedModelPreferencePatch(input), settingsFile, modelData);
    },
    {
      runtimeSettingsFile: DEFAULT_RUNTIME_SETTINGS_FILE,
    },
  );
  return buildDesktopMutationOkResponse();
}

export async function readDesktopDefaultCwd() {
  return readSavedDefaultCwdPreferences(DEFAULT_RUNTIME_SETTINGS_FILE, process.cwd());
}

export async function updateDesktopDefaultCwd(cwd: string | null) {
  const state = persistSettingsWrite(
    (settingsFile) => writeSavedDefaultCwdPreference({ cwd }, settingsFile, { baseDir: process.cwd(), validate: true }),
    {
      runtimeSettingsFile: DEFAULT_RUNTIME_SETTINGS_FILE,
    },
  );
  return state;
}

export async function pickDesktopFolder(input: { cwd?: string | null; prompt?: string | null } = {}) {
  const context = await getLocalServerRouteContext();
  return pickFolderCapability(input, {
    getDefaultWebCwd: context.getDefaultWebCwd,
    resolveRequestedCwd: context.resolveRequestedCwd,
  });
}

export async function readDesktopConversationPlansWorkspace() {
  return readConversationPlansWorkspace(DEFAULT_RUNTIME_SETTINGS_FILE);
}

export async function readDesktopOpenConversationTabs() {
  const context = await getLocalServerRouteContext();
  const saved = readSavedUiPreferences(context.getSettingsFile());
  return buildDesktopOpenConversationTabsResponse(saved);
}

export async function updateDesktopOpenConversationTabs(input: {
  sessionIds?: string[];
  pinnedSessionIds?: string[];
  archivedSessionIds?: string[];
  activeConversationId?: string | null;
  workspacePaths?: string[];
}) {
  const { sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId, workspacePaths } = input;
  validateDesktopOpenConversationTabsUpdate(input);

  const context = await getLocalServerRouteContext();
  const saved = persistSettingsWrite(
    (settingsFile) =>
      writeSavedUiPreferences(
        {
          openConversationIds: sessionIds,
          pinnedConversationIds: pinnedSessionIds,
          archivedConversationIds: archivedSessionIds,
          activeConversationId,
          workspacePaths,
        },
        settingsFile,
      ),
    { runtimeSettingsFile: context.getSettingsFile() },
  );

  for (const topic of desktopOpenConversationTabsInvalidationTopics(input)) {
    invalidateAppTopics(topic);
  }
  return {
    ok: true as const,
    ...buildDesktopOpenConversationTabsResponse(saved),
  };
}

export async function readDesktopModelProviders() {
  return (await models()).readModelProvidersCapability(await getLocalProviderDesktopCapabilityContext());
}

export async function readDesktopProviderAuth() {
  return (await models()).readProviderAuthCapability(await getLocalProviderDesktopCapabilityContext());
}

export async function saveDesktopModelProvider(input: {
  provider: string;
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  authHeader?: boolean;
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
  modelOverrides?: Record<string, unknown>;
}) {
  const result = (await models()).saveModelProviderCapability(await getLocalProviderDesktopCapabilityContext(), input);
  (await models()).invalidateModelDefinitionsCache();
  invalidateAppTopics('models');
  return result;
}

export async function deleteDesktopModelProvider(provider: string) {
  const result = (await models()).deleteModelProviderCapability(await getLocalProviderDesktopCapabilityContext(), provider);
  (await models()).invalidateModelDefinitionsCache();
  invalidateAppTopics('models');
  return result;
}

export async function saveDesktopModelProviderModel(input: {
  provider: string;
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
}) {
  const result = (await models()).saveModelProviderModelCapability(await getLocalProviderDesktopCapabilityContext(), input);
  (await models()).invalidateModelDefinitionsCache();
  invalidateAppTopics('models');
  return result;
}

export async function deleteDesktopModelProviderModel(input: { provider: string; modelId: string }) {
  const result = (await models()).deleteModelProviderModelCapability(
    await getLocalProviderDesktopCapabilityContext(),
    input.provider,
    input.modelId,
  );
  (await models()).invalidateModelDefinitionsCache();
  invalidateAppTopics('models');
  return result;
}

export async function setDesktopProviderApiKey(input: { provider: string; apiKey: string }) {
  const result = (await models()).setProviderApiKeyCapability(await getLocalProviderDesktopCapabilityContext(), input.provider, input.apiKey);
  (await models()).invalidateModelDefinitionsCache();
  invalidateAppTopics('models');
  return result;
}

export async function removeDesktopProviderCredential(provider: string) {
  const result = (await models()).removeProviderCredentialCapability(await getLocalProviderDesktopCapabilityContext(), provider);
  (await models()).invalidateModelDefinitionsCache();
  invalidateAppTopics('models');
  return result;
}

export async function startDesktopProviderOAuthLogin(provider: string) {
  return (await models()).startProviderOAuthLoginCapability(await getLocalProviderDesktopCapabilityContext(), provider);
}

export async function readDesktopProviderOAuthLogin(loginId: string) {
  return (await models()).readProviderOAuthLoginCapability(loginId);
}

export async function submitDesktopProviderOAuthLoginInput(input: { loginId: string; value: string }) {
  return (await models()).submitProviderOAuthLoginInputCapability(input.loginId, input.value);
}

export async function cancelDesktopProviderOAuthLogin(loginId: string) {
  return (await models()).cancelProviderOAuthLoginCapability(loginId);
}

export async function subscribeDesktopProviderOAuthLogin(loginId: string, onState: (state: unknown) => void): Promise<() => void> {
  await getLocalRoutes();
  const normalizedLoginId = normalizeRequiredProviderOAuthLoginId(loginId);

  let closed = false;
  let unsubscribe = () => {};
  const handleState = (state: unknown) => {
    if (closed) {
      return;
    }

    onState(state);
    if (shouldCloseProviderOAuthSubscription(state)) {
      closed = true;
      unsubscribe();
    }
  };

  unsubscribe = (await models()).subscribeProviderOAuthLogin(normalizedLoginId, handleState);
  const current = (await models()).getProviderOAuthLoginState(normalizedLoginId);
  if (current) {
    handleState(current);
  }

  return () => {
    if (closed) {
      return;
    }

    closed = true;
    unsubscribe();
  };
}

export async function readDesktopScheduledTasks() {
  await getLocalRoutes();
  return listScheduledTasksCapability(DESKTOP_SCHEDULED_TASK_PROFILE);
}

export async function readDesktopScheduledTaskDetail(taskId: string) {
  await getLocalRoutes();
  return readScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, taskId);
}

export async function readDesktopScheduledTaskSchedulerHealth() {
  await getLocalRoutes();
  return readScheduledTaskSchedulerHealth(DESKTOP_SCHEDULED_TASK_PROFILE);
}

export async function readDesktopScheduledTaskLog(taskId: string) {
  await getLocalRoutes();
  return readScheduledTaskLogCapability(DESKTOP_SCHEDULED_TASK_PROFILE, taskId);
}

export async function createDesktopScheduledTask(input: {
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
  conversationBehavior?: 'steer' | 'followUp' | null;
  callbackConversationId?: string | null;
  deliverOnSuccess?: boolean | null;
  deliverOnFailure?: boolean | null;
  notifyOnSuccess?: 'none' | 'passive' | 'disruptive' | null;
  notifyOnFailure?: 'none' | 'passive' | 'disruptive' | null;
  requireAck?: boolean | null;
  autoResumeIfOpen?: boolean | null;
  threadMode?: 'dedicated' | 'existing' | 'none' | null;
  threadConversationId?: string | null;
}) {
  await getLocalRoutes();
  return createScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, normalizeDesktopScheduledTaskCreateInput(input));
}

export async function updateDesktopScheduledTask(input: {
  taskId: string;
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
  conversationBehavior?: 'steer' | 'followUp' | null;
  callbackConversationId?: string | null;
  deliverOnSuccess?: boolean | null;
  deliverOnFailure?: boolean | null;
  notifyOnSuccess?: 'none' | 'passive' | 'disruptive' | null;
  notifyOnFailure?: 'none' | 'passive' | 'disruptive' | null;
  requireAck?: boolean | null;
  autoResumeIfOpen?: boolean | null;
  threadMode?: 'dedicated' | 'existing' | 'none' | null;
  threadConversationId?: string | null;
}) {
  await getLocalRoutes();
  return updateScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, input);
}

export async function runDesktopScheduledTask(taskId: string) {
  await getLocalRoutes();
  return runScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, taskId);
}

export async function deleteDesktopScheduledTask(taskId: string) {
  await getLocalRoutes();
  return deleteScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, taskId);
}

export async function markDesktopConversationAttention(input: { conversationId: string; read?: boolean }) {
  const context = await getLocalServerRouteContext();
  const updated = toggleConversationAttention({
    profile: context.getRuntimeScope(),
    conversationId: input.conversationId,
    read: resolveAttentionReadValue(input.read),
  });
  assertAttentionTargetUpdated(updated, 'Conversation not found');

  invalidateAppTopics('sessions');
  return buildDesktopOkResponse();
}

export async function readDesktopDurableRuns() {
  return listDurableRunsCapability();
}

export async function readDesktopDurableRun(runId: string) {
  return readDurableRunCapability(runId);
}

export async function readDesktopDurableRunLog(input: { runId: string; tail?: number }) {
  return readDurableRunLogCapability(input);
}

export async function cancelDesktopDurableRun(runId: string) {
  return cancelDurableRunCapability(runId);
}

export async function markDesktopDurableRunAttention(input: { runId: string; read?: boolean }) {
  return markDurableRunAttentionCapability(input);
}

export async function readDesktopConversationBootstrap(input: {
  conversationId: string;
  tailBlocks?: number;
  knownSessionSignature?: string;
  knownBlockOffset?: number;
  knownTotalBlocks?: number;
  knownLastBlockId?: string;
}) {
  const startedAtMs = performance.now();
  const context = await getLocalLiveSessionCapabilityContext();
  const contextReadyAtMs = performance.now();
  const bootstrap = await readConversationBootstrapState({
    ...input,
    profile: context.getRuntimeScope(),
  });
  const bootstrapReadAtMs = performance.now();
  assertConversationBootstrapFound(isMissingConversationBootstrapState(bootstrap.state));
  const checkedAtMs = performance.now();
  const state = inlineConversationBootstrapAssetsCapability(bootstrap.state);
  const inlinedAtMs = performance.now();

  return {
    ...state,
    perf: {
      contextMs: Math.round(contextReadyAtMs - startedAtMs),
      bootstrapReadMs: Math.round(bootstrapReadAtMs - contextReadyAtMs),
      assertMs: Math.round(checkedAtMs - bootstrapReadAtMs),
      assetInlineMs: Math.round(inlinedAtMs - checkedAtMs),
      totalMs: Math.round(inlinedAtMs - startedAtMs),
      ...(bootstrap.telemetry.sessionRead ? { sessionReadMs: Math.round(bootstrap.telemetry.sessionRead.durationMs) } : {}),
      ...(bootstrap.telemetry.sessionRead ? { sessionReadCache: bootstrap.telemetry.sessionRead.cache === 'hit' ? 1 : 0 } : {}),
      ...(bootstrap.telemetry.sessionRead ? { sessionReadFastTail: bootstrap.telemetry.sessionRead.loader === 'fast-tail' ? 1 : 0 } : {}),
      ...(bootstrap.telemetry.sessionRead?.phases ? { sessionReadPhases: bootstrap.telemetry.sessionRead.phases } : {}),
      remoteMirrorMs: Math.round(bootstrap.telemetry.remoteMirror.durationMs),
      sessionSignatureMs: Math.round(bootstrap.telemetry.sessionSignatureMs),
      sessionSignaturePhases: bootstrap.telemetry.sessionSignature,
      liveSessionLookupMs: Math.round(bootstrap.telemetry.liveSessionLookupMs),
      sessionDetailReused: bootstrap.telemetry.sessionDetailReused ? 1 : 0,
    },
  };
}

async function readForkedDesktopConversationBootstrap(input: { conversationId: string; profile: string }) {
  const bootstrap = await readConversationBootstrapState({
    conversationId: input.conversationId,
    profile: input.profile,
    tailBlocks: DESKTOP_FORK_BOOTSTRAP_TAIL_BLOCKS,
  });

  if (isMissingConversationBootstrapState(bootstrap.state)) {
    return null;
  }

  return inlineConversationBootstrapAssetsCapability(bootstrap.state);
}

export async function renameDesktopConversation(input: {
  conversationId: string;
  name: string;
  surfaceId?: string;
}): Promise<{ ok: true; title: string }> {
  await getLocalRoutes();

  const conversationId = readRequiredConversationId(input.conversationId);
  const nextName = readRequiredConversationName(input.name);

  if (isLiveSession(conversationId)) {
    renameSession(conversationId, nextName);
    return buildRenameDesktopConversationResult({ title: nextName });
  }

  const renamed = renameStoredConversation(conversationId, nextName);
  publishConversationSessionMetaChanged(conversationId);
  return buildRenameDesktopConversationResult({
    title: resolveRenamedStoredConversationTitle({ renamedTitle: renamed.title, fallbackTitle: nextName }),
  });
}

export async function changeDesktopConversationCwd(input: {
  conversationId: string;
  cwd?: string | null;
  workspaceCwd?: string | null;
  surfaceId?: string;
}) {
  await getLocalRoutes();

  const conversationId = readRequiredConversationId(input.conversationId);

  const liveEntry = liveRegistry.get(conversationId);
  const storedMeta = readConversationSessionMeta(conversationId);
  const currentCwd = liveEntry?.cwd ?? storedMeta?.cwd;
  const sourceSessionFile = liveEntry?.session.sessionFile ?? storedMeta?.file;

  if (!currentCwd || !sourceSessionFile) {
    throw new Error('Conversation not found.');
  }

  if (liveEntry?.session.isStreaming) {
    throw new Error('Stop the current response before changing the working directory.');
  }

  const context = await getLocalLiveSessionCapabilityContext();
  const { nextCwd, nextWorkspaceCwd } = resolveDesktopConversationNextCwd({
    cwd: input.cwd,
    workspaceCwd: input.workspaceCwd,
    currentCwd,
    runtimeScope: context.getRuntimeScope(),
    resolveNeutralChatCwd,
    resolveRequestedCwd,
  });
  assertDesktopConversationCwdDirectory(nextCwd);

  if (nextCwd === currentCwd) {
    return buildUnchangedConversationCwdResponse({ id: conversationId, sessionFile: sourceSessionFile, cwd: currentCwd });
  }

  const result = await createSessionFromExisting(sourceSessionFile, nextCwd, {
    ...context.buildLiveSessionResourceOptions(context.getRuntimeScope()),
    extensionFactories: context.buildLiveSessionExtensionFactories(),
  });

  appendConversationWorkspaceMetadata({
    sessionFile: result.sessionFile,
    previousCwd: currentCwd,
    previousWorkspaceCwd: resolvePreviousWorkspaceCwd({
      hasWorkspaceCwd: Boolean(storedMeta && Object.prototype.hasOwnProperty.call(storedMeta, 'workspaceCwd')),
      workspaceCwd: storedMeta?.workspaceCwd,
      currentCwd,
    }),
    cwd: nextCwd,
    workspaceCwd: nextWorkspaceCwd,
    visibleMessage: true,
  });
  appendConversationOffshootDetachedMetadata({ sessionFile: result.sessionFile });

  if (liveEntry) {
    destroySession(conversationId);
  }

  publishConversationSessionMetaChanged(conversationId, result.id);
  return buildChangedConversationCwdResponse({ id: result.id, sessionFile: result.sessionFile, cwd: nextCwd });
}

export async function updateDesktopConversationGoal(input: { conversationId: string; objective?: string }) {
  const conversationId = validateDesktopConversationGoalInput(input);
  const writeGoal = (sessionManager: SessionManager) => {
    const goalState = buildDesktopConversationGoalState(input);
    sessionManager.appendCustomEntry('conversation-goal', goalState);
    return goalState;
  };

  const liveEntry = liveRegistry.get(conversationId);
  if (liveEntry) {
    const result = writeGoal(liveEntry.session.sessionManager);
    publishAppEvent({ type: 'session_file_changed', sessionId: conversationId });
    return result;
  }

  const sessionFile = resolveConversationSessionFile(conversationId);
  if (!sessionFile || !existsSync(sessionFile)) throw new Error('Conversation not found');
  const result = writeGoal(SessionManager.open(sessionFile));
  publishAppEvent({ type: 'session_file_changed', sessionId: conversationId });
  return result;
}

export async function createDesktopConversationCheckpoint(input: { conversationId: string; message: string; paths: string[] }) {
  const context = await getLocalServerRouteContext();
  const conversationId = input.conversationId.trim();
  const session = readConversationSessionMetaCapability(conversationId);
  if (!session) {
    throw new Error('Conversation not found.');
  }
  const cwd = readRequiredCheckpointString(session.cwd, 'cwd');
  const message = readRequiredCheckpointString(input.message, 'message');
  const paths = normalizeCheckpointPaths(cwd, input.paths);
  const created = createConversationCheckpointCommit({ cwd, message, paths });
  const record = saveConversationCommitCheckpoint(
    buildConversationCheckpointRecordInput({ profile: context.getRuntimeScope(), conversationId, cwd, created }),
  );
  invalidateAppTopics('checkpoints', 'sessions');
  return record;
}

export async function readDesktopConversationArtifacts(conversationId: string) {
  const context = await getLocalServerRouteContext();
  return readConversationArtifactsCapability(context.getRuntimeScope(), conversationId);
}

export async function readDesktopConversationArtifact(input: { conversationId: string; artifactId: string }) {
  const context = await getLocalServerRouteContext();
  return readConversationArtifactCapability(context.getRuntimeScope(), input);
}

export async function readDesktopConversationCheckpoints(conversationId: string) {
  const context = await getLocalServerRouteContext();
  return readConversationCommitCheckpointsCapability(context.getRuntimeScope(), conversationId);
}

export async function readDesktopConversationCheckpoint(input: { conversationId: string; checkpointId: string }) {
  const context = await getLocalServerRouteContext();
  return readConversationCommitCheckpointCapability(context.getRuntimeScope(), input);
}

export async function readDesktopConversationAttachments(conversationId: string) {
  const context = await getLocalServerRouteContext();
  return readConversationAttachmentsCapability(context.getRuntimeScope(), conversationId);
}

export async function readDesktopConversationAttachment(input: { conversationId: string; attachmentId: string }) {
  const context = await getLocalServerRouteContext();
  return readConversationAttachmentCapability(context.getRuntimeScope(), input);
}

export async function createDesktopConversationAttachment(input: {
  conversationId: string;
  kind?: 'excalidraw';
  title?: string;
  sourceData?: string;
  sourceName?: string;
  sourceMimeType?: string;
  previewData?: string;
  previewName?: string;
  previewMimeType?: string;
  note?: string;
}) {
  const context = await getLocalServerRouteContext();
  return createConversationAttachmentCapability(context.getRuntimeScope(), input);
}

export async function updateDesktopConversationAttachment(input: {
  conversationId: string;
  attachmentId: string;
  title?: string;
  sourceData?: string;
  sourceName?: string;
  sourceMimeType?: string;
  previewData?: string;
  previewName?: string;
  previewMimeType?: string;
  note?: string;
}) {
  const context = await getLocalServerRouteContext();
  return updateConversationAttachmentCapability(context.getRuntimeScope(), input);
}

export async function deleteDesktopConversationAttachment(input: { conversationId: string; attachmentId: string }) {
  const context = await getLocalServerRouteContext();
  return deleteConversationAttachmentCapability(context.getRuntimeScope(), input);
}

export async function readDesktopConversationAttachmentAsset(input: {
  conversationId: string;
  attachmentId: string;
  asset: 'source' | 'preview';
  revision?: number;
}) {
  const context = await getLocalServerRouteContext();
  const download = readConversationAttachmentDownloadCapability(context.getRuntimeScope(), input);
  const data = readFileSync(download.filePath).toString('base64');

  return buildAttachmentAssetResponse({ mimeType: download.mimeType, fileName: download.fileName, base64Data: data });
}

export async function readDesktopConversationDeferredResumes(conversationId: string) {
  await getLocalServerRouteContext();
  return readConversationDeferredResumesCapability(conversationId);
}

export async function scheduleDesktopConversationDeferredResume(input: {
  conversationId: string;
  delay?: string;
  prompt?: string;
  behavior?: 'steer' | 'followUp';
}) {
  await getLocalServerRouteContext();
  return scheduleConversationDeferredResumeCapability(input);
}

export async function cancelDesktopConversationDeferredResume(input: { conversationId: string; resumeId: string }) {
  await getLocalServerRouteContext();
  return cancelConversationDeferredResumeCapability(input);
}

export async function fireDesktopConversationDeferredResume(input: { conversationId: string; resumeId: string }) {
  const context = await getLocalLiveSessionCapabilityContext();
  return fireConversationDeferredResumeCapability({
    ...input,
    flushLiveDeferredResumes: context.flushLiveDeferredResumes,
  });
}

export async function recoverDesktopConversation(conversationId: string) {
  const context = await getLocalLiveSessionCapabilityContext();
  return recoverConversationCapability(conversationId, {
    getRuntimeScope: context.getRuntimeScope,
    buildLiveSessionResourceOptions: context.buildLiveSessionResourceOptions,
    buildLiveSessionResourceOptionsAsync: context.buildLiveSessionResourceOptionsAsync,
    buildLiveSessionExtensionFactories: context.buildLiveSessionExtensionFactories,
    flushLiveDeferredResumes: context.flushLiveDeferredResumes,
  });
}

export async function readDesktopConversationModelPreferences(conversationId: string) {
  await getLocalRoutes();

  const normalizedConversationId = conversationId.trim();
  assertConversationFound(Boolean(normalizedConversationId));

  const state = await readConversationModelPreferenceStateById(normalizedConversationId);
  assertConversationFound(Boolean(state));

  return state;
}

export async function updateDesktopConversationModelPreferences(input: {
  conversationId: string;
  model?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
  surfaceId?: string;
}) {
  await getLocalRoutes();
  const { conversationId, preferences: nextInput } = normalizeDesktopConversationModelPreferenceUpdate(input);

  if (isLiveSession(conversationId)) {
    return updateLiveSessionModelPreferences(conversationId, nextInput, await getAvailableModelObjects());
  }

  const sessionFile = resolveConversationSessionFile(conversationId);
  if (!sessionFile || !existsSync(sessionFile)) {
    throw new Error('Conversation not found');
  }

  const availableModels = await getAvailableModelObjects();
  const sessionManager = SessionManager.open(sessionFile);
  const state = applyConversationModelPreferencesToSessionManager(
    sessionManager,
    nextInput,
    (await models()).readSavedModelPreferences(DEFAULT_RUNTIME_SETTINGS_FILE, availableModels),
    availableModels,
  );

  publishConversationSessionMetaChanged(conversationId);
  return state;
}

export async function readDesktopLiveSession(conversationId: string) {
  const normalizedConversationId = normalizeRequiredLiveConversationId(conversationId, '404 Not Found');
  assertLiveConversationExists(
    { conversationId: normalizedConversationId, isLive: isLiveSession(normalizedConversationId) },
    '404 Not Found',
  );

  const entry = getLocalLiveSessions().find((session) => session.id === normalizedConversationId);
  if (!entry) {
    throw new Error('404 Not Found');
  }

  return buildDesktopLiveSessionResponse(entry);
}

export async function prewarmDesktopLiveSessionOptions(): Promise<{ ok: true }> {
  return prewarmLiveSessionCapability({}, await getLocalLiveSessionCapabilityContext());
}

export async function readDesktopLiveSessionForkEntries(conversationId: string): Promise<Array<{ entryId: string; text: string }>> {
  await getLocalContexts();

  const normalizedConversationId = normalizeRequiredLiveConversationId(conversationId, 'Session not live');

  const entries = getLiveSessionForkEntries(normalizedConversationId);
  if (!entries) {
    throw new Error('Session not live');
  }

  return entries as Array<{ entryId: string; text: string }>;
}

export async function readDesktopLiveSessionContext(conversationId: string) {
  await getLocalRoutes();

  const normalizedConversationId = normalizeRequiredLiveConversationId(conversationId, 'Session not found');

  const liveEntry = liveRegistry.get(normalizedConversationId);
  const storedSession = !liveEntry ? readConversationSessionMeta(normalizedConversationId) : null;
  const cwd = liveEntry?.cwd ?? storedSession?.cwd;
  if (!cwd) {
    throw new Error('Session not found');
  }

  const gitSummary = readGitStatusSummaryWithTelemetry(cwd).summary;
  return buildLiveSessionContextResponse({ cwd, gitSummary });
}

export async function readDesktopSessionDetail(input: {
  sessionId: string;
  tailBlocks?: number;
  knownSessionSignature?: string;
  knownBlockOffset?: number;
  knownTotalBlocks?: number;
  knownLastBlockId?: string;
}) {
  const context = await getLocalLiveSessionCapabilityContext();
  return readSessionDetailRouteResponse({
    ...input,
    profile: context.getRuntimeScope(),
  });
}

export async function readDesktopSessionBlock(input: { sessionId: string; blockId: string }) {
  await getLocalRoutes();

  const result = await readConversationSessionBlockWithInlineAssetsCapability(input.sessionId, input.blockId);
  assertSessionFound(Boolean(result), 'Session block not found');

  return result;
}

export async function readDesktopSessionEntryBlocks(input: { sessionId: string; entryIds: string[] }) {
  await getLocalRoutes();

  const result = await readConversationSessionEntryBlocksWithInlineAssetsCapability(input.sessionId, input.entryIds);
  assertSessionFound(Boolean(result), 'Session not found');

  return { blocks: result };
}

function resolveDesktopConversationSource(conversationId: string): {
  sessionFile: string;
  cwd: string;
  live: boolean;
} {
  const trimmedConversationId = readRequiredConversationId(conversationId);

  const liveEntry = liveRegistry.get(trimmedConversationId);
  const liveSessionFile = normalizeResolvedSessionFile(liveEntry?.session.sessionFile);
  if (liveEntry && liveSessionFile) {
    return buildDesktopConversationSource({ sessionFile: liveSessionFile, cwd: liveEntry.cwd, live: true });
  }

  const sessionFile = normalizeResolvedSessionFile(resolveConversationSessionFile(trimmedConversationId));
  if (!sessionFile || !existsSync(sessionFile)) {
    throw new Error('Conversation not found');
  }

  const sessionManager = SessionManager.open(sessionFile);
  return buildDesktopConversationSource({ sessionFile, cwd: sessionManager.getCwd(), live: false });
}

export async function createDesktopLiveSession(input: {
  cwd?: string;
  workspaceCwd?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
  prompt?: string;
  behavior?: 'steer' | 'followUp';
  images?: Array<{ data: string; mimeType: string; name?: string }>;
  attachmentRefs?: unknown;
  contextMessages?: Array<{ customType: string; content: string }>;
  relatedConversationIds?: unknown;
  allowedToolNames?: string[];
  reservedSessionFile?: string;
}): Promise<{ id: string; sessionFile: string; bootstrap?: unknown; perf?: Record<string, number> }> {
  const startedAtMs = performance.now();
  const { context, perf: contextSetupPerf } = await getLocalLiveSessionCapabilityContextWithPerf();
  const contextReadyAtMs = performance.now();
  const created = await createLiveSessionCapability(input, context);
  const createdAtMs = performance.now();

  // Log timing to stderr so the user can see where time is spent.
  const contextSetupMs = Math.round(contextReadyAtMs - startedAtMs);
  const createSessionMs = Math.round(createdAtMs - contextReadyAtMs);
  if (contextSetupMs > 500 || createSessionMs > 500) {
    const perfLog = {
      event: 'createDesktopLiveSession',
      contextSetupMs,
      createSessionMs,
      totalMs: Math.round(createdAtMs - startedAtMs),
      capabilityPerf: created.perf,
      contextSetupPerf: contextSetupPerf,
    };
    process.stderr.write(`[perf] ${JSON.stringify(perfLog)}\n`);
  }
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  if (shouldDispatchInitialLiveSessionPrompt({ prompt, imageCount: input.images?.length })) {
    const dispatchTimer = setTimeout(() => {
      void submitLiveSessionPromptCapability(
        {
          conversationId: created.id,
          text: prompt,
          behavior: input.behavior,
          images: input.images,
          attachmentRefs: input.attachmentRefs,
          contextMessages: input.contextMessages,
          relatedConversationIds: input.relatedConversationIds,
        },
        context,
      ).catch((error) => {
        logError('initial live-session prompt dispatch failed', {
          conversationId: created.id,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
    }, 1_000);
    dispatchTimer.unref?.();
  }
  return {
    ...created,
    perf: buildCreateLiveSessionPerf({
      startedAtMs,
      contextReadyAtMs,
      createdAtMs,
      returnedAtMs: performance.now(),
      contextSetupPerf,
      capabilityPerf: created.perf,
    }),
  };
}

export async function resumeDesktopLiveSession(input: {
  sessionFile: string;
  cwd?: string;
}): Promise<{ id: string; perf?: Record<string, number> }> {
  const startedAtMs = performance.now();
  const { context, perf: contextSetupPerf } = await getLocalLiveSessionCapabilityContextWithPerf();
  const contextReadyAtMs = performance.now();
  const resumed = await resumeLiveSessionCapability(input, context);
  const resumedAtMs = performance.now();
  return {
    ...resumed,
    perf: {
      ...contextSetupPerf,
      contextMs: Math.round(contextReadyAtMs - startedAtMs),
      ...(resumed.perf ?? {}),
      totalBeforeReturnMs: Math.round(resumedAtMs - startedAtMs),
    },
  };
}

export async function submitDesktopLiveSessionPrompt(input: {
  conversationId: string;
  text?: string;
  behavior?: 'steer' | 'followUp';
  images?: Array<{ data: string; mimeType: string; name?: string }>;
  attachmentRefs?: unknown;
  contextMessages?: Array<{ customType: string; content: string }>;
  relatedConversationIds?: unknown;
  surfaceId?: string;
}): Promise<{
  ok: true;
  accepted: true;
  delivery: 'started' | 'queued';
  referencedTaskIds: string[];
  referencedMemoryDocIds: string[];
  referencedKnowledgeFileIds: string[];
  referencedAttachmentIds: string[];
}> {
  return submitLiveSessionPromptCapability(input, await getLocalLiveSessionCapabilityContext());
}

export async function submitDesktopLiveSessionParallelPrompt(input: {
  conversationId: string;
  text?: string;
  images?: Array<{ data: string; mimeType: string; name?: string }>;
  attachmentRefs?: unknown;
  contextMessages?: Array<{ customType: string; content: string }>;
  relatedConversationIds?: unknown;
  surfaceId?: string;
}): Promise<{
  ok: true;
  accepted: true;
  jobId: string;
  childConversationId: string;
  referencedTaskIds: string[];
  referencedMemoryDocIds: string[];
  referencedKnowledgeFileIds: string[];
  referencedAttachmentIds: string[];
}> {
  return submitLiveSessionParallelPromptCapability(input, await getLocalLiveSessionCapabilityContext());
}

export async function manageDesktopLiveSessionParallelJob(input: {
  conversationId: string;
  jobId: string;
  action: 'importNow' | 'skip' | 'cancel';
  surfaceId?: string;
}): Promise<{
  ok: true;
  status: 'imported' | 'queued' | 'skipped' | 'cancelled';
}> {
  return manageLiveSessionParallelJobCapability(input);
}

export async function takeOverDesktopLiveSession(input: { conversationId: string; surfaceId: string }) {
  return takeOverLiveSessionCapability(input);
}

export async function restoreDesktopQueuedLiveSessionMessage(input: {
  conversationId: string;
  behavior: 'steer' | 'followUp';
  index: number;
  previewId?: string;
}) {
  return restoreQueuedLiveSessionMessageCapability(input);
}

export async function clearDesktopQueuedLiveSessionMessages(input: { conversationId: string }) {
  return clearQueuedLiveSessionPromptsCapability(input);
}

export async function compactDesktopLiveSession(input: { conversationId: string; customInstructions?: string }) {
  return compactLiveSessionCapability(input);
}

export async function exportDesktopLiveSession(input: {
  conversationId: string;
  outputPath?: string;
}): Promise<{ ok: true; path: string }> {
  await getLocalRoutes();

  const conversationId = normalizeExportLiveSessionConversationId(input.conversationId);

  const path = await exportSessionHtml(conversationId, normalizeOptionalExportOutputPath(input.outputPath));
  return buildExportLiveSessionResponse({ path });
}

export async function reloadDesktopLiveSession(input: { conversationId: string }) {
  return reloadLiveSessionCapability(input);
}

export async function executeDesktopLiveSessionBash(input: {
  conversationId: string;
  command: string;
  excludeFromContext?: boolean;
}): Promise<{ ok: true; result: unknown }> {
  const result = await executeSessionBash(input.conversationId, input.command, { excludeFromContext: input.excludeFromContext });
  return buildExecuteLiveSessionBashResponse({ result });
}

export async function destroyDesktopLiveSession(conversationId: string): Promise<{ ok: true }> {
  return destroyLiveSessionCapability({ conversationId });
}

export async function branchDesktopLiveSession(input: { conversationId: string; entryId: string; surfaceId?: string }) {
  const context = await getLocalLiveSessionCapabilityContext();
  const branched = await branchLiveSessionCapability(input, context);
  const bootstrap = await readForkedDesktopConversationBootstrap({
    conversationId: branched.newSessionId,
    profile: context.getRuntimeScope(),
  });
  return {
    ...branched,
    ...(bootstrap ? { bootstrap } : {}),
  };
}

export async function forkDesktopLiveSession(input: {
  conversationId: string;
  entryId: string;
  preserveSource?: boolean;
  beforeEntry?: boolean;
  branchKind?: 'fork' | 'rewind';
  surfaceId?: string;
}) {
  const startedAtMs = performance.now();
  const { context, perf: contextSetupPerf } = await getLocalLiveSessionCapabilityContextWithPerf();
  const contextReadyAtMs = performance.now();
  const forked = await forkLiveSessionCapability(input, context);
  const forkedAtMs = performance.now();
  const bootstrap = await readForkedDesktopConversationBootstrap({
    conversationId: forked.newSessionId,
    profile: context.getRuntimeScope(),
  });
  const bootstrapAtMs = performance.now();
  return {
    ...forked,
    ...(bootstrap ? { bootstrap } : {}),
    perf: {
      ...contextSetupPerf,
      contextMs: Math.round(contextReadyAtMs - startedAtMs),
      ...(forked.perf ?? {}),
      totalBeforeReturnMs: Math.round(forkedAtMs - startedAtMs),
      bootstrapMs: Math.round(bootstrapAtMs - forkedAtMs),
      totalWithBootstrapMs: Math.round(bootstrapAtMs - startedAtMs),
    },
  };
}

export async function forkDesktopConversation(input: {
  conversationId: string;
  cwd?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}): Promise<{ id: string; sessionFile: string }> {
  const source = resolveDesktopConversationSource(input.conversationId);
  return createSessionFromExisting(
    source.sessionFile,
    resolveForkConversationCwd({ requestedCwd: input.cwd, sourceCwd: source.cwd }),
    buildForkConversationInitialOptions(input),
  );
}

export async function rollbackDesktopConversation(input: {
  conversationId: string;
  numTurns: number;
}): Promise<{ id: string; sessionFile: string }> {
  validateDesktopRollbackTurns(input.numTurns);

  const conversationId = input.conversationId.trim();
  const source = resolveDesktopConversationSource(conversationId);
  if (source.live) {
    const liveEntry = liveRegistry.get(conversationId);
    assertRollbackLiveSessionNotStreaming(Boolean(liveEntry?.session.isStreaming));
    destroySession(conversationId);
  }

  const leafId = resolveRollbackLeafId(source.sessionFile, input.numTurns);
  rewriteConversationSessionToLeaf(source.sessionFile, leafId);

  if (source.live) {
    await resumeLiveSessionCapability({ sessionFile: source.sessionFile, cwd: source.cwd }, await getLocalLiveSessionCapabilityContext());
  } else {
    publishConversationSessionMetaChanged(conversationId);
  }

  return buildRollbackConversationResponse({ id: conversationId, sessionFile: source.sessionFile });
}

export async function abortDesktopLiveSession(conversationId: string): Promise<{ ok: true }> {
  return abortLiveSessionCapability({ conversationId });
}
