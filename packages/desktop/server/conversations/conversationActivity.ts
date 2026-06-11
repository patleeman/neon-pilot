import type { DeferredResumeSummary } from '../automation/deferredResumes.js';
import { listConversationExecutions, type ExecutionRecord } from '../executions/executionService.js';
import type { RuntimeScopeTaskSummary } from '../routes/context.js';
import { listQueuedPromptPreviews } from './liveSessions.js';
import { readConversationSessionMeta } from './conversationService.js';

export type ConversationActivityKind = 'execution' | 'deferred-resume' | 'scheduled-task' | 'queued-prompt';
export type ConversationActivityVisibility = 'primary' | 'system' | 'hidden';
export type ConversationActivityStatus = 'queued' | 'waiting' | 'running' | 'scheduled' | 'ready' | 'failed' | 'done' | 'cancelled' | 'unknown';

export interface ConversationActivityAction {
  id: string;
  label: string;
  command?: string;
}

export interface ConversationActivityItem {
  id: string;
  kind: ConversationActivityKind;
  title: string;
  subtitle?: string;
  status: ConversationActivityStatus;
  active: boolean;
  visibility: ConversationActivityVisibility;
  conversationId: string;
  source: {
    type: ConversationActivityKind;
    id: string;
  };
  createdAt?: string;
  updatedAt?: string;
  dueAt?: string;
  actions: ConversationActivityAction[];
  payload?: unknown;
}

export interface ConversationActivityResult {
  conversationId: string;
  items: ConversationActivityItem[];
  primary: ConversationActivityItem[];
  system: ConversationActivityItem[];
  hidden: ConversationActivityItem[];
}

export interface ConversationActivityOptions {
  active?: boolean;
  visibility?: ConversationActivityVisibility | 'visible' | 'all';
  tasks?: RuntimeScopeTaskSummary[];
  profile?: string;
}

function normalizeConversationId(conversationId: string): string {
  const normalized = conversationId.trim();
  if (!normalized) throw new Error('Conversation id is required.');
  return normalized;
}

function normalizeExecutionStatus(status: string | undefined): ConversationActivityStatus {
  if (status === 'queued' || status === 'waiting' || status === 'running' || status === 'failed' || status === 'cancelled') return status;
  if (status === 'recovering') return 'running';
  if (status === 'completed') return 'done';
  return 'unknown';
}

function isActiveStatus(status: ConversationActivityStatus): boolean {
  return status === 'queued' || status === 'waiting' || status === 'running' || status === 'scheduled' || status === 'ready';
}

function mapExecution(execution: ExecutionRecord): ConversationActivityItem {
  const status = normalizeExecutionStatus(execution.status);
  return {
    id: `execution:${execution.id}`,
    kind: 'execution',
    title: execution.title,
    ...(execution.subtitle ? { subtitle: execution.subtitle } : {}),
    status,
    active: isActiveStatus(status),
    visibility: execution.visibility,
    conversationId: execution.conversationId ?? '',
    source: { type: 'execution', id: execution.id },
    ...(execution.createdAt ? { createdAt: execution.createdAt } : {}),
    ...(execution.updatedAt ?? execution.completedAt ?? execution.startedAt
      ? { updatedAt: execution.updatedAt ?? execution.completedAt ?? execution.startedAt }
      : {}),
    actions: [
      ...(execution.capabilities.canCancel ? [{ id: 'cancel', label: 'Cancel', command: 'execution.cancel' }] : []),
      ...(execution.capabilities.canRerun ? [{ id: 'rerun', label: 'Rerun', command: 'execution.rerun' }] : []),
      ...(execution.capabilities.canFollowUp ? [{ id: 'follow-up', label: 'Follow up', command: 'execution.followUp' }] : []),
      ...(execution.capabilities.hasLog ? [{ id: 'open', label: 'Open', command: 'execution.open' }] : []),
    ],
    payload: execution,
  };
}

function normalizeDeferredResumeStatus(status: DeferredResumeSummary['status']): ConversationActivityStatus {
  if (status === 'ready') return 'ready';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'done';
  return 'unknown';
}

function mapDeferredResume(conversationId: string, resume: DeferredResumeSummary): ConversationActivityItem {
  const status = normalizeDeferredResumeStatus(resume.status);
  return {
    id: `deferred-resume:${resume.id}`,
    kind: 'deferred-resume',
    title: resume.kind === 'task-callback' ? 'Task callback' : 'Deferred resume',
    ...(resume.promptPreview ? { subtitle: resume.promptPreview } : {}),
    status,
    active: status === 'ready' || status === 'scheduled',
    visibility: 'system',
    conversationId,
    source: { type: 'deferred-resume', id: resume.id },
    ...(resume.createdAt ? { createdAt: resume.createdAt } : {}),
    ...(resume.updatedAt ? { updatedAt: resume.updatedAt } : {}),
    ...(resume.dueAt ? { dueAt: resume.dueAt } : {}),
    actions: [
      ...(status === 'scheduled' ? [{ id: 'fire-now', label: 'Run now', command: 'deferredResume.fireNow' }] : []),
      ...(status === 'scheduled' || status === 'ready' ? [{ id: 'cancel', label: 'Cancel', command: 'deferredResume.cancel' }] : []),
    ],
    payload: resume,
  };
}

function taskConversationId(task: RuntimeScopeTaskSummary): string | undefined {
  const value = (task as RuntimeScopeTaskSummary & { threadConversationId?: unknown }).threadConversationId;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function mapScheduledTask(conversationId: string, task: RuntimeScopeTaskSummary): ConversationActivityItem {
  const status: ConversationActivityStatus = task.running ? 'running' : task.enabled ? 'scheduled' : 'unknown';
  return {
    id: `scheduled-task:${task.id}`,
    kind: 'scheduled-task',
    title: task.title || task.id,
    ...(task.cron ?? task.at ? { subtitle: task.cron ?? task.at } : {}),
    status,
    active: task.running || task.enabled,
    visibility: 'system',
    conversationId,
    source: { type: 'scheduled-task', id: task.id },
    ...(task.lastRunAt ? { updatedAt: task.lastRunAt } : {}),
    ...(task.at ? { dueAt: task.at } : {}),
    actions: [
      ...(task.enabled && !task.running ? [{ id: 'run-now', label: 'Run now', command: 'scheduledTask.runNow' }] : []),
      { id: 'open', label: 'Open', command: 'scheduledTask.open' },
    ],
    payload: task,
  };
}

function mapQueuedPrompt(
  conversationId: string,
  item: { id: string; text: string; imageCount: number; restorable?: boolean },
  type: 'steer' | 'followUp',
  index: number,
): ConversationActivityItem {
  const imageText = item.imageCount > 0 ? `${item.imageCount} image${item.imageCount === 1 ? '' : 's'}` : '';
  return {
    id: `queued-prompt:${type}:${item.id}`,
    kind: 'queued-prompt',
    title: type === 'steer' ? 'Queued steering prompt' : 'Queued follow-up',
    ...(item.text.trim() || imageText ? { subtitle: [item.text.trim(), imageText].filter(Boolean).join(' · ') } : {}),
    status: 'queued',
    active: true,
    visibility: 'primary',
    conversationId,
    source: { type: 'queued-prompt', id: item.id },
    actions: item.restorable === false ? [] : [{ id: 'restore', label: 'Restore', command: 'queuedPrompt.restore' }],
    payload: { ...item, type, queueIndex: index },
  };
}

function sortActivityItems(left: ConversationActivityItem, right: ConversationActivityItem): number {
  const leftActive = left.active ? 1 : 0;
  const rightActive = right.active ? 1 : 0;
  if (leftActive !== rightActive) return rightActive - leftActive;
  return (right.updatedAt ?? right.dueAt ?? right.createdAt ?? '').localeCompare(left.updatedAt ?? left.dueAt ?? left.createdAt ?? '');
}

function includeVisibility(item: ConversationActivityItem, visibility: ConversationActivityOptions['visibility']): boolean {
  const normalized = visibility ?? 'all';
  if (normalized === 'all') return true;
  if (normalized === 'visible') return item.visibility !== 'hidden';
  return item.visibility === normalized;
}

export async function listConversationActivity(
  conversationId: string,
  options: ConversationActivityOptions = {},
): Promise<ConversationActivityResult> {
  const normalized = normalizeConversationId(conversationId);
  const sessionMeta = readConversationSessionMeta(normalized, { profile: options.profile });
  const deferredResumes = (sessionMeta?.deferredResumes ?? []) as DeferredResumeSummary[];
  const executions = (await listConversationExecutions(normalized, { active: options.active, visibility: options.visibility })).executions.map(
    mapExecution,
  );
  const tasks = (options.tasks ?? []).filter((task) => taskConversationId(task) === normalized).map((task) => mapScheduledTask(normalized, task));
  const queued = (() => {
    try {
      const previews = listQueuedPromptPreviews(normalized);
      return [
        ...previews.steering.map((item, index) => mapQueuedPrompt(normalized, item, 'steer', index)),
        ...previews.followUp.map((item, index) => mapQueuedPrompt(normalized, item, 'followUp', index)),
      ];
    } catch {
      return [];
    }
  })();
  const items = [...executions, ...deferredResumes.map((resume) => mapDeferredResume(normalized, resume)), ...tasks, ...queued]
    .filter((item) => (options.active ? item.active : true))
    .filter((item) => includeVisibility(item, options.visibility))
    .sort(sortActivityItems);

  return {
    conversationId: normalized,
    items,
    primary: items.filter((item) => item.visibility === 'primary'),
    system: items.filter((item) => item.visibility === 'system'),
    hidden: items.filter((item) => item.visibility === 'hidden'),
  };
}
