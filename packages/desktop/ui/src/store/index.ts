/**
 * Data store — normalized entity stores with per-ID subscriptions.
 *
 * Usage:
 *   import { useSession, useSessionPresence, useCanSend } from '../store';
 *
 * The stores are wired to the SSE event system in App.tsx. Components
 * subscribe to individual entities and only re-render when their ID changes.
 */
export type { EntityStore } from './createEntityStore';
export { createEntityStore } from './createEntityStore';
export {
  useAllExecutions,
  useAllRuns,
  useAllSessions,
  useAllTasks,
  useCanSend,
  useSession,
  useSessionPresence,
  useSessionsReady,
  useSessionTitle,
} from './hooks';
export type { RunningState } from './stores';
export { executionStore, presenceStore, resetAllStores, runStore, sessionStore, taskStore, titleStore } from './stores';
