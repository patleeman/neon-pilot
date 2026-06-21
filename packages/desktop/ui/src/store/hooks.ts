/**
 * React hooks for the normalized entity stores.
 *
 * Each hook uses useSyncExternalStore internally so subscribers only
 * re-render when their specific entity ID changes.
 */
import { useCallback, useSyncExternalStore } from 'react';

import type { ConversationRuntimeState, DurableRunRecord, ExecutionRecord, ScheduledTaskSummary, SessionMeta } from '../shared/types';
import type { EntityStore } from './createEntityStore';
import { conversationRuntimeStore, executionStore, presenceStore, type RunningState, runStore, sessionStore, taskStore } from './stores';

// ── Internal helper ──────────────────────────────────────────────────────────

function useEntityValue<T>(store: EntityStore<T>, id: string | null | undefined): T | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!id) return () => {};
      return store.subscribe(id, onStoreChange);
    },
    [id, store],
  );

  const getSnapshot = useCallback(() => {
    if (!id) return undefined;
    return store.get(id);
  }, [id, store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useDerivedValue<T>(subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T): T {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ── Entity hooks ─────────────────────────────────────────────────────────────

export function useSession(id: string | null | undefined): SessionMeta | undefined {
  return useEntityValue(sessionStore, id);
}

export function useSessionPresence(id: string | null | undefined): RunningState {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!id) return () => {};
      return presenceStore.subscribe(id, onStoreChange);
    },
    [id],
  );

  const getSnapshot = useCallback((): RunningState => {
    if (!id) return 'idle';
    return presenceStore.get(id);
  }, [id]);

  return useDerivedValue(subscribe, getSnapshot);
}

export function useConversationRuntime(id: string | null | undefined): ConversationRuntimeState | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!id) return () => {};
      return conversationRuntimeStore.subscribe(id, onStoreChange);
    },
    [id],
  );

  const getSnapshot = useCallback((): ConversationRuntimeState | undefined => {
    if (!id) return undefined;
    return conversationRuntimeStore.get(id);
  }, [id]);

  return useDerivedValue(subscribe, getSnapshot);
}

export function usePresenceVersion(): number {
  const subscribe = useCallback((onStoreChange: () => void) => presenceStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => presenceStore.getVersion(), []);
  return useDerivedValue(subscribe, getSnapshot);
}

// ── Collection hooks ─────────────────────────────────────────────────────────

export function useAllSessions(): readonly SessionMeta[] {
  const subscribe = useCallback((onStoreChange: () => void) => sessionStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => sessionStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Whether the session store has received its initial snapshot. */
export function useSessionsReady(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (sessionStore.subscribeReady) {
      return sessionStore.subscribeReady(onStoreChange);
    }
    return () => {};
  }, []);
  const getSnapshot = useCallback(() => sessionStore.ready, []);
  return useDerivedValue(subscribe, getSnapshot);
}

export function useAllTasks(): readonly ScheduledTaskSummary[] {
  const subscribe = useCallback((onStoreChange: () => void) => taskStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => taskStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAllRuns(): readonly DurableRunRecord[] {
  const subscribe = useCallback((onStoreChange: () => void) => runStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => runStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAllExecutions(): readonly ExecutionRecord[] {
  const subscribe = useCallback((onStoreChange: () => void) => executionStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => executionStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
