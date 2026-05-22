import type { ExecutionListResult, ExecutionRecord, ScheduledTaskSummary } from '../shared/types';

export type ConversationBackgroundWorkKind = 'command' | 'subagent' | 'mixed' | 'other';

export function summarizeConversationBackgroundWorkKind(executions: readonly ExecutionRecord[]): ConversationBackgroundWorkKind | null {
  if (executions.length === 0) return null;

  let hasCommand = false;
  let hasSubagent = false;
  let hasOther = false;
  for (const execution of executions) {
    if (execution.kind === 'background-command') hasCommand = true;
    else if (execution.kind === 'subagent') hasSubagent = true;
    else hasOther = true;
  }

  const kindCount = Number(hasCommand) + Number(hasSubagent) + Number(hasOther);
  if (kindCount > 1) return 'mixed';
  if (hasCommand) return 'command';
  if (hasSubagent) return 'subagent';
  return 'other';
}

export function isActiveExecution(execution: ExecutionRecord): boolean {
  return (
    execution.status === 'queued' || execution.status === 'waiting' || execution.status === 'running' || execution.status === 'recovering'
  );
}

export function executionSortTimestamp(execution: ExecutionRecord): string {
  return execution.updatedAt ?? execution.startedAt ?? execution.createdAt ?? '';
}

export function buildBackgroundExecutionIndicatorText(executions: ExecutionRecord[]): string {
  if (executions.length === 0) return 'No background work';
  const latest = executions[0];
  if (!latest) return 'No background work';
  if (executions.length === 1) return `${latest.status} · ${latest.title}`;
  return `${executions.length} active · latest ${latest.title}`;
}

function buildAutomationRunningLookups(tasks: ScheduledTaskSummary[] | null | undefined): {
  byTaskId: Map<string, boolean>;
  byConversationId: Map<string, boolean>;
} {
  return {
    byTaskId: new Map((tasks ?? []).map((task) => [task.id, Boolean(task.running)] as const)),
    byConversationId: new Map(
      (tasks ?? []).flatMap((task) => (task.threadConversationId ? [[task.threadConversationId, Boolean(task.running)] as const] : [])),
    ),
  };
}

function isStaleScheduledTaskExecution(
  execution: ExecutionRecord,
  lookups: ReturnType<typeof buildAutomationRunningLookups>,
  tasks: ScheduledTaskSummary[] | null | undefined,
): boolean {
  if (execution.kind !== 'scheduled-task' || !tasks) return false;
  const taskRunning = execution.taskId
    ? lookups.byTaskId.get(execution.taskId)
    : lookups.byConversationId.get(execution.conversationId ?? '');
  return taskRunning === false;
}

export function selectConversationActiveExecutions(input: {
  conversationId: string | null | undefined;
  executions?: ExecutionListResult | null;
  tasks?: ScheduledTaskSummary[] | null;
  excludeExecutionId?: string | null;
  visibility?: 'primary' | 'visible' | 'all';
}): ExecutionRecord[] {
  const conversationId = input.conversationId?.trim();
  if (!conversationId) return [];

  const visibility = input.visibility ?? 'visible';
  const lookups = buildAutomationRunningLookups(input.tasks);
  return [...(input.executions?.executions ?? [])]
    .filter((execution) => execution.conversationId === conversationId)
    .filter((execution) => execution.id !== input.excludeExecutionId)
    .filter((execution) => {
      if (visibility === 'all') return true;
      if (visibility === 'primary') return execution.visibility === 'primary';
      return execution.visibility !== 'hidden';
    })
    .filter(isActiveExecution)
    .filter((execution) => !isStaleScheduledTaskExecution(execution, lookups, input.tasks))
    .sort((left, right) => executionSortTimestamp(right).localeCompare(executionSortTimestamp(left)));
}

export function selectConversationExecutions(input: {
  conversationId: string | null | undefined;
  executions?: ExecutionListResult | null;
  tasks?: ScheduledTaskSummary[] | null;
  visibility?: 'primary' | 'visible' | 'all';
}): ExecutionRecord[] {
  const conversationId = input.conversationId?.trim();
  if (!conversationId) return [];

  const visibility = input.visibility ?? 'visible';
  const lookups = buildAutomationRunningLookups(input.tasks);
  return [...(input.executions?.executions ?? [])]
    .filter((execution) => execution.conversationId === conversationId)
    .filter((execution) => {
      if (visibility === 'all') return true;
      if (visibility === 'primary') return execution.visibility === 'primary';
      return execution.visibility !== 'hidden';
    })
    .filter((execution) => !isStaleScheduledTaskExecution(execution, lookups, input.tasks))
    .sort((left, right) => executionSortTimestamp(right).localeCompare(executionSortTimestamp(left)));
}
