/**
 * Live Pi session registry.
 * Wraps @earendil-works/pi-coding-agent SDK sessions in-process and
 * exposes a pub/sub SSE event layer for the web server.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AgentSession } from '@earendil-works/pi-coding-agent';
import {
  type ConversationArtifactRecord,
  getConversationArtifact,
  getDurableSessionsDir,
  getPiAgentRuntimeDir,
  listConversationArtifacts,
} from '@neon-pilot/core';

import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { publishAppEvent, publishConversationRuntimeState } from '../shared/appEvents.js';
import { persistTraceStats } from '../traces/tracePersistence.js';
import {
  type ConversationAutoModeState,
  readConversationAutoModeStateFromSessionManager,
  writeConversationAutoModeState,
} from './conversationAutoMode.js';
import { type ConversationModelPreferenceInput, type ConversationModelPreferenceState } from './conversationModelPreferences.js';
import { reserveConversationSession } from './conversationReservation.js';
import {
  appendConversationCompactionSummary,
  appendConversationWorkspaceMetadata,
  readConversationSessionMetaByFilePath,
} from './conversationTranscriptOps.js';
import { type InjectedTurnEnvelopeOptions, wrapInjectedTurnMessage } from './injectedTurnEnvelope.js';
import { executeLiveSessionBash } from './liveSessionBash.js';
import { finalizeLiveSessionBashExecution } from './liveSessionBashFinalization.js';
import { abortConversationBashProcesses } from './liveSessionBashProcesses.js';
import { branchLiveSession, forkLiveSession } from './liveSessionBranching.js';
import {
  applySessionTitle,
  broadcast,
  broadcastContextUsage,
  broadcastParallelState,
  broadcastPresenceState,
  broadcastQueueState,
  broadcastSnapshot,
  broadcastTitle,
  clearContextUsageTimer,
  publishRunningChange,
  scheduleContextUsage,
  syncDurableConversationRun,
} from './liveSessionBroadcasts.js';
import {
  createLiveSession as createLiveSessionWithCallbacks,
  createLiveSessionFromExisting as createLiveSessionFromExistingWithCallbacks,
  resumeLiveSession as resumeLiveSessionWithCallbacks,
} from './liveSessionCreation.js';
import {
  applyPendingLiveSessionWorkingDirectoryChange,
  type PendingConversationWorkingDirectoryChange,
  requestLiveSessionWorkingDirectoryChange,
} from './liveSessionCwdChange.js';
import { destroyLiveSession } from './liveSessionDestroy.js';
import { abortConversationDurableRuns } from './liveSessionDurableRun.js';
import { handleLiveSessionEvent } from './liveSessionEventHandling.js';
import { type LiveContextUsage, type SseEvent } from './liveSessionEvents.js';
import { makeAuth as makeFactoryAuth, makeRegistry, warmLiveSessionToolSelection } from './liveSessionFactory.js';
import {
  getDefaultLifecycleHandlers,
  type LiveSessionLifecycleHandler,
  notifyLiveSessionLifecycleHandlers,
  registerLiveSessionLifecycleHandler as registerDefaultLiveSessionLifecycleHandler,
} from './liveSessionLifecycle.js';
import { type LiveSessionLoaderOptions } from './liveSessionLoader.js';
import {
  compactLiveSession,
  renameLiveSession,
  updateLiveSessionModelPreferences as updateLiveSessionModelPreferencesWithCallbacks,
} from './liveSessionMaintenanceOps.js';
import {
  appendDetachedLiveSessionAssistantError,
  appendDetachedLiveSessionBashExecution,
  appendDetachedLiveSessionUserMessage,
  appendParallelImportedLiveSessionMessage,
  appendVisibleLiveSessionCustomMessage,
  queueLiveSessionPromptContext,
  updateVisibleLiveSessionCustomMessage,
} from './liveSessionMessageAppend.js';
import {
  buildConversationServiceTierPreferenceInput,
  resolveConversationPreferenceStateForSession as resolveConversationPreferenceStateForSessionWithSettings,
} from './liveSessionModels.js';
import {
  finalizeParallelChildLiveSession as finalizeParallelChildLiveSessionWithCallbacks,
  manageParallelPromptJob as manageParallelPromptJobWithCallbacks,
  startParallelPromptSession as startParallelPromptSessionWithCallbacks,
  tryImportReadyParallelJobs as tryImportReadyParallelJobsWithCallbacks,
} from './liveSessionParallelImportOps.js';
import { writePersistedParallelJobs } from './liveSessionParallelJobs.js';
import { loadPersistedParallelJobs, type ResolveParallelChildSession } from './liveSessionParallelReconciliation.js';
import { resolveLiveSessionFile } from './liveSessionPersistence.js';
import { createLiveSessionPresenceHost, type LiveSessionPresenceState, type LiveSessionSurfaceType } from './liveSessionPresence.js';
import { ensureLiveSessionSurfaceCanControl, takeOverLiveSessionControl } from './liveSessionPresenceFacade.js';
import { runPromptOnLiveEntry as runPromptOnLiveEntryWithCallbacks, submitPromptOnLiveEntry } from './liveSessionPromptOps.js';
import {
  normalizeQueuedPromptBehavior,
  type PromptAudioAttachment,
  type PromptDocumentAttachment,
  type PromptImageAttachment,
  type PromptVideoAttachment,
  type QueuedPromptPreview,
} from './liveSessionQueue.js';
import {
  cancelLiveSessionQueuedPrompt,
  clearLiveSessionQueuedPrompts,
  restoreLiveSessionQueuedMessage,
} from './liveSessionQueueOperations.js';
import {
  canInjectResumeFallbackPrompt as canInjectResumeFallbackPromptForEntry,
  listQueuedPromptPreviews as listQueuedPromptPreviewsForEntry,
} from './liveSessionQueueRead.js';
import {
  computeLiveSessionRunning,
  formatAvailableModels,
  getLiveSessionContextUsage as readLiveSessionContextUsageForEntry,
  getLiveSessionForkEntries as readLiveSessionForkEntries,
  getLiveSessionStats as readLiveSessionStats,
  listLiveSessions as listLiveSessionEntries,
} from './liveSessionReadApi.js';
import { type TranscriptTailRecoveryReason } from './liveSessionRecovery.js';
import {
  refreshAllLiveSessionModelRegistries as refreshLiveSessionModelRegistries,
  reloadAllLiveSessionAuth as reloadLiveSessionAuth,
} from './liveSessionRegistryMaintenance.js';
import { createLiveSessionStaleTurnState, ensureStaleTurnState, hasQueuedOrActiveStaleTurn } from './liveSessionStaleTurns.js';
import {
  buildLiveSessionSnapshot,
  type LiveSessionStateSnapshot,
  readLiveSessionStateSnapshotFromEntry,
} from './liveSessionStateSnapshot.js';
import { subscribeLiveSession } from './liveSessionSubscription.js';
import { resolveStableSessionTitle } from './liveSessionTitle.js';
import { type BeforeAgentStartProbeMessage, inspectAvailableLiveSessionTools } from './liveSessionToolInspection.js';
import { repairLiveSessionTranscriptTail as repairLiveSessionTranscriptTailWithCallbacks } from './liveSessionTranscriptRepair.js';
import { getAssistantErrorDisplayMessage } from './sessionAssistantErrors.js';

export function registerLiveSessionLifecycleHandler(handler: LiveSessionLifecycleHandler): () => void {
  const unregisterDefault = registerDefaultLiveSessionLifecycleHandler(handler);
  for (const entry of registry.values()) {
    if (!entry.lifecycleHandlers.includes(handler)) {
      entry.lifecycleHandlers.push(handler);
    }
  }
  return () => {
    unregisterDefault();
    for (const entry of registry.values()) {
      entry.lifecycleHandlers = entry.lifecycleHandlers.filter((candidate) => candidate !== handler);
    }
  };
}

export { readConversationAutoModeStateFromEntries } from './conversationAutoMode.js';
export { type LiveContextUsage, type LiveContextUsageSegment, type SseEvent, toSse } from './liveSessionEvents.js';
export { resolveLastCompletedConversationEntryId, resolveStableForkEntryId } from './liveSessionForking.js';
export { clearPrewarmedLiveSessionLoaders, type LiveSessionLoaderOptions, prewarmLiveSessionLoader } from './liveSessionLoader.js';
export { type ParallelPromptPreview } from './liveSessionParallelJobs.js';
export { ensureSessionFileExists, patchSessionManagerPersistence } from './liveSessionPersistence.js';
export {
  LiveSessionControlError,
  type LiveSessionPresence,
  type LiveSessionPresenceState,
  type LiveSessionSurfaceType,
} from './liveSessionPresence.js';
export {
  type PromptAudioAttachment,
  type PromptDocumentAttachment,
  type PromptImageAttachment,
  type PromptVideoAttachment,
  type QueuedPromptPreview,
} from './liveSessionQueue.js';
export { isPlaceholderConversationTitle, resolveStableSessionTitle } from './liveSessionTitle.js';

export function prewarmLiveSessionToolSelection(): Promise<void> {
  // Return the warmup so callers can contain transient startup failures (for
  // example, before the extension-host RPC client has connected). Detaching
  // this promise turned an otherwise best-effort prewarm into an unhandled
  // process rejection.
  return warmLiveSessionToolSelection(resolveSettingsFile()).then(() => undefined);
}

function resolveAgentDir(): string {
  return getPiAgentRuntimeDir();
}

function resolveSettingsFile(): string {
  return join(resolveAgentDir(), 'settings.json');
}

function resolveSessionsDir(): string {
  return getDurableSessionsDir();
}

export function resolvePersistentSessionDir(cwd: string): string {
  const safePath = `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;
  return join(resolveSessionsDir(), safePath);
}

function resolveConversationPreferenceStateForSession(
  sessionManager: Parameters<typeof resolveConversationPreferenceStateForSessionWithSettings>[1],
  availableModels: Parameters<typeof resolveConversationPreferenceStateForSessionWithSettings>[2],
): ReturnType<typeof resolveConversationPreferenceStateForSessionWithSettings> {
  return resolveConversationPreferenceStateForSessionWithSettings(resolveSettingsFile(), sessionManager, availableModels);
}

// ── SSE event types sent to clients ──────────────────────────────────────────

// ── Internal entry ────────────────────────────────────────────────────────────

import type { LiveEntry } from './liveSessionTypes.js';

export type { LiveSessionStateSnapshot } from './liveSessionStateSnapshot.js';

export const registry = new Map<string, LiveEntry>();
const pendingConversationWorkingDirectoryChanges = new Map<string, PendingConversationWorkingDirectoryChange>();

function escapeExportHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function renderExportArtifactPreview(artifact: ConversationArtifactRecord): string {
  if (artifact.kind === 'html') {
    return `<iframe class="neon-export-artifact-frame" title="${escapeExportHtml(artifact.title)} preview" sandbox="" srcdoc="${escapeExportHtml(
      artifact.content,
    )}"></iframe>`;
  }

  return `<pre class="neon-export-artifact-source"><code>${escapeExportHtml(artifact.content)}</code></pre>`;
}

function buildConversationArtifactsExportSection(conversationId: string): string {
  const summaries = listConversationArtifacts({ profile: 'shared', conversationId });
  const artifacts = summaries.flatMap((summary) => {
    const artifact = getConversationArtifact({ profile: 'shared', conversationId, artifactId: summary.id });
    return artifact ? [artifact] : [];
  });

  if (artifacts.length === 0) {
    return '';
  }

  const artifactItems = artifacts
    .map(
      (artifact) => `<article class="neon-export-artifact">
  <header>
    <p class="neon-export-artifact-kind">${escapeExportHtml(artifact.kind)} · rev ${artifact.revision}</p>
    <h3>${escapeExportHtml(artifact.title)}</h3>
    <p class="neon-export-artifact-id">${escapeExportHtml(artifact.id)}</p>
  </header>
  ${renderExportArtifactPreview(artifact)}
</article>`,
    )
    .join('\n');

  return `<section class="neon-export-artifacts" aria-label="Saved artifacts">
<style>
.neon-export-artifacts{margin:2rem auto;padding:1.25rem;max-width:1100px;border-top:1px solid rgba(148,163,184,.35);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.neon-export-artifacts h2{margin:0 0 1rem;font-size:1.25rem}
.neon-export-artifact{margin:1rem 0;padding:1rem;border:1px solid rgba(148,163,184,.35);border-radius:8px}
.neon-export-artifact header{margin-bottom:.75rem}
.neon-export-artifact h3{margin:.15rem 0;font-size:1rem}
.neon-export-artifact-kind,.neon-export-artifact-id{margin:0;color:#64748b;font-size:.8rem}
.neon-export-artifact-frame{width:100%;min-height:320px;border:1px solid rgba(148,163,184,.35);border-radius:6px;background:white}
.neon-export-artifact-source{overflow:auto;white-space:pre-wrap;padding:1rem;border-radius:6px;background:#0f172a;color:#e2e8f0}
</style>
<h2>Saved artifacts</h2>
${artifactItems}
</section>`;
}

function appendConversationArtifactsToExportHtml(conversationId: string, exportPath: string): void {
  if (!exportPath || !existsSync(exportPath)) {
    return;
  }

  const section = buildConversationArtifactsExportSection(conversationId);
  if (!section) {
    return;
  }

  const html = readFileSync(exportPath, 'utf-8');
  const insertAt = html.search(/<\/body\s*>/i);
  const nextHtml =
    insertAt >= 0 ? `${html.slice(0, insertAt)}\n${section}\n${html.slice(insertAt)}` : `${html.replace(/\s*$/, '')}\n${section}\n`;
  writeFileSync(exportPath, nextHtml, 'utf-8');
}

function notifyEntryLifecycleHandlers(entry: LiveEntry, trigger: 'turn_end' | 'auto_compaction_end'): void {
  notifyLiveSessionLifecycleHandlers({
    conversationId: entry.sessionId,
    sessionFile: resolveLiveSessionFile(entry.session, { ensurePersisted: true }),
    title: resolveEntryTitle(entry),
    cwd: entry.cwd,
    trigger,
  });
}

export function reloadAllLiveSessionAuth(): number {
  return reloadLiveSessionAuth(registry.values());
}

export function refreshAllLiveSessionModelRegistries(): number {
  return refreshLiveSessionModelRegistries(registry.values());
}

function resolveEntryTitle(entry: LiveEntry): string {
  const sessionName = entry.session.sessionName?.trim();
  if (sessionName) {
    return sessionName;
  }

  return entry.title.trim();
}

export function canInjectResumeFallbackPrompt(sessionId: string): boolean {
  return canInjectResumeFallbackPromptForEntry(registry.get(sessionId));
}

export function listQueuedPromptPreviews(sessionId: string): { steering: QueuedPromptPreview[]; followUp: QueuedPromptPreview[] } {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }

  return listQueuedPromptPreviewsForEntry(entry);
}

let parallelPromptJobCounter = 0;

const resolveParallelChildSession: ResolveParallelChildSession = (childConversationId) => {
  const childEntry = registry.get(childConversationId);
  if (!childEntry) {
    return undefined;
  }

  return {
    sessionFile: childEntry.session.sessionFile,
    isStreaming: childEntry.session.isStreaming,
  };
};

function persistParallelJobs(entry: Pick<LiveEntry, 'session' | 'parallelJobs'>): void {
  const sessionFile = entry.session.sessionFile?.trim();
  if (!sessionFile) {
    return;
  }

  writePersistedParallelJobs(sessionFile, Array.isArray(entry.parallelJobs) ? entry.parallelJobs : []);
}

function createParallelPromptJobId(): string {
  parallelPromptJobCounter += 1;
  return `parallel-${parallelPromptJobCounter}`;
}

function publishSessionMetaChanged(sessionId: string): void {
  const entry = registry.get(sessionId);
  if (entry) {
    const running = computeLiveSessionRunning(entry);
    if (running !== entry.running) {
      entry.running = running;
    }
    publishConversationRuntimeState({ conversationId: sessionId, running });
  }
  publishAppEvent({ type: 'session_meta_changed', sessionId });
}

function publishOptimisticPromptRunningState(entry: LiveEntry): void {
  if (entry.running) {
    return;
  }
  entry.running = true;
  publishConversationRuntimeState({ conversationId: entry.sessionId, running: true });
  publishAppEvent({ type: 'session_meta_changed', sessionId: entry.sessionId });
}

function syncPromptRunningState(entry: LiveEntry): void {
  const target = registry.get(entry.sessionId);
  if (!target) {
    return;
  }
  publishRunningChange(target);
}

export async function readLiveSessionStateSnapshot(sessionId: string, tailBlocks?: number): Promise<LiveSessionStateSnapshot> {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }
  ensureStaleTurnState(entry);
  return readLiveSessionStateSnapshotFromEntry(entry, resolveEntryTitle(entry), tailBlocks);
}

export function ensureSessionSurfaceCanControl(sessionId: string, surfaceId?: string): void {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }

  ensureLiveSessionSurfaceCanControl(entry, surfaceId);
}

export function takeOverSessionControl(sessionId: string, surfaceId: string): LiveSessionPresenceState {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }

  return takeOverLiveSessionControl(entry, surfaceId, { broadcastPresenceState });
}

// ── Event wiring ──────────────────────────────────────────────────────────────

function wireSession(id: string, session: AgentSession, cwd: string) {
  // Snapshot current cumulative session token totals so the delta logic in
  // liveSessionEventHandling doesn't double-count tokens from before this wire
  // (e.g. on reconnect after a crash or reload).
  let initialPersistedTokens: LiveEntry['tracePersistedTokens'];
  try {
    const existing = session.getSessionStats();
    if (existing.tokens.input > 0 || existing.tokens.cacheRead > 0 || existing.tokens.cacheWrite > 0) {
      initialPersistedTokens = {
        input: existing.tokens.input,
        output: existing.tokens.output,
        cacheRead: existing.tokens.cacheRead,
        cacheWrite: existing.tokens.cacheWrite,
        cost: existing.cost,
      };
    }
  } catch {
    // Non-fatal — start from zero if stats unavailable
  }

  const entry: LiveEntry = {
    sessionId: id,
    session,
    cwd,
    listeners: new Set(),
    title: resolveStableSessionTitle(session),
    lastContextUsage: undefined,
    lastContextUsageJson: null,
    lastContextUsageMessageCount: undefined,
    lastQueueState: undefined,
    lastQueueStateJson: null,
    lastParallelState: undefined,
    lastParallelStateJson: null,
    currentTurnError: null,
    tracePersistedTokens: initialPersistedTokens,
    ...createLiveSessionStaleTurnState(),
    pendingAutoCompactionReason: null,
    lastCompactionSummaryTitle: null,
    isCompacting: false,
    running: false,
    parallelJobs: [],
    importingParallelJobs: false,
    lifecycleHandlers: getDefaultLifecycleHandlers(),
    ...createLiveSessionPresenceHost(),
  };
  entry.parallelJobs = loadPersistedParallelJobs(entry.session.sessionFile, resolveParallelChildSession);
  registry.set(id, entry);
  publishSessionMetaChanged(id);
  if (session.isStreaming) {
    queueMicrotask(() => {
      void syncDurableConversationRun(entry, 'running', { force: true });
    });
  }
  if (entry.parallelJobs.length > 0) {
    queueMicrotask(() => {
      void tryImportReadyParallelJobs(entry);
    });
  }

  session.subscribe((event) =>
    handleLiveSessionEvent(entry, event, {
      syncDurableConversationRun,
      requestConversationAutoModeContinuationTurn: async () => false,
      requestConversationAutoModeTurn: async () => false,
      notifyLifecycleHandlers: notifyEntryLifecycleHandlers,
      applyPendingConversationWorkingDirectoryChange,
      scheduleContextUsage,
      publishSessionMetaChanged,
      syncRunningState: (sessionId: string) => {
        const target = registry.get(sessionId);
        if (!target) return;
        publishRunningChange(target);
      },
      broadcastQueueState,
      broadcastTitle: (entry) => broadcastTitle(entry, { resolveEntryTitle, publishSessionMetaChanged }),
      broadcastStats: (target, tokens, cost, traceRun) => {
        broadcast(target, {
          type: 'stats_update',
          tokens: {
            input: tokens.input,
            output: tokens.output,
            total: tokens.total,
            cacheRead: tokens.cacheRead ?? 0,
            cacheWrite: tokens.cacheWrite ?? 0,
          },
          cost,
        });
        persistTraceStats({
          sessionId: target.sessionId,
          modelId: target.session.model?.id,
          runId: traceRun.runId,
          tokensInput: tokens.input,
          tokensOutput: tokens.output,
          tokensCachedInput: tokens.cacheRead,
          tokensCachedWrite: tokens.cacheWrite,
          cost,
          turnCount: traceRun.turnCount,
          stepCount: traceRun.stepCount,
          durationMs: traceRun.durationMs,
        });
      },
      clearContextUsageTimer,
      broadcastContextUsage: (entry, force) => broadcastContextUsage(entry, { readLiveSessionContextUsageForEntry }, force),
      broadcastSnapshot: (entry) =>
        broadcastSnapshot(entry, {
          buildLiveSessionSnapshot: (() => {
            const fn = buildLiveSessionSnapshot;
            return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
          })(),
          ensureStaleTurnState,
        }),
      appendCompactionSummary: ({ entry, summary, tokensBefore, firstKeptEntryId, details }) => {
        const sessionFile = resolveLiveSessionFile(entry.session, { ensurePersisted: true });
        if (!sessionFile) {
          return;
        }

        appendConversationCompactionSummary({
          sessionFile,
          summary,
          tokensBefore,
          ...(firstKeptEntryId ? { firstKeptEntryId } : {}),
          ...(details !== undefined ? { details } : {}),
        });
      },
      broadcast,
      tryImportReadyParallelJobs,
    }),
  );

  return entry;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isLive(sessionId: string): boolean {
  return registry.has(sessionId);
}

export function getLiveSessions() {
  return listLiveSessionEntries(registry.entries(), resolveEntryTitle);
}

export function getLiveSession(sessionId: string): ReturnType<typeof getLiveSessions>[number] | null {
  const entry = registry.get(sessionId);
  if (!entry) {
    return null;
  }
  return listLiveSessionEntries([[sessionId, entry]], resolveEntryTitle)[0] ?? null;
}

export function getLiveSessionForkEntries(sessionId: string): unknown[] | null {
  return readLiveSessionForkEntries(registry.get(sessionId));
}

export async function getAvailableModelObjects() {
  const auth = makeFactoryAuth(resolveAgentDir());
  const registry = makeRegistry(auth);
  return registry.getAvailable();
}

export async function getAvailableModels() {
  return formatAvailableModels(await getAvailableModelObjects());
}

function assertResolvableModelOverride(
  modelRef: string | null | undefined,
  models: Awaited<ReturnType<typeof getAvailableModelObjects>>,
): void {
  const normalized = typeof modelRef === 'string' ? modelRef.trim() : '';
  if (!normalized) {
    return;
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex > 0 && slashIndex < normalized.length - 1) {
    const provider = normalized.slice(0, slashIndex);
    const id = normalized.slice(slashIndex + 1);
    if (models.some((model) => model.provider === provider && model.id === id)) {
      return;
    }
    throw new Error(`Model "${normalized}" is not available.`);
  }

  const matches = models.filter((model) => model.id === normalized);
  if (matches.length === 1) {
    return;
  }
  if (matches.length > 1) {
    throw new Error(`Model "${normalized}" is ambiguous. Use provider/model.`);
  }
  throw new Error(`Model "${normalized}" is not available.`);
}

export async function inspectAvailableTools(
  cwd: string,
  options: LiveSessionLoaderOptions = {},
): Promise<{
  cwd: string;
  activeTools: string[];
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    active: boolean;
  }>;
  newSessionSystemPrompt: string;
  newSessionInjectedMessages: BeforeAgentStartProbeMessage[];
  newSessionToolDefinitions: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    active: true;
  }>;
}> {
  return inspectAvailableLiveSessionTools({
    cwd,
    agentDir: options.agentDir ?? resolveAgentDir(),
    options,
  });
}

export function getSessionStats(sessionId: string) {
  return readLiveSessionStats(registry.get(sessionId));
}

export function getSessionContextUsage(sessionId: string): LiveContextUsage | null {
  return readLiveSessionContextUsageForEntry(registry.get(sessionId));
}

/** Create a brand-new Pi session. */
export async function createSession(
  cwd: string,
  options: LiveSessionLoaderOptions = {},
): Promise<{ id: string; sessionFile: string; perf?: Record<string, number> }> {
  return createLiveSessionWithCallbacks({
    cwd,
    agentDir: resolveAgentDir(),
    settingsFile: resolveSettingsFile(),
    options,
    persistentSessionDir: resolvePersistentSessionDir(cwd),
    wireSession,
  });
}

/** Create a new live session in a different cwd from an existing session file. */
export async function createSessionFromExisting(
  sessionFile: string,
  cwd: string,
  options: LiveSessionLoaderOptions = {},
): Promise<{ id: string; sessionFile: string; perf?: Record<string, number> }> {
  return createLiveSessionFromExistingWithCallbacks({
    sessionFile,
    cwd,
    agentDir: resolveAgentDir(),
    settingsFile: resolveSettingsFile(),
    options,
    persistentSessionDir: resolvePersistentSessionDir(cwd),
    wireSession,
  });
}

export async function requestConversationWorkingDirectoryChange(
  input: {
    conversationId: string;
    cwd: string;
    continuePrompt?: string;
  },
  loaderOptions: LiveSessionLoaderOptions = {},
): Promise<{
  conversationId: string;
  cwd: string;
  queued: boolean;
  unchanged?: boolean;
}> {
  return requestLiveSessionWorkingDirectoryChange({
    conversationId: input.conversationId,
    cwd: input.cwd,
    continuePrompt: input.continuePrompt,
    loaderOptions,
    registry,
    pendingChanges: pendingConversationWorkingDirectoryChanges,
    resolveSessionFile: (entry) => resolveLiveSessionFile(entry.session, { ensurePersisted: true }) ?? undefined,
  });
}

async function applyPendingConversationWorkingDirectoryChange(entry: LiveEntry): Promise<void> {
  await applyPendingLiveSessionWorkingDirectoryChange({
    entry,
    pendingChanges: pendingConversationWorkingDirectoryChanges,
    resolveSessionFile: (candidate) => resolveLiveSessionFile(candidate.session, { ensurePersisted: true }) ?? undefined,
    changeSessionWorkingDirectory: async (candidate, sessionFile, cwd, options) => {
      const currentMeta = readConversationSessionMetaByFilePath(sessionFile);
      const previousWorkspaceCwd =
        currentMeta && 'workspaceCwd' in currentMeta ? currentMeta.workspaceCwd : (currentMeta?.cwd ?? candidate.cwd);
      appendConversationWorkspaceMetadata({
        sessionFile,
        previousCwd: currentMeta?.cwd ?? candidate.cwd,
        previousWorkspaceCwd,
        cwd,
        workspaceCwd: cwd,
        visibleMessage: true,
      });

      destroySession(candidate.sessionId);
      return resumeSession(sessionFile, {
        ...options,
        cwdOverride: cwd,
      }).then((result) => ({
        ...result,
        sessionFile,
      }));
    },
    promptSession,
    broadcast,
  });
}

/** Resume an existing session file into a live session. */
export async function resumeSession(
  sessionFile: string,
  options: LiveSessionLoaderOptions & { cwdOverride?: string } = {},
): Promise<{ id: string; perf?: Record<string, number> }> {
  return resumeLiveSessionWithCallbacks({
    sessionFile,
    agentDir: resolveAgentDir(),
    settingsFile: resolveSettingsFile(),
    options,
    findLiveSessionByFile: (candidateFile) => {
      for (const [id, entry] of registry.entries()) {
        if (resolveLiveSessionFile(entry.session) === candidateFile) return { id };
      }
      return null;
    },
    wireSession,
  });
}

/** Subscribe to SSE events for a live session. Returns unsubscribe fn or null if not live. */
export function subscribe(
  sessionId: string,
  listener: (e: SseEvent) => void,
  options?: {
    tailBlocks?: number;
    surface?: {
      surfaceId: string;
      surfaceType: LiveSessionSurfaceType;
    };
    deferInitialReplayMs?: number;
  },
): (() => void) | null {
  const entry = registry.get(sessionId);
  if (!entry) return null;
  return subscribeLiveSession(entry, listener, options, {
    resolveTitle: resolveEntryTitle,
    broadcastPresenceState,
  });
}

/** Append internal context before the next user-visible prompt in a live session. */
export async function queuePromptContext(sessionId: string, customType: string, content: string): Promise<void> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  await queueLiveSessionPromptContext(entry, customType, content);
}

export function readLiveSessionAutoModeState(sessionId: string): ConversationAutoModeState {
  const entry = registry.get(sessionId);
  if (!entry?.session.sessionManager?.getEntries) return { enabled: false, mode: 'manual', stopReason: null, updatedAt: null };
  return readConversationAutoModeStateFromSessionManager(entry.session.sessionManager);
}

export async function setLiveSessionAutoModeState(
  sessionId: string,
  input: Partial<ConversationAutoModeState>,
): Promise<ConversationAutoModeState> {
  const entry = registry.get(sessionId);
  if (!entry?.session.sessionManager?.appendCustomEntry) throw new Error(`Live session not found: ${sessionId}`);
  const state = writeConversationAutoModeState(entry.session.sessionManager, input);
  publishSessionMetaChanged(sessionId);
  return state;
}

export function markConversationAutoModeContinueRequested(_sessionId: string): void {
  // Legacy auto-mode continuation is intentionally disabled. Goal-mode owns autonomous continuation now.
}

export async function requestConversationAutoModeTurn(_sessionId: string): Promise<boolean> {
  // Legacy auto-mode continuation is intentionally disabled. Goal-mode owns autonomous continuation now.
  return false;
}

export async function requestConversationAutoModeContinuationTurn(sessionId: string): Promise<boolean> {
  const entry = registry.get(sessionId);
  if (entry) entry.pendingAutoModeContinuation = false;
  // Legacy auto-mode continuation is intentionally disabled. Goal-mode owns autonomous continuation now.
  return false;
}

export async function appendDetachedUserMessage(sessionId: string, text: string): Promise<void> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  await appendDetachedLiveSessionUserMessage(entry, text, {
    broadcastTitle: (entry) => broadcastTitle(entry, { resolveEntryTitle, publishSessionMetaChanged }),
    publishSessionMetaChanged,
  });
}

export async function appendVisibleCustomMessage(
  sessionId: string,
  customType: string,
  content: string,
  details?: unknown,
  options?: { blockId?: string },
): Promise<string | null> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  return appendVisibleLiveSessionCustomMessage(
    entry,
    customType,
    content,
    details,
    {
      broadcastSnapshot: (entry) =>
        broadcastSnapshot(entry, {
          buildLiveSessionSnapshot: (() => {
            const fn = buildLiveSessionSnapshot;
            return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
          })(),
          ensureStaleTurnState,
        }),
      publishSessionMetaChanged,
    },
    options,
  );
}

export function updateVisibleCustomMessage(
  sessionId: string,
  blockId: string,
  customType: string,
  content: string,
  details?: unknown,
): boolean {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  return updateVisibleLiveSessionCustomMessage(entry, blockId, customType, content, details, {
    broadcastSnapshot: (entry) =>
      broadcastSnapshot(entry, {
        buildLiveSessionSnapshot: (() => {
          const fn = buildLiveSessionSnapshot;
          return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
        })(),
        ensureStaleTurnState,
      }),
    publishSessionMetaChanged,
  });
}

async function appendParallelImportedMessage(
  sessionId: string,
  content: string,
  details: { childConversationId: string; status: 'complete' | 'failed' },
): Promise<void> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  await appendParallelImportedLiveSessionMessage(entry, content, details, {
    appendDetachedUserMessage: (target, text) =>
      appendDetachedLiveSessionUserMessage(target, text, {
        broadcastTitle: (entry) => broadcastTitle(entry, { resolveEntryTitle, publishSessionMetaChanged }),
        publishSessionMetaChanged,
      }),
    broadcastSnapshot: (entry) =>
      broadcastSnapshot(entry, {
        buildLiveSessionSnapshot: (() => {
          const fn = buildLiveSessionSnapshot;
          return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
        })(),
        ensureStaleTurnState,
      }),
    publishSessionMetaChanged,
  });
}

async function finalizeParallelChildLiveSession(
  childConversationId: string,
  options: { abortIfRunning?: boolean } = {},
): Promise<'destroyed' | 'preserved' | 'missing'> {
  return finalizeParallelChildLiveSessionWithCallbacks(childConversationId, {
    childEntry: registry.get(childConversationId),
    destroySession,
    abortIfRunning: options.abortIfRunning,
  });
}

async function tryImportReadyParallelJobs(entry: LiveEntry): Promise<void> {
  await tryImportReadyParallelJobsWithCallbacks(entry, {
    hasQueuedOrActiveStaleTurn,
    persistParallelJobs,
    broadcastParallelState,
    appendParallelImportedMessage,
    finalizeParallelChildLiveSession,
  });
}

export async function startParallelPromptSession(
  sessionId: string,
  input: {
    text: string;
    images?: PromptImageAttachment[];
    videos?: PromptVideoAttachment[];
    audios?: PromptAudioAttachment[];
    documents?: PromptDocumentAttachment[];
    attachmentRefs?: string[];
    contextMessages?: Array<{ customType: string; content: string }>;
    cwd?: string;
    model?: string | null;
    thinkingLevel?: string | null;
    serviceTier?: string | null;
    ownerExtensionId?: string;
    purpose?: string;
    metadata?: Record<string, unknown>;
    autoImport?: boolean;
  },
  options: LiveSessionLoaderOptions = {},
): Promise<{ jobId: string; childConversationId: string }> {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }
  const availableModelsForTier = await getAvailableModelObjects();
  assertResolvableModelOverride(input.model, availableModelsForTier);
  return startParallelPromptSessionWithCallbacks(entry, input, options, {
    createJobId: createParallelPromptJobId,
    createSession,
    forkSession,
    queuePromptContext,
    submitPromptSession,
    resolveDefaultServiceTier: (candidate) =>
      buildConversationServiceTierPreferenceInput(
        resolveConversationPreferenceStateForSession(candidate.session.sessionManager, availableModelsForTier),
      ),
    hasQueuedOrActiveStaleTurn,
    persistParallelJobs,
    broadcastParallelState,
    getCurrentEntry: () => registry.get(sessionId),
    resolveParallelChildSession,
    tryImportReadyParallelJobs,
  });
}

export async function manageParallelPromptJob(
  sessionId: string,
  input: { jobId: string; action: 'importNow' | 'skip' | 'cancel'; callerExtensionId?: string },
): Promise<{ ok: true; status: 'imported' | 'queued' | 'skipped' | 'cancelled' }> {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }

  return manageParallelPromptJobWithCallbacks(entry, input, {
    persistParallelJobs,
    broadcastParallelState,
    finalizeParallelChildLiveSession,
    tryImportReadyParallelJobs,
  });
}

function resolvePromptBehavior(entry: LiveEntry, behavior?: 'steer' | 'followUp'): 'steer' | 'followUp' | undefined {
  return normalizeQueuedPromptBehavior(behavior, {
    isStreaming: entry.session.isStreaming,
    hasQueuedStaleTurn: hasQueuedOrActiveStaleTurn(entry),
  });
}

export function repairLiveSessionTranscriptTail(sessionId: string): {
  recoverable: boolean;
  repaired: boolean;
  reason: TranscriptTailRecoveryReason | null;
  summary?: string;
} {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }
  return repairLiveSessionTranscriptTailWithCallbacks(entry, {
    broadcastSnapshot: (entry) =>
      broadcastSnapshot(entry, {
        buildLiveSessionSnapshot: (() => {
          const fn = buildLiveSessionSnapshot;
          return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
        })(),
        ensureStaleTurnState,
      }),
    clearContextUsageTimer,
    broadcastContextUsage: (entry, force) => broadcastContextUsage(entry, { readLiveSessionContextUsageForEntry }, force),
    publishSessionMetaChanged: () => publishSessionMetaChanged(sessionId),
  });
}

async function runPromptOnLiveEntry(
  entry: LiveEntry,
  text: string,
  behavior: 'steer' | 'followUp' | undefined,
  images?: PromptImageAttachment[],
  videos?: PromptVideoAttachment[],
  audios?: PromptAudioAttachment[],
  documents?: PromptDocumentAttachment[],
): Promise<void> {
  if (behavior === undefined) {
    publishOptimisticPromptRunningState(entry);
  }

  try {
    await runPromptOnLiveEntryWithCallbacks(entry, text, behavior, images, videos, audios, documents, {
      repairLiveSessionTranscriptTail,
      broadcastQueueState,
    });
  } catch (error) {
    if (behavior === undefined) {
      const message = error instanceof Error ? error.message : String(error);
      appendDetachedLiveSessionAssistantError(
        entry,
        {
          promptText: text,
          errorMessage:
            getAssistantErrorDisplayMessage({ stopReason: 'error', errorMessage: message }) ??
            'The model could not start. Configure a model provider, then try again.',
        },
        {
          broadcastTitle: (entry) => broadcastTitle(entry, { resolveEntryTitle, publishSessionMetaChanged }),
          publishSessionMetaChanged,
        },
      );
      broadcastSnapshot(entry, {
        buildLiveSessionSnapshot: (() => {
          const fn = buildLiveSessionSnapshot;
          return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
        })(),
        ensureStaleTurnState,
      });
    }
    throw error;
  } finally {
    if (behavior === undefined) {
      syncPromptRunningState(entry);
    }
  }
}

export async function promptSession(
  sessionId: string,
  text: string,
  behavior?: 'steer' | 'followUp',
  images?: PromptImageAttachment[],
  videos?: PromptVideoAttachment[],
  audios?: PromptAudioAttachment[],
  documents?: PromptDocumentAttachment[],
  _surfaceId?: string,
  injectedTurn?: InjectedTurnEnvelopeOptions,
): Promise<void> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  // Prompt submission should survive quick navigation between conversations.
  // Keep surface-gated control for takeover/abort actions, but let an already
  // clicked send continue even if this surface disconnects a moment later.
  const normalizedBehavior = resolvePromptBehavior(entry, behavior);
  const submittedText = injectedTurn ? wrapInjectedTurnMessage(text, { ...injectedTurn, delivery: normalizedBehavior ?? 'started' }) : text;
  await runPromptOnLiveEntry(entry, submittedText, normalizedBehavior, images, videos, audios, documents);
}

export async function submitPromptSession(
  sessionId: string,
  text: string,
  behavior?: 'steer' | 'followUp',
  images?: PromptImageAttachment[],
  videos?: PromptVideoAttachment[],
  audios?: PromptAudioAttachment[],
  documents?: PromptDocumentAttachment[],
  _surfaceId?: string,
): Promise<{ acceptedAs: 'started' | 'queued'; completion: Promise<void> }> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);

  const normalizedBehavior = resolvePromptBehavior(entry, behavior);
  const submitted = await submitPromptOnLiveEntry(entry, text, normalizedBehavior, images, videos, audios, documents, {
    runPromptOnLiveEntry,
  });
  if (submitted.acceptedAs === 'started') {
    publishOptimisticPromptRunningState(entry);
    void submitted.completion
      .finally(() => {
        syncPromptRunningState(entry);
      })
      .catch(() => undefined);
  }
  return submitted;
}

export async function executeSessionBash(
  sessionId: string,
  command: string,
  options: { excludeFromContext?: boolean } = {},
): Promise<unknown> {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }

  const abortController = new AbortController();
  entry.directBashAbortControllers ??= new Set();
  entry.directBashAbortControllers.add(abortController);
  entry.directBashRunning = true;
  publishRunningChange(entry);

  let result: unknown;
  let normalizedCommand: string;
  try {
    const executed = await executeLiveSessionBash(entry, command, {
      excludeFromContext: options.excludeFromContext,
      signal: abortController.signal,
      broadcast: (event) => broadcast(entry, event),
    });
    result = executed.result;
    normalizedCommand = executed.normalizedCommand;
  } finally {
    entry.directBashAbortControllers.delete(abortController);
    if (entry.directBashAbortControllers.size === 0) {
      entry.directBashAbortControllers = undefined;
      entry.directBashRunning = false;
    }
    publishRunningChange(entry);
  }

  appendDetachedLiveSessionBashExecution(entry, normalizedCommand, result as Record<string, unknown>, {
    excludeFromContext: options.excludeFromContext,
  });
  finalizeLiveSessionBashExecution(entry, normalizedCommand, {
    broadcastTitle: (entry) => broadcastTitle(entry, { resolveEntryTitle, publishSessionMetaChanged }),
    broadcast,
    clearContextUsageTimer,
    broadcastContextUsage: (entry, force) => broadcastContextUsage(entry, { readLiveSessionContextUsageForEntry }, force),
    broadcastSnapshot: (entry) =>
      broadcastSnapshot(entry, {
        buildLiveSessionSnapshot: (() => {
          const fn = buildLiveSessionSnapshot;
          return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
        })(),
        ensureStaleTurnState,
      }),
    publishSessionMetaChanged,
    publishSessionFileChanged: (sessionId) => publishAppEvent({ type: 'session_file_changed', sessionId }),
  });

  return result;
}

export async function restoreQueuedMessage(
  sessionId: string,
  behavior: 'steer' | 'followUp',
  index: number,
  previewId?: string,
): Promise<{ text: string; images: PromptImageAttachment[] }> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);

  const restored = await restoreLiveSessionQueuedMessage(entry, behavior, index, previewId);
  broadcastQueueState(entry, true);
  return restored;
}

export async function cancelQueuedPrompt(
  sessionId: string,
  behavior: 'steer' | 'followUp',
  previewId: string,
): Promise<QueuedPromptPreview> {
  const entry = registry.get(sessionId);
  if (!entry) {
    throw new Error(`Session ${sessionId} is not live`);
  }

  const cancelledPreview = await cancelLiveSessionQueuedPrompt(entry, behavior, previewId);
  broadcastQueueState(entry, true);
  return cancelledPreview;
}

export function clearQueuedPrompts(sessionId: string): ReturnType<typeof clearLiveSessionQueuedPrompts> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  const cleared = clearLiveSessionQueuedPrompts(entry);
  broadcastQueueState(entry, true);
  return cleared;
}
export async function compactSession(sessionId: string, customInstructions?: string) {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  return compactLiveSession(entry, customInstructions, {
    broadcastSnapshot: (entry) =>
      broadcastSnapshot(entry, {
        buildLiveSessionSnapshot: (() => {
          const fn = buildLiveSessionSnapshot;
          return (e: Parameters<typeof fn>[0], t?: number) => fn(e, t) as unknown as Record<string, unknown>;
        })(),
        ensureStaleTurnState,
      }),
    clearContextUsageTimer,
    broadcastContextUsage: (entry, force) => broadcastContextUsage(entry, { readLiveSessionContextUsageForEntry }, force),
    publishSessionMetaChanged,
  });
}

export async function reloadSessionResources(sessionId: string): Promise<void> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  await entry.session.reload();
}

export async function exportSessionHtml(sessionId: string, outputPath?: string): Promise<string> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  const exportPath = await entry.session.exportToHtml(outputPath);
  appendConversationArtifactsToExportHtml(sessionId, exportPath);
  return exportPath;
}

export function renameSession(sessionId: string, name: string): void {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  renameLiveSession(entry, name, {
    applySessionTitle: (entry, title) => applySessionTitle(entry, title, { resolveEntryTitle, publishSessionMetaChanged }),
    syncDurableConversationRun,
  });
}

export async function updateLiveSessionModelPreferences(
  sessionId: string,
  input: ConversationModelPreferenceInput,
  availableModels?: Awaited<ReturnType<typeof getAvailableModelObjects>>,
): Promise<ConversationModelPreferenceState> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);

  const models = availableModels ?? (await getAvailableModelObjects());
  return updateLiveSessionModelPreferencesWithCallbacks({
    entry,
    preferences: input,
    availableModels: models,
    settingsFile: resolveSettingsFile(),
    publishSessionMetaChanged,
  });
}

/** Abort the current agent run. */
export async function abortSession(sessionId: string): Promise<void> {
  const entry = registry.get(sessionId);
  if (!entry) return;
  for (const controller of entry.directBashAbortControllers ?? []) {
    controller.abort();
  }
  abortConversationBashProcesses(sessionId);
  await abortConversationDurableRuns(entry);
  await entry.session.abort();
  for (const controller of entry.directBashAbortControllers ?? []) {
    controller.abort();
  }
  abortConversationBashProcesses(sessionId);
  await abortConversationDurableRuns(entry);
  try {
    await getExtensionHostClient().abortConversationResources(sessionId);
  } catch {
    // Some test and CLI contexts do not run a split extension host.
  }
  await syncDurableConversationRun(entry, 'interrupted', { force: true, lastError: 'Stopped by user' });
  publishRunningChange(entry);
}

/** Fork a session at a given message entry ID. */
export async function branchSession(
  sessionId: string,
  entryId: string,
  options: LiveSessionLoaderOptions = {},
  surfaceId?: string,
): Promise<{ newSessionId: string; sessionFile: string; perf?: Record<string, number> }> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  ensureLiveSessionSurfaceCanControl(entry, surfaceId);
  const result = await branchLiveSession(entry, entryId, options, { resumeSession });
  // Notify the source conversation so its transcript refreshes and shows the new child tombstone.
  publishSessionMetaChanged(sessionId);
  publishAppEvent({ type: 'session_file_changed', sessionId });
  return result;
}

export async function forkSession(
  sessionId: string,
  entryId: string,
  options: LiveSessionLoaderOptions & {
    preserveSource?: boolean;
    beforeEntry?: boolean;
    branchKind?: 'fork' | 'rewind';
    cwdOverride?: string;
  } = {},
  surfaceId?: string,
): Promise<{ newSessionId: string; sessionFile: string; perf?: Record<string, number> }> {
  const entry = registry.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} is not live`);
  ensureLiveSessionSurfaceCanControl(entry, surfaceId);
  const result = await forkLiveSession(entry, entryId, options, {
    createSession,
    reserveSession: (cwd) => reserveConversationSession({ cwd }),
    resumeSession,
    destroySession,
    resolveDefaultServiceTier: async (candidate) => {
      const availableModelsForTier = await getAvailableModelObjects();
      return buildConversationServiceTierPreferenceInput(
        resolveConversationPreferenceStateForSession(candidate.session.sessionManager, availableModelsForTier),
      );
    },
  });
  // Notify the source conversation so its transcript refreshes and shows the new child tombstone.
  if (options.preserveSource) {
    publishSessionMetaChanged(sessionId);
    publishAppEvent({ type: 'session_file_changed', sessionId });
  }
  return result;
}

/** Cleanly dispose a live session. */
export function destroySession(sessionId: string): void {
  destroyLiveSession(sessionId, {
    registry,
    pendingConversationWorkingDirectoryChanges,
    clearContextUsageTimer,
    syncDurableConversationRun,
    publishSessionMetaChanged,
  });
}
