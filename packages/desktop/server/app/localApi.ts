import { EventEmitter } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainThread } from 'node:worker_threads';

import { installProcessLogging } from '../middleware/index.js';
installProcessLogging();

const DESKTOP_SCHEDULED_TASK_PROFILE = 'shared';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import {
  getPiAgentRuntimeDir,
  getStateRoot,
  readKnowledgeBaseState,
  saveConversationCommitCheckpoint,
  startKnowledgeBaseSyncLoop,
  subscribeKnowledgeBaseState,
  syncKnowledgeBaseNow,
  updateKnowledgeBase,
} from '@neon-pilot/core';
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
import { searchIndexedConversationContent } from '../conversations/conversationSearchIndex.js';
import {
  appendConversationOffshootDetachedMetadata,
  appendConversationWorkspaceMetadata,
  buildAppendOnlyConversationDetailResponse,
  publishConversationSessionMetaChanged,
  readConversationModelPreferenceStateById,
  readConversationSessionMeta,
  readConversationSessionSignature,
  readSessionDetailForRoute,
  renameStoredConversation,
  resolveConversationSessionFile,
  toggleConversationAttention,
} from '../conversations/conversationService.js';
import {
  inlineConversationBootstrapAssetsCapability,
  inlineConversationSessionDetailAppendOnlyAssetsCapability,
  inlineConversationSessionDetailAssetsCapability,
  readConversationSessionBlockWithInlineAssetsCapability,
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
import { checkEnabledExtensionBackendHealth, startExtensionStartupActions } from '../extensions/extensionBackend.js';
import { beginExtensionStartupGuard, completeExtensionStartupGuard } from '../extensions/extensionRegistry.js';
import { setWorkbenchBrowserToolHost, type WorkbenchBrowserToolHost } from '../extensions/workbenchBrowserToolHost.js';
import { listMemoryDocs, listSkillsForProfile } from '../knowledge/memoryDocs.js';
import { readSavedModelPreferences, writeSavedModelPreferences } from '../models/modelPreferences.js';
import { readModelState } from '../models/modelState.js';
import { getProviderOAuthLoginState, subscribeProviderOAuthLogin } from '../models/providerAuth.js';
import {
  cancelProviderOAuthLoginCapability,
  deleteModelProviderCapability,
  deleteModelProviderModelCapability,
  type ProviderDesktopCapabilityContext,
  readModelProvidersCapability,
  readProviderAuthCapability,
  readProviderOAuthLoginCapability,
  removeProviderCredentialCapability,
  saveModelProviderCapability,
  saveModelProviderModelCapability,
  setProviderApiKeyCapability,
  startProviderOAuthLoginCapability,
  submitProviderOAuthLoginInputCapability,
} from '../models/providerDesktopCapability.js';
import type { ServerRouteContext } from '../routes/context.js';
import { registerServerRoutes } from '../routes/registerAll.js';
import { invalidateAppTopics, publishAppEvent, subscribeAppEvents } from '../shared/appEvents.js';
import { logError } from '../shared/logging.js';
import { readConversationPlansWorkspace } from '../ui/conversationPlanPreferences.js';
import { readSavedDefaultCwdPreferences, writeSavedDefaultCwdPreference } from '../ui/defaultCwdPreferences.js';
import { DEFAULT_RUNTIME_SETTINGS_FILE, persistSettingsWrite } from '../ui/settingsPersistence.js';
import { readSavedUiPreferences, writeSavedUiPreferences } from '../ui/uiPreferences.js';
import { readGitStatusSummaryWithTelemetry } from '../workspace/gitStatus.js';
import { pickFolderCapability, readVaultFilesCapability } from '../workspace/workspaceDesktopCapability.js';
import { startAttentionDispatchLoop } from './bootstrap.js';
import { buildDesktopConversationGoalState, validateDesktopConversationGoalInput } from './localApiConversationGoal.js';
import { validateDesktopModelPreferenceUpdate } from './localApiModelPreferences.js';
import { desktopOpenConversationTabsInvalidationTopics, validateDesktopOpenConversationTabsUpdate } from './localApiOpenTabs.js';
import { buildDesktopOpenConversationTabsResponse } from './localApiOpenTabsPresentation.js';
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
import {
  buildUnchangedSessionDetailResponse,
  shouldBuildAppendOnlySessionDetail,
  shouldReturnUnchangedSessionDetail,
} from './localApiSessionDetailResponse.js';
import { buildDesktopCloseEvent, markSubscriptionClosed, shouldCloseSubscription } from './localApiSubscriptionClose.js';
import { createServerRouteContext } from './routeContext.js';
import { createRuntimeState } from './runtimeState.js';

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
let localServerRouteContext: ServerRouteContext | null = null;
let localLiveSessionCapabilityContext: LiveSessionCapabilityContext | null = null;
let localProviderDesktopCapabilityContext: ProviderDesktopCapabilityContext | null = null;

const LOCAL_API_DEFERRED_RESUME_POLL_MS = 3_000;
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

async function buildLocalRoutes(): Promise<RegisteredRoute[]> {
  const repoRoot = resolveRepoRoot();
  const agentDir = getPiAgentRuntimeDir();
  const authFile = join(agentDir, 'auth.json');
  const settingsFile = DEFAULT_RUNTIME_SETTINGS_FILE;

  const runtimeState = createRuntimeState({
    repoRoot,
    agentDir,
    logger: {
      warn: () => {
        // Ignore local desktop route-context warnings here.
      },
    },
  });

  const flushAttentionEvents = createAttentionEventFlusher({
    getRuntimeScope: runtimeState.getRuntimeScope,
    getRepoRoot: () => repoRoot,
    getStateRoot,
    resolveDaemonRoot,
    publishConversationSessionMetaChanged,
  });

  if (isMainThread) {
    startAttentionDispatchLoop({
      flushAttentionEvents,
      pollMs: LOCAL_API_DEFERRED_RESUME_POLL_MS,
    });
  }

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

  localServerRouteContext = context;

  localLiveSessionCapabilityContext = {
    getRuntimeScope: context.getRuntimeScope,
    getRepoRoot: context.getRepoRoot,
    getDefaultWebCwd: context.getDefaultWebCwd,
    buildLiveSessionResourceOptions: context.buildLiveSessionResourceOptions,
    buildLiveSessionExtensionFactories: context.buildLiveSessionExtensionFactories,
    flushLiveDeferredResumes: context.flushLiveDeferredResumes,
    listTasksForRuntimeScope: context.listTasksForRuntimeScope,
    listMemoryDocs: context.listMemoryDocs,
  };

  localProviderDesktopCapabilityContext = {
    getRuntimeScope: context.getRuntimeScope,
    materializeWebRuntimeConfig: context.materializeWebRuntimeConfig,
    getAuthFile: context.getAuthFile,
  };

  const routes: RegisteredRoute[] = [];
  const appRouter = createRouteCollector(routes);
  registerServerRoutes({
    app: appRouter as never,
    context,
  });

  if (isMainThread) {
    const startupGuard = beginExtensionStartupGuard();
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

    // Startup actions/services are first-class startup work. Full backend
    // health probes are diagnostic and can import heavyweight optional
    // backends, so run them after the app has had a chance to paint.
    void startExtensionStartupActions(context)
      .then(() => completeExtensionStartupGuard())
      .catch((error) => {
        logError('extension startup dispatch failed', { message: (error as Error).message });
        publishAppEvent({
          type: 'notification',
          extensionId: 'core',
          message: `Extension startup failed: ${(error as Error).message}`,
          severity: 'error',
        });
      });

    const backendHealthTimer = setTimeout(() => {
      void checkEnabledExtensionBackendHealth().catch((error) => {
        logError('extension backend health check dispatch failed', { message: (error as Error).message });
      });
    }, 60_000);
    backendHealthTimer.unref?.();
  }

  return routes;
}

async function getLocalRoutes(): Promise<RegisteredRoute[]> {
  if (!localRoutesPromise) {
    localRoutesPromise = buildLocalRoutes().catch((error) => {
      localRoutesPromise = null;
      localServerRouteContext = null;
      localLiveSessionCapabilityContext = null;
      localProviderDesktopCapabilityContext = null;
      throw error;
    });
  }

  return localRoutesPromise;
}

async function getLocalServerRouteContext(): Promise<ServerRouteContext> {
  await getLocalRoutes();
  return assertLocalServerRouteContext(localServerRouteContext);
}

async function getLocalLiveSessionCapabilityContext(): Promise<LiveSessionCapabilityContext> {
  await getLocalRoutes();
  return assertLocalLiveSessionCapabilityContext(localLiveSessionCapabilityContext);
}

async function getLocalProviderDesktopCapabilityContext(): Promise<ProviderDesktopCapabilityContext> {
  await getLocalRoutes();
  return assertLocalProviderDesktopCapabilityContext(localProviderDesktopCapabilityContext);
}

subscribeKnowledgeBaseState(() => {
  invalidateAppTopics('knowledgeBase');
});

// The desktop shell serves local API routes directly inside Electron. Running the
// managed knowledge-base sync loop there shells out to git on a timer and can
// block the app while the user is clicking around. Keep the loop in the managed
// web service, but skip it for the embedded desktop runtime and its worker
// helpers.
if (process.env.NEON_PILOT_DESKTOP_RUNTIME !== '1') {
  startKnowledgeBaseSyncLoop();
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
  await getLocalRoutes();
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

async function dispatchDesktopLocalProductApiRequest(input: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: URL;
  body?: unknown;
}): Promise<DesktopLocalApiDispatchResult | null> {
  const path = input.url.pathname;
  const method = input.method;

  if (method === 'GET' && path === '/api/status') return createDesktopLocalApiJsonResponse(await readDesktopAppStatus());
  if (method === 'GET' && path === '/api/daemon') return createDesktopLocalApiJsonResponse(await readDesktopDaemonState());
  if (method === 'GET' && path === '/api/sessions') return createDesktopLocalApiJsonResponse(await readDesktopSessions());
  if (method === 'POST' && path === '/api/sessions/search-index') {
    const body = input.body as { sessionIds?: string[] } | undefined;
    return createDesktopLocalApiJsonResponse(await readDesktopSessionSearchIndex(body?.sessionIds ?? []));
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
}): Promise<DesktopLocalApiDispatchResult> {
  const url = new URL(input.path, 'http://desktop.local');
  const productResponse = await dispatchDesktopLocalProductApiRequest({ method: input.method, url, body: input.body });
  if (productResponse) return productResponse;

  if (input.method === 'POST' && url.pathname === '/api/sessions/search') {
    const fastResponse = dispatchFastConversationContentSearch({ body: input.body });
    if (fastResponse) return fastResponse;
  }

  const routes = await getLocalRoutes();
  const route = findMatchingLocalApiRoute(routes, input.method, url.pathname);

  if (!route) {
    throw new Error(`No local API route for ${input.method} ${url.pathname}`);
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

  await route.handler(req, res);

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ended) {
    if (contentType.toLowerCase().includes('text/event-stream')) {
      throw new Error(`Local API stream requires subscribeDesktopLocalApiStream for ${input.method} ${url.pathname}`);
    }

    throw new Error(`Local API route did not complete for ${input.method} ${url.pathname}`);
  }

  return {
    statusCode: res.statusCode,
    headers: Object.fromEntries(res.headers.entries()),
    body: res.getBody(),
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

export async function readDesktopSessions() {
  await getLocalRoutes();
  return readConversationSessionsCapability();
}

export async function readDesktopSessionMeta(sessionId: string) {
  await getLocalRoutes();

  const session = readConversationSessionMetaCapability(sessionId);
  assertSessionFound(Boolean(session));

  return session;
}

export async function readDesktopSessionSearchIndex(sessionIds: string[]) {
  await getLocalRoutes();
  return readConversationSessionSearchIndexCapability({ sessionIds });
}

export async function readDesktopModels() {
  return await readModelState(DEFAULT_RUNTIME_SETTINGS_FILE);
}

export async function updateDesktopModelPreferences(input: {
  model?: string | null;
  visionModel?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}) {
  validateDesktopModelPreferenceUpdate(input);

  const models = (await readModelState(DEFAULT_RUNTIME_SETTINGS_FILE)).models;
  persistSettingsWrite(
    (settingsFile) => {
      writeSavedModelPreferences(buildSavedModelPreferencePatch(input), settingsFile, models);
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

export async function readDesktopVaultFiles() {
  return readVaultFilesCapability();
}

export async function readDesktopKnowledgeBase() {
  return readKnowledgeBaseState();
}

export async function updateDesktopKnowledgeBase(input: { repoUrl?: string | null; branch?: string | null }) {
  const state = updateKnowledgeBase(input);
  const context = await getLocalServerRouteContext();
  context.materializeWebRuntimeConfig(context.getRuntimeScope());
  invalidateAppTopics('knowledgeBase');
  return state;
}

export async function syncDesktopKnowledgeBase() {
  const state = syncKnowledgeBaseNow();
  invalidateAppTopics('knowledgeBase');
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
  return readModelProvidersCapability(await getLocalProviderDesktopCapabilityContext());
}

export async function readDesktopProviderAuth() {
  return readProviderAuthCapability(await getLocalProviderDesktopCapabilityContext());
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
  return saveModelProviderCapability(await getLocalProviderDesktopCapabilityContext(), input);
}

export async function deleteDesktopModelProvider(provider: string) {
  return deleteModelProviderCapability(await getLocalProviderDesktopCapabilityContext(), provider);
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
  return saveModelProviderModelCapability(await getLocalProviderDesktopCapabilityContext(), input);
}

export async function deleteDesktopModelProviderModel(input: { provider: string; modelId: string }) {
  return deleteModelProviderModelCapability(await getLocalProviderDesktopCapabilityContext(), input.provider, input.modelId);
}

export async function setDesktopProviderApiKey(input: { provider: string; apiKey: string }) {
  return setProviderApiKeyCapability(await getLocalProviderDesktopCapabilityContext(), input.provider, input.apiKey);
}

export async function removeDesktopProviderCredential(provider: string) {
  return removeProviderCredentialCapability(await getLocalProviderDesktopCapabilityContext(), provider);
}

export async function startDesktopProviderOAuthLogin(provider: string) {
  return startProviderOAuthLoginCapability(await getLocalProviderDesktopCapabilityContext(), provider);
}

export async function readDesktopProviderOAuthLogin(loginId: string) {
  return readProviderOAuthLoginCapability(loginId);
}

export async function submitDesktopProviderOAuthLoginInput(input: { loginId: string; value: string }) {
  return submitProviderOAuthLoginInputCapability(input.loginId, input.value);
}

export async function cancelDesktopProviderOAuthLogin(loginId: string) {
  return cancelProviderOAuthLoginCapability(loginId);
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

  unsubscribe = subscribeProviderOAuthLogin(normalizedLoginId, handleState);
  const current = getProviderOAuthLoginState(normalizedLoginId);
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
  const context = await getLocalLiveSessionCapabilityContext();
  const bootstrap = await readConversationBootstrapState({
    ...input,
    profile: context.getRuntimeScope(),
  });
  assertConversationBootstrapFound(isMissingConversationBootstrapState(bootstrap.state));

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
    readSavedModelPreferences(DEFAULT_RUNTIME_SETTINGS_FILE, availableModels),
    availableModels,
  );

  publishConversationSessionMetaChanged(conversationId);
  return state;
}

export async function readDesktopLiveSession(conversationId: string) {
  await getLocalRoutes();

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

export async function readDesktopLiveSessionForkEntries(conversationId: string): Promise<Array<{ entryId: string; text: string }>> {
  await getLocalRoutes();

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
  const sessionId = input.sessionId.trim();
  const currentSessionSignature = readConversationSessionSignature(sessionId);
  const unchangedSessionCheck = { knownSessionSignature: input.knownSessionSignature, currentSessionSignature };
  if (shouldReturnUnchangedSessionDetail(unchangedSessionCheck)) {
    return buildUnchangedSessionDetailResponse({ sessionId, signature: unchangedSessionCheck.currentSessionSignature });
  }

  const { sessionRead } = await readSessionDetailForRoute({
    conversationId: sessionId,
    profile: context.getRuntimeScope(),
    tailBlocks: input.tailBlocks,
  });
  if (!sessionRead.detail) {
    throw new Error('Session not found');
  }

  const appendOnly = shouldBuildAppendOnlySessionDetail({
    knownSessionSignature: input.knownSessionSignature,
    nextSessionSignature: sessionRead.detail.signature,
  })
    ? buildAppendOnlyConversationDetailResponse({
        detail: sessionRead.detail,
        knownBlockOffset: input.knownBlockOffset,
        knownTotalBlocks: input.knownTotalBlocks,
        knownLastBlockId: input.knownLastBlockId,
      })
    : null;

  if (appendOnly) {
    return inlineConversationSessionDetailAppendOnlyAssetsCapability(sessionId, appendOnly);
  }

  return inlineConversationSessionDetailAssetsCapability(sessionId, sessionRead.detail);
}

export async function readDesktopSessionBlock(input: { sessionId: string; blockId: string }) {
  await getLocalRoutes();

  const result = await readConversationSessionBlockWithInlineAssetsCapability(input.sessionId, input.blockId);
  assertSessionFound(Boolean(result), 'Session block not found');

  return result;
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
}): Promise<{ id: string; sessionFile: string; bootstrap?: unknown; perf?: Record<string, number> }> {
  const startedAtMs = performance.now();
  const context = await getLocalLiveSessionCapabilityContext();
  const contextReadyAtMs = performance.now();
  const created = await createLiveSessionCapability(input, context);
  const createdAtMs = performance.now();
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
      capabilityPerf: created.perf,
    }),
  };
}

export async function resumeDesktopLiveSession(input: { sessionFile: string; cwd?: string }): Promise<{ id: string }> {
  return resumeLiveSessionCapability(input, await getLocalLiveSessionCapabilityContext());
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
  referencedVaultFileIds: string[];
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
  referencedVaultFileIds: string[];
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
  return branchLiveSessionCapability(input, await getLocalLiveSessionCapabilityContext());
}

export async function forkDesktopLiveSession(input: {
  conversationId: string;
  entryId: string;
  preserveSource?: boolean;
  beforeEntry?: boolean;
  surfaceId?: string;
}) {
  return forkLiveSessionCapability(input, await getLocalLiveSessionCapabilityContext());
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
