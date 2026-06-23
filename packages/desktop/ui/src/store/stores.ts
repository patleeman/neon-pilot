/**
 * Singleton entity stores for the reactive data layer.
 *
 * These are the canonical sources of truth for session, task, run, and
 * execution data. Backend snapshots and backend-published events write to them;
 * components and hooks read through granular subscriptions.
 */
import type { ConversationRuntimeState, DurableRunRecord, ExecutionRecord, ScheduledTaskSummary, SessionMeta } from '../shared/types';
import { createEntityStore, type EntityStore } from './createEntityStore';

// ── Entity stores ────────────────────────────────────────────────────────────

export const sessionStore: EntityStore<SessionMeta> = createEntityStore<SessionMeta>();
export const taskStore: EntityStore<ScheduledTaskSummary> = createEntityStore<ScheduledTaskSummary>();
export const runStore: EntityStore<DurableRunRecord> = createEntityStore<DurableRunRecord>(undefined, (r) => r.runId);
export const executionStore: EntityStore<ExecutionRecord> = createEntityStore<ExecutionRecord>();

// ── Conversation runtime and derived activity status ─────────────────────────
// Backend-published conversation runtime records are the authority for durable
// runtime facts such as whether a conversation is running. The derived
// ConversationActivityStatus folds that backend runtime together with other
// backend snapshots for task/execution indicators.

export type ConversationActivityStatus = 'idle' | 'streaming' | 'automation' | 'hasRuns' | 'stale';

let conversationActivityStatusStates = new Map<string, ConversationActivityStatus>();
let conversationRuntimeStates = new Map<string, ConversationRuntimeState>();
let conversationActivityStatusVersion = 0;
const conversationRuntimeListeners = new Map<string, Set<() => void>>();
const conversationActivityStatusListeners = new Map<string, Set<() => void>>();
const conversationActivityStatusAllListeners = new Set<() => void>();

function isActiveExecutionStatus(status: string | undefined): boolean {
  return status === 'pending' || status === 'queued' || status === 'waiting' || status === 'running' || status === 'recovering';
}

function computeConversationActivityStatus(sessionId: string): ConversationActivityStatus {
  const backendRuntime = conversationRuntimeStates.get(sessionId);
  if (backendRuntime?.running === true) return 'streaming';

  const session = sessionStore.get(sessionId);
  if (!session) return 'idle';

  if (backendRuntime === undefined && session.isRunning) return 'streaming';

  // Thread-owned automation scheduled or actively running for this thread.
  const hasAutomation = taskStore.getAll().some((t) => (t.running || t.enabled) && t.threadConversationId === sessionId);
  if (hasAutomation) return 'automation';

  // Pending executions (background commands, subagents, etc.) for this thread only.
  const hasPendingRuns = executionStore.getAll().some((e) => e.conversationId === sessionId && isActiveExecutionStatus(e.status));
  if (hasPendingRuns) return 'hasRuns';

  return 'idle';
}

function rederiveConversationActivityStatusForAll(): void {
  const affectedIds = new Set<string>();
  for (const id of conversationActivityStatusStates.keys()) {
    const next = computeConversationActivityStatus(id);
    const current = conversationActivityStatusStates.get(id);
    if (current !== next) {
      conversationActivityStatusStates.set(id, next);
      affectedIds.add(id);
    }
  }
  if (affectedIds.size === 0) return;
  conversationActivityStatusVersion += 1;
  for (const id of affectedIds) {
    conversationActivityStatusListeners.get(id)?.forEach((cb) => cb());
  }
  conversationActivityStatusAllListeners.forEach((cb) => cb());
}

function rederiveConversationActivityStatusForId(sessionId: string): void {
  const next = computeConversationActivityStatus(sessionId);
  const current = conversationActivityStatusStates.get(sessionId);
  if (current === next) return;
  conversationActivityStatusStates = new Map(conversationActivityStatusStates).set(sessionId, next);
  conversationActivityStatusVersion += 1;
  conversationActivityStatusListeners.get(sessionId)?.forEach((cb) => cb());
  conversationActivityStatusAllListeners.forEach((cb) => cb());
}

// Wire source-store changes to derived activity-status re-computation.
sessionStore.subscribeAll(() => rederiveConversationActivityStatusForAll());
taskStore.subscribeAll(() => rederiveConversationActivityStatusForAll());
executionStore.subscribeAll(() => rederiveConversationActivityStatusForAll());

export const conversationRuntimeStore = {
  subscribe(sessionId: string, callback: () => void): () => void {
    if (!conversationRuntimeListeners.has(sessionId)) conversationRuntimeListeners.set(sessionId, new Set());
    conversationRuntimeListeners.get(sessionId)!.add(callback);
    return () => {
      conversationRuntimeListeners.get(sessionId)?.delete(callback);
    };
  },

  apply(runtime: ConversationRuntimeState): void {
    const sessionId = runtime.id.trim();
    if (!sessionId) return;
    const current = conversationRuntimeStates.get(sessionId);
    if (current && runtime.revision < current.revision) return;
    if (
      current &&
      runtime.revision === current.revision &&
      current.running === runtime.running &&
      current.updatedAt === runtime.updatedAt
    ) {
      return;
    }
    conversationRuntimeStates = new Map(conversationRuntimeStates).set(sessionId, { ...runtime, id: sessionId });
    conversationRuntimeListeners.get(sessionId)?.forEach((cb) => cb());
    rederiveConversationActivityStatusForId(sessionId);
  },

  reconcileIdleFromSessionMeta(session: Pick<SessionMeta, 'id' | 'isRunning'>): void {
    const sessionId = session.id.trim();
    if (!sessionId || session.isRunning !== false) return;
    const current = conversationRuntimeStates.get(sessionId);
    if (current?.running !== true) return;

    conversationRuntimeStates = new Map(conversationRuntimeStates).set(sessionId, {
      ...current,
      running: false,
      updatedAt: new Date().toISOString(),
    });
    conversationRuntimeListeners.get(sessionId)?.forEach((cb) => cb());
    rederiveConversationActivityStatusForId(sessionId);
  },

  clear(sessionId: string): void {
    if (!conversationRuntimeStates.has(sessionId)) return;
    conversationRuntimeStates = new Map(conversationRuntimeStates);
    conversationRuntimeStates.delete(sessionId);
    conversationRuntimeListeners.get(sessionId)?.forEach((cb) => cb());
    rederiveConversationActivityStatusForId(sessionId);
  },

  get(sessionId: string): ConversationRuntimeState | undefined {
    return conversationRuntimeStates.get(sessionId);
  },

  reset(): void {
    conversationRuntimeStates = new Map();
    conversationRuntimeListeners.clear();
  },
};

export const conversationActivityStatusStore = {
  subscribe(sessionId: string, callback: () => void): () => void {
    // Ensure the session is tracked so rederiveConversationActivityStatusForAll() picks it up
    if (!conversationActivityStatusStates.has(sessionId)) {
      conversationActivityStatusStates = new Map(conversationActivityStatusStates).set(
        sessionId,
        computeConversationActivityStatus(sessionId),
      );
    }
    if (!conversationActivityStatusListeners.has(sessionId)) conversationActivityStatusListeners.set(sessionId, new Set());
    conversationActivityStatusListeners.get(sessionId)!.add(callback);
    return () => {
      conversationActivityStatusListeners.get(sessionId)?.delete(callback);
    };
  },

  subscribeAll(callback: () => void): () => void {
    conversationActivityStatusAllListeners.add(callback);
    return () => {
      conversationActivityStatusAllListeners.delete(callback);
    };
  },

  get(sessionId: string): ConversationActivityStatus {
    if (!conversationActivityStatusStates.has(sessionId)) {
      conversationActivityStatusStates = new Map(conversationActivityStatusStates).set(
        sessionId,
        computeConversationActivityStatus(sessionId),
      );
    }
    return conversationActivityStatusStates.get(sessionId) ?? 'idle';
  },

  getVersion(): number {
    return conversationActivityStatusVersion;
  },

  /** Reset cached activity status (for test isolation). */
  reset(): void {
    conversationActivityStatusStates = new Map();
    conversationRuntimeStore.reset();
    conversationActivityStatusVersion = 0;
    conversationActivityStatusListeners.clear();
    conversationActivityStatusAllListeners.clear();
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
  conversationActivityStatusStore.reset();
  titleStore.reset();
}
