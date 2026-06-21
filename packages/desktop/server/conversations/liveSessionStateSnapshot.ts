import { existsSync, statSync } from 'node:fs';

import type { AgentSession } from '@earendil-works/pi-coding-agent';

import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import type { ExtensionHostModelProfileResolution } from '../extensions/extensionHostProtocol.js';
import { readTranscriptBackedConversationDetailByFile } from './conversationTranscriptOps.js';
import type { ThreadGoal } from './conversationTypes.js';
import type { DisplayBlock } from './conversationTypes.js';
import type { LiveContextUsage, LiveSessionToolDefinition } from './liveSessionEvents.js';
import { type ParallelPromptJob, type ParallelPromptPreview, readParallelState } from './liveSessionParallelJobs.js';
import { buildLiveSessionPresenceState, type LiveSessionPresenceHost, type LiveSessionPresenceState } from './liveSessionPresence.js';
import { type QueuedPromptPreview, readQueueState } from './liveSessionQueue.js';
import { computeCanonicalLiveSessionRunning } from './liveSessionRunningState.js';
import { hasQueuedOrActiveStaleTurn } from './liveSessionStaleTurns.js';
import { readLiveSessionContextUsage } from './liveSessionStateBroadcasts.js';
import { applyLatestCompactionSummaryTitle, buildLiveStateBlocks, mergeConversationHistoryBlocks } from './liveSessionTranscript.js';
import { readGoalFromEntries } from './sessionGoalState.js';

const DEFAULT_LIVE_SNAPSHOT_TAIL_BLOCKS = 400;
const MAX_LIVE_SNAPSHOT_TAIL_BLOCKS = 10000;
const SMALL_LIVE_SESSION_FILE_MAX_BYTES = 16 * 1024;

function normalizeLiveSnapshotTailBlocks(value: number | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? Math.min(MAX_LIVE_SNAPSHOT_TAIL_BLOCKS, value)
    : DEFAULT_LIVE_SNAPSHOT_TAIL_BLOCKS;
}

export interface LiveSessionSnapshotHost {
  session: AgentSession;
  activeStaleTurnCustomType?: string | null;
  lastCompactionSummaryTitle?: string | null;
  isCompacting?: boolean;
  lastDurableRunState?: string;
}

export interface LiveSessionStateSnapshot {
  blocks: DisplayBlock[];
  blockOffset: number;
  totalBlocks: number;
  hasSnapshot: boolean;
  isStreaming: boolean;
  isCompacting: boolean;
  hasStaleTurnState: boolean;
  error: string | null;
  title: string | null;
  tokens: { input: number; output: number; total: number } | null;
  cost: number | null;
  contextUsage: LiveContextUsage | null;
  pendingQueue: { steering: QueuedPromptPreview[]; followUp: QueuedPromptPreview[] };
  parallelJobs: ParallelPromptPreview[];
  goalState: ThreadGoal | null;
  systemPrompt: string | null;
  toolDefinitions: LiveSessionToolDefinition[];
  modelProfile: ExtensionHostModelProfileResolution & { modelRef: string | null };
  presence: LiveSessionPresenceState;
  cwdChange: { newConversationId: string; cwd: string; autoContinued: boolean } | null;
}

export interface LiveSessionStateSnapshotHost extends LiveSessionSnapshotHost, LiveSessionPresenceHost {
  currentTurnError?: string | null;
  isCompacting?: boolean;
  parallelJobs?: ParallelPromptJob[];
}

export interface LiveSessionSnapshot {
  blocks: DisplayBlock[];
  blockOffset: number;
  totalBlocks: number;
  isStreaming: boolean;
}

async function readSessionModelProfile(session: AgentSession): Promise<LiveSessionStateSnapshot['modelProfile']> {
  const model = session.model;
  const provider = typeof model?.provider === 'string' ? model.provider : '';
  const modelId = typeof model?.id === 'string' ? model.id : '';
  if (!provider || !modelId) return { kind: 'none', modelRef: null };
  return { ...(await getExtensionHostClient().resolveModelProfile({ provider, model: modelId })), modelRef: `${provider}/${modelId}` };
}

function hasNoLiveSessionEntries(session: AgentSession): boolean {
  const sessionManager = session.sessionManager as { getEntries?: () => unknown[] } | undefined;
  if (typeof sessionManager?.getEntries !== 'function') {
    return false;
  }

  try {
    return !sessionManager.getEntries().some((entry) => {
      const type = (entry as { type?: unknown } | null)?.type;
      return type === 'message' || type === 'custom_message' || type === 'summary' || type === 'error';
    });
  } catch {
    return false;
  }
}

function isSmallLiveSessionFile(filePath: string): boolean {
  try {
    return statSync(filePath).size <= SMALL_LIVE_SESSION_FILE_MAX_BYTES;
  } catch {
    return false;
  }
}

function isLiveSessionSnapshotStreaming(entry: LiveSessionSnapshotHost): boolean {
  return computeCanonicalLiveSessionRunning(entry);
}

export function buildLiveSessionSnapshot(entry: LiveSessionSnapshotHost, tailBlocks?: number): LiveSessionSnapshot {
  const isStreaming = isLiveSessionSnapshotStreaming(entry);
  if (!isStreaming && !entry.isCompacting && hasNoLiveSessionEntries(entry.session)) {
    return {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      isStreaming,
    };
  }

  const liveBlocks = buildLiveStateBlocks(entry.session, {
    omitStreamMessage: false,
  });
  const sessionFile = entry.session.sessionFile?.trim();
  if (!sessionFile || !existsSync(sessionFile)) {
    return {
      blocks: applyLatestCompactionSummaryTitle(liveBlocks, entry.lastCompactionSummaryTitle),
      blockOffset: 0,
      totalBlocks: liveBlocks.length,
      isStreaming,
    };
  }

  if (liveBlocks.length === 0 && !entry.isCompacting && isSmallLiveSessionFile(sessionFile)) {
    return {
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
      isStreaming,
    };
  }

  const persisted = readTranscriptBackedConversationDetailByFile(sessionFile, { tailBlocks: normalizeLiveSnapshotTailBlocks(tailBlocks) });
  if (!persisted || persisted.blocks.length === 0) {
    return {
      blocks: applyLatestCompactionSummaryTitle(liveBlocks, entry.lastCompactionSummaryTitle),
      blockOffset: 0,
      totalBlocks: liveBlocks.length,
      isStreaming,
    };
  }

  // session.state.messages is the *current context window*, not a chronological display transcript.
  // After compaction it can reorder blocks as: summary → pre-compaction tail → post-compaction tail.
  // For idle live sessions we should render the durable transcript from disk exactly as persisted.
  if (!isStreaming && !entry.isCompacting) {
    return {
      blocks: applyLatestCompactionSummaryTitle(persisted.blocks, entry.lastCompactionSummaryTitle),
      blockOffset: persisted.blockOffset,
      totalBlocks: persisted.totalBlocks,
      isStreaming,
    };
  }

  const blocks = mergeConversationHistoryBlocks(persisted.blocks, liveBlocks);
  return {
    blocks: applyLatestCompactionSummaryTitle(blocks, entry.lastCompactionSummaryTitle),
    blockOffset: persisted.blockOffset,
    totalBlocks: persisted.blockOffset + blocks.length,
    isStreaming,
  };
}

export async function readLiveSessionStateSnapshotFromEntry(
  entry: LiveSessionStateSnapshotHost,
  title: string,
  tailBlocks?: number,
): Promise<LiveSessionStateSnapshot> {
  const snapshot = buildLiveSessionSnapshot(entry, tailBlocks);
  const isStreaming = snapshot.isStreaming;
  const modelProfile = await readSessionModelProfile(entry.session);
  if (
    snapshot.blocks.length === 0 &&
    snapshot.totalBlocks === 0 &&
    !isLiveSessionSnapshotStreaming(entry) &&
    !entry.isCompacting &&
    !entry.currentTurnError &&
    hasNoLiveSessionEntries(entry.session)
  ) {
    return {
      ...snapshot,
      hasSnapshot: true,
      isStreaming,
      isCompacting: false,
      hasStaleTurnState: false,
      goalState: null,
      systemPrompt: null,
      toolDefinitions: [],
      modelProfile,
      error: null,
      title,
      tokens: null,
      cost: null,
      contextUsage: null,
      pendingQueue: { steering: [], followUp: [] },
      parallelJobs: [],
      presence: buildLiveSessionPresenceState(entry),
      cwdChange: null,
    };
  }

  let tokens: LiveSessionStateSnapshot['tokens'] = null;
  let cost: number | null = null;
  try {
    const stats = entry.session.getSessionStats();
    tokens = stats.tokens;
    cost = stats.cost;
  } catch {
    tokens = null;
    cost = null;
  }

  return {
    ...snapshot,
    hasSnapshot: true,
    isStreaming,
    isCompacting: entry.isCompacting === true,
    hasStaleTurnState: hasQueuedOrActiveStaleTurn(entry),
    goalState: readGoalFromEntries(entry.session.sessionManager.getEntries()),
    systemPrompt: entry.session.systemPrompt?.trim() || null,
    toolDefinitions: entry.session.state.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    })),
    modelProfile,
    error: entry.currentTurnError ?? null,
    title,
    tokens,
    cost,
    contextUsage: readLiveSessionContextUsage(entry.session),
    pendingQueue: readQueueState(entry.session),
    parallelJobs: readParallelState(entry.parallelJobs),
    presence: buildLiveSessionPresenceState(entry),
    cwdChange: null,
  };
}
