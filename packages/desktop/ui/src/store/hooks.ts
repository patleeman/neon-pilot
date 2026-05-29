/**
 * React hooks for the normalized entity stores.
 *
 * Each hook uses useSyncExternalStore internally so subscribers only
 * re-render when their specific entity ID changes.
 */
import { useCallback, useSyncExternalStore } from 'react';

import type { SessionMeta } from '../shared/types';
import type { EntityStore } from './createEntityStore';
import { presenceStore, type RunningState, sessionStore, titleStore } from './stores';

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

  return useSyncExternalStore(subscribe, getSnapshot);
}

function useDerivedValue<T>(subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T): T {
  return useSyncExternalStore(subscribe, getSnapshot);
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

export function useSessionTitle(id: string | null | undefined): string | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!id) return () => {};
      return titleStore.subscribe(id, onStoreChange);
    },
    [id],
  );

  const getSnapshot = useCallback(() => {
    if (!id) return undefined;
    return titleStore.get(id);
  }, [id]);

  return useDerivedValue(subscribe, getSnapshot);
}

// ── Composer convenience ─────────────────────────────────────────────────────

export function useCanSend(id: string | null | undefined): boolean {
  const presence = useSessionPresence(id);
  return presence !== 'streaming' && presence !== 'stale';
}

// ── Legacy compatibility ─────────────────────────────────────────────────────
// Returns the full sessions array for code that still needs to iterate
// all sessions (e.g. sidebar layout). Prefer useSession(id) for per-session
// subscriptions.

export function useAllSessions(): readonly SessionMeta[] {
  const subscribe = useCallback((onStoreChange: () => void) => sessionStore.subscribeAll(onStoreChange), []);
  const getSnapshot = useCallback(() => sessionStore.getAll(), []);
  return useSyncExternalStore(subscribe, getSnapshot);
}
