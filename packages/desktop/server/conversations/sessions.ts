/**
 * Pi session JSONL reader → MessageBlock converter
 *
 * Session file format (JSONL):
 *   line 1: { type:'session', id, timestamp, cwd }
 *   line 2: { type:'model_change', modelId, ... }
 *   ...
 *   rest:   { type:'message', id, parentId, timestamp, message: { role, content } }
 *
 * Roles:
 *   user         → content: [{type:'text', text}|{type:'image', data, mimeType}]
 *   assistant    → content: [{type:'thinking', thinking}, {type:'toolCall', id, name, arguments}, {type:'text', text}]
 *   toolResult   → toolCallId, toolName, content: [{type:'text', text}|{type:'image', data, mimeType}]
 */

import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  type Dirent,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { type SessionEntry, SessionManager } from '@earendil-works/pi-coding-agent';
import { getDurableSessionsDir, getPiAgentRuntimeDir } from '@neon-pilot/core';

import { persistAppTelemetryEvent } from '../traces/appTelemetry.js';
import {
  deleteConversationCatalogSessions,
  readConversationAssetCache,
  readConversationDetailCache,
  upsertConversationCatalogSession,
  writeConversationAssetCache,
  writeConversationDetailCache,
} from './conversationCatalog.js';
import { buildAppendOnlySessionDetailResponse as buildAppendOnlySessionDetailResponseValue } from './sessionAppendOnly.js';
import { decorateSessionAssetUrls as decorateSessionAssetUrlsForBlocks } from './sessionAssetUrls.js';
import { getAssistantErrorDisplayMessage as getAssistantErrorDisplayMessageValue } from './sessionAssistantErrors.js';
import { rebaseDisplayBlockIds as rebaseDisplayBlockIdsForOffset } from './sessionBlockIds.js';
import {
  readExecutionWrappers as readExecutionWrappersValue,
  resolveCompactionSummarySupplement as resolveCompactionSummarySupplementValue,
} from './sessionCompactionSummary.js';
import { normalizeContent, normalizeTimestamp } from './sessionContent.js';
import { readSessionContextUsageFromEntries, type SessionContextUsageSnapshot } from './sessionContextUsage.js';
import { buildCustomMessageSessionEntry, buildCustomSessionEntry, serializeSessionJsonLine } from './sessionCustomEntrySerialization.js';
import {
  type ConversationOffshootKind,
  type ConversationOffshootMetadata,
  type ConversationWorkspaceMetadata,
  normalizeOptionalPath,
  readConversationOffshootMetadata as readConversationOffshootMetadataFromCustomEntry,
  readConversationWorkspaceMetadata as readConversationWorkspaceMetadataFromCustomEntry,
} from './sessionCustomMetadata.js';
import {
  buildSessionDetailCacheKey as buildSessionDetailCacheKeyValue,
  normalizeTailBlockRequest as normalizeTailBlockRequestValue,
  trimSessionDetailCache as trimSessionDetailCacheMap,
} from './sessionDetailCache.js';
import { buildPromptCacheMissMetadata, buildSessionDetailTelemetry } from './sessionDetailTelemetry.js';
import {
  buildDisplayMessageEntryFromRawLine as buildDisplayMessageEntryFromRawLineValue,
  type SessionDisplayRawLine,
} from './sessionDisplayEntry.js';
import { computeFileContentHash, computeFilePrefixHash, getFileSignature, parseSignatureSize } from './sessionFileHashes.js';
import {
  listSessionFiles as listSessionFilesFromDir,
  resolveSessionFileCwdSlug as resolveSessionFileCwdSlugFromDir,
  slugToCwd,
} from './sessionFiles.js';
import {
  deferHeavyBlockContent as deferHeavyBlockContentValue,
  findLastBlockIndex as findLastBlockIndexValue,
  resolveTailBlockLimit as resolveTailBlockLimitValue,
} from './sessionHeavyContent.js';
import { readCurrentSessionLeafIdFromFile, readSessionIdFromSessionRecordFile } from './sessionIdentity.js';
import { buildSessionImageAssets, imageMimeType, imageSrc } from './sessionImages.js';
import { isToolResultOutputError, presentToolResultOutput, presentTranscriptErrorMessage } from './toolResultPresentation.js';
import {
  attachTranscriptRenderItems,
  buildTranscriptRenderItemsFromDisplayBlocks,
  type TranscriptRenderItem,
} from './transcriptRenderItems.js';
export type { SessionImageAsset } from './sessionImages.js';
import { buildSessionIndexKey, shouldReloadPersistentSessionIndex } from './sessionIndexKey.js';
import {
  buildPersistentSessionIndexDocument as buildPersistentSessionIndexDocumentFromCache,
  loadPersistentSessionIndexEntry as loadPersistentSessionIndexEntryFromValue,
  serializePersistentSessionIndex,
} from './sessionIndexPersistence.js';
import { didSessionIndexJsonChange, shouldPersistSessionIndex } from './sessionIndexPersistenceDecision.js';
import { enqueueSessionIndexWrite } from './sessionIndexWriteQueue.js';
import {
  CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE,
  CONVERSATION_WORKSPACE_CHANGE_CUSTOM_TYPE,
  isInjectedContextMessage as isInjectedContextMessageValue,
  PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE,
} from './sessionInjectedContext.js';
import { isRawDisplayLineType, parseJsonLine as parseJsonLineValue } from './sessionJsonLines.js';
import { resolveKnownSessionIdFromCache } from './sessionKnownIdResolution.js';
export { GOAL_STATE_CUSTOM_TYPE, readGoalFromEntries, type ThreadGoal } from './sessionGoalState.js';
import { readFileLinesReverse as readFileLinesReverseValue } from './reverseFileLines.js';
import {
  sanitizeSessionLineForSearch as sanitizeSessionLineForSearchValue,
  sanitizeSessionLineForSummary as sanitizeSessionLineForSummaryValue,
} from './sessionLineSanitizers.js';
import { extractSearchTextFromMessage as extractSearchTextFromMessageValue } from './sessionMessageSearchText.js';
import { detectSessionModification, shouldComputeSessionPrefixHash } from './sessionModificationDetection.js';
import { normalizeSessionName } from './sessionNaming.js';
import { buildConversationOffshootMetadataData, CONVERSATION_OFFSHOOT_METADATA_CUSTOM_TYPE } from './sessionOffshootMetadataEntry.js';
import { buildParentBacklinkContent, resolveParentBacklinkLabel } from './sessionParentBacklinkEntry.js';
import { mergeResolvedParentSessionMetadata } from './sessionParentMetadata.js';
import {
  resolveSessionsDir as resolveSessionsDirValue,
  resolveSessionsIndexFile as resolveSessionsIndexFileValue,
} from './sessionPaths.js';
import {
  formatRelatedConversationPointersText,
  formatRelatedThreadsSummaryText,
  resolveRelatedConversationPointersDetail,
  resolveRelatedThreadsSummaryDetail,
} from './sessionRelatedContext.js';
import { buildMissingSessionRenameError, buildReloadSessionAfterRenameError, resolveStoredSessionRename } from './sessionRename.js';
import { buildSessionSearchTextCacheKey, normalizeSessionSearchMaxCharacters } from './sessionSearchCacheKey.js';
import { shouldUseSessionSearchFallback } from './sessionSearchFallback.js';
import { appendSessionSearchSegment, buildSessionSearchTextFromEntries } from './sessionSearchText.js';
import {
  buildSuppressedTranscriptError,
  collectSuppressedTranscriptEntryIds,
  shouldSuppressTranscriptDescendants,
} from './sessionSuppression.js';
import { extractTitleFromMessage as extractTitleFromMessageValue } from './sessionTitleExtraction.js';
import {
  decorateSessionParentIds as decorateSessionParentIdsForMetas,
  readSourceRunIdFromSessionFilePath as readSourceRunIdFromSessionPath,
  resolveSessionIdByFile as resolveSessionIdByFileFromMap,
} from './sessionTopologyMetadata.js';
import { extractUserContent as extractUserContentValue } from './sessionUserContent.js';
import { buildWorkspaceChangeContent, resolveWorkspaceChangeLabels } from './sessionWorkspaceChangeEntry.js';
import {
  isNeutralChatWorkspaceCwd as isNeutralChatWorkspaceCwdForRuntime,
  type LegacyToolWorkspaceMetadata,
  readLegacyToolWorkspaceMetadata as readLegacyToolWorkspaceMetadataFromMessage,
} from './sessionWorkspaceMetadata.js';

const DEFAULT_SESSIONS_DIR = getDurableSessionsDir();
export const SESSIONS_DIR = DEFAULT_SESSIONS_DIR;
const DEFAULT_SESSIONS_INDEX_FILE = join(getPiAgentRuntimeDir(), 'session-meta-index.json');
export const SESSIONS_INDEX_FILE = DEFAULT_SESSIONS_INDEX_FILE;

// ── Raw JSONL types ────────────────────────────────────────────────────────────

interface RawSessionRecord {
  type: 'session';
  id: string;
  timestamp: string;
  cwd: string;
  version?: number;
  parentSession?: string;
}

interface RawModelChange {
  type: 'model_change';
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  provider?: string;
  modelId?: string;
}

interface RawThinkingLevelChange {
  type: 'thinking_level_change';
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  thinkingLevel?: string;
}

interface RawSessionInfo {
  type: 'session_info';
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  name?: string;
}

interface RawCustomEntry {
  type: 'custom';
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  customType?: string;
  data?: unknown;
}

interface RawContentBlock {
  type: 'text' | 'thinking' | 'toolCall' | 'image';
  text?: string;
  thinking?: string;
  // toolCall
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  // image
  data?: string;
  mimeType?: string;
  mediaType?: string;
}

type RawMessageContent = string | RawContentBlock[];

interface RawMessage {
  type: 'message';
  id: string;
  parentId: string | null;
  timestamp: string;
  message: {
    role: 'user' | 'assistant' | 'toolResult';
    content: RawMessageContent;
    toolCallId?: string;
    toolName?: string;
    details?: unknown;
    stopReason?: string;
    errorMessage?: string;
  };
}

interface RawCustomMessage {
  type: 'custom_message';
  id: string;
  parentId: string | null;
  timestamp: string;
  customType?: string;
  content: RawMessageContent;
  details?: unknown;
  display?: boolean;
}

interface RawCompaction {
  type: 'compaction';
  id: string;
  parentId: string | null;
  timestamp: string | number;
  summary: string;
  firstKeptEntryId?: string;
  tokensBefore: number;
  details?: unknown;
}

interface RawBranchSummary {
  type: 'branch_summary';
  id: string;
  parentId: string | null;
  timestamp: string | number;
  summary: string;
  fromId: string;
}

type RawLine =
  | RawSessionRecord
  | RawModelChange
  | RawThinkingLevelChange
  | RawSessionInfo
  | RawCustomEntry
  | RawMessage
  | RawCustomMessage
  | RawCompaction
  | RawBranchSummary;
type RawDisplayLine = RawMessage | RawCustomMessage | RawCompaction | RawBranchSummary;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

interface TailScanDisplayEntrySummary {
  kind: 'display';
  id: string;
  parentId: string | null;
  visibleBlockCount: number;
  suppressedRoot: boolean;
  displayEntry: DisplayMessageEntryLike;
}

interface TailScanLineageSummary {
  kind: 'lineage';
  id: string;
  parentId: string | null;
}

type TailScanEntrySummary = TailScanDisplayEntrySummary | TailScanLineageSummary;

// ── Public types ───────────────────────────────────────────────────────────────

export interface SessionMeta {
  [key: string]: unknown;
  id: string;
  file: string; // absolute path
  timestamp: string;
  cwd: string;
  workspaceCwd?: string | null;
  cwdSlug: string; // directory name without leading/trailing --
  model: string;
  title: string; // session display name or derived fallback title
  messageCount: number;
  isRunning?: boolean;
  isLive?: boolean;
  lastActivityAt?: string;
  parentSessionFile?: string;
  parentSessionId?: string;
  parentMessageId?: string;
  offshootKind?: ConversationOffshootKind;
  offshootTimestamp?: string;
  sourceRunId?: string;
}

export const CONVERSATION_WORKSPACE_METADATA_CUSTOM_TYPE = 'personal_agent_conversation_workspace';
export { CONVERSATION_WORKSPACE_CHANGE_CUSTOM_TYPE } from './sessionInjectedContext.js';

export interface SessionDetail {
  meta: SessionMeta;
  blocks: DisplayBlock[];
  blockOffset: number;
  totalBlocks: number;
  contextUsage: SessionContextUsageSnapshot | null;
  signature?: string;
  renderItems?: TranscriptRenderItem[];
}

export interface SessionDetailAppendOnlyResponse {
  appendOnly: true;
  meta: SessionMeta;
  blocks: DisplayBlock[];
  blockOffset: number;
  totalBlocks: number;
  contextUsage: SessionContextUsageSnapshot | null;
  signature: string | null;
}

export interface SessionDetailReadTelemetry {
  cache: 'hit' | 'miss';
  loader: 'fast-tail' | 'full';
  durationMs: number;
  requestedTailBlocks?: number;
  totalBlocks: number;
  blockOffset: number;
  contextUsageIncluded: boolean;
  phases?: Record<string, number>;
  /** True when a cache miss was caused by file modification (not just append). */
  modificationDetected?: boolean;
}

interface DisplayImage {
  alt: string;
  src?: string;
  mimeType?: string;
  caption?: string;
  deferred?: boolean;
}

export type DisplayBlock =
  | { type: 'user'; id: string; ts: string; text: string; images?: DisplayImage[] }
  | { type: 'text'; id: string; ts: string; text: string }
  | { type: 'context'; id: string; ts: string; text: string; customType?: string; details?: unknown }
  | { type: 'summary'; id: string; ts: string; kind: 'compaction' | 'branch' | 'related'; title: string; text: string; detail?: string }
  | { type: 'thinking'; id: string; ts: string; text: string }
  | {
      type: 'tool_use';
      id: string;
      ts: string;
      tool: string;
      input: Record<string, unknown>;
      output: string;
      durationMs?: number;
      status?: 'running' | 'ok' | 'error';
      toolCallId: string;
      details?: unknown;
      outputDeferred?: boolean;
    }
  | {
      type: 'image';
      id: string;
      ts: string;
      alt: string;
      src?: string;
      mimeType?: string;
      width?: number;
      height?: number;
      caption?: string;
      deferred?: boolean;
    }
  | { type: 'error'; id: string; ts: string; tool?: string; message: string };

type DisplayBlockSourceMetadata = { sourceEntryIds?: string[] };

function attachDisplayBlockSourceEntryIds<T extends DisplayBlock>(block: T, sourceEntryIds: string[]): T {
  Object.defineProperty(block, 'sourceEntryIds', {
    value: sourceEntryIds,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return block;
}

interface CachedSessionMeta {
  signature: string;
  meta: SessionMeta;
}

interface CachedSessionDetail {
  signature: string;
  contentHash: string;
  detail: SessionDetail;
}

interface CachedSessionSearchText {
  signature: string;
  text: string;
}

interface PersistentSessionIndexEntry {
  filePath: string;
  signature: string;
  meta: SessionMeta;
}

interface PersistentSessionIndexDocument {
  version: 1;
  sessionsDir: string;
  entries: PersistentSessionIndexEntry[];
}

const MAX_SESSION_META_CACHE_ENTRIES = 500;
const MAX_SESSION_SEARCH_TEXT_CACHE_ENTRIES = 500;

/**
 * Simple LRU map that evicts the oldest entry when `maxSize` is exceeded.
 * Uses insertion-order semantics of Map — get() re-inserts to mark as recently used.
 */
class LRUMap<K, V> extends Map<K, V> {
  constructor(private readonly maxSize: number) {
    super();
  }

  get(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      // Promote to most-recently-used by re-inserting
      super.delete(key);
      super.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): this {
    if (super.has(key)) {
      super.delete(key);
    }
    super.set(key, value);
    if (this.size > this.maxSize) {
      const firstKey = this.keys().next().value;
      if (firstKey !== undefined) {
        super.delete(firstKey);
      }
    }
    return this;
  }
}

const sessionMetaCache = new LRUMap<string, CachedSessionMeta>(MAX_SESSION_META_CACHE_ENTRIES);
const sessionDetailCache = new Map<string, CachedSessionDetail>();
const sessionSearchTextCache = new LRUMap<string, CachedSessionSearchText>(MAX_SESSION_SEARCH_TEXT_CACHE_ENTRIES);
let sessionFileById = new Map<string, string>();
let loadedPersistentIndexKey: string | null = null;
let persistedIndexJson: string | null = null;
let lastFastTailScanStats: {
  linesVisited: number;
  displayLinesRetained: number;
  scanMs: number;
  entryBuildMs: number;
  blockBuildMs: number;
  assetDecorateMs: number;
  topologyMs: number;
  deferMs: number;
} | null = null;
// Set to true whenever the session cache is mutated so persistSessionIndex() can
// skip the expensive JSON build-and-compare on unchanged scans.
let sessionCacheDirty = false;
let pendingIndexWrite: Promise<void> | null = null;

/** Flush any pending async session index write. Use in tests only. */
export async function flushSessionIndexWrite(): Promise<void> {
  if (pendingIndexWrite) await pendingIndexWrite;
}

const MAX_SESSION_DETAIL_CACHE_ENTRIES = 24;

function elapsedMsSince(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function resolveSessionsDir(sessionsDirOverride?: string): string {
  if (sessionsDirOverride) return sessionsDirOverride;
  return resolveSessionsDirValue({ envSessionsDir: process.env.PA_SESSIONS_DIR, defaultSessionsDir: DEFAULT_SESSIONS_DIR });
}

function resolveSessionsIndexFile(sessionsDirOverride?: string): string {
  if (sessionsDirOverride) return join(dirname(sessionsDirOverride), 'session-meta-index.json');
  return resolveSessionsIndexFileValue({
    envSessionsIndexFile: process.env.PA_SESSIONS_INDEX_FILE,
    envSessionsDir: process.env.PA_SESSIONS_DIR,
    defaultSessionsIndexFile: DEFAULT_SESSIONS_INDEX_FILE,
  });
}

function parseJsonLine(rawLine: string): RawLine | null {
  return parseJsonLineValue<RawLine>(rawLine);
}

function isRawDisplayLine(line: RawLine): line is RawDisplayLine {
  return isRawDisplayLineType(line) && (line.type !== 'custom_message' || typeof line.customType === 'string');
}

function sanitizeSessionLineForSummary(rawLine: string): string {
  return sanitizeSessionLineForSummaryValue(rawLine);
}

function sanitizeSessionLineForSearch(rawLine: string): string {
  return sanitizeSessionLineForSearchValue(rawLine);
}

function readFileLinesReverse(filePath: string, visit: (line: string) => boolean | void): void {
  readFileLinesReverseValue(filePath, visit);
}

function readFileLinesForward(filePath: string, visit: (line: string) => boolean | void): void {
  const fd = openSync(filePath, 'r');
  const buffer = Buffer.alloc(64 * 1024);
  const decoder = new TextDecoder();
  let pending = '';

  try {
    let bytesRead: number;
    while ((bytesRead = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      pending += decoder.decode(buffer.subarray(0, bytesRead), { stream: true });

      let lineStart = 0;
      for (;;) {
        const newlineIndex = pending.indexOf('\n', lineStart);
        if (newlineIndex === -1) {
          pending = pending.slice(lineStart);
          break;
        }

        const line = pending.slice(lineStart, newlineIndex).replace(/\r$/, '');
        if (visit(line) === false) {
          return;
        }
        lineStart = newlineIndex + 1;
      }
    }

    pending += decoder.decode();
    if (pending && visit(pending.replace(/\r$/, '')) === false) {
      return;
    }
  } finally {
    closeSync(fd);
  }
}

function buildDisplayMessageEntryFromRawLine(line: RawDisplayLine): DisplayMessageEntryLike {
  return buildDisplayMessageEntryFromRawLineValue(line as SessionDisplayRawLine) as DisplayMessageEntryLike;
}

function summarizeTailScanEntry(rawLine: string): TailScanEntrySummary | null {
  const sanitizedLine = sanitizeSessionLineForSummary(rawLine);
  const parsed = parseJsonLine(sanitizedLine) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const id = 'id' in parsed && typeof parsed.id === 'string' ? parsed.id : null;
  const parentId = 'parentId' in parsed && (typeof parsed.parentId === 'string' || parsed.parentId === null) ? parsed.parentId : undefined;

  if (!id || parentId === undefined) {
    return null;
  }

  if (!isRawDisplayLine(parsed as RawLine)) {
    return {
      kind: 'lineage',
      id,
      parentId,
    };
  }

  const displayEntry = buildDisplayMessageEntryFromRawLine(parsed as RawDisplayLine);
  const visibleBlockCount = buildDisplayBlocksFromEntries([displayEntry]).length;
  const suppressedRoot = shouldSuppressTranscriptDescendants(displayEntry.message);

  return {
    kind: 'display',
    id,
    parentId,
    visibleBlockCount,
    suppressedRoot,
    displayEntry,
  };
}

function tryReadSessionTailBlocksByFile(
  filePath: string,
  meta: SessionMeta,
  tailBlocks: number,
  options: { exactCounts?: boolean } = {},
): SessionDetail | null {
  if (!options.exactCounts) {
    return tryReadApproximateSessionTailBlocksByFile(filePath, meta, tailBlocks);
  }

  const branchDisplayEntries: TailScanDisplayEntrySummary[] = [];
  let pendingEntryId: string | null | undefined;
  let scannedVisibleBlockCount = 0;

  try {
    readFileLinesReverse(filePath, (rawLine) => {
      if (!rawLine.trim()) {
        return;
      }

      const summary = summarizeTailScanEntry(rawLine);
      if (!summary) {
        return;
      }

      if (pendingEntryId === undefined) {
        pendingEntryId = summary.id;
      }

      if (summary.id !== pendingEntryId) {
        return;
      }

      pendingEntryId = summary.parentId;

      if (summary.kind === 'display') {
        branchDisplayEntries.push(summary);
        scannedVisibleBlockCount += summary.visibleBlockCount;
      }

      return pendingEntryId !== null && (options.exactCounts || scannedVisibleBlockCount < tailBlocks);
    });
  } catch {
    return null;
  }

  const chronologicalDisplayEntries = branchDisplayEntries.slice().reverse();
  const suppressedEntryIds = collectSuppressedTranscriptEntryIds(chronologicalDisplayEntries.map((entry) => entry.displayEntry));
  const visibleEntries = chronologicalDisplayEntries.filter((entry) => !suppressedEntryIds.has(entry.id));
  const visibleScannedBlocks = visibleEntries.reduce((sum, entry) => sum + entry.visibleBlockCount, 0);
  const totalBlocks = options.exactCounts ? visibleScannedBlocks : Math.max(meta.messageCount, visibleScannedBlocks);
  const tailBlockLimit = Math.min(tailBlocks, totalBlocks);

  const retained: TailScanDisplayEntrySummary[] = [];
  let retainedVisibleBlockCount = 0;

  for (let index = visibleEntries.length - 1; index >= 0; index -= 1) {
    const entry = visibleEntries[index];
    if (!entry) {
      continue;
    }

    retained.unshift(entry);
    retainedVisibleBlockCount += entry.visibleBlockCount;

    if (retainedVisibleBlockCount >= tailBlockLimit) {
      break;
    }
  }

  const droppedVisibleBlockCount = Math.max(0, totalBlocks - retainedVisibleBlockCount);
  const retainedIds = new Set(retained.map((entry) => entry.id));
  const retainedRawLines = new Map<string, string>();

  try {
    readFileLinesReverse(filePath, (rawLine) => {
      if (!rawLine.trim()) {
        return retainedIds.size > 0;
      }

      const sanitizedLine = sanitizeSessionLineForSummary(rawLine);
      const parsed = parseJsonLine(sanitizedLine) as unknown;
      if (!parsed || typeof parsed !== 'object' || !('id' in parsed && typeof parsed.id === 'string')) {
        return retainedIds.size > 0;
      }

      const id = parsed.id;
      if (!retainedIds.has(id)) {
        return retainedIds.size > 0;
      }

      retainedRawLines.set(id, rawLine);
      retainedIds.delete(id);
      return retainedIds.size > 0;
    });
  } catch {
    return null;
  }

  const detailEntries = retained
    .map((entry) => retainedRawLines.get(entry.id))
    .filter((line): line is string => typeof line === 'string')
    .map((line) => parseJsonLine(line))
    .filter((entry): entry is RawDisplayLine => entry !== null && isRawDisplayLine(entry))
    .map((entry) => buildDisplayMessageEntryFromRawLine(entry));

  const rebasedBlocks = rebaseDisplayBlockIds(buildDisplayBlocksFromEntries(detailEntries), droppedVisibleBlockCount);
  const blocksWithAssets = decorateSessionAssetUrls(rebasedBlocks, meta.id);
  const allMetas = scanSessionMetas();
  const blocksWithTopology = addParentConversationBacklink(
    mergeTopologyBlocks(enrichSubagentToolBlocks(blocksWithAssets, meta, allMetas), meta, allMetas),
    meta,
    allMetas,
  );
  const topologyBlockCount = Math.max(0, blocksWithTopology.length - blocksWithAssets.length);
  const totalBlocksWithTopology = totalBlocks + topologyBlockCount;
  const blocks = deferHeavyBlockContent(blocksWithTopology, droppedVisibleBlockCount, totalBlocksWithTopology);

  return {
    meta,
    blocks,
    blockOffset: droppedVisibleBlockCount,
    totalBlocks: totalBlocksWithTopology,
    contextUsage: null,
  };
}

function tryReadApproximateSessionTailBlocksByFile(filePath: string, meta: SessionMeta, tailBlocks: number): SessionDetail | null {
  const retainedRawLines: string[] = [];
  let pendingEntryId: string | null | undefined;
  let linesVisited = 0;

  const scanStartedAt = process.hrtime.bigint();
  try {
    readFileLinesReverse(filePath, (rawLine) => {
      const trimmedLine = rawLine.trim();
      if (!trimmedLine) {
        return;
      }

      linesVisited += 1;
      const sanitizedLine = sanitizeSessionLineForSummary(trimmedLine);
      const parsed = parseJsonLine(sanitizedLine) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      const id = 'id' in parsed && typeof parsed.id === 'string' ? parsed.id : null;
      const parentId =
        'parentId' in parsed && (typeof parsed.parentId === 'string' || parsed.parentId === null) ? parsed.parentId : undefined;
      if (!id || parentId === undefined) {
        return;
      }

      if (pendingEntryId === undefined) {
        pendingEntryId = id;
      }

      if (id !== pendingEntryId) {
        return;
      }

      pendingEntryId = parentId;
      if (isRawDisplayLine(parsed as RawLine)) {
        retainedRawLines.push(rawLine);
      }

      return pendingEntryId !== null && retainedRawLines.length < tailBlocks;
    });
  } catch {
    return null;
  }
  const scanMs = elapsedMsSince(scanStartedAt);

  const entryBuildStartedAt = process.hrtime.bigint();
  const chronologicalEntries = retainedRawLines
    .slice()
    .reverse()
    .map((line) => parseJsonLine(line))
    .filter((entry): entry is RawDisplayLine => entry !== null && isRawDisplayLine(entry))
    .map((entry) => buildDisplayMessageEntryFromRawLine(entry));
  const suppressedEntryIds = collectSuppressedTranscriptEntryIds(chronologicalEntries);
  const visibleEntries = chronologicalEntries.filter((entry) => !suppressedEntryIds.has(entry.id));
  const entryBuildMs = elapsedMsSince(entryBuildStartedAt);

  const blockBuildStartedAt = process.hrtime.bigint();
  const allTailBlocks = buildDisplayBlocksFromEntries(visibleEntries);
  const totalBlocks = Math.max(meta.messageCount, allTailBlocks.length);
  const tailBlockLimit = Math.min(tailBlocks, totalBlocks);
  const retainedBlocks = allTailBlocks.length > tailBlockLimit ? allTailBlocks.slice(allTailBlocks.length - tailBlockLimit) : allTailBlocks;
  const droppedVisibleBlockCount = Math.max(0, totalBlocks - retainedBlocks.length);
  const rebasedBlocks = rebaseDisplayBlockIds(retainedBlocks, droppedVisibleBlockCount);
  const blockBuildMs = elapsedMsSince(blockBuildStartedAt);

  const assetDecorateStartedAt = process.hrtime.bigint();
  const blocksWithAssets = decorateSessionAssetUrls(rebasedBlocks, meta.id);
  const assetDecorateMs = elapsedMsSince(assetDecorateStartedAt);

  const topologyStartedAt = process.hrtime.bigint();
  const blocksWithTopology = addFastTailParentBacklink(blocksWithAssets, meta);
  const topologyBlockCount = Math.max(0, blocksWithTopology.length - blocksWithAssets.length);
  const totalBlocksWithTopology = totalBlocks + topologyBlockCount;
  const topologyMs = elapsedMsSince(topologyStartedAt);

  const deferStartedAt = process.hrtime.bigint();
  const blocks = deferHeavyBlockContent(blocksWithTopology, droppedVisibleBlockCount, totalBlocksWithTopology);
  const deferMs = elapsedMsSince(deferStartedAt);
  lastFastTailScanStats = {
    linesVisited,
    displayLinesRetained: retainedRawLines.length,
    scanMs,
    entryBuildMs,
    blockBuildMs,
    assetDecorateMs,
    topologyMs,
    deferMs,
  };

  return {
    meta,
    blocks,
    blockOffset: droppedVisibleBlockCount,
    totalBlocks: totalBlocksWithTopology,
    contextUsage: null,
  };
}

export interface DisplayMessageEntryLike {
  id: string;
  parentId?: string | null;
  timestamp: string | number;
  message: {
    role: string;
    content?: unknown;
    toolCallId?: string;
    toolName?: string;
    details?: unknown;
    stopReason?: string;
    errorMessage?: string;
    summary?: string;
    tokensBefore?: number;
    fromId?: string;
    customType?: string;
    display?: boolean;
    command?: string;
    output?: string;
    exitCode?: number;
    cancelled?: boolean;
    truncated?: boolean;
    fullOutputPath?: string;
    excludeFromContext?: boolean;
  };
}

function extractUserContent(content: unknown): { text: string; images: DisplayImage[] } {
  return extractUserContentValue(content) as { text: string; images: DisplayImage[] };
}

function readExecutionWrappers(details: unknown): Array<{ id: string; label?: string }> {
  return readExecutionWrappersValue(details);
}

function resolveCompactionSummarySupplement(details: unknown): string | undefined {
  return resolveCompactionSummarySupplementValue(details);
}

export function getAssistantErrorDisplayMessage(message: { stopReason?: string; errorMessage?: string }): string | null {
  return getAssistantErrorDisplayMessageValue(message);
}

const RELATED_THREADS_CONTEXT_CUSTOM_TYPE = 'related_threads_context';
const RELATED_CONVERSATION_POINTERS_CUSTOM_TYPE = 'related_conversation_pointers';
function isInjectedContextMessage(message: DisplayMessageEntryLike['message']): boolean {
  return isInjectedContextMessageValue(message);
}

function isExtensionTranscriptBlockMessage(message: DisplayMessageEntryLike['message']): boolean {
  if (message.role !== 'custom' || typeof message.customType !== 'string' || !message.customType.trim()) return false;
  const details = isRecord(message.details) ? message.details : null;
  return typeof details?.extensionBlockId === 'string' && details.extensionBlockId.trim().length > 0;
}

function extractSearchTextFromMessage(message: { role: string; content?: unknown }): string {
  return extractSearchTextFromMessageValue(message);
}

function buildSessionSearchText(entries: SessionEntry[], maxCharacters: number): string {
  return buildSessionSearchTextFromEntries(entries, maxCharacters, (message) =>
    extractSearchTextFromMessage(message as { role: string; content?: unknown }),
  );
}

function buildDisplayBlocksInternal(messages: DisplayMessageEntryLike[], entryAnchorIndexById?: Map<string, number>): DisplayBlock[] {
  const blocks: DisplayBlock[] = [];
  const toolCallIndex = new Map<string, number>();
  const suppressedTranscriptEntryIds = collectSuppressedTranscriptEntryIds(messages);
  if (suppressedTranscriptEntryIds.size > 0) {
    throw buildSuppressedTranscriptError(suppressedTranscriptEntryIds.size);
  }

  for (const [messageIndex, msg] of messages.entries()) {
    const { role, content, toolCallId, toolName, details, summary } = msg.message;
    const ts = normalizeTimestamp(msg.timestamp);
    const contentBlocks = normalizeContent(content);
    const errorMessage = getAssistantErrorDisplayMessage(msg.message);
    const baseId = msg.id || `msg-${messageIndex}`;
    if (suppressedTranscriptEntryIds.has(baseId)) {
      continue;
    }
    let anchorRecorded = false;

    const recordAnchor = () => {
      if (!entryAnchorIndexById || anchorRecorded) {
        return;
      }
      entryAnchorIndexById.set(baseId, blocks.length);
      anchorRecorded = true;
    };
    const pushBlock = (block: DisplayBlock) => {
      blocks.push(attachDisplayBlockSourceEntryIds(block, [baseId]));
    };

    if (role === 'compactionSummary' || role === 'branchSummary') {
      const normalizedSummary = summary?.trim();
      if (normalizedSummary) {
        const detail = role === 'compactionSummary' ? resolveCompactionSummarySupplement(details) : undefined;
        recordAnchor();
        pushBlock({
          type: 'summary',
          id: baseId,
          ts,
          kind: role === 'compactionSummary' ? 'compaction' : 'branch',
          title: role === 'compactionSummary' ? 'Compaction summary' : 'Branch summary',
          text: normalizedSummary,
          ...(detail ? { detail } : {}),
        });
      }
      continue;
    }

    if (role === 'user') {
      const { text, images } = extractUserContent(content);
      if (text || images.length > 0) {
        recordAnchor();
        pushBlock({
          type: 'user',
          id: baseId,
          ts,
          text,
          ...(images.length > 0 ? { images } : {}),
        });
      }
      continue;
    }

    if (role === 'custom' && msg.message.customType === RELATED_THREADS_CONTEXT_CUSTOM_TYPE) {
      const relatedSummaryText = formatRelatedThreadsSummaryText(
        contentBlocks
          .flatMap((block) =>
            block.type === 'text' && typeof block.text === 'string' && block.text.trim().length > 0 ? [block.text.trim()] : [],
          )
          .join('\n\n'),
      );
      if (relatedSummaryText) {
        recordAnchor();
        pushBlock({
          type: 'summary',
          id: baseId,
          ts,
          kind: 'related',
          title: 'Reused thread summaries',
          text: relatedSummaryText,
          detail: resolveRelatedThreadsSummaryDetail(relatedSummaryText),
        });
      }
      continue;
    }

    if (role === 'custom' && msg.message.customType === RELATED_CONVERSATION_POINTERS_CUSTOM_TYPE) {
      const pointerText = formatRelatedConversationPointersText(
        contentBlocks
          .flatMap((block) =>
            block.type === 'text' && typeof block.text === 'string' && block.text.trim().length > 0 ? [block.text.trim()] : [],
          )
          .join('\n\n'),
      );
      if (pointerText) {
        recordAnchor();
        pushBlock({
          type: 'summary',
          id: baseId,
          ts,
          kind: 'related',
          title: 'Related conversation pointers',
          text: pointerText,
          detail: resolveRelatedConversationPointersDetail(pointerText),
        });
      }
      continue;
    }

    if (isInjectedContextMessage(msg.message)) {
      for (const block of contentBlocks) {
        if (block.type === 'text' && block.text?.trim()) {
          recordAnchor();
          pushBlock({
            type: 'context',
            id: `${baseId}-m${blocks.length}`,
            ts,
            text: block.text,
            ...(msg.message.customType ? { customType: msg.message.customType } : {}),
            ...(msg.message.details !== undefined ? { details: msg.message.details } : {}),
          });
          continue;
        }

        if (block.type === 'image') {
          const src = imageSrc(block);
          const mimeType = imageMimeType(block);
          if (!src || !mimeType) {
            continue;
          }

          recordAnchor();
          pushBlock({
            type: 'image',
            id: `${baseId}-i${blocks.length}`,
            ts,
            alt: 'Injected context image',
            src,
            mimeType,
            ...(typeof block.name === 'string' && block.name.trim().length > 0 ? { caption: block.name.trim() } : {}),
          });
        }
      }
      continue;
    }

    if (isExtensionTranscriptBlockMessage(msg.message)) {
      for (const block of contentBlocks) {
        if (block.type === 'text' && block.text?.trim()) {
          recordAnchor();
          pushBlock({
            type: 'context',
            id: `${baseId}-m${blocks.length}`,
            ts,
            text: block.text,
            customType: msg.message.customType,
            ...(msg.message.details !== undefined ? { details: msg.message.details } : {}),
          });
          continue;
        }

        if (block.type === 'image') {
          const src = imageSrc(block);
          const mimeType = imageMimeType(block);
          if (!src || !mimeType) {
            continue;
          }

          recordAnchor();
          pushBlock({
            type: 'image',
            id: `${baseId}-i${blocks.length}`,
            ts,
            alt: 'Extension transcript image',
            src,
            mimeType,
            ...(typeof block.name === 'string' && block.name.trim().length > 0 ? { caption: block.name.trim() } : {}),
          });
        }
      }
      continue;
    }

    if (role === 'custom' && msg.message.display === false) {
      for (const block of contentBlocks) {
        if (block.type === 'text' && block.text?.trim()) {
          recordAnchor();
          pushBlock({
            type: 'context',
            id: `${baseId}-m${blocks.length}`,
            ts,
            text: block.text,
            ...(msg.message.customType ? { customType: msg.message.customType } : {}),
            ...(msg.message.details !== undefined ? { details: msg.message.details } : {}),
          });
          continue;
        }

        if (block.type === 'image') {
          const src = imageSrc(block);
          const mimeType = imageMimeType(block);
          if (!src || !mimeType) {
            continue;
          }

          recordAnchor();
          pushBlock({
            type: 'image',
            id: `${baseId}-i${blocks.length}`,
            ts,
            alt: 'Custom transcript image',
            src,
            mimeType,
            ...(typeof block.name === 'string' && block.name.trim().length > 0 ? { caption: block.name.trim() } : {}),
          });
        }
      }
      continue;
    }

    if (role === 'bashExecution') {
      const commandText = typeof msg.message.command === 'string' ? msg.message.command : '';
      const outputText = typeof msg.message.output === 'string' ? msg.message.output : '';
      const outputDisplayLimit = 8000;
      const displayOutput = outputText.slice(0, outputDisplayLimit);
      const outputWasDisplayTruncated = outputText.length > displayOutput.length;
      const executionWrappers = readExecutionWrappers(msg.message.details);
      const bashDetails = {
        displayMode: 'terminal',
        ...(executionWrappers.length > 0 ? { executionWrappers } : {}),
        ...(typeof msg.message.exitCode === 'number' ? { exitCode: msg.message.exitCode } : {}),
        ...(msg.message.cancelled === true ? { cancelled: true } : {}),
        ...(msg.message.truncated === true || outputWasDisplayTruncated ? { truncated: true } : {}),
        ...(typeof msg.message.fullOutputPath === 'string' && msg.message.fullOutputPath.trim().length > 0
          ? { fullOutputPath: msg.message.fullOutputPath }
          : {}),
        ...(msg.message.excludeFromContext === true ? { excludeFromContext: true } : {}),
      };

      recordAnchor();
      pushBlock({
        type: 'tool_use',
        id: `${baseId}-c${blocks.length}`,
        ts,
        tool: 'bash',
        input: { command: commandText },
        output: displayOutput,
        toolCallId: baseId,
        ...(Object.keys(bashDetails).length > 0 ? { details: bashDetails } : {}),
      });
      continue;
    }

    if (role === 'assistant' || role === 'custom') {
      for (const block of contentBlocks) {
        if (role === 'assistant' && block.type === 'thinking' && block.thinking?.trim()) {
          recordAnchor();
          pushBlock({ type: 'thinking', id: `${baseId}-t${blocks.length}`, ts, text: block.thinking });
          continue;
        }

        if (block.type === 'text' && block.text?.trim()) {
          recordAnchor();
          pushBlock({ type: 'text', id: `${baseId}-x${blocks.length}`, ts, text: block.text });
          continue;
        }

        if (role === 'assistant' && block.type === 'toolCall' && block.id) {
          recordAnchor();
          const idx = blocks.length;
          toolCallIndex.set(block.id, idx);
          pushBlock({
            type: 'tool_use',
            id: `${baseId}-c${blocks.length}`,
            ts,
            tool: block.name ?? 'unknown',
            input: block.arguments ?? {},
            output: '',
            toolCallId: block.id,
          });
        }
      }

      if (role === 'assistant' && errorMessage) {
        recordAnchor();
        pushBlock({
          type: 'error',
          id: `${baseId}-e${blocks.length}`,
          ts,
          message: presentTranscriptErrorMessage(errorMessage),
        });
      }
      continue;
    }

    if (role === 'toolResult' && toolCallId) {
      const idx = toolCallIndex.get(toolCallId);
      const rawResultText = contentBlocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n')
        .slice(0, 8000);
      const isError = (msg.message as { isError?: unknown }).isError === true || isToolResultOutputError(rawResultText);
      const resultText = presentToolResultOutput({ text: rawResultText, isError });

      if (idx !== undefined) {
        const existing = blocks[idx] as DisplayBlock & { type: 'tool_use' };
        const startMs = new Date(existing.ts).getTime();
        const endMs = new Date(ts).getTime();
        const duration = endMs > startMs ? endMs - startMs : undefined;
        const imageCount = contentBlocks.filter((block) => block.type === 'image' && imageSrc(block) && imageMimeType(block)).length;
        const nextBlock = {
          ...existing,
          output: resultText,
          ...(isError ? { status: 'error' as const } : {}),
          durationMs: duration,
          details: imageCount > 0 ? { ...(details && typeof details === 'object' ? details : {}), imageCount } : details,
        };
        blocks[idx] = attachDisplayBlockSourceEntryIds(nextBlock, [
          ...new Set([...((existing as DisplayBlock & DisplayBlockSourceMetadata).sourceEntryIds ?? []), baseId]),
        ]);
      } else if (resultText) {
        recordAnchor();
        pushBlock({
          type: 'tool_use',
          id: `${baseId}-c${blocks.length}`,
          ts,
          tool: toolName ?? 'unknown',
          input: {},
          output: resultText,
          toolCallId,
          ...(isError ? { status: 'error' as const } : {}),
          ...(details ? { details } : {}),
        });
      }

      let resultImageIndex = 0;
      const resultImages = contentBlocks
        .filter((block) => block.type === 'image')
        .flatMap((block) => {
          const src = imageSrc(block);
          const mimeType = imageMimeType(block);
          if (!src || !mimeType) {
            return [];
          }

          const imageIndex = resultImageIndex;
          resultImageIndex += 1;
          return [
            {
              type: 'image' as const,
              id: `${baseId}-i${imageIndex}`,
              ts,
              alt: toolName ? `${toolName} image result` : 'Tool image result',
              src,
              mimeType,
              caption: toolName,
            },
          ];
        });
      const normalizedToolName = toolName ?? 'unknown';
      const hasOriginalToolCall = idx !== undefined;
      if (
        !hasOriginalToolCall ||
        (normalizedToolName !== 'image' && normalizedToolName !== 'browser_screenshot' && normalizedToolName !== 'screenshot')
      ) {
        blocks.push(...resultImages.map((block) => attachDisplayBlockSourceEntryIds(block as DisplayBlock, [baseId])));
      }
    }
  }

  return blocks;
}

export function buildDisplayBlocksFromEntries(messages: DisplayMessageEntryLike[]): DisplayBlock[] {
  return buildDisplayBlocksInternal(messages);
}

function rebaseDisplayBlockIds(blocks: DisplayBlock[], blockOffset: number): DisplayBlock[] {
  return rebaseDisplayBlockIdsForOffset(blocks, blockOffset) as DisplayBlock[];
}

function decorateSessionAssetUrls(blocks: DisplayBlock[], sessionId: string): DisplayBlock[] {
  return decorateSessionAssetUrlsForBlocks(blocks, sessionId) as DisplayBlock[];
}

function buildChildConversationTopologyBlocks(
  meta: SessionMeta,
  existingBlocks: DisplayBlock[] = [],
  allMetas: SessionMeta[] = scanSessionMetas(),
): DisplayBlock[] {
  const existingChildIds = new Set(
    existingBlocks
      .map((block) =>
        block.type === 'context' && block.customType === CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE
          ? block.text.match(/^Conversation:\s*(\S+)$/m)?.[1]?.trim()
          : undefined,
      )
      .filter((id): id is string => Boolean(id)),
  );
  const children = allMetas
    .filter((child) => child.id !== meta.id && (child.parentSessionId === meta.id || child.parentSessionFile === meta.file))
    .filter((child) => !existingChildIds.has(child.id))
    .filter((child) => {
      const kind = child.offshootKind ?? (child.sourceRunId ? 'subagent' : 'side');
      return kind === 'fork' || kind === 'rewind' || kind === 'duplicate';
    })
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return children.map((child) => {
    const kind = child.offshootKind ?? (child.sourceRunId ? 'subagent' : 'side');
    const label = kind === 'subagent' ? 'Subagent' : kind.charAt(0).toUpperCase() + kind.slice(1);
    const sourceRun = child.sourceRunId ? `\nSource run: ${child.sourceRunId}` : '';
    const sourceMessage = child.parentMessageId ? `\nSource message: ${child.parentMessageId}` : '';
    const cwd = child.cwd && child.cwd !== meta.cwd ? `\nWorking directory: ${child.cwd}` : '';
    return {
      type: 'context',
      id: `topology-child-${child.id}`,
      ts: child.timestamp,
      customType: CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE,
      text: `${label} conversation created: ${child.title || child.id}\nOpen: /conversations/${child.id}\nConversation: ${child.id}${sourceMessage}${sourceRun}${cwd}`,
    } satisfies DisplayBlock;
  });
}

function enrichSubagentToolBlocks(blocks: DisplayBlock[], meta: SessionMeta, allMetas: SessionMeta[] = scanSessionMetas()): DisplayBlock[] {
  const subagentChildren = allMetas.filter(
    (child) =>
      child.id !== meta.id &&
      (child.parentSessionId === meta.id || child.parentSessionFile === meta.file) &&
      (child.offshootKind === 'subagent' || Boolean(child.sourceRunId)),
  );
  if (subagentChildren.length === 0) return blocks;

  return blocks.map((block) => {
    if (block.type !== 'tool_use' || block.tool !== 'subagent') return block;
    const serialized = `${JSON.stringify(block.input)}\n${block.output}\n${JSON.stringify(block.details ?? {})}`;
    const child = subagentChildren.find((candidate) => candidate.sourceRunId && serialized.includes(candidate.sourceRunId));
    if (!child) return block;
    return {
      ...block,
      details: {
        ...(block.details && typeof block.details === 'object' ? (block.details as Record<string, unknown>) : {}),
        childConversationId: child.id,
        branchKind: child.offshootKind ?? 'subagent',
        branchTitle: child.title,
      },
    };
  });
}

function mergeTopologyBlocks(blocks: DisplayBlock[], meta: SessionMeta, allMetas: SessionMeta[] = scanSessionMetas()): DisplayBlock[] {
  const children = allMetas
    .filter((child) => child.id !== meta.id && (child.parentSessionId === meta.id || child.parentSessionFile === meta.file))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const childById = new Map(children.map((child) => [child.id, child] as const));
  const topologyBlocks = buildChildConversationTopologyBlocks(meta, blocks, allMetas);
  if (topologyBlocks.length === 0) {
    return blocks;
  }

  const remainingTopologyBlocks = [...topologyBlocks];
  const merged: DisplayBlock[] = [];
  for (const block of blocks) {
    merged.push(block);
    const anchoredForBlock = remainingTopologyBlocks.filter((topologyBlock) => {
      const parentMessageId = childById.get(topologyBlock.id.replace(/^topology-child-/, ''))?.parentMessageId;
      if (!parentMessageId) return false;
      // parentMessageId is the raw entry ID (e.g. "abc123"); block.id may have a type suffix ("abc123-u0").
      return block.id === parentMessageId || block.id.startsWith(`${parentMessageId}-`);
    });
    for (const anchored of anchoredForBlock) {
      merged.push(anchored);
      remainingTopologyBlocks.splice(remainingTopologyBlocks.indexOf(anchored), 1);
    }
  }

  return [...merged, ...remainingTopologyBlocks];
}

function addParentConversationBacklink(
  blocks: DisplayBlock[],
  meta: SessionMeta,
  allMetas: SessionMeta[] = scanSessionMetas(),
): DisplayBlock[] {
  const existingBacklink = blocks.find(
    (block) => block.type === 'context' && block.customType === PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE,
  );
  const kind = meta.offshootKind ?? (meta.sourceRunId ? 'subagent' : 'side');
  if (existingBacklink && kind !== 'fork' && kind !== 'rewind' && kind !== 'duplicate') {
    return blocks;
  }

  const parentId = meta.parentSessionId?.trim() || (meta.parentSessionFile ? resolveSessionIdByFile(meta.parentSessionFile) : undefined);
  if (!parentId) return blocks;
  const label = kind === 'subagent' ? 'Subagent' : kind.charAt(0).toUpperCase() + kind.slice(1);
  const parentMeta = allMetas.find((m) => m.id === parentId);
  const parentTitle = parentMeta?.title?.trim() || parentId;
  const backlink: DisplayBlock =
    existingBacklink ??
    ({
      type: 'context',
      id: `topology-parent-${meta.id}`,
      ts: meta.timestamp,
      customType: PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE,
      text: `${label} conversation from parent: ${parentTitle}\nOpen parent: /conversations/${parentId}${meta.parentMessageId ? `\nSource message: ${meta.parentMessageId}` : ''}`,
    } satisfies DisplayBlock);
  const contentBlocks = existingBacklink ? blocks.filter((block) => block !== existingBacklink) : blocks;
  // For forks and rewinds, place the backlink immediately after the source entry
  // when the child still contains that copied history. Appending it to the end makes
  // the marker drift downward as the child conversation grows or reloads.
  if (kind === 'fork' || kind === 'rewind' || kind === 'duplicate') {
    const parentMessageId = meta.parentMessageId?.trim();
    if (parentMessageId) {
      const anchorIndex = contentBlocks.findIndex((block) => block.id === parentMessageId || block.id.startsWith(`${parentMessageId}-`));
      if (anchorIndex >= 0) {
        return [...contentBlocks.slice(0, anchorIndex + 1), backlink, ...contentBlocks.slice(anchorIndex + 1)];
      }
    }

    // Rewinds fork the child from the entry *before* parentMessageId, so the
    // source entry named in metadata may not exist in the copied child history.
    // In that case, anchor the backlink at the end of the inherited snapshot
    // instead of appending it after all new child work. Offshoot metadata is
    // written before the child resumes, so its timestamp separates copied parent
    // history from child-only turns for the normal fork/rewind flow.
    const offshootTimestamp = meta.offshootTimestamp ?? meta.timestamp;
    const inheritedSnapshotEndIndex = findLastBlockIndex(contentBlocks, (block) => block.ts <= offshootTimestamp);
    if (inheritedSnapshotEndIndex >= 0) {
      return [...contentBlocks.slice(0, inheritedSnapshotEndIndex + 1), backlink, ...contentBlocks.slice(inheritedSnapshotEndIndex + 1)];
    }

    return [...contentBlocks, backlink];
  }
  return [backlink, ...contentBlocks];
}

function addFastTailParentBacklink(blocks: DisplayBlock[], meta: SessionMeta): DisplayBlock[] {
  if (!meta.parentSessionId?.trim() && !meta.parentSessionFile) {
    return blocks;
  }

  // Fast-tail reads are the route-critical path for opening a conversation.
  // Avoid full child topology enrichment here, but keep the current child's own
  // parent marker visible so fork/duplicate/rewind routes do not hydrate without
  // their navigation affordance.
  return addParentConversationBacklink(blocks, meta);
}

function findLastBlockIndex(blocks: DisplayBlock[], predicate: (block: DisplayBlock) => boolean): number {
  return findLastBlockIndexValue(blocks, predicate);
}

const RECENT_HEAVY_CONTENT_BLOCK_COUNT = 80;
const DEFERRED_TOOL_OUTPUT_PREVIEW_LENGTH = 600;
const MAX_INITIAL_SESSION_DETAIL_BLOCK_BYTES = 768 * 1024;

function deferHeavyBlockContent(blocks: DisplayBlock[], blockOffset: number, totalBlocks: number): DisplayBlock[] {
  const deferredBlocks = deferHeavyBlockContentValue({
    blocks,
    blockOffset,
    totalBlocks,
    recentHeavyContentBlockCount: RECENT_HEAVY_CONTENT_BLOCK_COUNT,
    deferredToolOutputPreviewLength: DEFERRED_TOOL_OUTPUT_PREVIEW_LENGTH,
  }) as DisplayBlock[];
  return deferSessionDetailBlocksToPayloadBudget(deferredBlocks, MAX_INITIAL_SESSION_DETAIL_BLOCK_BYTES);
}

function estimateBlockPayloadBytes(block: DisplayBlock): number {
  return Buffer.byteLength(JSON.stringify(block), 'utf8');
}

function deferSessionDetailBlocksToPayloadBudget(blocks: DisplayBlock[], maxBlockBytes: number): DisplayBlock[] {
  let totalBytes = blocks.reduce((sum, block) => sum + estimateBlockPayloadBytes(block), 0);
  if (totalBytes <= maxBlockBytes) {
    return blocks;
  }

  const candidates = blocks
    .map((block, index) => ({ block, index, bytes: estimateBlockPayloadBytes(block) }))
    .filter(({ block }) =>
      Boolean(
        (block.type === 'tool_use' &&
          typeof block.output === 'string' &&
          block.output.trim().length > DEFERRED_TOOL_OUTPUT_PREVIEW_LENGTH) ||
        (block.type === 'user' && Array.isArray(block.images) && block.images.some((image) => image.src)) ||
        (block.type === 'image' && block.src),
      ),
    )
    .sort((left, right) => right.bytes - left.bytes);

  if (candidates.length === 0) {
    return blocks;
  }

  const nextBlocks = blocks.slice();
  for (const candidate of candidates) {
    if (totalBytes <= maxBlockBytes) {
      break;
    }

    const beforeBytes = estimateBlockPayloadBytes(nextBlocks[candidate.index]!);
    const deferred = deferHeavyBlockContentValue({
      blocks: [nextBlocks[candidate.index]!],
      blockOffset: 0,
      totalBlocks: 1,
      recentHeavyContentBlockCount: 0,
      deferredToolOutputPreviewLength: DEFERRED_TOOL_OUTPUT_PREVIEW_LENGTH,
    })[0] as DisplayBlock;
    nextBlocks[candidate.index] = deferred;
    totalBytes -= Math.max(0, beforeBytes - estimateBlockPayloadBytes(deferred));
  }

  return nextBlocks;
}

function extractTitleFromMessage(message: RawMessage['message']): string | null {
  return extractTitleFromMessageValue(message);
}

function stripOffshootTitlePrefix(title: string, kind?: ConversationOffshootKind): string {
  const normalizedKind = kind?.trim().toLowerCase();
  if (normalizedKind !== 'fork' && normalizedKind !== 'rewind' && normalizedKind !== 'duplicate') {
    return title;
  }

  const withoutPrefix = title.replace(/^(?:fork|rewind|duplicate)\s*:\s*/i, '').trim();
  return withoutPrefix || title;
}

function isNeutralChatWorkspaceCwd(cwd: string): boolean {
  return isNeutralChatWorkspaceCwdForRuntime({ cwd, runtimeDir: getPiAgentRuntimeDir() });
}

function readConversationWorkspaceMetadata(line: RawCustomEntry): ConversationWorkspaceMetadata | null {
  return readConversationWorkspaceMetadataFromCustomEntry(line, CONVERSATION_WORKSPACE_METADATA_CUSTOM_TYPE);
}

function readConversationOffshootMetadata(line: RawCustomEntry): ConversationOffshootMetadata | null {
  return readConversationOffshootMetadataFromCustomEntry(line, CONVERSATION_OFFSHOOT_METADATA_CUSTOM_TYPE);
}

export function appendConversationOffshootDetachedMetadata(input: { sessionFile: string }): void {
  let leafId: string | null = null;
  try {
    const manager = SessionManager.open(input.sessionFile);
    leafId = manager.getLeafId() ?? null;
  } catch {
    // Non-fatal: metadata still works for session-list projection without a parent id.
  }

  appendFileSync(
    input.sessionFile,
    serializeSessionJsonLine(
      buildCustomSessionEntry({
        id: randomUUID(),
        parentId: leafId,
        timestamp: new Date().toISOString(),
        customType: CONVERSATION_OFFSHOOT_METADATA_CUSTOM_TYPE,
        data: buildConversationOffshootMetadataData({ detached: true }),
      }),
    ),
    'utf-8',
  );
  clearSessionCaches();
}

export function appendConversationOffshootMetadata(input: {
  sessionFile: string;
  kind: ConversationOffshootKind;
  parentSessionFile?: string;
  parentSessionId?: string;
  parentMessageId?: string;
  sourceRunId?: string;
}): void {
  // Use the current leaf entry as parentId so the SDK's getBranch() / buildSessionContext()
  // traversal continues to work correctly after this entry is appended.
  // Without this, parentId: null makes the offshoot entry the new "root" leaf,
  // causing getBranch() to return only this single entry and the transcript to appear empty.
  const leafId = readCurrentSessionLeafId(input.sessionFile);

  appendFileSync(
    input.sessionFile,
    serializeSessionJsonLine(
      buildCustomSessionEntry({
        id: randomUUID(),
        parentId: leafId,
        timestamp: new Date().toISOString(),
        customType: CONVERSATION_OFFSHOOT_METADATA_CUSTOM_TYPE,
        data: buildConversationOffshootMetadataData({
          kind: input.kind,
          parentSessionFile: input.parentSessionFile,
          parentSessionId: input.parentSessionId,
          parentMessageId: input.parentMessageId,
          sourceRunId: input.sourceRunId,
        }),
      }),
    ),
    'utf-8',
  );
  clearSessionCaches();
}

export function appendParentConversationBacklinkEntry(input: {
  sessionFile: string;
  kind: ConversationOffshootKind;
  parentSessionFile?: string;
  parentSessionId?: string;
  parentMessageId?: string;
}): void {
  const parentId = input.parentSessionId?.trim() || (input.parentSessionFile ? resolveSessionIdByFile(input.parentSessionFile) : undefined);
  if (!parentId) return;

  const parentMeta = input.parentSessionFile ? readSessionMetaByFile(input.parentSessionFile) : readSessionMeta(parentId);
  const parentTitle = parentMeta?.title?.trim() || parentId;
  const label = resolveParentBacklinkLabel(input.kind);
  const leafId = readCurrentSessionLeafId(input.sessionFile);

  appendFileSync(
    input.sessionFile,
    serializeSessionJsonLine(
      buildCustomMessageSessionEntry({
        id: randomUUID(),
        parentId: leafId,
        timestamp: new Date().toISOString(),
        customType: PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE,
        content: buildParentBacklinkContent({ label, parentTitle, parentId, parentMessageId: input.parentMessageId }),
      }),
    ),
    'utf-8',
  );
  clearSessionCaches();
}

function readLegacyToolWorkspaceMetadata(line: RawMessage): LegacyToolWorkspaceMetadata | null {
  return readLegacyToolWorkspaceMetadataFromMessage(line.message);
}

function readCurrentSessionLeafId(filePath: string): string | null {
  return readCurrentSessionLeafIdFromFile(filePath, parseJsonLine);
}

const HIDDEN_CUSTOM_BRANCH_TYPES = new Set(['child_conversation_topology', 'parent_conversation_backlink']);

function isHiddenCustomBranchEntry(entry: SessionEntry | Record<string, unknown> | undefined): boolean {
  if (!entry || entry.type !== 'custom_message') return false;
  const customType = typeof entry.customType === 'string' ? entry.customType : '';
  return entry.display !== true || HIDDEN_CUSTOM_BRANCH_TYPES.has(customType);
}

function readCurrentVisibleSessionLeafId(filePath: string): string | null {
  try {
    const entries = new Map<string, Record<string, unknown>>();
    for (const rawLine of readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
      if (!rawLine.trim()) continue;
      const parsed = parseJsonLine(rawLine);
      if (!parsed || parsed.type === 'session') continue;
      const id = typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : '';
      if (id) entries.set(id, parsed as unknown as Record<string, unknown>);
    }
    let leafId = readCurrentSessionLeafId(filePath);
    while (leafId) {
      const entry = entries.get(leafId);
      if (!isHiddenCustomBranchEntry(entry)) return leafId;
      leafId = typeof entry?.parentId === 'string' && entry.parentId.trim() ? entry.parentId.trim() : null;
    }
    return null;
  } catch {
    return readCurrentSessionLeafId(filePath);
  }
}

function readSessionEntryPreview(filePath: string, entryId: string): string | null {
  try {
    const entry = SessionManager.open(filePath).getEntry(entryId);
    if (!entry || entry.type !== 'message' || !('message' in entry)) return null;
    if (!('content' in entry.message)) return null;
    const content = entry.message.content;
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .map((part) => (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? part.text : ''))
              .join(' ')
          : '';
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.length > 48 ? `${normalized.slice(0, 45).trimEnd()}…` : normalized;
  } catch {
    return null;
  }
}

interface AppendConversationCompactionSummaryInput {
  sessionFile: string;
  summary: string;
  tokensBefore: number;
  firstKeptEntryId?: string;
  details?: unknown;
}

export function appendConversationCompactionSummary(input: AppendConversationCompactionSummaryInput): void {
  const sessionFile = input.sessionFile.trim();
  if (!sessionFile) {
    return;
  }

  const summary = input.summary.trim();
  if (!summary) {
    return;
  }

  const parentId = readCurrentSessionLeafId(sessionFile);
  const firstKeptEntryId =
    typeof input.firstKeptEntryId === 'string' && input.firstKeptEntryId.trim()
      ? input.firstKeptEntryId.trim()
      : parentId?.trim() || undefined;
  const tokensBefore = Number.isFinite(input.tokensBefore) ? Math.trunc(input.tokensBefore) : 0;

  appendFileSync(
    sessionFile,
    serializeSessionJsonLine({
      type: 'compaction',
      id: randomUUID(),
      parentId,
      timestamp: new Date().toISOString(),
      summary,
      ...(firstKeptEntryId ? { firstKeptEntryId } : {}),
      tokensBefore: Math.max(0, tokensBefore),
      ...(input.details !== undefined ? { details: input.details } : {}),
    }),
    'utf-8',
  );
  clearSessionCaches();
}

/**
 * Append a chronological source-conversation topology event.
 *
 * Pi sessions are append-only, so this event intentionally stays where the fork
 * action happened in time. The renderer can link back to the source message
 * instead of pretending the entry was inserted in the middle of the graph.
 */
export function appendChildConversationTopologyEntry(input: {
  parentSessionFile: string;
  childSessionId: string;
  childTitle?: string;
  kind: ConversationOffshootKind;
  parentMessageId?: string;
}): void {
  const label = input.kind === 'subagent' ? 'Subagent' : input.kind.charAt(0).toUpperCase() + input.kind.slice(1);
  const childLabel = input.childTitle?.trim() || input.childSessionId;
  const sourcePreview = input.parentMessageId ? readSessionEntryPreview(input.parentSessionFile, input.parentMessageId) : null;
  const leafId = readCurrentSessionLeafId(input.parentSessionFile);
  appendFileSync(
    input.parentSessionFile,
    serializeSessionJsonLine(
      buildCustomMessageSessionEntry({
        id: randomUUID(),
        parentId: leafId,
        timestamp: new Date().toISOString(),
        customType: CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE,
        content: `${label} conversation created: ${childLabel}\nOpen: /conversations/${input.childSessionId}\nConversation: ${input.childSessionId}${input.parentMessageId ? `\nSource message: ${input.parentMessageId}` : ''}${sourcePreview ? `\nSource preview: ${sourcePreview}` : ''}`,
      }),
    ),
    'utf-8',
  );
  clearSessionCaches();
}

export function appendConversationWorkspaceMetadata(input: {
  sessionFile: string;
  cwd?: string;
  workspaceCwd?: string | null;
  previousCwd?: string;
  previousWorkspaceCwd?: string | null;
  visibleMessage?: boolean;
}): void {
  const cwd = input.cwd?.trim();
  const workspaceCwd = input.workspaceCwd === null ? null : input.workspaceCwd?.trim();
  const timestamp = new Date().toISOString();
  const metadataId = randomUUID();
  const metadataParentId = readCurrentSessionLeafId(input.sessionFile);

  appendFileSync(
    input.sessionFile,
    serializeSessionJsonLine(
      buildCustomSessionEntry({
        id: metadataId,
        parentId: metadataParentId,
        timestamp,
        customType: CONVERSATION_WORKSPACE_METADATA_CUSTOM_TYPE,
        data: {
          ...(cwd ? { cwd } : {}),
          ...(input.workspaceCwd !== undefined ? { workspaceCwd: workspaceCwd || null } : {}),
        },
      }),
    ),
    'utf-8',
  );

  if (!input.visibleMessage) {
    clearSessionCaches();
    refreshCatalogEntryFromSessionFile(input.sessionFile);
    return;
  }

  const workspaceChangeLabels = resolveWorkspaceChangeLabels({
    cwd,
    workspaceCwd,
    previousCwd: input.previousCwd,
    previousWorkspaceCwd: input.previousWorkspaceCwd,
  });

  appendFileSync(
    input.sessionFile,
    serializeSessionJsonLine(
      buildCustomMessageSessionEntry({
        id: randomUUID(),
        parentId: metadataId,
        timestamp,
        customType: CONVERSATION_WORKSPACE_CHANGE_CUSTOM_TYPE,
        content: buildWorkspaceChangeContent(workspaceChangeLabels),
        details: {
          ...(input.previousCwd ? { previousCwd: input.previousCwd } : {}),
          ...(input.previousWorkspaceCwd !== undefined ? { previousWorkspaceCwd: input.previousWorkspaceCwd } : {}),
          ...(cwd ? { cwd } : {}),
          ...(input.workspaceCwd !== undefined ? { workspaceCwd: workspaceCwd || null } : {}),
        },
      }),
    ),
    'utf-8',
  );
  clearSessionCaches();
  refreshCatalogEntryFromSessionFile(input.sessionFile);
}

export function appendStoredVisibleCustomMessage(input: {
  sessionFile: string;
  customType: string;
  content: string;
  details?: unknown;
  blockId?: string;
  display?: boolean;
}): string | null {
  const customType = input.customType.trim();
  const content = input.content.trim();
  if (!customType || !content) {
    return null;
  }

  const blockId = input.blockId ?? `${customType}:${Date.now()}`;
  appendFileSync(
    input.sessionFile,
    serializeSessionJsonLine(
      buildCustomMessageSessionEntry({
        id: randomUUID(),
        parentId: readCurrentVisibleSessionLeafId(input.sessionFile),
        timestamp: new Date().toISOString(),
        customType,
        content,
        details: {
          ...(input.details && typeof input.details === 'object' && !Array.isArray(input.details)
            ? (input.details as Record<string, unknown>)
            : { value: input.details }),
          extensionBlockId: blockId,
        },
        display: input.display,
      }),
    ),
    'utf-8',
  );
  clearSessionCaches();
  refreshCatalogEntryFromSessionFile(input.sessionFile);
  return blockId;
}

export function updateStoredVisibleCustomMessage(input: {
  sessionFile: string;
  customType: string;
  content: string;
  details?: unknown;
  blockId: string;
}): boolean {
  const customType = input.customType.trim();
  const content = input.content.trim();
  const blockId = input.blockId.trim();
  if (!customType || !content || !blockId) {
    return false;
  }

  let updated = false;
  const lines = readFileSync(input.sessionFile, 'utf-8')
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return line;
      const parsed = parseJsonLine(line);
      if (!parsed || parsed.type !== 'custom_message' || parsed.customType !== customType) return line;
      const details = isRecord(parsed.details) ? parsed.details : {};
      if (details.extensionBlockId !== blockId) return line;
      updated = true;
      return JSON.stringify({
        ...parsed,
        content,
        timestamp: new Date().toISOString(),
        details: {
          ...(input.details && typeof input.details === 'object' && !Array.isArray(input.details)
            ? (input.details as Record<string, unknown>)
            : { value: input.details }),
          extensionBlockId: blockId,
        },
      });
    });

  if (!updated) {
    return false;
  }

  writeFileSync(input.sessionFile, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf-8');
  clearSessionCaches();
  refreshCatalogEntryFromSessionFile(input.sessionFile);
  return true;
}

function refreshCatalogEntryFromSessionFile(sessionFile: string): void {
  try {
    const meta = readSessionMetaByFile(sessionFile);
    if (meta) {
      upsertConversationCatalogSession(meta);
    }
  } catch {
    // Best-effort catalog refresh; the in-memory caches are already cleared.
  }
}

function readSourceRunIdFromSessionFilePath(filePath: string): string | undefined {
  return readSourceRunIdFromSessionPath({ sessionsDir: resolveSessionsDir(), filePath });
}

function decorateSessionParentIds(metas: SessionMeta[]): SessionMeta[] {
  return decorateSessionParentIdsForMetas(metas, normalizeOptionalPath);
}

function resolveSessionIdByFile(filePath: string): string | undefined {
  return resolveSessionIdByFileFromMap({ filePath, sessionFileById, normalizeOptionalPath });
}

function readSessionMetaFromFile(filePath: string, cwdSlug: string): SessionMeta | null {
  let sessionRecord: RawSessionRecord | null = null;
  let model = 'unknown';
  let fallbackTitle: string | null = null;
  let namedTitle: string | null = null;
  let sawSessionInfo = false;
  let messageCount = 0;
  let workspaceMetadata: ConversationWorkspaceMetadata | null = null;
  let offshootMetadata: ConversationOffshootMetadata | null = null;
  let legacyToolWorkspaceMetadata: LegacyToolWorkspaceMetadata | null = null;

  readFileLinesForward(filePath, (rawLine) => {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      return;
    }

    // Session list rendering is a startup-hot path. Avoid JSON.parse for every
    // transcript message in large historical profiles; only parse metadata
    // records and the first title-bearing message.
    const isMessageLine = trimmedLine.includes('"type":"message"') || trimmedLine.includes('"type": "message"');
    if (isMessageLine) {
      messageCount += 1;
      if (fallbackTitle !== null && legacyToolWorkspaceMetadata) {
        return;
      }

      const line = parseJsonLine(trimmedLine);
      if (!line || line.type !== 'message') {
        return;
      }
      const message = line as RawMessage;
      legacyToolWorkspaceMetadata = readLegacyToolWorkspaceMetadata(message) ?? legacyToolWorkspaceMetadata;
      if (fallbackTitle === null) {
        fallbackTitle = extractTitleFromMessage(message.message);
      }
      return;
    }

    if (trimmedLine.includes('"type":"custom_message"') || trimmedLine.includes('"type": "custom_message"')) {
      messageCount += 1;
      return;
    }

    const line = parseJsonLine(trimmedLine);
    if (!line) return;

    if (line.type === 'session') {
      if (!sessionRecord) {
        sessionRecord = line as RawSessionRecord;
      }
      return;
    }

    if (line.type === 'model_change' && model === 'unknown') {
      model = (line as RawModelChange).modelId ?? 'unknown';
      return;
    }

    if (line.type === 'session_info') {
      sawSessionInfo = true;
      namedTitle = normalizeSessionName((line as RawSessionInfo).name);
      return;
    }

    if (line.type === 'compaction' || line.type === 'branch_summary') {
      messageCount += 1;
      return;
    }

    if (line.type === 'custom') {
      workspaceMetadata = readConversationWorkspaceMetadata(line as RawCustomEntry) ?? workspaceMetadata;
      offshootMetadata = readConversationOffshootMetadata(line as RawCustomEntry) ?? offshootMetadata;
      return;
    }

    if (line.type === 'message') {
      const message = line as RawMessage;
      messageCount += 1;
      legacyToolWorkspaceMetadata = readLegacyToolWorkspaceMetadata(message) ?? legacyToolWorkspaceMetadata;
      if (fallbackTitle === null) fallbackTitle = extractTitleFromMessage(message.message);
    }
  });

  const resolvedSessionRecord = sessionRecord as RawSessionRecord | null;
  if (!resolvedSessionRecord) {
    return null;
  }

  const resolvedOffshootMetadata = offshootMetadata as ConversationOffshootMetadata | null;
  const resolvedWorkspaceMetadata = workspaceMetadata as ConversationWorkspaceMetadata | null;
  const resolvedLegacyToolWorkspaceMetadata = legacyToolWorkspaceMetadata as LegacyToolWorkspaceMetadata | null;
  const parentSessionFile = resolvedOffshootMetadata?.detached
    ? undefined
    : (resolvedOffshootMetadata?.parentSessionFile ?? normalizeOptionalPath(resolvedSessionRecord.parentSession));
  const sourceRunId = resolvedOffshootMetadata?.detached
    ? undefined
    : (resolvedOffshootMetadata?.sourceRunId ?? readSourceRunIdFromSessionFilePath(filePath));
  const headerCwd = resolvedSessionRecord.cwd ?? slugToCwd(cwdSlug);
  const inferredLegacyWorkspaceMetadata =
    resolvedWorkspaceMetadata?.workspaceCwd === null && resolvedLegacyToolWorkspaceMetadata ? resolvedLegacyToolWorkspaceMetadata : null;
  const cwd = inferredLegacyWorkspaceMetadata?.cwd ?? resolvedWorkspaceMetadata?.cwd ?? headerCwd;
  const workspaceCwd =
    inferredLegacyWorkspaceMetadata?.workspaceCwd ??
    (resolvedWorkspaceMetadata && 'workspaceCwd' in resolvedWorkspaceMetadata
      ? resolvedWorkspaceMetadata.workspaceCwd === null
        ? isNeutralChatWorkspaceCwd(cwd)
          ? null
          : undefined
        : resolvedWorkspaceMetadata.workspaceCwd
      : isNeutralChatWorkspaceCwd(cwd)
        ? null
        : undefined);

  const offshootKind = resolvedOffshootMetadata?.kind ?? (sourceRunId ? ('subagent' as const) : undefined);
  const rawTitle = (sawSessionInfo ? namedTitle : null) ?? fallbackTitle ?? 'New Conversation';

  return {
    id: resolvedSessionRecord.id,
    file: filePath,
    timestamp: resolvedSessionRecord.timestamp,
    cwd,
    ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
    cwdSlug,
    model,
    title: stripOffshootTitlePrefix(rawTitle, offshootKind),
    messageCount,
    ...(parentSessionFile ? { parentSessionFile } : {}),
    ...(resolvedOffshootMetadata?.parentSessionId ? { parentSessionId: resolvedOffshootMetadata.parentSessionId } : {}),
    ...(resolvedOffshootMetadata?.parentMessageId ? { parentMessageId: resolvedOffshootMetadata.parentMessageId } : {}),
    ...(offshootKind ? { offshootKind } : {}),
    ...(resolvedOffshootMetadata?.timestamp ? { offshootTimestamp: resolvedOffshootMetadata.timestamp } : {}),
    ...(sourceRunId ? { sourceRunId } : {}),
  };
}

function buildPersistentSessionIndexDocument(sessionsDir: string): PersistentSessionIndexDocument {
  return buildPersistentSessionIndexDocumentFromCache(sessionsDir, sessionMetaCache) as PersistentSessionIndexDocument;
}

function loadPersistentSessionIndexEntry(value: unknown): PersistentSessionIndexEntry | null {
  return loadPersistentSessionIndexEntryFromValue(value) as PersistentSessionIndexEntry | null;
}

function ensurePersistentIndexLoaded(sessionsDirOverride?: string): void {
  const sessionsDir = resolveSessionsDir(sessionsDirOverride);
  const indexFile = resolveSessionsIndexFile(sessionsDirOverride);
  const indexKey = buildSessionIndexKey({ sessionsDir, indexFile });

  if (!shouldReloadPersistentSessionIndex({ loadedIndexKey: loadedPersistentIndexKey, nextIndexKey: indexKey })) {
    return;
  }

  sessionMetaCache.clear();
  sessionFileById.clear();
  loadedPersistentIndexKey = indexKey;
  persistedIndexJson = null;
  sessionCacheDirty = true;

  if (!existsSync(indexFile)) {
    return;
  }

  try {
    const raw = readFileSync(indexFile, 'utf-8').trim();
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Partial<PersistentSessionIndexDocument>;
    if (parsed.version !== 1 || parsed.sessionsDir !== sessionsDir || !Array.isArray(parsed.entries)) {
      return;
    }

    for (const value of parsed.entries) {
      const entry = loadPersistentSessionIndexEntry(value);
      if (!entry) {
        continue;
      }

      sessionMetaCache.set(entry.filePath, {
        signature: entry.signature,
        meta: entry.meta,
      });
      sessionFileById.set(entry.meta.id, entry.filePath);
    }

    persistedIndexJson = serializePersistentSessionIndex(buildPersistentSessionIndexDocument(sessionsDir));
  } catch {
    sessionMetaCache.clear();
    sessionFileById.clear();
    persistedIndexJson = null;
  }
}

function persistSessionIndex(sessionsDirOverride?: string): void {
  // Skip the expensive JSON build-and-compare if the cache hasn't changed since
  // the last persist. This is called on every listSessions() which fires in tight
  // loops (e.g. the search indexer batch loop), so avoiding redundant work here
  // is critical for performance with large session counts.
  if (!shouldPersistSessionIndex({ sessionCacheDirty })) {
    return;
  }

  const sessionsDir = resolveSessionsDir(sessionsDirOverride);
  const indexFile = resolveSessionsIndexFile(sessionsDirOverride);
  const nextJson = serializePersistentSessionIndex(buildPersistentSessionIndexDocument(sessionsDir));
  if (!didSessionIndexJsonChange({ nextJson, persistedIndexJson })) {
    sessionCacheDirty = false;
    return;
  }

  // Update in-memory state synchronously so re-entrant calls skip redundant work,
  // then write to disk asynchronously to avoid blocking the worker thread.
  persistedIndexJson = nextJson;
  sessionCacheDirty = false;
  mkdirSync(dirname(indexFile), { recursive: true });
  pendingIndexWrite = enqueueSessionIndexWrite({ previousWrite: pendingIndexWrite, indexFile, json: nextJson });
}

function resolveSessionFileCwdSlug(filePath: string): string {
  return resolveSessionFileCwdSlugFromDir(filePath, resolveSessionsDir());
}

function listSessionFiles(sessionsDir: string): Array<{ filePath: string; cwdSlug: string }> {
  return listSessionFilesFromDir(sessionsDir);
}

function readCachedSessionMeta(filePath: string, cwdSlug: string): SessionMeta | null {
  const signature = getFileSignature(filePath);
  if (!signature) {
    sessionMetaCache.delete(filePath);
    return null;
  }

  const cached = sessionMetaCache.get(filePath);
  if (cached && cached.signature === signature) {
    return cached.meta;
  }

  const meta = readSessionMetaFromFile(filePath, cwdSlug);
  if (!meta) {
    sessionMetaCache.delete(filePath);
    sessionCacheDirty = true;
    return null;
  }

  sessionMetaCache.set(filePath, { signature, meta });
  sessionCacheDirty = true;
  return meta;
}

function scanSessionMetas(sessionsDirOverride?: string): SessionMeta[] {
  ensurePersistentIndexLoaded(sessionsDirOverride);

  const sessionsDir = resolveSessionsDir(sessionsDirOverride);
  if (!existsSync(sessionsDir)) {
    sessionMetaCache.clear();
    sessionFileById.clear();
    persistSessionIndex();
    return [];
  }

  const metas: SessionMeta[] = [];
  const seenFiles = new Set<string>();
  const nextSessionFileById = new Map<string, string>();

  for (const { filePath, cwdSlug } of listSessionFiles(sessionsDir)) {
    seenFiles.add(filePath);

    const meta = readCachedSessionMeta(filePath, cwdSlug);
    if (!meta) {
      continue;
    }

    metas.push(meta);
    nextSessionFileById.set(meta.id, filePath);
  }

  for (const filePath of sessionMetaCache.keys()) {
    if (!seenFiles.has(filePath)) {
      sessionMetaCache.delete(filePath);
      sessionCacheDirty = true;
    }
  }

  sessionFileById = nextSessionFileById;
  metas.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  const decoratedMetas = decorateSessionParentIds(metas);
  persistSessionIndex(sessionsDirOverride);
  return decoratedMetas;
}

function resolveSessionMetaByConventionalFileName(sessionId: string, sessionsDirOverride?: string): SessionMeta | null {
  if (!sessionId || sessionId.includes('/') || sessionId.includes('\\')) {
    return null;
  }

  const sessionsDir = resolveSessionsDir(sessionsDirOverride);
  if (!existsSync(sessionsDir)) {
    return null;
  }

  let entries: Dirent[];
  try {
    entries = readdirSync(sessionsDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const filePath = join(sessionsDir, entry.name, `${sessionId}.jsonl`);
    if (!existsSync(filePath)) {
      continue;
    }

    const meta = readCachedSessionMeta(filePath, resolveSessionFileCwdSlug(filePath));
    if (meta?.id === sessionId) {
      sessionFileById.set(sessionId, filePath);
      return meta;
    }
  }

  return null;
}

function resolveSessionMeta(sessionId: string, sessionsDirOverride?: string): SessionMeta | null {
  ensurePersistentIndexLoaded(sessionsDirOverride);

  const cachedFilePath = sessionFileById.get(sessionId);
  if (cachedFilePath) {
    const cachedMeta = readSessionMetaByFile(cachedFilePath);
    if (cachedMeta?.id === sessionId) {
      return cachedMeta;
    }
  }

  const conventionalMeta = resolveSessionMetaByConventionalFileName(sessionId, sessionsDirOverride);
  if (conventionalMeta) {
    return conventionalMeta;
  }

  const metas = scanSessionMetas(sessionsDirOverride);
  return metas.find((meta) => meta.id === sessionId) ?? null;
}

export function clearSessionCaches(): void {
  sessionMetaCache.clear();
  sessionDetailCache.clear();
  sessionSearchTextCache.clear();
  sessionFileById.clear();
  loadedPersistentIndexKey = null;
  persistedIndexJson = null;
  sessionCacheDirty = true;
}

export function buildDisplayMessageEntriesFromSessionEntries(entries: SessionEntry[]): DisplayMessageEntryLike[] {
  const displayEntries: DisplayMessageEntryLike[] = [];

  for (const entry of entries) {
    if (entry.type === 'message') {
      displayEntries.push({
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        message: entry.message,
      });
      continue;
    }

    if (entry.type === 'custom_message') {
      const customMessage: DisplayMessageEntryLike['message'] = {
        role: 'custom',
        content: entry.content,
        details: entry.details,
        customType: entry.customType,
        display: entry.display,
      };

      displayEntries.push({
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        message: customMessage,
      });
      continue;
    }

    if (entry.type === 'compaction') {
      displayEntries.push({
        id: entry.id,
        timestamp: entry.timestamp,
        message: {
          role: 'compactionSummary',
          summary: entry.summary,
          tokensBefore: entry.tokensBefore,
          details: (entry as { details?: unknown }).details,
        },
      });
      continue;
    }

    if (entry.type === 'branch_summary') {
      displayEntries.push({
        id: entry.id,
        timestamp: entry.timestamp,
        message: {
          role: 'branchSummary',
          summary: entry.summary,
          fromId: entry.fromId,
        },
      });
    }
  }

  return displayEntries;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function listSessions(sessionsDir?: string): SessionMeta[] {
  return scanSessionMetas(sessionsDir);
}

export function readSessionMeta(sessionId: string, sessionsDir?: string): SessionMeta | null {
  return resolveSessionMeta(sessionId, sessionsDir);
}

export interface DeleteSessionsResult {
  deleted: Array<{ id: string; file: string }>;
  missing: string[];
}

export function deleteSessions(sessionIds: string[], sessionsDir?: string): DeleteSessionsResult {
  const deleted: Array<{ id: string; file: string }> = [];
  const missing: string[] = [];
  const normalizedSessionIds = [...new Set(sessionIds.map((id) => id.trim()).filter(Boolean))];
  for (const sessionId of normalizedSessionIds) {
    const meta = resolveSessionMeta(sessionId, sessionsDir);
    if (!meta?.file) {
      missing.push(sessionId);
      continue;
    }
    if (existsSync(meta.file)) {
      rmSync(meta.file, { force: true });
      deleted.push({ id: sessionId, file: meta.file });
    } else {
      missing.push(sessionId);
    }
    sessionMetaCache.delete(meta.file);
    sessionSearchTextCache.clear();
    sessionDetailCache.delete(meta.file);
    sessionFileById.delete(sessionId);
    sessionCacheDirty = true;
  }
  deleteConversationCatalogSessions(normalizedSessionIds);
  persistSessionIndex(sessionsDir);
  return { deleted, missing };
}

export function pruneSessionsByRetention(input: {
  olderThanMs: number;
  now?: Date;
  archivedConversationIds?: string[];
  archivedOnly?: boolean;
  dryRun?: boolean;
  sessionsDir?: string;
}): {
  ok: true;
  dryRun: boolean;
  cutoff: string;
  candidates: Array<{ id: string; file: string; timestamp: string }>;
  deleted: Array<{ id: string; file: string }>;
  skipped: number;
} {
  const nowMs = input.now?.getTime() ?? Date.now();
  const cutoffMs = nowMs - input.olderThanMs;
  const archivedIds = new Set((input.archivedConversationIds ?? []).map((id) => id.trim()).filter(Boolean));
  const allSessions = listSessions(input.sessionsDir);
  const candidates = allSessions
    .filter((meta) => {
      if (input.archivedOnly && !archivedIds.has(meta.id)) return false;
      const timestampMs = Date.parse(meta.lastActivityAt ?? meta.timestamp);
      return Number.isFinite(timestampMs) && timestampMs < cutoffMs;
    })
    .map((meta) => ({ id: meta.id, file: meta.file, timestamp: meta.lastActivityAt ?? meta.timestamp }));
  const deleted = input.dryRun
    ? []
    : deleteSessions(
        candidates.map((candidate) => candidate.id),
        input.sessionsDir,
      ).deleted;
  return {
    ok: true,
    dryRun: Boolean(input.dryRun),
    cutoff: new Date(cutoffMs).toISOString(),
    candidates,
    deleted,
    skipped: allSessions.length - candidates.length,
  };
}

function readSessionIdFromSessionRecord(filePath: string): string | null {
  return readSessionIdFromSessionRecordFile(filePath, parseJsonLine);
}

export function readKnownSessionIdByFilePath(filePath: string): string | null {
  ensurePersistentIndexLoaded();

  const cachedSessionId = resolveKnownSessionIdFromCache(sessionMetaCache.get(filePath)?.meta.id);
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (!existsSync(filePath)) {
    return null;
  }

  return readSessionIdFromSessionRecord(filePath) ?? readSessionMetaByFile(filePath)?.id ?? null;
}

function readSessionSearchTextByFile(filePath: string, maxCharacters: number): string | null {
  const normalizedMaxCharacters = normalizeSessionSearchMaxCharacters(maxCharacters);
  const cacheKey = buildSessionSearchTextCacheKey(filePath, normalizedMaxCharacters);
  const signature = getFileSignature(filePath);
  if (!signature) {
    sessionSearchTextCache.delete(cacheKey);
    return null;
  }

  const cached = sessionSearchTextCache.get(cacheKey);
  if (cached && cached.signature === signature) {
    return cached.text;
  }

  try {
    const segments: string[] = [];
    let remaining = normalizedMaxCharacters;

    // @ts-ignore TS7030 — false positive; all paths in this callback are valid
    readFileLinesReverse(filePath, (rawLine) => {
      if (remaining <= 0) {
        return false;
      }

      if (!rawLine.trim()) {
        return;
      }

      const parsed = parseJsonLine(sanitizeSessionLineForSearch(rawLine));
      if (!parsed || parsed.type !== 'message') {
        return;
      }

      remaining = appendSessionSearchSegment(segments, extractSearchTextFromMessage(parsed.message), remaining);
      if (remaining <= 0) {
        return false;
      }
    });

    const text = segments.reverse().join('\n');
    sessionSearchTextCache.set(cacheKey, { signature, text });
    return text;
  } catch {
    sessionSearchTextCache.delete(cacheKey);
  }
  return null;
}

export function readSessionSearchTextForMeta(meta: Pick<SessionMeta, 'file'>, maxCharacters = 12_000): string | null {
  const indexedText = readSessionSearchTextByFile(meta.file, maxCharacters);
  if (!shouldUseSessionSearchFallback(indexedText)) {
    return indexedText;
  }

  try {
    const manager = SessionManager.open(meta.file);
    return buildSessionSearchText(manager.getBranch(), maxCharacters);
  } catch {
    return null;
  }
}

export function readSessionSearchText(sessionId: string, maxCharacters = 12_000, sessionsDir?: string): string | null {
  const meta = resolveSessionMeta(sessionId, sessionsDir);
  if (!meta) {
    return null;
  }
  return readSessionSearchTextForMeta(meta, maxCharacters);
}

export function readSessionMetaByFile(filePath: string): SessionMeta | null {
  const meta = readCachedSessionMeta(filePath, resolveSessionFileCwdSlug(filePath));
  if (!meta) {
    return null;
  }

  const parentSessionFile = normalizeOptionalPath(meta.parentSessionFile);
  const parentSessionId = parentSessionFile ? resolveSessionIdByFile(parentSessionFile) : undefined;
  return mergeResolvedParentSessionMetadata(meta, { parentSessionFile, parentSessionId });
}

export function renameStoredSession(sessionId: string, name: string, sessionsDir?: string): SessionMeta {
  const rename = resolveStoredSessionRename(name);

  const meta = resolveSessionMeta(sessionId, sessionsDir);
  if (!meta) {
    throw buildMissingSessionRenameError(sessionId);
  }

  appendFileSync(meta.file, rename.sessionInfoLine);

  const updatedMeta = readSessionMetaByFile(meta.file);
  if (!updatedMeta) {
    throw buildReloadSessionAfterRenameError(sessionId);
  }

  persistSessionIndex(sessionsDir);
  return updatedMeta;
}

function resolveTailBlockLimit(tailBlocks: number | undefined, totalBlocks: number): number | null {
  return resolveTailBlockLimitValue(tailBlocks, totalBlocks);
}

const MAX_SESSION_DETAIL_TAIL_BLOCKS = 10000;
const SESSION_DETAIL_PROJECTION_VERSION = 'v2';

function normalizeTailBlockRequest(tailBlocks: number | undefined): number | undefined {
  return normalizeTailBlockRequestValue({ tailBlocks, maxTailBlocks: MAX_SESSION_DETAIL_TAIL_BLOCKS });
}

function buildSessionDetailCacheKey(filePath: string, tailBlocks?: number): string {
  return `${SESSION_DETAIL_PROJECTION_VERSION}:${buildSessionDetailCacheKeyValue(filePath, tailBlocks)}`;
}

function trimSessionDetailCache(): void {
  trimSessionDetailCacheMap(sessionDetailCache, MAX_SESSION_DETAIL_CACHE_ENTRIES);
}

export function readSessionBlocksByFileWithTelemetry(
  filePath: string,
  options?: { tailBlocks?: number },
): { detail: SessionDetail | null; telemetry: SessionDetailReadTelemetry | null } {
  const startedAt = process.hrtime.bigint();
  const signature = getFileSignature(filePath);
  if (!signature) {
    return { detail: null, telemetry: null };
  }

  const requestedTailBlocks = normalizeTailBlockRequest(options?.tailBlocks);
  const cacheKey = buildSessionDetailCacheKey(filePath, requestedTailBlocks);
  const cachedDetail = sessionDetailCache.get(cacheKey);
  const cacheLookupAt = process.hrtime.bigint();

  // ── Cache hit ────────────────────────────────────────────────────────────────
  if (cachedDetail?.signature === signature) {
    const cacheHitStartedAt = process.hrtime.bigint();
    sessionDetailCache.delete(cacheKey);
    const cacheDeleteAt = process.hrtime.bigint();
    const detailWithRenderItems = attachTranscriptRenderItems(cachedDetail.detail);
    const renderItemsAttachedAt = process.hrtime.bigint();
    const detail = detailWithRenderItems.signature === signature ? detailWithRenderItems : { ...detailWithRenderItems, signature };
    sessionDetailCache.set(cacheKey, { ...cachedDetail, detail });
    const cacheSetAt = process.hrtime.bigint();
    return {
      detail,
      telemetry: {
        ...buildSessionDetailTelemetry({
          cache: 'hit',
          loader: detail.contextUsage === null && typeof requestedTailBlocks === 'number' ? 'fast-tail' : 'full',
          startedAt,
          requestedTailBlocks,
          totalBlocks: detail.totalBlocks,
          blockOffset: detail.blockOffset,
          contextUsageIncluded: detail.contextUsage !== null,
          phases: {
            signatureAndCacheLookupMs: Number(cacheLookupAt - startedAt) / 1_000_000,
            cacheDeleteMs: Number(cacheDeleteAt - cacheHitStartedAt) / 1_000_000,
            attachRenderItemsMs: Number(renderItemsAttachedAt - cacheDeleteAt) / 1_000_000,
            cacheSetMs: Number(cacheSetAt - renderItemsAttachedAt) / 1_000_000,
          },
        }),
      },
    };
  }

  const cachedDbDetail =
    typeof requestedTailBlocks === 'number'
      ? null
      : readConversationDetailCache(readKnownSessionIdByFilePath(filePath) ?? filePath, signature);
  if (cachedDbDetail) {
    const detail = attachTranscriptRenderItems(cachedDbDetail);
    return {
      detail,
      telemetry: buildSessionDetailTelemetry({
        cache: 'hit',
        loader: 'full',
        startedAt,
        totalBlocks: detail.totalBlocks,
        blockOffset: detail.blockOffset,
        contextUsageIncluded: detail.contextUsage !== null,
      }),
    };
  }

  // ── Cache miss — detect modification ─────────────────────────────────────────
  const modificationCheckStartedAt = process.hrtime.bigint();
  let telemetryModificationDetected = false;
  if (cachedDetail?.contentHash) {
    const oldSize = parseSignatureSize(cachedDetail.signature);
    const newSize = parseSignatureSize(signature);
    if (oldSize !== null && newSize !== null) {
      const prefixHash = shouldComputeSessionPrefixHash({ oldSize, newSize }) ? computeFilePrefixHash(filePath, oldSize) : undefined;
      telemetryModificationDetected = detectSessionModification({ oldSize, newSize, oldContentHash: cachedDetail.contentHash, prefixHash });

      if (telemetryModificationDetected) {
        persistAppTelemetryEvent({
          source: 'server',
          category: 'session_integrity',
          name: 'prompt_cache_miss',
          metadata: buildPromptCacheMissMetadata({
            filePath,
            oldSignature: cachedDetail.signature,
            newSignature: signature,
            oldSize,
            newSize,
            cacheLoader: typeof requestedTailBlocks === 'number' ? 'fast-tail' : 'full',
          }),
        });
      }
    }
  }
  const modificationCheckMs = elapsedMsSince(modificationCheckStartedAt);

  const metaReadStartedAt = process.hrtime.bigint();
  const meta = readCachedSessionMeta(filePath, resolveSessionFileCwdSlug(filePath));
  if (!meta) return { detail: null, telemetry: null };
  const metaReadMs = elapsedMsSince(metaReadStartedAt);

  const fastTailStartedAt = process.hrtime.bigint();
  const fastTailDetail =
    typeof requestedTailBlocks === 'number' && requestedTailBlocks > 0
      ? tryReadSessionTailBlocksByFile(meta.file, meta, requestedTailBlocks, {
          exactCounts: false,
        })
      : null;
  const fastTailMs = elapsedMsSince(fastTailStartedAt);
  if (fastTailDetail) {
    const fastTailFinalizeStartedAt = process.hrtime.bigint();
    const detail = {
      ...fastTailDetail,
      signature,
      renderItems: buildTranscriptRenderItemsFromDisplayBlocks(fastTailDetail.blocks),
    } satisfies SessionDetail;
    // Fast-tail reads serve the initial route paint; avoid a full-file hash on
    // this path and rely on the file signature for exact cache reuse. Keep this
    // cache in memory only; opening and writing the persistent detail DB adds
    // blocking work to the route that is supposed to be the cheap transcript path.
    sessionDetailCache.set(cacheKey, { signature, contentHash: '', detail });
    trimSessionDetailCache();
    const fastTailFinalizeMs = elapsedMsSince(fastTailFinalizeStartedAt);
    return {
      detail,
      telemetry: {
        ...buildSessionDetailTelemetry({
          cache: 'miss',
          loader: 'fast-tail',
          startedAt,
          requestedTailBlocks,
          totalBlocks: detail.totalBlocks,
          blockOffset: detail.blockOffset,
          contextUsageIncluded: false,
          modificationDetected: telemetryModificationDetected,
          phases: {
            modificationCheckMs,
            metaReadMs,
            fastTailMs,
            fastTailFinalizeMs,
            ...(lastFastTailScanStats
              ? {
                  fastTailLinesVisited: lastFastTailScanStats.linesVisited,
                  fastTailDisplayLinesRetained: lastFastTailScanStats.displayLinesRetained,
                  fastTailScanMs: lastFastTailScanStats.scanMs,
                  fastTailEntryBuildMs: lastFastTailScanStats.entryBuildMs,
                  fastTailBlockBuildMs: lastFastTailScanStats.blockBuildMs,
                  fastTailAssetDecorateMs: lastFastTailScanStats.assetDecorateMs,
                  fastTailTopologyMs: lastFastTailScanStats.topologyMs,
                  fastTailDeferMs: lastFastTailScanStats.deferMs,
                }
              : {}),
          },
        }),
      },
    };
  }

  const fullReadStartedAt = process.hrtime.bigint();
  const manager = SessionManager.open(meta.file);
  const branchEntries = buildDisplayMessageEntriesFromSessionEntries(manager.getBranch());
  const allMetas = scanSessionMetas();
  const allBlocks = addParentConversationBacklink(
    mergeTopologyBlocks(
      enrichSubagentToolBlocks(decorateSessionAssetUrls(buildDisplayBlocksFromEntries(branchEntries), meta.id), meta, allMetas),
      meta,
      allMetas,
    ),
    meta,
    allMetas,
  );
  const totalBlocks = allBlocks.length;
  const tailBlockLimit = resolveTailBlockLimit(requestedTailBlocks, totalBlocks);
  const blockOffset = tailBlockLimit === null ? 0 : Math.max(0, totalBlocks - tailBlockLimit);
  const slicedBlocks = blockOffset > 0 ? allBlocks.slice(blockOffset) : allBlocks;
  const blocks = blockOffset > 0 ? deferHeavyBlockContent(slicedBlocks, blockOffset, totalBlocks) : slicedBlocks;

  const contentHash = computeFileContentHash(filePath) ?? '';
  const detail = {
    meta,
    blocks,
    blockOffset,
    totalBlocks,
    contextUsage: readSessionContextUsageFromEntries(manager.getEntries()),
    signature,
    renderItems: buildTranscriptRenderItemsFromDisplayBlocks(blocks),
  } satisfies SessionDetail;
  const fullReadMs = elapsedMsSince(fullReadStartedAt);

  const fullCacheWriteStartedAt = process.hrtime.bigint();
  sessionDetailCache.set(cacheKey, { signature, contentHash, detail });
  writeConversationDetailCache(meta.id, detail, { tailBlocks: requestedTailBlocks });
  trimSessionDetailCache();
  const fullCacheWriteMs = elapsedMsSince(fullCacheWriteStartedAt);
  return {
    detail,
    telemetry: {
      ...buildSessionDetailTelemetry({
        cache: 'miss',
        loader: 'full',
        startedAt,
        requestedTailBlocks,
        totalBlocks: detail.totalBlocks,
        blockOffset: detail.blockOffset,
        contextUsageIncluded: true,
        modificationDetected: telemetryModificationDetected,
        phases: {
          modificationCheckMs,
          metaReadMs,
          fullReadMs,
          fullCacheWriteMs,
        },
      }),
    },
  };
}

export function buildAppendOnlySessionDetailResponse(input: {
  detail: SessionDetail;
  knownBlockOffset?: number;
  knownTotalBlocks?: number;
  knownLastBlockId?: string;
}): SessionDetailAppendOnlyResponse | null {
  return buildAppendOnlySessionDetailResponseValue(input) as SessionDetailAppendOnlyResponse | null;
}

export function readSessionBlocksByFile(filePath: string, options?: { tailBlocks?: number }): SessionDetail | null {
  return readSessionBlocksByFileWithTelemetry(filePath, options).detail;
}

export function readSessionBlocksWithTelemetry(
  sessionId: string,
  options?: { tailBlocks?: number; sessionsDir?: string },
): { detail: SessionDetail | null; telemetry: SessionDetailReadTelemetry | null } {
  const meta = resolveSessionMeta(sessionId, options?.sessionsDir);
  return meta ? readSessionBlocksByFileWithTelemetry(meta.file, options) : { detail: null, telemetry: null };
}

export function readSessionBlocks(sessionId: string, options?: { tailBlocks?: number; sessionsDir?: string }): SessionDetail | null {
  return readSessionBlocksWithTelemetry(sessionId, options).detail;
}

export function readSessionBlock(sessionId: string, blockId: string, sessionsDir?: string): DisplayBlock | null {
  const meta = resolveSessionMeta(sessionId, sessionsDir);
  if (!meta) {
    return null;
  }

  const manager = SessionManager.open(meta.file);
  const branchEntries = buildDisplayMessageEntriesFromSessionEntries(manager.getBranch());
  const blocks = decorateSessionAssetUrls(buildDisplayBlocksFromEntries(branchEntries), sessionId);
  const exactBlock = blocks.find((block) => block.id === blockId);
  if (exactBlock) {
    return exactBlock;
  }

  const rebasedMatch = /^(.+)-([mtxcei])(\d+)$/.exec(blockId);
  if (!rebasedMatch) {
    return null;
  }

  const [, blockPrefix, blockKind, absoluteIndexText] = rebasedMatch;
  const absoluteIndex = Number.parseInt(absoluteIndexText ?? '', 10);
  const indexedBlock = Number.isSafeInteger(absoluteIndex) && absoluteIndex >= 0 ? blocks[absoluteIndex] : undefined;
  if (indexedBlock && indexedBlock.id.startsWith(`${blockPrefix}-${blockKind}`)) {
    return indexedBlock;
  }

  return blocks.find((block) => block.id.startsWith(`${blockPrefix}-${blockKind}`)) ?? null;
}

export function readSessionEntryBlocks(sessionId: string, entryIds: string[], sessionsDir?: string): DisplayBlock[] | null {
  const meta = resolveSessionMeta(sessionId, sessionsDir);
  if (!meta) {
    return null;
  }

  const normalizedEntryIds = [...new Set(entryIds.map((entryId) => entryId.trim()).filter(Boolean))];
  if (normalizedEntryIds.length === 0) {
    return [];
  }

  const requestedEntryIds = new Set(normalizedEntryIds);
  const manager = SessionManager.open(meta.file);
  const branchEntries = buildDisplayMessageEntriesFromSessionEntries(manager.getBranch());
  const blocks = buildDisplayBlocksFromEntries(branchEntries).filter(
    (block) =>
      requestedEntryIds.has(block.id) ||
      [...requestedEntryIds].some((entryId) => block.id.startsWith(`${entryId}-`)) ||
      ((block as DisplayBlock & DisplayBlockSourceMetadata).sourceEntryIds ?? []).some((entryId) => requestedEntryIds.has(entryId)),
  );
  return decorateSessionAssetUrls(blocks, sessionId);
}

export function readSessionImageAsset(
  sessionId: string,
  blockId: string,
  imageIndex?: number,
  sessionsDir?: string,
): { mimeType: string; data: Buffer; fileName?: string } | null {
  const meta = resolveSessionMeta(sessionId, sessionsDir);
  if (!meta) {
    return null;
  }

  const signature = getFileSignature(meta.file);
  if (signature) {
    const cachedAsset = readConversationAssetCache({ conversationId: meta.id, signature, blockId, imageIndex });
    if (cachedAsset) {
      return cachedAsset;
    }
  }

  const cacheAsset = (
    asset: { mimeType: string; data: Buffer; fileName?: string } | null,
  ): { mimeType: string; data: Buffer; fileName?: string } | null => {
    if (asset && signature) {
      writeConversationAssetCache({ conversationId: meta.id, signature, blockId, imageIndex, asset });
    }
    return asset;
  };

  const manager = SessionManager.open(meta.file);
  for (const entry of manager.getBranch()) {
    if (entry.type !== 'message') {
      continue;
    }

    const contentBlocks = normalizeContent('content' in entry.message ? entry.message.content : undefined);
    if (entry.message.role === 'user' && entry.id === blockId) {
      if (!Number.isInteger(imageIndex) || typeof imageIndex !== 'number' || imageIndex < 0) {
        return null;
      }

      const image = buildSessionImageAssets(contentBlocks)[imageIndex];
      return cacheAsset(image?.asset ?? null);
    }

    if (entry.message.role !== 'toolResult') {
      continue;
    }

    const images = buildSessionImageAssets(contentBlocks);
    for (const [candidateIndex, image] of images.entries()) {
      if (`${entry.id}-i${candidateIndex}` !== blockId) {
        continue;
      }

      return cacheAsset(image.asset);
    }
  }

  return null;
}
