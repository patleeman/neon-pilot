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

// ── Conversation runtime and running state ───────────────────────────────────
// Backend-published conversation runtime records are the authority for durable
// runtime facts such as whether a conversation is running. The derived
// RunningState folds that backend runtime together with other backend snapshots
// for task/execution indicators.

export type RunningState = 'idle' | 'streaming' | 'automation' | 'hasRuns' | 'stale';

let presenceStates = new Map<string, RunningState>();
let conversationRuntimeStates = new Map<string, ConversationRuntimeState>();
let presenceVersion = 0;
const presenceListeners = new Map<string, Set<() => void>>();
const presenceAllListeners = new Set<() => void>();

function isActiveExecutionStatus(status: string | undefined): boolean {
  return status === 'pending' || status === 'queued' || status === 'waiting' || status === 'running' || status === 'recovering';
}

function computeRunningState(sessionId: string): RunningState {
  const backendRuntime = conversationRuntimeStates.get(sessionId);
  if (backendRuntime?.running === true) return 'streaming';

  const session = sessionStore.get(sessionId);
  if (!session) return 'idle';

  if (backendRuntime === undefined && session.isRunning) return 'streaming';

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

export const conversationRuntimeStore = {
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
    rederivePresenceForId(sessionId);
  },

  clear(sessionId: string): void {
    if (!conversationRuntimeStates.has(sessionId)) return;
    conversationRuntimeStates = new Map(conversationRuntimeStates);
    conversationRuntimeStates.delete(sessionId);
    rederivePresenceForId(sessionId);
  },

  get(sessionId: string): ConversationRuntimeState | undefined {
    return conversationRuntimeStates.get(sessionId);
  },

  reset(): void {
    conversationRuntimeStates = new Map();
  },
};

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

  setBackendRunning(sessionId: string, running: boolean | null, revision = Date.now()): void {
    if (!sessionId.trim()) return;
    if (running === null) {
      conversationRuntimeStore.clear(sessionId);
    } else {
      conversationRuntimeStore.apply({ id: sessionId, running, revision, updatedAt: new Date().toISOString() });
    }
  },

  /** @deprecated Frontend code must not author running state; use backend-published conversation state. */
  setLiveStreaming(sessionId: string, running: boolean | null): void {
    this.setBackendRunning(sessionId, running);
  },

  /** Reset all cached presence (for test isolation). */
  reset(): void {
    presenceStates = new Map();
    conversationRuntimeStore.reset();
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
