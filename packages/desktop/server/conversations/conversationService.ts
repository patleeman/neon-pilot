import { existsSync, statSync } from 'node:fs';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import {
  ensureConversationAttentionBaselines,
  getActivityConversationLink,
  listDeferredResumeRecords,
  listProfileActivityEntries,
  loadDeferredResumeState,
  loadProfileActivityReadState,
  markConversationAttentionRead,
  markConversationAttentionUnread,
  summarizeConversationAttention,
} from '@neon-pilot/core';
import { loadDaemonConfig, resolveDaemonPaths } from '@neon-pilot/daemon';

import { type DeferredResumeSummary } from '../automation/deferredResumes.js';
import { readSavedModelPreferences } from '../models/modelPreferences.js';
import { publishAppEvent } from '../shared/appEvents.js';
import { getRuntimeSettingsFilePath } from '../ui/settingsPersistence.js';
import { type SavedUiPreferences } from '../ui/uiPreferences.js';
import {
  hasConversationCatalogRows,
  isConversationCatalogComplete,
  listConversationCatalogSessions,
  markConversationCatalogComplete,
  readConversationCatalogSession,
  startConversationCatalogBackfill,
  upsertConversationCatalogSessions,
} from './conversationCatalog.js';
import { readConversationContextDocs } from './conversationContextDocs.js';
import { readConversationModelPreferenceSnapshot, resolveConversationModelPreferenceState } from './conversationModelPreferences.js';
import { scheduleConversationSearchIndexing } from './conversationSearchIndex.js';
import { ensureSessionFileExists, registry as liveSessionRegistry } from './liveSessions.js';
import {
  getAvailableModelObjects,
  getLiveSession as getLocalLiveSession,
  getLiveSessions as getLocalLiveSessions,
} from './liveSessions.js';
import {
  appendConversationOffshootDetachedMetadata as appendSessionConversationOffshootDetachedMetadata,
  appendConversationOffshootMetadata as appendSessionConversationOffshootMetadata,
  appendConversationWorkspaceMetadata as appendSessionConversationWorkspaceMetadata,
  appendStoredVisibleCustomMessage as appendSessionStoredVisibleCustomMessage,
  buildAppendOnlySessionDetailResponse as buildSessionAppendOnlySessionDetailResponse,
  listSessions,
  readKnownSessionIdByFilePath,
  readSessionBlocksByFileWithTelemetry,
  readSessionBlocksWithTelemetry,
  readSessionEntryBlocks,
  readSessionImageAsset,
  readSessionMeta,
  readSessionMetaByFile,
  renameStoredSession as renameStoredConversationSession,
  type SessionImageAsset,
} from './sessions.js';

let getRuntimeScopeFn: () => string = () => {
  throw new Error('getRuntimeScope not initialized for conversation service');
};

let getRepoRootFn: () => string = () => process.cwd();
let getSettingsFileFn: () => string = () => getRuntimeSettingsFilePath();
let readModelBackfillStarted = false;
let readModelBackfillTimer: ReturnType<typeof setTimeout> | null = null;
const DEFAULT_READ_MODEL_BACKFILL_DELAY_MS = 5 * 60_000;

export function getRuntimeScope(): string {
  return getRuntimeScopeFn();
}

export function setConversationServiceContext(input: {
  getRuntimeScope: () => string;
  getRepoRoot: () => string;
  getSettingsFile?: () => string;
  getSavedUiPreferences: () => SavedUiPreferences;
}): void {
  getRuntimeScopeFn = input.getRuntimeScope;
  getRepoRootFn = input.getRepoRoot;
  getSettingsFileFn = input.getSettingsFile ?? (() => getRuntimeSettingsFilePath());
}

function resolveDaemonRoot(): string {
  return resolveDaemonPaths(loadDaemonConfig().ipc.socketPath).root;
}

function listActivityStateRoots(): Array<string | undefined> {
  try {
    return [undefined, resolveDaemonRoot()];
  } catch {
    return [undefined];
  }
}

function loadReadState(stateRoot: string | undefined, profile = getRuntimeScopeFn()): Set<string> {
  return loadProfileActivityReadState({
    repoRoot: getRepoRootFn(),
    stateRoot,
    profile,
  });
}

type ActivityEntryWithConversationLinks = ReturnType<typeof listProfileActivityEntries>[number]['entry'] & {
  relatedConversationIds?: string[];
};

type ActivityRecord = {
  stateRoot?: string;
  entry: ActivityEntryWithConversationLinks;
  read: boolean;
};

function attachActivityConversationLinks(
  profile: string,
  entry: ReturnType<typeof listProfileActivityEntries>[number]['entry'],
  stateRoot?: string,
): ActivityEntryWithConversationLinks {
  const relatedConversationIds = getActivityConversationLink({
    stateRoot,
    profile,
    activityId: entry.id,
  })?.relatedConversationIds;

  if (!relatedConversationIds || relatedConversationIds.length === 0) {
    return entry;
  }

  return {
    ...entry,
    relatedConversationIds,
  };
}

function listActivityRecordsForProfile(profile = getRuntimeScopeFn()): ActivityRecord[] {
  const records: ActivityRecord[] = [];

  for (const stateRoot of listActivityStateRoots()) {
    const readState = loadReadState(stateRoot, profile);
    const entries = listProfileActivityEntries({ repoRoot: getRepoRootFn(), stateRoot, profile });

    for (const { entry } of entries) {
      records.push({
        stateRoot,
        entry: attachActivityConversationLinks(profile, entry, stateRoot),
        read: readState.has(entry.id),
      });
    }
  }

  records.sort((left, right) => {
    const timestampCompare = right.entry.createdAt.localeCompare(left.entry.createdAt);
    if (timestampCompare !== 0) {
      return timestampCompare;
    }

    if (left.stateRoot !== right.stateRoot) {
      return left.stateRoot ? 1 : -1;
    }

    return right.entry.id.localeCompare(left.entry.id);
  });

  const deduped: ActivityRecord[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    if (seenIds.has(record.entry.id)) {
      continue;
    }

    seenIds.add(record.entry.id);
    deduped.push(record);
  }

  return deduped;
}

function listUnreadConversationActivityEntries(profile = getRuntimeScopeFn()) {
  return listActivityRecordsForProfile(profile)
    .filter((record) => !record.read && record.entry.relatedConversationIds && record.entry.relatedConversationIds.length > 0)
    .map((record) => ({
      id: record.entry.id,
      createdAt: record.entry.createdAt,
      relatedConversationIds: record.entry.relatedConversationIds ?? [],
    }));
}

function getSessionLastActivityAt(sessionFile: string, fallback: string): string {
  try {
    return new Date(statSync(sessionFile).mtimeMs).toISOString();
  } catch {
    return fallback;
  }
}

function toDeferredResumeSummary(record: {
  id: string;
  sessionFile: string;
  prompt: string;
  dueAt: string;
  createdAt: string;
  attempts: number;
  status: 'scheduled' | 'ready';
  readyAt?: string;
  kind: DeferredResumeSummary['kind'];
  title?: string;
  delivery: DeferredResumeSummary['delivery'];
}): DeferredResumeSummary {
  return {
    id: record.id,
    sessionFile: record.sessionFile,
    prompt: record.prompt,
    dueAt: record.dueAt,
    createdAt: record.createdAt,
    attempts: record.attempts,
    status: record.status,
    readyAt: record.readyAt,
    kind: record.kind,
    title: record.title,
    delivery: record.delivery,
  };
}

function listDeferredResumeSummariesBySessionFile(): Map<string, DeferredResumeSummary[]> {
  const summariesBySessionFile = new Map<string, DeferredResumeSummary[]>();

  for (const record of listDeferredResumeRecords(loadDeferredResumeState())) {
    const summaries = summariesBySessionFile.get(record.sessionFile);
    const summary = toDeferredResumeSummary(record);
    if (summaries) {
      summaries.push(summary);
      continue;
    }

    summariesBySessionFile.set(record.sessionFile, [summary]);
  }

  return summariesBySessionFile;
}

type LocalLiveSession = ReturnType<typeof getLocalLiveSessions>[number] & {
  session?: {
    sessionManager: unknown;
  };
};

interface SessionDetailRouteRemoteMirrorTelemetry {
  status: 'not-remote' | 'deferred';
  durationMs: number;
}

export interface PublicLiveSessionMeta {
  id: string;
  cwd: string;
  sessionFile: string;
  title?: string;
  isStreaming: boolean;
  hasStaleTurnState?: boolean;
  lastDurableRunState?: string;
}

export function toPublicLiveSessionMeta(session: {
  id: string;
  cwd: string;
  sessionFile: string;
  title?: string;
  isStreaming: boolean;
  hasStaleTurnState?: boolean;
  lastDurableRunState?: string;
}): PublicLiveSessionMeta {
  return {
    id: session.id,
    cwd: session.cwd,
    sessionFile: session.sessionFile,
    ...(typeof session.title === 'string' ? { title: session.title } : {}),
    isStreaming: session.isStreaming,
    ...(typeof session.hasStaleTurnState === 'boolean' ? { hasStaleTurnState: session.hasStaleTurnState } : {}),
    ...(typeof session.lastDurableRunState === 'string' ? { lastDurableRunState: session.lastDurableRunState } : {}),
  };
}

export function listAllLiveSessions(): LocalLiveSession[] {
  const local = getLocalLiveSessions();
  const localManagersById = new Map<string, unknown>(
    Array.from(liveSessionRegistry.entries()).map(([id, entry]) => [id, (entry as { session?: unknown }).session]),
  );
  return local.map((entry) => ({
    ...entry,
    session: localManagersById.get(entry.id) as { sessionManager: unknown } | undefined,
  }));
}

export function readLiveSession(conversationId: string): LocalLiveSession | null {
  const local = getLocalLiveSession(conversationId);
  if (!local) {
    return null;
  }
  const registryEntry = liveSessionRegistry.get(conversationId) as { session?: unknown } | undefined;
  return {
    ...local,
    session: registryEntry?.session as { sessionManager: unknown } | undefined,
  };
}
export function publishConversationSessionMetaChanged(...conversationIds: Array<string | null | undefined>): void {
  const seen = new Set<string>();

  for (const value of conversationIds) {
    const conversationId = typeof value === 'string' ? value.trim() : '';
    if (!conversationId || seen.has(conversationId)) {
      continue;
    }

    seen.add(conversationId);
    const liveEntry = readLiveSession(conversationId);
    const running = liveEntry ? isLiveEntryRunning(liveEntry) : undefined;
    publishAppEvent({ type: 'session_meta_changed', sessionId: conversationId, ...(running !== undefined ? { running } : {}) });
  }
}

export function decorateSessionsWithAttention<
  T extends {
    id: string;
    file: string;
    timestamp: string;
    messageCount: number;
  },
>(profile: string, sessions: T[], deferredResumesBySessionFile = listDeferredResumeSummariesBySessionFile()) {
  ensureConversationAttentionBaselines({
    profile,
    conversations: sessions.map((session) => ({
      conversationId: session.id,
      messageCount: session.messageCount,
    })),
  });

  const summaries = summarizeConversationAttention({
    profile,
    conversations: sessions.map((session) => ({
      conversationId: session.id,
      messageCount: session.messageCount,
      lastActivityAt: getSessionLastActivityAt(session.file, session.timestamp),
    })),
    unreadActivityEntries: listUnreadConversationActivityEntries(profile),
  });
  const summaryByConversationId = new Map(summaries.map((summary) => [summary.conversationId, summary]));

  return sessions.map((session) => {
    const summary = summaryByConversationId.get(session.id);
    const lastActivityAt = getSessionLastActivityAt(session.file, session.timestamp);

    return {
      ...session,
      lastActivityAt,
      needsAttention: summary?.needsAttention ?? false,
      attentionUpdatedAt: summary?.attentionUpdatedAt,
      attentionUnreadMessageCount: summary?.unreadMessageCount ?? 0,
      attentionUnreadActivityCount: summary?.unreadActivityCount ?? 0,
      attentionActivityIds: summary?.unreadActivityIds ?? [],
      deferredResumes: deferredResumesBySessionFile.get(session.file) ?? [],
      attachedContextDocs: readConversationContextDocs(session.id),
    };
  });
}

function buildSyntheticLiveSessionSnapshot(
  liveEntry: ReturnType<typeof listAllLiveSessions>[number],
  deferredResumesBySessionFile: ReturnType<typeof listDeferredResumeSummariesBySessionFile>,
) {
  const isRunning = isLiveEntryRunning(liveEntry);
  return {
    id: liveEntry.id,
    file: liveEntry.sessionFile,
    timestamp: new Date().toISOString(),
    cwd: liveEntry.cwd,
    workspaceCwd: null,
    cwdSlug: liveEntry.cwd.replace(/\//g, '-'),
    model: '',
    title: liveEntry.title || 'New Conversation',
    messageCount: 0,
    isRunning,
    isLive: true,
    lastActivityAt: new Date().toISOString(),
    needsAttention: false,
    attentionUnreadMessageCount: 0,
    attentionUnreadActivityCount: 0,
    attentionActivityIds: [],
    deferredResumes: deferredResumesBySessionFile.get(liveEntry.sessionFile) ?? [],
    attachedContextDocs: readConversationContextDocs(liveEntry.id),
  };
}

function isLiveEntryRunning(liveEntry: ReturnType<typeof listAllLiveSessions>[number] | null | undefined): boolean {
  // Prefer the pre-computed `running` field from listLiveSessions.
  // Fall back to re-deriving for callers (or mocks) that bypass listLiveSessions.
  const anyEntry = liveEntry as Record<string, unknown> | null | undefined;
  if (anyEntry && 'running' in anyEntry) {
    return Boolean(anyEntry.running);
  }
  return Boolean(
    liveEntry?.isStreaming ||
    liveEntry?.hasStaleTurnState ||
    liveEntry?.lastDurableRunState === 'running' ||
    liveEntry?.lastDurableRunState === 'recovering',
  );
}

export function listConversationSessionsSnapshot(options: { includeLive?: boolean; limit?: number } = {}) {
  const profile = getRuntimeScopeFn();
  const deferredResumesBySessionFile = listDeferredResumeSummariesBySessionFile();
  const catalogComplete = isConversationCatalogComplete();
  const catalogHasRows = hasConversationCatalogRows();
  const limit = Number.isSafeInteger(options.limit) && typeof options.limit === 'number' && options.limit > 0 ? options.limit : null;
  const storedSessions = catalogHasRows ? listConversationCatalogSessions({ ...(limit === null ? {} : { limit }) }) : listSessions();
  if (!catalogComplete && !catalogHasRows) {
    upsertConversationCatalogSessions(storedSessions);
    markConversationCatalogComplete();
  }
  const jsonl = decorateSessionsWithAttention(
    profile,
    limit === null || catalogHasRows ? storedSessions : storedSessions.slice(0, limit),
    deferredResumesBySessionFile,
  );
  const live = options.includeLive === false ? [] : listAllLiveSessions();
  const liveById = new Map(live.map((entry) => [entry.id, entry]));
  const jsonlIds = new Set(jsonl.map((session) => session.id));
  const syntheticLive = live
    .filter((entry) => !jsonlIds.has(entry.id))
    .map((entry) => buildSyntheticLiveSessionSnapshot(entry, deferredResumesBySessionFile));

  const sessions = [
    ...syntheticLive,
    ...jsonl.map((session) => {
      const liveEntry = liveById.get(session.id);
      const liveSnapshot = liveEntry
        ? {
            id: liveEntry.id,
            cwd: liveEntry.cwd,
            file: liveEntry.sessionFile,
            title: liveEntry.title,
            isStreaming: liveEntry.isStreaming,
            hasStaleTurnState: liveEntry.hasStaleTurnState,
            lastDurableRunState: liveEntry.lastDurableRunState,
            isRunning: liveEntry.running,
          }
        : null;
      return {
        ...session,
        ...(liveSnapshot ?? {}),
        title: liveSnapshot?.title || session.title,
        isRunning: isLiveEntryRunning(liveEntry),
        isLive: Boolean(liveEntry),
      };
    }),
  ];
  return limit === null ? sessions : sessions.slice(0, limit);
}

export function startConversationCatalogBackfillFromSource(): void {
  startConversationCatalogBackfill({ listSessions });
}

export function toggleConversationAttention(input: { profile: string; conversationId: string; read?: boolean }): boolean {
  const session = readConversationSessionMeta(input.conversationId);
  if (!session) {
    return false;
  }

  if (input.read === false) {
    markConversationAttentionUnread({
      profile: input.profile,
      conversationId: input.conversationId,
      messageCount: session.messageCount,
    });
  } else {
    markConversationAttentionRead({
      profile: input.profile,
      conversationId: input.conversationId,
      messageCount: session.messageCount,
    });
  }

  return true;
}

export function resolveConversationSessionFile(conversationId: string): string | undefined {
  return resolveConversationSessionFileWithTelemetry(conversationId).sessionFile;
}

export function resolveConversationSessionFileWithTelemetry(conversationId: string): {
  sessionFile: string | undefined;
  telemetry: {
    liveLookupMs: number;
    liveFileExistsMs: number;
    ensureMs: number;
    ensuredLiveLookupMs: number;
    ensuredFileExistsMs: number;
    snapshotLookupMs: number;
    source: 'live' | 'ensured-live' | 'catalog' | 'snapshot' | 'missing';
  };
} {
  const startedAtMs = performance.now();
  const liveEntry = readLiveSession(conversationId);
  const liveLookupAtMs = performance.now();
  const liveSessionFile = liveEntry?.sessionFile?.trim();
  const liveFileExists = Boolean(liveSessionFile && existsSync(liveSessionFile));
  const liveFileExistsAtMs = performance.now();
  if (liveSessionFile && liveFileExists) {
    return {
      sessionFile: liveSessionFile,
      telemetry: {
        liveLookupMs: liveLookupAtMs - startedAtMs,
        liveFileExistsMs: liveFileExistsAtMs - liveLookupAtMs,
        ensureMs: 0,
        ensuredLiveLookupMs: 0,
        ensuredFileExistsMs: 0,
        snapshotLookupMs: 0,
        source: 'live',
      },
    };
  }

  let ensureMs = 0;
  let ensuredLiveLookupMs = 0;
  let ensuredFileExistsMs = 0;
  if (liveEntry && 'session' in liveEntry && liveEntry.session?.sessionManager) {
    const ensureStartedAtMs = performance.now();
    ensureSessionFileExists(liveEntry.session.sessionManager as Parameters<typeof ensureSessionFileExists>[0]);
    const ensureEndedAtMs = performance.now();
    const ensuredLiveSessionFile = readLiveSession(conversationId)?.sessionFile?.trim();
    const ensuredLookupAtMs = performance.now();
    const ensuredFileExists = Boolean(ensuredLiveSessionFile && existsSync(ensuredLiveSessionFile));
    const ensuredFileExistsAtMs = performance.now();
    ensureMs = ensureEndedAtMs - ensureStartedAtMs;
    ensuredLiveLookupMs = ensuredLookupAtMs - ensureEndedAtMs;
    ensuredFileExistsMs = ensuredFileExistsAtMs - ensuredLookupAtMs;
    if (ensuredLiveSessionFile && ensuredFileExists) {
      return {
        sessionFile: ensuredLiveSessionFile,
        telemetry: {
          liveLookupMs: liveLookupAtMs - startedAtMs,
          liveFileExistsMs: liveFileExistsAtMs - liveLookupAtMs,
          ensureMs,
          ensuredLiveLookupMs,
          ensuredFileExistsMs,
          snapshotLookupMs: 0,
          source: 'ensured-live',
        },
      };
    }
  }

  const catalogStartedAtMs = performance.now();
  const catalogSessionFile = readConversationCatalogSession(conversationId)?.file?.trim();
  const catalogEndedAtMs = performance.now();
  if (catalogSessionFile) {
    return {
      sessionFile: catalogSessionFile,
      telemetry: {
        liveLookupMs: liveLookupAtMs - startedAtMs,
        liveFileExistsMs: liveFileExistsAtMs - liveLookupAtMs,
        ensureMs,
        ensuredLiveLookupMs,
        ensuredFileExistsMs,
        snapshotLookupMs: catalogEndedAtMs - catalogStartedAtMs,
        source: 'catalog',
      },
    };
  }

  const snapshotStartedAtMs = performance.now();
  const snapshotSessionFile = listConversationSessionsSnapshot()
    .find((session) => session.id === conversationId)
    ?.file?.trim();
  const snapshotEndedAtMs = performance.now();
  return {
    sessionFile: snapshotSessionFile || undefined,
    telemetry: {
      liveLookupMs: liveLookupAtMs - startedAtMs,
      liveFileExistsMs: liveFileExistsAtMs - liveLookupAtMs,
      ensureMs,
      ensuredLiveLookupMs,
      ensuredFileExistsMs,
      snapshotLookupMs: snapshotEndedAtMs - snapshotStartedAtMs,
      source: snapshotSessionFile ? 'snapshot' : 'missing',
    },
  };
}

export function readKnownConversationIdByFilePath(filePath: string): string | null {
  return readKnownSessionIdByFilePath(filePath);
}

export function readConversationSessionMetaByFile(filePath: string) {
  return readSessionMetaByFile(filePath);
}

export function appendConversationOffshootMetadata(input: Parameters<typeof appendSessionConversationOffshootMetadata>[0]): void {
  appendSessionConversationOffshootMetadata(input);
}

export function appendConversationOffshootDetachedMetadata(
  input: Parameters<typeof appendSessionConversationOffshootDetachedMetadata>[0],
): void {
  appendSessionConversationOffshootDetachedMetadata(input);
}

export function appendConversationWorkspaceMetadata(input: Parameters<typeof appendSessionConversationWorkspaceMetadata>[0]): void {
  appendSessionConversationWorkspaceMetadata(input);
}

export function appendStoredVisibleCustomMessage(input: Parameters<typeof appendSessionStoredVisibleCustomMessage>[0]): string | null {
  return appendSessionStoredVisibleCustomMessage(input);
}

export function renameStoredConversation(conversationId: string, nextName: string): ReturnType<typeof renameStoredConversationSession> {
  return renameStoredConversationSession(conversationId, nextName);
}

export function buildAppendOnlyConversationDetailResponse(
  input: Parameters<typeof buildSessionAppendOnlySessionDetailResponse>[0],
): ReturnType<typeof buildSessionAppendOnlySessionDetailResponse> {
  return buildSessionAppendOnlySessionDetailResponse(input);
}

export function readConversationSessionImageAsset(sessionId: string, blockId: string, imageIndex?: number): SessionImageAsset | null {
  return typeof imageIndex === 'number' ? readSessionImageAsset(sessionId, blockId, imageIndex) : readSessionImageAsset(sessionId, blockId);
}

export function readConversationSessionSignature(conversationId: string): string | null {
  return readConversationSessionSignatureWithTelemetry(conversationId).signature;
}

export function readConversationSessionSignatureWithTelemetry(conversationId: string): {
  signature: string | null;
  telemetry: ReturnType<typeof resolveConversationSessionFileWithTelemetry>['telemetry'] & {
    signatureFileExistsMs: number;
    signatureStatMs: number;
  };
} {
  const resolved = resolveConversationSessionFileWithTelemetry(conversationId);
  const sessionFile = resolved.sessionFile;
  const existsStartedAtMs = performance.now();
  const fileExists = Boolean(sessionFile && existsSync(sessionFile));
  const existsEndedAtMs = performance.now();
  if (!sessionFile || !fileExists) {
    return {
      signature: null,
      telemetry: {
        ...resolved.telemetry,
        signatureFileExistsMs: existsEndedAtMs - existsStartedAtMs,
        signatureStatMs: 0,
      },
    };
  }

  try {
    const statStartedAtMs = performance.now();
    const stats = statSync(sessionFile);
    const statEndedAtMs = performance.now();
    return {
      signature: `${stats.size}:${stats.mtimeMs}`,
      telemetry: {
        ...resolved.telemetry,
        signatureFileExistsMs: existsEndedAtMs - existsStartedAtMs,
        signatureStatMs: statEndedAtMs - statStartedAtMs,
      },
    };
  } catch {
    return {
      signature: null,
      telemetry: {
        ...resolved.telemetry,
        signatureFileExistsMs: existsEndedAtMs - existsStartedAtMs,
        signatureStatMs: 0,
      },
    };
  }
}

export function readConversationSessionMeta(conversationId: string) {
  const profile = getRuntimeScopeFn();
  const deferredResumesBySessionFile = listDeferredResumeSummariesBySessionFile();
  const storedSession = readConversationCatalogSession(conversationId) ?? readSessionMeta(conversationId);
  const decoratedSession = storedSession
    ? (decorateSessionsWithAttention(profile, [storedSession], deferredResumesBySessionFile)[0] ?? null)
    : null;
  const liveEntry = readLiveSession(conversationId);

  if (!decoratedSession) {
    return liveEntry ? buildSyntheticLiveSessionSnapshot(liveEntry, deferredResumesBySessionFile) : null;
  }

  return {
    ...decoratedSession,
    title: liveEntry?.title || decoratedSession.title,
    isRunning: isLiveEntryRunning(liveEntry),
    isLive: Boolean(liveEntry),
  };
}

type SessionDetailRouteReadResult = ReturnType<typeof readSessionBlocksWithTelemetry>;

const MAX_SESSION_DETAIL_TAIL_BLOCKS = 10000;

function normalizeSessionDetailTailBlocks(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? Math.min(MAX_SESSION_DETAIL_TAIL_BLOCKS, value)
    : undefined;
}

export function parseTailBlocksQuery(rawTailBlocks: unknown): number | undefined {
  const candidate = Array.isArray(rawTailBlocks) ? rawTailBlocks[0] : rawTailBlocks;
  const parsed =
    typeof candidate === 'number'
      ? candidate
      : typeof candidate === 'string' && /^\d+$/.test(candidate.trim())
        ? Number.parseInt(candidate.trim(), 10)
        : undefined;

  return Number.isSafeInteger(parsed) && (parsed as number) > 0 ? Math.min(MAX_SESSION_DETAIL_TAIL_BLOCKS, parsed as number) : undefined;
}

export function readConversationSessionDetail(input: { conversationId: string; tailBlocks?: number }): SessionDetailRouteReadResult {
  const tailBlocks = normalizeSessionDetailTailBlocks(input.tailBlocks);
  const liveSessionFile = readLiveSession(input.conversationId)?.sessionFile?.trim();
  if (liveSessionFile && existsSync(liveSessionFile)) {
    const sessionRead = readSessionBlocksByFileWithTelemetry(liveSessionFile, tailBlocks ? { tailBlocks } : undefined);
    if (tailBlocks && sessionRead.detail && sessionRead.detail.totalBlocks > 0 && sessionRead.detail.blocks.length === 0) {
      return readSessionBlocksByFileWithTelemetry(liveSessionFile);
    }
    return sessionRead;
  }
  const sessionRead = readSessionBlocksWithTelemetry(input.conversationId, tailBlocks ? { tailBlocks } : undefined);
  if (tailBlocks && sessionRead.detail && sessionRead.detail.totalBlocks > 0 && sessionRead.detail.blocks.length === 0) {
    return readSessionBlocksWithTelemetry(input.conversationId);
  }
  return sessionRead;
}

export function readConversationSessionEntryBlocks(input: { conversationId: string; entryIds: string[] }) {
  return readSessionEntryBlocks(input.conversationId, input.entryIds);
}

export async function readSessionDetailForRoute(input: { conversationId: string; profile: string; tailBlocks?: number }): Promise<{
  sessionRead: SessionDetailRouteReadResult;
  remoteMirror: SessionDetailRouteRemoteMirrorTelemetry;
}> {
  const sessionRead = readConversationSessionDetail(input);

  return {
    sessionRead,
    remoteMirror: sessionRead.detail ? { status: 'deferred', durationMs: 0 } : { status: 'not-remote', durationMs: 0 },
  };
}

export function startConversationReadModelBackfill(options: { delayMs?: number; limit?: number; tailBlocks?: number } = {}): void {
  if (readModelBackfillStarted) return;
  readModelBackfillStarted = true;

  const delayMs =
    Number.isSafeInteger(options.delayMs) && typeof options.delayMs === 'number' && options.delayMs >= 0
      ? options.delayMs
      : DEFAULT_READ_MODEL_BACKFILL_DELAY_MS;
  const limit =
    Number.isSafeInteger(options.limit) && typeof options.limit === 'number' && options.limit > 0 ? Math.min(options.limit, 500) : 100;
  const tailBlocks =
    Number.isSafeInteger(options.tailBlocks) && typeof options.tailBlocks === 'number' && options.tailBlocks > 0
      ? Math.min(options.tailBlocks, 250)
      : 80;

  readModelBackfillTimer = setTimeout(() => {
    readModelBackfillTimer = null;
    try {
      scheduleConversationSearchIndexing();
      for (const meta of listConversationSessionsSnapshot({ includeLive: false }).slice(0, limit)) {
        readConversationSessionDetail({ conversationId: meta.id, tailBlocks });
      }
    } catch {
      // Best-effort delayed reconciliation. Request paths still have targeted fallback.
    }
  }, delayMs);
  readModelBackfillTimer.unref?.();
}

export function resetConversationReadModelBackfillForTests(): void {
  if (readModelBackfillTimer) {
    clearTimeout(readModelBackfillTimer);
    readModelBackfillTimer = null;
  }
  readModelBackfillStarted = false;
}

export async function readConversationModelPreferenceStateById(
  conversationId: string,
): Promise<{ currentModel: string; currentThinkingLevel: string; currentServiceTier: string; hasExplicitServiceTier: boolean } | null> {
  const sessionFile = resolveConversationSessionFile(conversationId);
  if (!sessionFile || !existsSync(sessionFile)) {
    return null;
  }

  const sessionManager = SessionManager.open(sessionFile);
  const availableModels = await getAvailableModelObjects();
  return resolveConversationModelPreferenceState(
    readConversationModelPreferenceSnapshot(sessionManager),
    readSavedModelPreferences(getSettingsFileFn(), availableModels),
    availableModels,
  );
}
