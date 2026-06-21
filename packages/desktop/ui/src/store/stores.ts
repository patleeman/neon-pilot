/**
 * Singleton entity stores for the reactive data layer.
 *
 * These are the canonical sources of truth for session, task, run, and
 * execution data. Backend snapshots and backend-published events write to them;
 * components and hooks read through granular subscriptions.
 */
import type { DurableRunRecord, ExecutionRecord, ScheduledTaskSummary, SessionMeta } from '../shared/types';
import { createEntityStore, type EntityStore } from './createEntityStore';

// ── Entity stores ────────────────────────────────────────────────────────────

export const sessionStore: EntityStore<SessionMeta> = createEntityStore<SessionMeta>();
export const taskStore: EntityStore<ScheduledTaskSummary> = createEntityStore<ScheduledTaskSummary>();
export const runStore: EntityStore<DurableRunRecord> = createEntityStore<DurableRunRecord>(undefined, (r) => r.runId);
export const executionStore: EntityStore<ExecutionRecord> = createEntityStore<ExecutionRecord>();

// ── Running state (derived) ──────────────────────────────────────────────────
// Merges session.isRunning + automation tasks + pending executions into one
// canonical RunningState per conversation ID. Components subscribe per-ID.

export type RunningState = 'idle' | 'streaming' | 'automation' | 'hasRuns' | 'stale';

let presenceStates = new Map<string, RunningState>();
let liveStreamingOverrides = new Map<string, boolean>();
let presenceVersion = 0;
const presenceListeners = new Map<string, Set<() => void>>();
const presenceAllListeners = new Set<() => void>();

function isActiveExecutionStatus(status: string | undefined): boolean {
  return status === 'pending' || status === 'queued' || status === 'waiting' || status === 'running' || status === 'recovering';
}

function computeRunningState(sessionId: string): RunningState {
  const liveStreamingOverride = liveStreamingOverrides.get(sessionId);
  if (liveStreamingOverride === true) return 'streaming';

  const session = sessionStore.get(sessionId);
  if (!session) return 'idle';

  if (liveStreamingOverride === true) return 'streaming';
  if (liveStreamingOverride === undefined && session.isRunning) return 'streaming';

  // Automation task actively running for this thread
  const hasAutomation = taskStore.getAll().some((t) => t.running && t.threadConversationId === sessionId);
  if (hasAutomation) return 'automation';

  // Pending executions (background commands, subagents, etc.) for this thread only.
  const hasPendingRuns = executionStore.getAll().some((e) => e.conversationId === sessionId && isActiveExecutionStatus(e.status));
  if (hasPendingRuns) return 'hasRuns';

  return 'idle';
}

function rederivePresenceForAll(): void {
  const affectedIds = new Set<string>();
  for (const id of presenceStates.keys()) {
    const next = computeRunningState(id);
    const current = presenceStates.get(id);
    if (current !== next) {
      presenceStates.set(id, next);
      affectedIds.add(id);
    }
  }
  if (affectedIds.size === 0) return;
  presenceVersion += 1;
  for (const id of affectedIds) {
    presenceListeners.get(id)?.forEach((cb) => cb());
  }
  presenceAllListeners.forEach((cb) => cb());
}

function rederivePresenceForId(sessionId: string): void {
  const next = computeRunningState(sessionId);
  const current = presenceStates.get(sessionId);
  if (current === next) return;
  presenceStates = new Map(presenceStates).set(sessionId, next);
  presenceVersion += 1;
  presenceListeners.get(sessionId)?.forEach((cb) => cb());
  presenceAllListeners.forEach((cb) => cb());
}

// Wire source-store changes to presence re-derivation
sessionStore.subscribeAll(() => rederivePresenceForAll());
taskStore.subscribeAll(() => rederivePresenceForAll());
executionStore.subscribeAll(() => rederivePresenceForAll());

export const presenceStore = {
  subscribe(sessionId: string, callback: () => void): () => void {
    // Ensure the session is tracked so rederivePresenceForAll() picks it up
    if (!presenceStates.has(sessionId)) {
      presenceStates = new Map(presenceStates).set(sessionId, computeRunningState(sessionId));
    }
    if (!presenceListeners.has(sessionId)) presenceListeners.set(sessionId, new Set());
    presenceListeners.get(sessionId)!.add(callback);
    return () => {
      presenceListeners.get(sessionId)?.delete(callback);
    };
  },

  subscribeAll(callback: () => void): () => void {
    presenceAllListeners.add(callback);
    return () => {
      presenceAllListeners.delete(callback);
    };
  },

  get(sessionId: string): RunningState {
    if (!presenceStates.has(sessionId)) {
      presenceStates = new Map(presenceStates).set(sessionId, computeRunningState(sessionId));
    }
    return presenceStates.get(sessionId) ?? 'idle';
  },

  getVersion(): number {
    return presenceVersion;
  },

  setLiveStreaming(sessionId: string, running: boolean | null): void {
    if (!sessionId.trim()) return;
    if (running === null) {
      if (!liveStreamingOverrides.has(sessionId)) return;
      liveStreamingOverrides = new Map(liveStreamingOverrides);
      liveStreamingOverrides.delete(sessionId);
    } else {
      if (liveStreamingOverrides.get(sessionId) === running) return;
      liveStreamingOverrides = new Map(liveStreamingOverrides).set(sessionId, running);
    }
    rederivePresenceForId(sessionId);
  },

  /** Reset all cached presence (for test isolation). */
  reset(): void {
    presenceStates = new Map();
    liveStreamingOverrides = new Map();
    presenceVersion = 0;
    presenceListeners.clear();
    presenceAllListeners.clear();
  },
};

// ── Title store (derived from live_title SSE events) ─────────────────────────

const titleEntities = new Map<string, string>();
const titleListeners = new Map<string, Set<() => void>>();

export const titleStore = {
  subscribe(sessionId: string, callback: () => void): () => void {
    if (!titleListeners.has(sessionId)) titleListeners.set(sessionId, new Set());
    titleListeners.get(sessionId)!.add(callback);
    return () => {
      titleListeners.get(sessionId)?.delete(callback);
    };
  },

  get(sessionId: string): string | undefined {
    return titleEntities.get(sessionId);
  },

  /** Called by the SSE handler in App.tsx and the live stream manager. */
  set(sessionId: string, title: string): void {
    if (titleEntities.get(sessionId) === title) return;
    titleEntities.set(sessionId, title);
    titleListeners.get(sessionId)?.forEach((cb) => cb());
  },

  /** Clear all titles (for test isolation). */
  reset(): void {
    titleEntities.clear();
    titleListeners.clear();
  },
};

/** Reset all stores to initial empty state (for test isolation). */
export function resetAllStores(): void {
  sessionStore.reset?.();
  taskStore.reset?.();
  runStore.reset?.();
  executionStore.reset?.();
  presenceStore.reset();
  titleStore.reset();
}
