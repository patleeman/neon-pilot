import { useMemo } from 'react';

import { useAppData as useLegacyAppData } from '../app/contexts';
import { useAllSessions, useAllTasks } from '../store';

/**
 * Backward-compatible extension API: returns data shaped like the old
 * AppDataContext, but populated from the reactive entity stores.
 */
export function useAppData() {
  const { projects, setProjects } = useLegacyAppData();
  const sessions = useAllSessions();
  const tasks = useAllTasks();
  return useMemo(
    () => ({
      projects,
      sessions,
      tasks,
      setProjects,
    }),
    [projects, sessions, tasks, setProjects],
  );
}

export { api } from '../client/api';
export { summarizeConversationCwd } from '../conversation/conversationCwdHistory';
export type { MentionItem } from '../conversation/conversationMentions';
export type { RelatedConversationSearchResult } from '../conversation/relatedConversationSearch';
export {
  EXTENSION_REGISTRY_CHANGED_EVENT,
  getExtensionRegistryRevision,
  notifyExtensionRegistryChanged,
} from '../extensions/extensionRegistryEvents';
export type { ExtensionInstallSummary } from '../extensions/types';
export { GATEWAY_STATE_CHANGED_EVENT, notifyGatewayStateChanged } from '../gateways/gatewayEvents';
export { CONVERSATION_LAYOUT_CHANGED_EVENT, readConversationLayout } from '../session/sessionTabs';
export type {
  AppTelemetryEventRow,
  CacheEfficiencyAggregate,
  ContextPointerUsageResult,
  GatewayConnection,
  GatewayEvent,
  GatewayState,
  GatewayThreadBinding,
  KnowledgeBaseState,
  MemoryDocItem,
  ScheduledTaskSchedulerHealth,
  ScheduledTaskSummary,
  SessionMeta,
  SystemPromptAggregate,
  ToolFlowResult,
  TraceAgentLoop,
  TraceCompactionAggs,
  TraceCompactionEvent,
  TraceContextSession,
  TraceModelUsage,
  TraceThroughput,
  TraceTokenDaily,
  TraceToolHealth,
} from '../shared/types';
export { timeAgo, timeAgoCompact } from '../shared/utils';
export type { AskUserQuestionAnswers, AskUserQuestionPresentation } from '../transcript/askUserQuestions';
export {
  isAskUserQuestionComplete,
  moveAskUserQuestionIndex,
  resolveAskUserQuestionDefaultOptionIndex,
  resolveAskUserQuestionNavigationHotkey,
  resolveAskUserQuestionOptionHotkey,
  shouldAdvanceAskUserQuestionAfterSelection,
} from '../transcript/askUserQuestions';
