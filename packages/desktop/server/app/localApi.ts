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
import {
  ensureDesktopRootDir,
  getPiAgentRuntimeDir,
  getStateRoot,
  resolveDesktopRootLayout,
  saveConversationCommitCheckpoint,
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
import { readConversationAggregateDeltas, readConversationAggregateState } from '../conversations/conversationAggregate.js';
import {
  createConversationAttachmentCapability,
  deleteConversationArtifactCapability,
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
import { cleanupDeletedConversationRuntime } from '../conversations/conversationRunCleanup.js';
import { searchIndexedConversationContent } from '../conversations/conversationSearchIndex.js';
import {
  appendConversationOffshootDetachedMetadata,
  appendConversationWorkspaceMetadata,
  deleteStoredConversations,
  publishConversationSessionMetaChanged,
  readConversationModelPreferenceStateById,
  readConversationSessionMeta,
  readSessionDetailForRoute,
  renameStoredConversation,
  resolveConversationSessionFile,
  setConversationServiceContext,
  toggleConversationAttention,
} from '../conversations/conversationService.js';
import {
  findConversationSessionDetailBlock,
  inlineConversationBootstrapAssetsCapability,
  inlineConversationSessionBlockAssetsCapability,
  readConversationSessionBlockWithInlineAssetsCapability,
  readConversationSessionEntryBlocksWithInlineAssetsCapability,
} from '../conversations/conversationSessionAssetCapability.js';
import {
  readConversationSessionMetaCapability,
  readConversationSessionsCapability,
  readConversationSessionSearchIndexCapability,
} from '../conversations/conversationSessionCapability.js';
import { readConversationSummaryIndexCapability } from '../conversations/conversationSummaries.js';
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
  requestConversationWorkingDirectoryChange,
  resumeSession,
} from '../conversations/liveSessions.js';
import {
  createSessionFromExisting,
  destroySession,
  getAvailableModelObjects,
  updateLiveSessionModelPreferences,
} from '../conversations/liveSessions.js';
import { getExecution, getExecutionLog, listConversationExecutions, listExecutions } from '../executions/executionService.js';
import { createExtensionConversationsCapability } from '../extensions/extensionConversations.js';
import { getExtensionHostClient, setExtensionHostClient } from '../extensions/extensionHostClient.js';
import { createExtensionHostRpcClient } from '../extensions/extensionHostRpcClient.js';
import { createExtensionHostServerContextSnapshot } from '../extensions/extensionHostServerContext.js';
import { notifyExtensionStartupStatus } from '../extensions/extensionNotifications.js';
import { requestExtensionUiConfirm } from '../extensions/extensionUiConfirmBridge.js';
import { setWorkbenchBrowserToolHost, type WorkbenchBrowserToolHost } from '../extensions/workbenchBrowserToolHost.js';
import { listMemoryDocs, listSkillsForProfile } from '../knowledge/memoryDocs.js';
import type { ProviderDesktopCapabilityContext } from '../models/providerDesktopCapability.js';
import { invokeToolByName } from '../tools/toolGateway.js';

// ── Model/provider modules ─────────────────────────────────────────────
// Keep the provider SDK/model table stack behind typed loaders so the local
// API module and read-only model picker path can become ready before
// provider-management routes are touched.
type ModelStateModules = typeof import('../models/modelPreferences.js') & typeof import('../models/modelState.js');
type ModelProviderModules = ModelStateModules &
  typeof import('../models/providerAuth.js') &
  typeof import('../models/providerDesktopCapability.js');

let modelStateModulesPromise: Promise<ModelStateModules> | null = null;
let modelProviderModulesPromise: Promise<ModelProviderModules> | null = null;

function modelState(): Promise<ModelStateModules> {
  modelStateModulesPromise ??= Promise.all([import('../models/modelPreferences.js'), import('../models/modelState.js')]).then(
    ([prefs, state]) => ({ ...prefs, ...state }),
  );
  return modelStateModulesPromise;
}

function models(): Promise<ModelProviderModules> {
  modelProviderModulesPromise ??= Promise.all([
    modelState(),
    import('../models/providerAuth.js'),
    import('../models/providerDesktopCapability.js'),
  ]).then(([state, auth, caps]) => ({ ...state, ...auth, ...caps }));
  return modelProviderModulesPromise;
}
import type { ServerRouteContext } from '../routes/context.js';
import { registerServerRoutes } from '../routes/registerAll.js';
import { buildToolsRouteState } from '../routes/tools.js';
import { createSettingsStore } from '../settings/settingsStore.js';
import { type AppEvent, type AppEventTopic, invalidateAppTopics, publishAppEvent, subscribeAppEvents } from '../shared/appEvents.js';
import {
  getLocalhostWebappProxyStatus,
  startLocalhostWebappProxy,
  trustLocalhostWebappProxyCertificate,
} from '../shared/localhostWebappProxy.js';
import { logError, logWarn } from '../shared/logging.js';
import { isSameOriginUnsafeRequestInput } from '../shared/webSecurity.js';
import { readConversationPlansWorkspace } from '../ui/conversationPlanPreferences.js';
import { readSavedDefaultCwdPreferences, writeSavedDefaultCwdPreference } from '../ui/defaultCwdPreferences.js';
import { getRuntimeSettingsFilePath, persistSettingsWrite } from '../ui/settingsPersistence.js';
import { readSavedUiPreferences, writeSavedUiPreferences } from '../ui/uiPreferences.js';
import { readGitStatusSummaryWithTelemetry } from '../workspace/gitStatus.js';
import { pickFolderCapability } from '../workspace/workspaceDesktopCapability.js';
import { buildDesktopConversationGoalState, validateDesktopConversationGoalInput } from './localApiConversationGoal.js';
import {
  applyDesktopConversationWorkspaceOperation,
  desktopConversationWorkspaceInvalidationTopics,
  filterDesktopConversationWorkspaceLayoutBySessionIds,
  validateDesktopConversationWorkspaceOperation,
  validateDesktopConversationWorkspaceUpdate,
} from './localApiConversationWorkspace.js';
import { buildDesktopConversationWorkspaceResponse } from './localApiConversationWorkspacePresentation.js';
import { acknowledgeDesktopControlCommand } from './localApiDesktopControl.js';
import { publishDesktopUserActionEvent } from './localApiDesktopEvents.js';
import { acknowledgeDesktopScreenshotRequest } from './localApiDesktopScreenshot.js';
import { readDesktopStateSnapshot, storeDesktopStateSnapshot } from './localApiDesktopState.js';
import { buildCriticalExtensionRegistryResponse } from './localApiExtensionRegistryPresentation.js';
import { validateDesktopModelPreferenceUpdate } from './localApiModelPreferences.js';
import { buildRelatedConversationResults } from './localApiRelatedConversations.js';
import { decodeLocalApiBody, readLocalApiError } from './localApiResponseParsing.js';
import { resolveRollbackLeafId, rewriteConversationSessionToLeaf, validateDesktopRollbackTurns } from './localApiRollback.js';
import { buildLocalApiQueryObject, buildLocalApiRoutePattern } from './localApiRouting.js';
import { normalizeDesktopScheduledTaskCreateInput, withDesktopScheduledTaskMutationInvalidation } from './localApiScheduledTasks.js';
import { normalizeFastConversationSearchLimit, normalizeFastConversationSearchTerms } from './localApiSearch.js';
import { buildDesktopSidebarConversationSnapshot } from './localApiSidebarConversations.js';
import { type DesktopLocalApiStreamEvent, subscribeDesktopLocalApiStreamByUrl } from './localApiStreams.js';
import { setLocalBackendBaseUrl } from './localBackendBaseUrl.js';
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
import { buildCreateLiveSessionPerf } from './localApiCreateLiveSessionResponse.js';
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
import { createDesktopRealtimeUpgradeHandler, type DesktopRealtimeUpgradeHandlerOptions } from './realtime.js';
import { createServerRouteContext } from './routeContext.js';
import { createRuntimeState } from './runtimeState.js';

function prewarmDesktopModelDefinitions(): void {
  const modelDefinitionsPrewarmTimer = setTimeout(() => {
    void modelState()
      .then((m) => m.prewarmModelDefinitions?.())
      .catch(() => {});
  }, 0);
  modelDefinitionsPrewarmTimer.unref?.();
}

type RouteNext = (error?: unknown) => void;
type RouteHandler = (req: LocalApiRequest, res: LocalApiResponse, next?: RouteNext) => unknown;

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

function isAppEventTopic(value: unknown): value is AppEventTopic {
  return (
    value === 'sessions' ||
    value === 'sessionFiles' ||
    value === 'artifacts' ||
    value === 'checkpoints' ||
    value === 'attachments' ||
    value === 'documents' ||
    value === 'activity' ||
    value === 'extensions' ||
    value === 'tasks' ||
    value === 'models' ||
    value === 'runs' ||
    value === 'executions' ||
    value === 'automation' ||
    value === 'daemon' ||
    value === 'workspace' ||
    value === 'knowledgeBase' ||
    value === 'notifications' ||
    value === 'inbox' ||
    value === 'readiness'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

async function syncSystemConversationToolMutation(input: {
  extensionId: string;
  actionId: string;
  body: unknown;
  result: unknown;
}): Promise<unknown | undefined> {
  if (input.extensionId !== 'system-conversation-tools') return undefined;
  if (!isRecord(input.body)) return undefined;
  const body = input.body;
  const action = typeof body.action === 'string' ? body.action : '';
  const actionResult = isRecord(input.result) ? input.result : {};
  if (actionResult.ok !== true) return undefined;

  const conversations = createExtensionConversationsCapability(await getLocalServerRouteContext(), input.extensionId);
  if (input.actionId === 'conversationTool' && action === 'delete') {
    await conversations.delete({ conversationIds: optionalStringArray(body.conversationIds) ?? [] });
    return undefined;
  }
  if (input.actionId === 'conversationTool' && action === 'retention_prune' && body.dryRun !== true) {
    await conversations.prune({
      olderThanMs: Number(body.olderThanMs),
      archivedOnly: body.archivedOnly === true,
      dryRun: false,
    });
  }
  return syncSystemConversationCwdAction({ actionId: input.actionId, body, result: input.result });
}

function readActionResultDetails(result: unknown): Record<string, unknown> | null {
  if (!isRecord(result) || result.ok !== true || !isRecord(result.result)) return null;
  return isRecord(result.result.details) ? result.result.details : null;
}

function readActionString(primary: unknown, fallback: unknown): string | undefined {
  const value = typeof primary === 'string' && primary.trim().length > 0 ? primary : fallback;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function syncSystemConversationCwdAction(input: {
  actionId: string;
  body: Record<string, unknown>;
  result: unknown;
}): Promise<unknown | undefined> {
  if (
    input.actionId !== 'conversationCwd' &&
    !(input.actionId === 'conversationTool' && input.body.action === 'change_working_directory')
  ) {
    return undefined;
  }

  const details = readActionResultDetails(input.result);
  if (details?.reason !== 'session_not_live') {
    return undefined;
  }

  const conversationId = readActionString(details.conversationId, input.body.conversationId);
  const cwd = readActionString(details.cwd, input.body.cwd);
  if (!conversationId || !cwd) {
    return undefined;
  }

  const continuePrompt = readActionString(input.body.continuePrompt, undefined);
  try {
    const [liveContext, routeContext] = await Promise.all([getLocalLiveSessionCapabilityContext(), getLocalServerRouteContext()]);
    const queued = await requestConversationWorkingDirectoryChange(
      {
        conversationId,
        cwd,
        ...(continuePrompt ? { continuePrompt } : {}),
      },
      {
        ...liveContext.buildLiveSessionResourceOptions(routeContext.getRuntimeScope()),
        extensionFactories: liveContext.buildLiveSessionExtensionFactories(),
      },
    );

    const text = queued.unchanged
      ? `Already using working directory ${queued.cwd}.`
      : continuePrompt
        ? `Queued working directory change to ${queued.cwd}. This conversation will move there after this turn and continue automatically.`
        : `Queued working directory change to ${queued.cwd}. This conversation will move there after this turn.`;
    return {
      ok: true,
      result: {
        content: [{ type: 'text', text }],
        details: {
          action: queued.unchanged ? 'noop' : 'queue',
          conversationId: queued.conversationId,
          cwd: queued.cwd,
          queued: queued.queued,
          ...(queued.unchanged ? { unchanged: true } : {}),
          ...(continuePrompt ? { continuePrompt: true } : {}),
        },
      },
    };
  } catch {
    return undefined;
  }
}

async function handleSystemConversationCwdAction(input: { actionId: string; body: unknown }): Promise<unknown | undefined> {
  if (!isRecord(input.body)) return undefined;
  if (
    input.actionId !== 'conversationCwd' &&
    !(input.actionId === 'conversationTool' && input.body.action === 'change_working_directory')
  ) {
    return undefined;
  }

  const conversationId = readActionString(input.body.conversationId, undefined);
  const cwd = readActionString(input.body.cwd, undefined);
  if (!conversationId || !cwd) return undefined;

  const continuePrompt = readActionString(input.body.continuePrompt, undefined);
  try {
    const [liveContext, routeContext] = await Promise.all([getLocalLiveSessionCapabilityContext(), getLocalServerRouteContext()]);
    const queued = await requestConversationWorkingDirectoryChange(
      {
        conversationId,
        cwd,
        ...(continuePrompt ? { continuePrompt } : {}),
      },
      {
        ...liveContext.buildLiveSessionResourceOptions(routeContext.getRuntimeScope()),
        extensionFactories: liveContext.buildLiveSessionExtensionFactories(),
      },
    );

    const text = queued.unchanged
      ? `Already using working directory ${queued.cwd}.`
      : continuePrompt
        ? `Queued working directory change to ${queued.cwd}. This conversation will move there after this turn and continue automatically.`
        : `Queued working directory change to ${queued.cwd}. This conversation will move there after this turn.`;
    return {
      ok: true,
      result: {
        content: [{ type: 'text', text }],
        details: {
          action: queued.unchanged ? 'noop' : 'queue',
          conversationId: queued.conversationId,
          cwd: queued.cwd,
          queued: queued.queued,
          ...(queued.unchanged ? { unchanged: true } : {}),
          ...(continuePrompt ? { continuePrompt: true } : {}),
        },
      },
    };
  } catch {
    return undefined;
  }
}

export function setDesktopWorkbenchBrowserToolHost(host: WorkbenchBrowserToolHost | null): void {
  setWorkbenchBrowserToolHost(host);
}

export function setDesktopLocalBackendBaseUrl(baseUrl: string | undefined): { ok: true } {
  setLocalBackendBaseUrl(baseUrl);
  return { ok: true };
}

export function configureDesktopExtensionHostClient(input: { baseUrl?: string | null; token?: string | null }): { ok: true } {
  const baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : '';
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  if (baseUrl && token) {
    setExtensionHostClient(createExtensionHostRpcClient({ baseUrl, token }));
  } else {
    setExtensionHostClient(undefined);
  }
  return { ok: true };
}

export async function warmDesktopLocalApiRuntime(): Promise<{ ok: true }> {
  await getLocalContexts();
  return { ok: true };
}

export function createDesktopLocalRealtimeUpgradeHandler(
  options: Pick<DesktopRealtimeUpgradeHandlerOptions, 'getRuntimeScope' | 'subscribeLocalApiStreamByUrl'> = {},
): ReturnType<typeof createDesktopRealtimeUpgradeHandler> {
  return createDesktopRealtimeUpgradeHandler(options);
}

export async function startDesktopLocalhostWebappProxy(options: Omit<Parameters<typeof startLocalhostWebappProxy>[0], 'dispatch'>) {
  let certificateHostnames: string[] = [];
  try {
    const { snapshot } = await getExtensionHostClient().readRegistryPresentation();
    certificateHostnames = ((snapshot as { webapps?: unknown[] }).webapps ?? []).flatMap((webapp) =>
      webapp && typeof webapp === 'object' && typeof (webapp as { localhostName?: unknown }).localhostName === 'string'
        ? [`${(webapp as { localhostName: string }).localhostName}.localhost`]
        : [],
    );
  } catch (error) {
    options.logger?.warn?.('localhost webapp certificate host discovery failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return startLocalhostWebappProxy({
    ...options,
    certificateHostnames,
    dispatch: (input) => dispatchDesktopLocalApiRequest({ ...input, trustMode: 'browser' }),
  });
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
const WEBAPP_LOCALHOST_SUFFIX = '.localhost';
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

function shouldPrioritizeWebappHostRoute(headers?: Record<string, string>): boolean {
  const host = readLocalApiRequestHeader(normalizeLocalApiRequestHeaders(headers), 'host')?.split(':')[0]?.trim().toLowerCase() ?? '';
  return host.endsWith(WEBAPP_LOCALHOST_SUFFIX) && host.length > WEBAPP_LOCALHOST_SUFFIX.length;
}

function isTrustedDesktopLocalApiDispatch(input: {
  method: string;
  url: URL;
  headers?: Record<string, string>;
  allowMissingOrigin: boolean;
}): boolean {
  const headers = normalizeLocalApiRequestHeaders(input.headers);
  return isSameOriginUnsafeRequestInput(
    {
      method: input.method,
      originHeader: readLocalApiRequestHeader(headers, 'origin'),
      host: readLocalApiRequestHeader(headers, 'host') ?? input.url.host,
      forwardedHost: readLocalApiRequestHeader(headers, 'x-forwarded-host'),
      protocol: input.url.protocol.replace(/:$/, ''),
      forwardedProto: readLocalApiRequestHeader(headers, 'x-forwarded-proto'),
    },
    { allowMissingOrigin: input.allowMissingOrigin },
  );
}

function findLocalApiRoutesForRequest(routes: RegisteredRoute[], method: string, pathname: string, headers?: Record<string, string>) {
  const matchingRoutes = routes.filter((candidate) => candidate.method === method && candidate.pattern.test(pathname));
  if (!shouldPrioritizeWebappHostRoute(headers)) {
    return matchingRoutes;
  }

  const hostRoutes = matchingRoutes.filter((candidate) => candidate.path === '*');
  const remainingRoutes = matchingRoutes.filter((candidate) => candidate.path !== '*');
  return [...hostRoutes, ...remainingRoutes];
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
  const stateRoot = getStateRoot();
  const agentDir = getPiAgentRuntimeDir(stateRoot);
  const authFile = join(agentDir, 'auth.json');
  const settingsFile = getRuntimeSettingsFilePath(stateRoot);
  const pathsAtMs = performance.now();
  process.stderr.write(`[perf] buildLocalContexts: paths ${Math.round(pathsAtMs - startedAtMs)}ms\n`);

  // Ensure the desktop root directory exists before any consumer
  // (e.g. getDefaultWebCwd) can reference it.
  ensureDesktopRootDir();
  const desktopRootLayout = resolveDesktopRootLayout();

  const runtimeState = createRuntimeState({
    repoRoot,
    agentDir,
    settingsFile,
    stateRoot,
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
    getStateRoot: () => stateRoot,
    resolveDaemonRoot,
    getOpenConversationSessions: () =>
      readSavedUiPreferences(settingsFile).openConversationIds.flatMap((conversationId) => {
        const sessionFile = resolveConversationSessionFile(conversationId);
        return sessionFile ? [{ conversationId, sessionFile }] : [];
      }),
    ensureLiveSessionForDeferredResume: async (sessionFile) => {
      const resourceOptions = runtimeState.buildLiveSessionResourceOptionsAsync
        ? await runtimeState.buildLiveSessionResourceOptionsAsync()
        : runtimeState.buildLiveSessionResourceOptions();
      await resumeSession(sessionFile, {
        ...resourceOptions,
        extensionFactories: runtimeState.buildLiveSessionExtensionFactories(),
      });
    },
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
    getStateRoot: () => stateRoot,
    serverPort: 0,
    getDefaultWebCwd: () => desktopRootLayout.root,
    getDesktopRootLayout: () => desktopRootLayout,
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
        const threadDetail = buildScheduledTaskThreadDetail(taskWithThread, { profile: runtimeState.getRuntimeScope() });
        return {
          id: taskWithThread.id,
          title: taskWithThread.title,
          filePath: taskWithThread.filePath,
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
    getStateRoot: context.getStateRoot,
    getDefaultWebCwd: context.getDefaultWebCwd,
    getDesktopRootLayout: context.getDesktopRootLayout,
    buildLiveSessionResourceOptions: context.buildLiveSessionResourceOptions,
    buildLiveSessionResourceOptionsAsync: context.buildLiveSessionResourceOptionsAsync,
    buildLiveSessionExtensionFactories: context.buildLiveSessionExtensionFactories,
    flushLiveDeferredResumes: context.flushLiveDeferredResumes,
    listTasksForRuntimeScope: context.listTasksForRuntimeScope,
    listMemoryDocs: context.listMemoryDocs,
  };
  localLiveSessionCapabilityContext = liveSessionCapabilityContext;

  // Warm the local resource cache synchronously so first chat creation can
  // reuse materialized runtime resources without queuing a renderer prewarm.
  try {
    context.buildLiveSessionResourceOptions();
  } catch (error) {
    logWarn('live session resource options prewarm failed', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
  prewarmDesktopModelDefinitions();

  // Extension factory and loader prewarm can do substantial synchronous work
  // before their first await. Queue it so context construction stays on the
  // fast path and the work runs before normal user interaction.
  const liveSessionPrewarmTimer = setTimeout(() => {
    void prewarmLiveSessionCapability({}, liveSessionCapabilityContext).catch((error) => {
      logWarn('default live session prewarm failed', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
  }, 0);
  liveSessionPrewarmTimer.unref?.();

  localProviderDesktopCapabilityContext = {
    getRuntimeScope: context.getRuntimeScope,
    materializeWebRuntimeConfig: context.materializeWebRuntimeConfig,
    getAuthFile: context.getAuthFile,
    getStateRoot: context.getStateRoot,
  };
  setConversationServiceContext({
    getRuntimeScope: context.getRuntimeScope,
    getRepoRoot: context.getRepoRoot,
    getSettingsFile: context.getSettingsFile,
    getSavedUiPreferences: context.getSavedUiPreferences,
  });
  const capabilityContextAtMs = performance.now();

  if (isMainThread) {
    let extensionHostClient: ReturnType<typeof getExtensionHostClient> | null = null;
    try {
      extensionHostClient = getExtensionHostClient();
    } catch (error) {
      logError('extension startup guard unavailable', { message: error instanceof Error ? error.message : String(error) });
    }
    // Runtime extension services are useful, but they are not chat-critical.
    // Keep their cold imports and service startup out of the initial conversation
    // creation and transcript navigation window.
    const startupActionsTimer = setTimeout(() => {
      if (!extensionHostClient) return;
      void extensionHostClient
        .beginStartupGuard()
        .then((startupGuard) => {
          if (startupGuard?.safeMode) {
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
        })
        .then(() => extensionHostClient.startStartupActions({ serverContextSnapshot: createExtensionHostServerContextSnapshot(context) }))
        .then(async () => {
          await extensionHostClient?.checkBackendHealth();
        })
        .then(() => {
          notifyExtensionStartupStatus();
        })
        .catch((error) => {
          logError('extension startup dispatch failed', { message: (error as Error).message });
          publishAppEvent({
            type: 'notification',
            extensionId: 'core',
            message: `Extension startup failed: ${(error as Error).message}`,
            severity: 'error',
          });
        })
        .finally(() => {
          void extensionHostClient?.completeStartupGuard().catch((error) => {
            logError('extension startup guard completion failed', { message: (error as Error).message });
          });
        });
    }, EXTENSION_STARTUP_ACTIONS_DELAY_MS);
    startupActionsTimer.unref?.();

    const backendHealthTimer = setTimeout(() => {
      if (!extensionHostClient) return;
      void extensionHostClient.checkBackendHealth().catch((error) => {
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

export async function publishDesktopAppEventFromExtensionHost(event: unknown): Promise<{ ok: true }> {
  await getLocalRoutes();
  if (!isRecord(event) || typeof event.type !== 'string') {
    throw new Error('Invalid desktop app event from extension host.');
  }

  if (event.type === 'invalidate') {
    const topics = Array.isArray(event.topics) ? event.topics.filter(isAppEventTopic) : [];
    if (topics.length > 0) {
      invalidateAppTopics(...topics);
    }
    return { ok: true };
  }

  publishAppEvent(event as AppEvent);
  return { ok: true };
}

export async function requestExtensionUiConfirmFromExtensionHost(request: unknown): Promise<unknown> {
  await getLocalRoutes();
  if (!isRecord(request) || typeof request.extensionId !== 'string' || !isRecord(request.input)) {
    throw new Error('Invalid extension UI confirmation request.');
  }

  const input = request.input;
  if (typeof input.message !== 'string') {
    throw new Error('Extension UI confirmation message is required.');
  }

  const details = input.details;
  if (details !== undefined) {
    if (!Array.isArray(details)) throw new Error('Extension UI confirmation details must be an array.');
    for (const detail of details) {
      if (!isRecord(detail) || typeof detail.label !== 'string' || typeof detail.value !== 'string') {
        throw new Error('Extension UI confirmation details must include string labels and values.');
      }
    }
  }

  return requestExtensionUiConfirm({
    extensionId: request.extensionId,
    message: input.message,
    ...(typeof input.title === 'string' ? { title: input.title } : {}),
    ...(typeof input.confirmLabel === 'string' ? { confirmLabel: input.confirmLabel } : {}),
    ...(typeof input.cancelLabel === 'string' ? { cancelLabel: input.cancelLabel } : {}),
    ...(typeof input.timeoutMs === 'number' ? { timeoutMs: input.timeoutMs } : {}),
    ...(Array.isArray(details) ? { details: details as Array<{ label: string; value: string }> } : {}),
  });
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

function createDesktopLocalApiJsonResponse(value: unknown, statusCode = 200): DesktopLocalApiDispatchResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: new TextEncoder().encode(JSON.stringify(value)),
  };
}

function createDesktopLocalApiErrorResponse(statusCode: number, message: string): DesktopLocalApiDispatchResult {
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

  if (error.name === 'AbortError') {
    return 499;
  }

  if (error.name === 'ConversationAssetCapabilityNotFoundError' || error.name === 'ConversationDeferredResumeCapabilityNotFoundError') {
    return 404;
  }

  if (error.name === 'DesktopConversationCwdValidationError') {
    return 400;
  }

  if (error.name === 'DesktopConversationTitleValidationError') {
    return 400;
  }

  if (
    error.name === 'DesktopControlValidationError' ||
    error.name === 'DesktopUserActionEventValidationError' ||
    error.name === 'DesktopScreenshotValidationError' ||
    error.name === 'DesktopStateValidationError'
  ) {
    return 400;
  }

  return /\bnot found\b/i.test(error.message) || error.message === '404 Not Found' ? 404 : 500;
}

function parseDesktopLocalApiBooleanQuery(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function parseDesktopLocalApiExecutionVisibilityQuery(
  value: string | null,
): 'primary' | 'system' | 'hidden' | 'visible' | 'all' | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();
  return normalized === 'primary' || normalized === 'system' || normalized === 'hidden' || normalized === 'visible' || normalized === 'all'
    ? normalized
    : undefined;
}

function parseDesktopLocalApiLogTail(value: string | null): number | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(1000, parsed) : undefined;
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

  if (method === 'GET' && path === '/api/health') return createDesktopLocalApiJsonResponse(await readDesktopLocalApiHealth());
  if (method === 'GET' && path === '/api/session-state') return createDesktopLocalApiJsonResponse(await readDesktopSessionState());
  if (method === 'GET' && path === '/api/executions') return createDesktopLocalApiJsonResponse(await listExecutions());
  if (method === 'POST' && path === '/api/conversation-summaries') {
    return createDesktopLocalApiJsonResponse(
      readConversationSummaryIndexCapability((input.body && typeof input.body === 'object' ? input.body : {}) as { sessionIds?: unknown }),
    );
  }
  if (method === 'GET' && path === '/api/status') return createDesktopLocalApiJsonResponse(await readDesktopAppStatus());
  if (method === 'GET' && path === '/api/daemon') return createDesktopLocalApiJsonResponse(await readDesktopDaemonState());
  if (method === 'GET' && path === '/api/tools') {
    const { context } = await getLocalContexts();
    return createDesktopLocalApiJsonResponse(await buildToolsRouteState(context));
  }
  if (method === 'POST' && path === '/api/tools/invoke') {
    return createDesktopLocalApiJsonResponse(await invokeDesktopTool((input.body ?? {}) as Parameters<typeof invokeDesktopTool>[0]));
  }
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
        signal: input.signal,
      }),
    );
  }

  const conversationExecutionsMatch = /^\/api\/conversations\/([^/]+)\/executions$/.exec(path);
  if (method === 'GET' && conversationExecutionsMatch) {
    return createDesktopLocalApiJsonResponse(
      await listConversationExecutions(decodeURIComponent(conversationExecutionsMatch[1] ?? ''), {
        active: parseDesktopLocalApiBooleanQuery(input.url.searchParams.get('active')),
        visibility: parseDesktopLocalApiExecutionVisibilityQuery(input.url.searchParams.get('visibility')),
      }),
    );
  }
  const executionLogMatch = /^\/api\/executions\/([^/]+)\/log$/.exec(path);
  if (method === 'GET' && executionLogMatch) {
    const result = await getExecutionLog(
      decodeURIComponent(executionLogMatch[1] ?? ''),
      parseDesktopLocalApiLogTail(input.url.searchParams.get('tail')),
    );
    return result ? createDesktopLocalApiJsonResponse(result) : createDesktopLocalApiJsonResponse({ error: 'Execution not found' }, 404);
  }
  const executionDetailMatch = /^\/api\/executions\/([^/]+)$/.exec(path);
  if (method === 'GET' && executionDetailMatch) {
    const result = await getExecution(decodeURIComponent(executionDetailMatch[1] ?? ''));
    return result ? createDesktopLocalApiJsonResponse(result) : createDesktopLocalApiJsonResponse({ error: 'Execution not found' }, 404);
  }

  if (method === 'GET' && path === '/api/models') return createDesktopLocalApiJsonResponse(await readDesktopModels());
  if (method === 'POST' && path === '/api/models/refresh') return createDesktopLocalApiJsonResponse(await refreshDesktopModels());
  if (method === 'GET' && path === '/api/model-preferences') return createDesktopLocalApiJsonResponse(await readDesktopModelPreferences());
  if (method === 'GET' && path === '/api/extensions/slash-commands') {
    return createDesktopLocalApiJsonResponse((await getExtensionHostClient().readRegistryPresentation()).slashCommandRegistrations);
  }
  if (method === 'GET' && path === '/api/extensions/mentions') {
    return createDesktopLocalApiJsonResponse((await getExtensionHostClient().readRegistryPresentation()).mentionRegistrations);
  }
  if (method === 'GET' && path === '/api/extensions/webapps/localhost-proxy') {
    return createDesktopLocalApiJsonResponse(getLocalhostWebappProxyStatus() ?? { running: false });
  }
  if (method === 'POST' && path === '/api/extensions/webapps/localhost-proxy/trust') {
    const result = trustLocalhostWebappProxyCertificate();
    return result
      ? createDesktopLocalApiJsonResponse(result, result.ok ? 200 : 503)
      : createDesktopLocalApiJsonResponse({ ok: false, error: 'Neon Pilot localhost webapp proxy is not running.' }, 503);
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
    const context = await getLocalServerRouteContext();
    const [extensions, registryPresentation, settings] = await Promise.all([
      readExtensionInstallSummariesWithRuntimeStateForLocalApi(),
      getExtensionHostClient().readRegistryPresentation(),
      Promise.resolve(createSettingsStore(context.getStateRoot()).read()),
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
    const extensionId = decodeURIComponent(extensionActionMatch[1] ?? '');
    const actionId = decodeURIComponent(extensionActionMatch[2] ?? '');
    if (extensionId === 'system-conversation-tools') {
      const hostResult = await handleSystemConversationCwdAction({ actionId, body: input.body });
      if (hostResult) {
        return createDesktopLocalApiJsonResponse(hostResult);
      }
    }
    const result = await getExtensionHostClient().invokeAction({
      extensionId,
      actionId,
      input: input.body,
      serverContextSnapshot: createExtensionHostServerContextSnapshot(await getLocalServerRouteContext()),
      signal: input.signal,
    });
    const syncedResult = await syncSystemConversationToolMutation({ extensionId, actionId, body: input.body, result });
    return createDesktopLocalApiJsonResponse(syncedResult ?? result);
  }
  if (method === 'PATCH' && path === '/api/model-preferences')
    return createDesktopLocalApiJsonResponse(
      await updateDesktopModelPreferences(input.body as Parameters<typeof updateDesktopModelPreferences>[0]),
    );
  if (method === 'GET' && path === '/api/model-providers') return createDesktopLocalApiJsonResponse(await readDesktopModelProviders());
  const modelProviderTestMatch = /^\/api\/model-providers\/([^/]+)\/test$/.exec(path);
  if (method === 'POST' && modelProviderTestMatch) {
    return createDesktopLocalApiJsonResponse(await testDesktopModelProvider(decodeURIComponent(modelProviderTestMatch[1] ?? '')));
  }
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
  if (method === 'GET' && path === '/api/desktop/state') {
    return createDesktopLocalApiJsonResponse(readDesktopStateSnapshot());
  }
  if (method === 'POST' && path === '/api/desktop/state') {
    return createDesktopLocalApiJsonResponse(storeDesktopStateSnapshot(input.body as Parameters<typeof storeDesktopStateSnapshot>[0]));
  }
  if (method === 'POST' && path === '/api/desktop/control/ack') {
    return createDesktopLocalApiJsonResponse(
      acknowledgeDesktopControlCommand(input.body as Parameters<typeof acknowledgeDesktopControlCommand>[0]),
    );
  }
  if (method === 'POST' && path === '/api/desktop/events') {
    return createDesktopLocalApiJsonResponse(
      publishDesktopUserActionEvent(input.body as Parameters<typeof publishDesktopUserActionEvent>[0]),
    );
  }
  if (method === 'POST' && path === '/api/desktop/screenshot/ack') {
    return createDesktopLocalApiJsonResponse(
      acknowledgeDesktopScreenshotRequest(input.body as Parameters<typeof acknowledgeDesktopScreenshotRequest>[0]),
    );
  }
  if (method === 'GET' && path === '/api/conversation-workspace') {
    return createDesktopLocalApiJsonResponse(await readDesktopConversationWorkspace());
  }
  if (method === 'GET' && path === '/api/sidebar/conversations') {
    return createDesktopLocalApiJsonResponse(await readDesktopSidebarConversations());
  }
  if (method === 'PATCH' && path === '/api/conversation-workspace') {
    return createDesktopLocalApiJsonResponse(
      await saveDesktopConversationWorkspace(input.body as Parameters<typeof saveDesktopConversationWorkspace>[0]),
    );
  }
  if (method === 'POST' && path === '/api/conversation-workspace/operation') {
    return createDesktopLocalApiJsonResponse(
      await updateDesktopConversationWorkspaceByOperation(
        input.body as Parameters<typeof updateDesktopConversationWorkspaceByOperation>[0],
      ),
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
  if (method === 'GET' && path === '/api/executions') return createDesktopLocalApiJsonResponse(await listExecutions());
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

  if (method === 'POST' && path === '/api/conversations/reserve') {
    const body = input.body && typeof input.body === 'object' ? (input.body as { cwd?: unknown }) : {};
    return createDesktopLocalApiJsonResponse(
      reserveConversationSession({
        cwd: typeof body.cwd === 'string' ? body.cwd : undefined,
        profile: 'shared',
      }),
    );
  }
  const conversationMessageMatch = /^\/api\/conversations\/([^/]+)\/messages$/.exec(path);
  if (method === 'POST' && conversationMessageMatch) {
    return createDesktopLocalApiJsonResponse(
      await submitDesktopConversationMessage({
        conversationId: decodeURIComponent(conversationMessageMatch[1] ?? ''),
        ...((input.body && typeof input.body === 'object' ? input.body : {}) as object),
      } as Parameters<typeof submitDesktopConversationMessage>[0]),
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
      }),
    );
  }
  const conversationAggregateMatch = /^\/api\/conversations\/([^/]+)\/aggregate$/.exec(path);
  if (method === 'GET' && conversationAggregateMatch) {
    const capabilityContext = await getLocalLiveSessionCapabilityContext();
    return createDesktopLocalApiJsonResponse(
      await readConversationAggregateState({
        conversationId: decodeURIComponent(conversationAggregateMatch[1] ?? ''),
        profile: capabilityContext.getRuntimeScope(),
        tailBlocks: input.url.searchParams.has('tailBlocks') ? Number(input.url.searchParams.get('tailBlocks')) : undefined,
        tasks: capabilityContext.listTasksForRuntimeScope?.().map((task) => ({ ...task, title: task.title ?? task.id })),
        signal: input.signal,
      }),
    );
  }
  const conversationAggregateDeltasMatch = /^\/api\/conversations\/([^/]+)\/aggregate\/deltas$/.exec(path);
  if (method === 'GET' && conversationAggregateDeltasMatch) {
    return createDesktopLocalApiJsonResponse(
      readConversationAggregateDeltas({
        conversationId: decodeURIComponent(conversationAggregateDeltasMatch[1] ?? ''),
        afterRevision: input.url.searchParams.has('after') ? Number(input.url.searchParams.get('after')) : 0,
        limit: input.url.searchParams.has('limit') ? Number(input.url.searchParams.get('limit')) : undefined,
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
  const conversationResumeMatch = /^\/api\/conversations\/([^/]+)\/resume$/.exec(path);
  if (method === 'POST' && conversationResumeMatch) {
    return createDesktopLocalApiJsonResponse(await resumeDesktopConversation(decodeURIComponent(conversationResumeMatch[1] ?? '')));
  }
  const conversationRecoverMatch = /^\/api\/conversations\/([^/]+)\/recover$/.exec(path);
  if (method === 'POST' && conversationRecoverMatch) {
    return createDesktopLocalApiJsonResponse(await resumeDesktopConversation(decodeURIComponent(conversationRecoverMatch[1] ?? '')));
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
  if (method === 'DELETE' && conversationArtifactMatch) {
    return createDesktopLocalApiJsonResponse(
      await deleteDesktopConversationArtifact({
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
  trustMode?: 'in-process' | 'browser';
}): Promise<DesktopLocalApiDispatchResult> {
  const startedAtMs = performance.now();
  process.stderr.write(`[perf] dispatch ${input.method} ${input.path}\n`);
  const url = new URL(input.path, 'http://desktop.local');
  if (
    !isTrustedDesktopLocalApiDispatch({
      method: input.method,
      url,
      headers: input.headers,
      allowMissingOrigin: input.trustMode !== 'browser',
    })
  ) {
    return createDesktopLocalApiErrorResponse(403, 'Cross-origin request rejected.');
  }

  const isWebappHostRequest = shouldPrioritizeWebappHostRoute(input.headers);
  let productResponse: DesktopLocalApiDispatchResult | null;
  try {
    productResponse = isWebappHostRequest
      ? null
      : await dispatchDesktopLocalProductApiRequest({ method: input.method, url, body: input.body, signal: input.signal });
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

  if (input.method === 'POST' && url.pathname === '/api/conversation-summaries') {
    const response = createDesktopLocalApiJsonResponse(readConversationSummaryIndexCapability(input.body as { sessionIds?: unknown }));
    return {
      ...response,
      headers: {
        ...response.headers,
        'X-PA-Perf': JSON.stringify({
          localApi: {
            totalBeforeReturnMs: Math.round(performance.now() - startedAtMs),
            responseBytes: response.body.byteLength,
            fastPath: 'product',
          },
        }),
      },
    };
  }

  const routes = await getLocalRoutes();
  const routesReadyAtMs = performance.now();
  const matchingRoutes = findLocalApiRoutesForRequest(routes, input.method, url.pathname, input.headers);

  if (matchingRoutes.length === 0) {
    return createDesktopLocalApiErrorResponse(404, `No local API route for ${input.method} ${url.pathname}`);
  }

  const handlerStartedAtMs = performance.now();
  let res: LocalApiResponse | null = null;
  let handlerFinishedAtMs = handlerStartedAtMs;
  let routeCompleted = false;

  for (const route of matchingRoutes) {
    const match = route.pattern.exec(url.pathname);
    const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match?.[index + 1] ?? '')]));
    const req = createLocalApiRequest({
      method: input.method,
      url,
      params,
      body: input.body,
      headers: input.headers,
    });
    res = new LocalApiResponse();
    let nextCalled = false;
    let nextError: unknown;
    const next: RouteNext = (error?: unknown) => {
      nextCalled = true;
      nextError = error;
    };

    try {
      await route.handler(req, res, next);
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
    handlerFinishedAtMs = performance.now();

    if (nextError) {
      const statusCode = getDesktopLocalApiErrorStatus(nextError);
      const message = nextError instanceof Error ? nextError.message : String(nextError);
      const errorResponse = createDesktopLocalApiErrorResponse(statusCode, message);
      return {
        ...errorResponse,
        headers: {
          ...errorResponse.headers,
          'X-PA-Perf': JSON.stringify({
            localApi: {
              routeLookupMs: Math.round(routesReadyAtMs - startedAtMs),
              handlerMs: Math.round(handlerFinishedAtMs - handlerStartedAtMs),
              totalBeforeReturnMs: Math.round(performance.now() - startedAtMs),
              responseBytes: errorResponse.body.byteLength,
            },
          }),
        },
      };
    }

    if (res.ended) {
      routeCompleted = true;
      break;
    }

    if (nextCalled) {
      continue;
    }

    break;
  }

  if (!res) {
    return createDesktopLocalApiErrorResponse(404, `No local API route for ${input.method} ${url.pathname}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!routeCompleted) {
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

export async function readDesktopLocalApiHealth() {
  const status = await readDesktopAppStatus();
  return {
    ok: true,
    status: 'ready',
    profile: status.profile,
    repoRoot: status.repoRoot,
    appRevision: status.appRevision,
  };
}

export async function readDesktopSessionState() {
  const sessions = await readDesktopSessions();
  const liveSessions = getLocalLiveSessions().map((session) => ({
    id: session.id,
    live: true,
    isStreaming: session.isStreaming,
    cwd: session.cwd,
    sessionFile: session.sessionFile,
  }));

  return {
    ok: true,
    sessions,
    liveSessions,
  };
}

export async function readDesktopDaemonState() {
  return readDaemonState();
}

export async function readDesktopSessions(input: { limit?: number } = {}) {
  await getLocalServerRouteContext();
  return readConversationSessionsCapability(input);
}

export async function syncDesktopDeletedConversations(input: { conversationIds?: unknown }): Promise<{
  ok: true;
  deleted: Array<{ id: string; file: string }>;
  missing: string[];
}> {
  const conversationIds = optionalStringArray(input.conversationIds) ?? [];
  if (conversationIds.length === 0) return { ok: true, deleted: [], missing: [] };
  for (const conversationId of conversationIds) {
    if (isLiveSession(conversationId)) {
      destroySession(conversationId);
    }
  }
  await cleanupDeletedConversationRuntime(
    conversationIds.map((id) => {
      const meta = readConversationSessionMeta(id);
      return {
        id,
        ...(meta?.file ? { sessionFile: meta.file } : {}),
      };
    }),
  );
  const result = deleteStoredConversations(conversationIds);

  const context = await getLocalServerRouteContext();
  const deletedIds = new Set(conversationIds);
  persistSettingsWrite(
    (settingsFile) => {
      const before = readSavedUiPreferences(settingsFile);
      return writeSavedUiPreferences(
        {
          openConversationIds: before.openConversationIds.filter((id) => !deletedIds.has(id)),
          pinnedConversationIds: before.pinnedConversationIds.filter((id) => !deletedIds.has(id)),
          archivedConversationIds: before.archivedConversationIds.filter((id) => !deletedIds.has(id)),
          lockedConversationIds: before.lockedConversationIds.filter((id) => !deletedIds.has(id)),
          activeConversationId:
            before.activeConversationId && deletedIds.has(before.activeConversationId) ? null : before.activeConversationId,
          remoteControlledConversationIds: before.remoteControlledConversationIds.filter((id) => !deletedIds.has(id)),
        },
        settingsFile,
      );
    },
    { runtimeSettingsFile: context.getSettingsFile() },
  );
  invalidateAppTopics('sessions');
  return { ok: true, ...result };
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
  const context = await getLocalServerRouteContext();
  const m = await modelState();
  return await m.readModelState(context.getSettingsFile());
}

export async function refreshDesktopModels() {
  const context = await getLocalServerRouteContext();
  const m = await modelState();
  await m.refreshModelDefinitions();
  return await m.readModelState(context.getSettingsFile());
}

export async function readDesktopModelPreferences() {
  const context = await getLocalServerRouteContext();
  const m = await modelState();
  return m.readSavedModelPreferences(context.getSettingsFile());
}

export async function updateDesktopModelPreferences(input: {
  model?: string | null;
  visionModel?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
}) {
  validateDesktopModelPreferenceUpdate(input);

  const context = await getLocalServerRouteContext();
  const m = await modelState();
  const modelData = (await m.readModelState(context.getSettingsFile())).models;
  persistSettingsWrite(
    (settingsFile) => {
      m.writeSavedModelPreferences(buildSavedModelPreferencePatch(input), settingsFile, modelData);
    },
    {
      runtimeSettingsFile: context.getSettingsFile(),
    },
  );
  return buildDesktopMutationOkResponse();
}

export async function readDesktopDefaultCwd() {
  const context = await getLocalServerRouteContext();
  return readSavedDefaultCwdPreferences(context.getSettingsFile(), context.getDesktopRootLayout().root);
}

export async function updateDesktopDefaultCwd(cwd: string | null) {
  const context = await getLocalServerRouteContext();
  const state = persistSettingsWrite(
    (settingsFile) =>
      writeSavedDefaultCwdPreference({ cwd }, settingsFile, { baseDir: context.getDesktopRootLayout().root, validate: true }),
    {
      runtimeSettingsFile: context.getSettingsFile(),
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
  const context = await getLocalServerRouteContext();
  return readConversationPlansWorkspace(context.getSettingsFile());
}

export async function readDesktopConversationWorkspace() {
  const context = await getLocalServerRouteContext();
  const saved = readSavedUiPreferences(context.getSettingsFile());
  return buildDesktopConversationWorkspaceResponse(saved);
}

export async function readDesktopSidebarConversations() {
  const context = await getLocalServerRouteContext();
  return buildDesktopSidebarConversationSnapshot({
    saved: readSavedUiPreferences(context.getSettingsFile()),
    sessions: readConversationSessionsCapability(),
  });
}

export async function saveDesktopConversationWorkspace(input: {
  sessionIds?: string[];
  pinnedSessionIds?: string[];
  archivedSessionIds?: string[];
  lockedConversationIds?: string[];
  activeConversationId?: string | null;
  workspacePaths?: string[];
  remoteControlledConversationIds?: string[];
  conversationWorkspaceMigrated?: boolean | null;
}) {
  const {
    sessionIds,
    pinnedSessionIds,
    archivedSessionIds,
    lockedConversationIds,
    activeConversationId,
    workspacePaths,
    remoteControlledConversationIds,
    conversationWorkspaceMigrated,
  } = input;
  validateDesktopConversationWorkspaceUpdate(input);

  const context = await getLocalServerRouteContext();
  const current = readSavedUiPreferences(context.getSettingsFile());
  const knownSessionIds = new Set(readConversationSessionsCapability().map((session) => session.id));
  const nextLayout = filterDesktopConversationWorkspaceLayoutBySessionIds(
    {
      sessionIds: sessionIds ?? current.openConversationIds,
      pinnedSessionIds: pinnedSessionIds ?? current.pinnedConversationIds,
      archivedSessionIds: archivedSessionIds ?? current.archivedConversationIds,
      lockedConversationIds: lockedConversationIds ?? current.lockedConversationIds,
      activeConversationId: activeConversationId === undefined ? current.activeConversationId : activeConversationId,
    },
    knownSessionIds,
  );
  const saved = persistSettingsWrite(
    (settingsFile) =>
      writeSavedUiPreferences(
        {
          openConversationIds: sessionIds === undefined ? undefined : nextLayout.sessionIds,
          pinnedConversationIds: pinnedSessionIds === undefined ? undefined : nextLayout.pinnedSessionIds,
          archivedConversationIds: archivedSessionIds === undefined ? undefined : nextLayout.archivedSessionIds,
          lockedConversationIds: lockedConversationIds === undefined ? undefined : nextLayout.lockedConversationIds,
          activeConversationId: activeConversationId === undefined ? undefined : nextLayout.activeConversationId,
          workspacePaths,
          remoteControlledConversationIds,
          conversationWorkspaceMigrated,
        },
        settingsFile,
      ),
    { runtimeSettingsFile: context.getSettingsFile() },
  );

  for (const topic of desktopConversationWorkspaceInvalidationTopics(input)) {
    invalidateAppTopics(topic);
  }
  const response = {
    ok: true as const,
    ...buildDesktopConversationWorkspaceResponse(saved),
  };
  publishConversationWorkspaceChanged(response);
  return response;
}

export async function updateDesktopConversationWorkspaceByOperation(
  input: Parameters<typeof applyDesktopConversationWorkspaceOperation>[1],
) {
  validateDesktopConversationWorkspaceOperation(input);

  const context = await getLocalServerRouteContext();
  const current = readSavedUiPreferences(context.getSettingsFile());
  const knownSessionIds = new Set(readConversationSessionsCapability().map((session) => session.id));
  if ('sessionId' in input && input.operation !== 'close') {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
    if (sessionId) {
      knownSessionIds.add(sessionId);
    }
  }
  const currentLayout = filterDesktopConversationWorkspaceLayoutBySessionIds(
    {
      sessionIds: current.openConversationIds,
      pinnedSessionIds: current.pinnedConversationIds,
      archivedSessionIds: current.archivedConversationIds,
      lockedConversationIds: current.lockedConversationIds,
      activeConversationId: current.activeConversationId,
    },
    knownSessionIds,
  );
  const next = filterDesktopConversationWorkspaceLayoutBySessionIds(
    applyDesktopConversationWorkspaceOperation(currentLayout, input),
    knownSessionIds,
  );
  const saved = persistSettingsWrite(
    (settingsFile) =>
      writeSavedUiPreferences(
        {
          openConversationIds: next.sessionIds,
          pinnedConversationIds: next.pinnedSessionIds,
          archivedConversationIds: next.archivedSessionIds,
          lockedConversationIds: next.lockedConversationIds,
          activeConversationId: next.activeConversationId,
          conversationWorkspaceMigrated: true,
        },
        settingsFile,
      ),
    { runtimeSettingsFile: context.getSettingsFile() },
  );
  invalidateAppTopics('sessions');
  const response = {
    ok: true as const,
    ...buildDesktopConversationWorkspaceResponse(saved),
  };
  publishConversationWorkspaceChanged(response);
  return response;
}

function publishConversationWorkspaceChanged(input: ReturnType<typeof buildDesktopConversationWorkspaceResponse> & { ok?: true }): void {
  publishAppEvent({
    type: 'conversation_workspace_changed',
    sessionIds: input.sessionIds,
    pinnedSessionIds: input.pinnedSessionIds,
    archivedSessionIds: input.archivedSessionIds,
    conversationPlacements: input.conversationPlacements,
    activeConversationId: input.activeConversationId,
    workspacePaths: input.workspacePaths,
    remoteControlledConversationIds: input.remoteControlledConversationIds,
    conversationWorkspaceRevision: input.conversationWorkspaceRevision,
    conversationWorkspaceUpdatedAt: input.conversationWorkspaceUpdatedAt,
    conversationWorkspaceMigratedAt: input.conversationWorkspaceMigratedAt,
  });
}

export async function readDesktopModelProviders() {
  return (await models()).readModelProvidersCapability(await getLocalProviderDesktopCapabilityContext());
}

export async function testDesktopModelProvider(provider: string) {
  return (await models()).testModelProviderCapability(await getLocalProviderDesktopCapabilityContext(), provider);
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
  const result = (await models()).setProviderApiKeyCapability(
    await getLocalProviderDesktopCapabilityContext(),
    input.provider,
    input.apiKey,
  );
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
  return withDesktopScheduledTaskMutationInvalidation(() =>
    createScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, normalizeDesktopScheduledTaskCreateInput(input)),
  );
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
  return withDesktopScheduledTaskMutationInvalidation(() => updateScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, input));
}

export async function runDesktopScheduledTask(taskId: string) {
  await getLocalRoutes();
  return withDesktopScheduledTaskMutationInvalidation(() => runScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, taskId), {
    includeRuns: true,
  });
}

export async function deleteDesktopScheduledTask(taskId: string) {
  await getLocalRoutes();
  return withDesktopScheduledTaskMutationInvalidation(() => deleteScheduledTaskCapability(DESKTOP_SCHEDULED_TASK_PROFILE, taskId));
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

export async function requestDesktopConversationWorkingDirectoryChange(input: {
  conversationId: string;
  cwd: string;
  continuePrompt?: string;
}) {
  const [liveContext, routeContext] = await Promise.all([getLocalLiveSessionCapabilityContext(), getLocalServerRouteContext()]);
  return requestConversationWorkingDirectoryChange(
    {
      conversationId: readRequiredConversationId(input.conversationId),
      cwd: input.cwd,
      ...(typeof input.continuePrompt === 'string' && input.continuePrompt.trim().length > 0
        ? { continuePrompt: input.continuePrompt.trim() }
        : {}),
    },
    {
      ...liveContext.buildLiveSessionResourceOptions(routeContext.getRuntimeScope()),
      extensionFactories: liveContext.buildLiveSessionExtensionFactories(),
    },
  );
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

export async function deleteDesktopConversationArtifact(input: { conversationId: string; artifactId: string }) {
  const context = await getLocalServerRouteContext();
  return deleteConversationArtifactCapability(context.getRuntimeScope(), input);
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

export async function resumeDesktopConversation(conversationId: string) {
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
  const settingsFile = (await getLocalServerRouteContext()).getSettingsFile();
  const sessionManager = SessionManager.open(sessionFile);
  const state = applyConversationModelPreferencesToSessionManager(
    sessionManager,
    nextInput,
    (await models()).readSavedModelPreferences(settingsFile, availableModels),
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

function readOptionalToolString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export async function invokeDesktopTool(input: {
  name?: unknown;
  input?: unknown;
  directToolNames?: unknown;
  toolContext?: unknown;
}): Promise<unknown> {
  const name = readOptionalToolString(input.name);
  if (!name) throw new Error('Tool name is required.');
  const context = await getLocalServerRouteContext();
  const toolContextInput =
    input.toolContext && typeof input.toolContext === 'object' && !Array.isArray(input.toolContext)
      ? (input.toolContext as Record<string, unknown>)
      : {};

  return invokeToolByName(
    {
      name,
      input: input.input,
      runtime: {
        runtimeScope: context.getRuntimeScope(),
        repoRoot: context.getRepoRoot(),
        ...(Array.isArray(input.directToolNames)
          ? { directToolNames: input.directToolNames.filter((item): item is string => typeof item === 'string') }
          : {}),
      },
      toolContext: {
        ...(readOptionalToolString(toolContextInput.conversationId)
          ? { conversationId: readOptionalToolString(toolContextInput.conversationId) }
          : {}),
        ...(readOptionalToolString(toolContextInput.sessionId) ? { sessionId: readOptionalToolString(toolContextInput.sessionId) } : {}),
        cwd: readOptionalToolString(toolContextInput.cwd) ?? context.getRepoRoot(),
      },
    },
    { getRuntimeScope: context.getRuntimeScope, getRepoRoot: context.getRepoRoot },
  );
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
  signal?: AbortSignal;
}) {
  if (input.signal?.aborted) {
    const error = new Error('Transcript load cancelled');
    error.name = 'AbortError';
    throw error;
  }

  const context = await getLocalLiveSessionCapabilityContext();
  return readSessionDetailRouteResponse({
    ...input,
    profile: context.getRuntimeScope(),
  });
}

export async function readDesktopSessionBlock(input: { sessionId: string; blockId: string }) {
  await getLocalRoutes();

  let result = await readConversationSessionBlockWithInlineAssetsCapability(input.sessionId, input.blockId);
  if (!result) {
    const context = await getLocalLiveSessionCapabilityContext();
    const { sessionRead } = await readSessionDetailForRoute({
      conversationId: input.sessionId,
      profile: context.getRuntimeScope(),
    });
    const block = sessionRead.detail ? findConversationSessionDetailBlock(sessionRead.detail, input.blockId) : null;
    result = block ? inlineConversationSessionBlockAssetsCapability(input.sessionId, block) : null;
  }
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
  videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  attachmentRefs?: unknown;
  contextMessages?: Array<{ customType: string; content: string }>;
  relatedConversationIds?: unknown;
  surfaceId?: string;
  allowedToolNames?: string[];
  reservedSessionFile?: string;
}): Promise<{ id: string; sessionFile: string; bootstrap?: unknown; perf?: Record<string, number> }> {
  const startedAtMs = performance.now();
  const { context, perf: contextSetupPerf } = await getLocalLiveSessionCapabilityContextWithPerf();
  const contextReadyAtMs = performance.now();
  const created = await createLiveSessionCapability({ ...input, includePersonaMemory: true, includeUnreadInbox: true }, context);
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
  videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
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
  return submitLiveSessionPromptCapability(
    { ...input, includePersonaMemory: true, includeUnreadInbox: true },
    await getLocalLiveSessionCapabilityContext(),
  );
}

export async function submitDesktopConversationMessage(input: {
  conversationId: string;
  text?: string;
  behavior?: 'steer' | 'followUp';
  images?: Array<{ data: string; mimeType: string; name?: string }>;
  videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  attachmentRefs?: unknown;
  contextMessages?: Array<{ customType: string; content: string }>;
  relatedConversationIds?: unknown;
  surfaceId?: string;
}) {
  const conversationId = input.conversationId.trim();
  if (!conversationId) {
    throw new Error('conversationId required');
  }

  const context = await getLocalLiveSessionCapabilityContext();
  const state = await readDesktopConversationState({ conversationId, profile: context.getRuntimeScope() });
  let targetConversationId = conversationId;
  if (!state.liveSession.live) {
    const sessionFile =
      state.sessionDetail?.meta && typeof state.sessionDetail.meta === 'object' && 'file' in state.sessionDetail.meta
        ? String((state.sessionDetail.meta as { file?: unknown }).file ?? '').trim()
        : '';
    const cwd =
      state.sessionDetail?.meta && typeof state.sessionDetail.meta === 'object' && 'cwd' in state.sessionDetail.meta
        ? String((state.sessionDetail.meta as { cwd?: unknown }).cwd ?? '').trim()
        : '';
    if (!sessionFile) {
      throw new Error('Conversation not found.');
    }
    const resumed = await resumeDesktopLiveSession({ sessionFile, ...(cwd ? { cwd } : {}) });
    targetConversationId = resumed.id || conversationId;
  }

  return submitLiveSessionPromptCapability(
    { ...input, conversationId: targetConversationId, includePersonaMemory: true, includeUnreadInbox: true },
    context,
  );
}

export async function submitDesktopLiveSessionParallelPrompt(input: {
  conversationId: string;
  text?: string;
  images?: Array<{ data: string; mimeType: string; name?: string }>;
  videos?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  audios?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  documents?: Array<{ path: string; mimeType: string; name?: string; sizeBytes?: number }>;
  attachmentRefs?: unknown;
  contextMessages?: Array<{ customType: string; content: string }>;
  relatedConversationIds?: unknown;
  surfaceId?: string;
  model?: string | null;
  thinkingLevel?: string | null;
  serviceTier?: string | null;
  ownerExtensionId?: string;
  purpose?: string;
  metadata?: Record<string, unknown>;
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
