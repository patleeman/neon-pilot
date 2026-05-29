/**
 * Singleton entity stores for the reactive data layer.
 *
 * These are the canonical sources of truth for session, task, run, and
 * execution data. Only the SSE event handler in App.tsx writes to them;
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
const presenceListeners = new Map<string, Set<() => void>>();

function computeRunningState(sessionId: string): RunningState {
  const session = sessionStore.get(sessionId);
  if (!session) return 'idle';

  // Explicit running flag from SSE live session
  if (session.isRunning) return 'streaming';

  // Automation task actively running for this thread
  const hasAutomation = taskStore.getAll().some((t) => t.running && t.threadConversationId === sessionId);
  if (hasAutomation) return 'automation';

  // Pending executions (background commands, subagents, etc.)
  const hasPendingRuns = executionStore.getAll().some((e) => e.status === 'pending' || e.status === 'running');
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
  for (const id of affectedIds) {
    presenceListeners.get(id)?.forEach((cb) => cb());
  }
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

  get(sessionId: string): RunningState {
    if (!presenceStates.has(sessionId)) {
      presenceStates = new Map(presenceStates).set(sessionId, computeRunningState(sessionId));
    }
    return presenceStates.get(sessionId) ?? 'idle';
  },

  /** Reset all cached presence (for test isolation). */
  reset(): void {
    presenceStates = new Map();
    presenceListeners.clear();
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
