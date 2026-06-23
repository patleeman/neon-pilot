import { type AppEventTopic, invalidateAppTopics } from '../shared/appEvents.js';

export interface DesktopScheduledTaskMutationInput {
  title?: string;
  enabled?: boolean;
  cron?: string | null;
  at?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  cwd?: string | null;
  timeoutSeconds?: number | null;
  catchUpWindowSeconds?: number | null;
  prompt?: string;
  targetType?: 'background-agent' | 'conversation' | null;
  conversationBehavior?: 'steer' | 'followUp' | null;
  callbackConversationId?: string | null;
  deliverOnSuccess?: boolean | null;
  deliverOnFailure?: boolean | null;
  notifyOnSuccess?: 'none' | 'passive' | 'disruptive' | null;
  notifyOnFailure?: 'none' | 'passive' | 'disruptive' | null;
  requireAck?: boolean | null;
  autoResumeIfOpen?: boolean | null;
  threadMode?: 'dedicated' | 'existing' | 'none' | null;
  threadConversationId?: string | null;
}

export const DESKTOP_SCHEDULED_TASK_MUTATION_TOPICS = ['tasks', 'sessions', 'workspace'] satisfies AppEventTopic[];
export const DESKTOP_SCHEDULED_TASK_RUN_TOPICS = ['tasks', 'runs', 'sessions', 'workspace'] satisfies AppEventTopic[];

export function normalizeDesktopScheduledTaskCreateInput(input: DesktopScheduledTaskMutationInput): DesktopScheduledTaskMutationInput & {
  title: string;
  prompt: string;
} {
  return {
    ...input,
    title: input.title ?? '',
    prompt: input.prompt ?? '',
  };
}

export async function withDesktopScheduledTaskMutationInvalidation<T>(
  operation: () => Promise<T>,
  options: { includeRuns?: boolean } = {},
): Promise<T> {
  const result = await operation();
  invalidateAppTopics(...(options.includeRuns ? DESKTOP_SCHEDULED_TASK_RUN_TOPICS : DESKTOP_SCHEDULED_TASK_MUTATION_TOPICS));
  return result;
}
