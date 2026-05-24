export type ConversationLifecycleEvent =
  | 'model-error'
  | 'waiting-for-user'
  | 'blocked'
  | 'goal-active'
  | 'compaction-available'
  | 'after-run-start';

export function resolveConversationLifecycleEvent(input: {
  hasSessionError: boolean;
  hasPendingAskUserQuestion: boolean;
  conversationNeedsTakeover: boolean;
  goalActive: boolean;
  isCompacting: boolean;
  conversationRunningForPage: boolean;
}): ConversationLifecycleEvent | null {
  if (input.hasSessionError) return 'model-error';
  if (input.hasPendingAskUserQuestion) return 'waiting-for-user';
  if (input.conversationNeedsTakeover) return 'blocked';
  if (input.goalActive) return 'goal-active';
  if (input.isCompacting) return 'compaction-available';
  if (input.conversationRunningForPage) return 'after-run-start';
  return null;
}

export function filterConversationLifecycleElements<TElement extends { events: string[] }>(
  elements: TElement[],
  lifecycleEvent: ConversationLifecycleEvent | null,
): TElement[] {
  return elements.filter((item) => lifecycleEvent && item.events.includes(lifecycleEvent));
}

export function buildConversationLifecycleContext(input: {
  lifecycleEvent: ConversationLifecycleEvent | null;
  conversationId: string | undefined;
  cwd: string | null | undefined;
  isStreaming: boolean;
  hasGoal: boolean;
  isCompacting: boolean;
  error: string | null | undefined;
}): {
  conversationId: string | null;
  cwd: string | null;
  event: ConversationLifecycleEvent;
  isStreaming: boolean;
  hasGoal: boolean;
  isCompacting: boolean;
  error: string | null;
} | null {
  if (!input.lifecycleEvent) return null;
  return {
    conversationId: input.conversationId ?? null,
    cwd: input.cwd ?? null,
    event: input.lifecycleEvent,
    isStreaming: input.isStreaming,
    hasGoal: input.hasGoal,
    isCompacting: input.isCompacting,
    error: input.error ?? null,
  };
}
