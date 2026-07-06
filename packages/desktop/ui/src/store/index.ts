/**
 * Data store — normalized entity stores with per-ID subscriptions.
 *
 * Usage:
 *   import { useSession, useConversationActivityStatus } from '../store';
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
  useConversationActivityStatus,
  useConversationActivityStatusVersion,
  useConversationRuntime,
  useConversationRuntimeVersion,
  useSession,
  useSessionsReady,
  useTitle,
  useTitleVersion,
} from './hooks';
export type { ConversationActivityStatus } from './stores';
export {
  conversationActivityStatusStore,
  conversationRuntimeStore,
  executionStore,
  runStore,
  sessionStore,
  taskStore,
  titleStore,
} from './stores';
