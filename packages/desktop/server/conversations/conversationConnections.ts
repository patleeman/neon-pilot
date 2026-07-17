import type { DeferredResumeSummary } from '../automation/deferredResumes.js';
import { type ExecutionRecord, listConversationExecutions } from '../executions/executionService.js';
import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { listExtensionConversationConnectionProviderRegistrations } from '../extensions/extensionRegistry.js';
import type { RuntimeScopeTaskSummary } from '../routes/context.js';
import { readConversationSessionMeta } from './conversationService.js';
import { listQueuedPromptPreviews } from './liveSessions.js';

export type ConversationConnectionKind = 'activity' | 'state' | 'asset' | 'context' | 'integration' | 'surface';
export type ConversationConnectionSurface = 'activityShelf' | 'composerShelf' | 'rightRail' | 'workbench' | 'sidebar' | 'cli';
export type ConversationConnectionVisibility = 'primary' | 'system' | 'hidden';
export type ConversationConnectionStatus =
  | 'queued'
  | 'waiting'
  | 'running'
  | 'scheduled'
  | 'ready'
  | 'failed'
  | 'done'
  | 'cancelled'
  | 'available'
  | 'unknown';

export interface ConversationConnectionAction {
  id: string;
  label: string;
  command?: string;
}

export interface ConversationConnectionSource {
  type: string;
  id: string;
}

export interface ConversationConnectionItem {
  id: string;
  conversationId: string;
  kind: ConversationConnectionKind;
  title: string;
  subtitle?: string;
  status?: ConversationConnectionStatus;
  active: boolean;
  meaningful: boolean;
  visibility: ConversationConnectionVisibility;
  extensionId?: string;
  source: ConversationConnectionSource;
  surfaces: ConversationConnectionSurface[];
  createdAt?: string;
  updatedAt?: string;
  dueAt?: string;
  actions: ConversationConnectionAction[];
  payload?: unknown;
}

export interface ConversationConnectionsResult {
  conversationId: string;
  items: ConversationConnectionItem[];
  byKind: Record<ConversationConnectionKind, ConversationConnectionItem[]>;
  primary: ConversationConnectionItem[];
  system: ConversationConnectionItem[];
  hidden: ConversationConnectionItem[];
}

export interface ConversationConnectionsOptions {
  active?: boolean;
  kind?: ConversationConnectionKind | 'all';
  surface?: ConversationConnectionSurface | 'all';
  visibility?: ConversationConnectionVisibility | 'visible' | 'all';
  tasks?: RuntimeScopeTaskSummary[];
  profile?: string;
  includeExtensionProviders?: boolean;
}

function normalizeConversationId(conversationId: string): string {
  const normalized = conversationId.trim();
  if (!normalized) throw new Error('Conversation id is required.');
  return normalized;
}

function normalizeExecutionStatus(status: string | undefined): ConversationConnectionStatus {
  if (status === 'queued' || status === 'waiting' || status === 'running' || status === 'failed' || status === 'cancelled') return status;
  if (status === 'recovering') return 'running';
  if (status === 'completed') return 'done';
  return 'unknown';
}

function isActiveStatus(status: ConversationConnectionStatus | undefined): boolean {
  return status === 'queued' || status === 'waiting' || status === 'running' || status === 'scheduled' || status === 'ready';
}

function mapExecution(execution: ExecutionRecord): ConversationConnectionItem {
  const status = normalizeExecutionStatus(execution.status);
  return {
    id: `execution:${execution.id}`,
    conversationId: execution.conversationId ?? '',
    kind: 'activity',
    title: execution.title,
    ...(execution.subtitle ? { subtitle: execution.subtitle } : {}),
    status,
    active: isActiveStatus(status),
    meaningful: true,
    visibility: execution.visibility,
    source: { type: 'execution', id: execution.id },
    surfaces: ['activityShelf', 'composerShelf', 'cli'],
    ...(execution.createdAt ? { createdAt: execution.createdAt } : {}),
    ...((execution.updatedAt ?? execution.completedAt ?? execution.startedAt)
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

function normalizeDeferredResumeStatus(status: DeferredResumeSummary['status']): ConversationConnectionStatus {
  if (status === 'ready') return 'ready';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'done';
  return 'unknown';
}

function mapDeferredResume(conversationId: string, resume: DeferredResumeSummary): ConversationConnectionItem {
  const status = normalizeDeferredResumeStatus(resume.status);
  const updatedAt = resume.readyAt ?? resume.dueAt ?? resume.createdAt;
  return {
    id: `deferred-resume:${resume.id}`,
    conversationId,
    kind: 'activity',
    title: resume.kind === 'task-callback' ? 'Task callback' : 'Deferred resume',
    ...(resume.prompt ? { subtitle: resume.prompt } : {}),
    status,
    active: status === 'ready' || status === 'scheduled',
    meaningful: true,
    visibility: 'system',
    source: { type: 'deferred-resume', id: resume.id },
    surfaces: ['activityShelf', 'composerShelf', 'cli'],
    ...(resume.createdAt ? { createdAt: resume.createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
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

function mapScheduledTask(conversationId: string, task: RuntimeScopeTaskSummary): ConversationConnectionItem {
  const status: ConversationConnectionStatus = task.running ? 'running' : task.enabled ? 'scheduled' : 'unknown';
  return {
    id: `scheduled-task:${task.id}`,
    conversationId,
    kind: 'activity',
    title: task.title || task.id,
    ...((task.cron ?? task.at) ? { subtitle: task.cron ?? task.at } : {}),
    status,
    active: task.running || task.enabled,
    meaningful: true,
    visibility: 'system',
    source: { type: 'scheduled-task', id: task.id },
    surfaces: ['activityShelf', 'composerShelf', 'cli'],
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
): ConversationConnectionItem {
  const imageText = item.imageCount > 0 ? `${item.imageCount} image${item.imageCount === 1 ? '' : 's'}` : '';
  return {
    id: `queued-prompt:${type}:${item.id}`,
    conversationId,
    kind: 'activity',
    title: type === 'steer' ? 'Queued steering prompt' : 'Queued follow-up',
    ...(item.text.trim() || imageText ? { subtitle: [item.text.trim(), imageText].filter(Boolean).join(' · ') } : {}),
    status: 'queued',
    active: true,
    meaningful: true,
    visibility: 'primary',
    source: { type: 'queued-prompt', id: item.id },
    surfaces: ['activityShelf', 'composerShelf', 'cli'],
    actions: item.restorable === false ? [] : [{ id: 'restore', label: 'Restore', command: 'queuedPrompt.restore' }],
    payload: { ...item, type, queueIndex: index },
  };
}

function sortConnections(left: ConversationConnectionItem, right: ConversationConnectionItem): number {
  const leftActive = left.active ? 1 : 0;
  const rightActive = right.active ? 1 : 0;
  if (leftActive !== rightActive) return rightActive - leftActive;
  return (right.updatedAt ?? right.dueAt ?? right.createdAt ?? '').localeCompare(left.updatedAt ?? left.dueAt ?? left.createdAt ?? '');
}

function includeVisibility(item: ConversationConnectionItem, visibility: ConversationConnectionsOptions['visibility']): boolean {
  const normalized = visibility ?? 'all';
  if (normalized === 'all') return true;
  if (normalized === 'visible') return item.visibility !== 'hidden';
  return item.visibility === normalized;
}

function includeKind(item: ConversationConnectionItem, kind: ConversationConnectionsOptions['kind']): boolean {
  return !kind || kind === 'all' || item.kind === kind;
}

function includeSurface(item: ConversationConnectionItem, surface: ConversationConnectionsOptions['surface']): boolean {
  return !surface || surface === 'all' || item.surfaces.includes(surface);
}

function byKind(items: ConversationConnectionItem[]): ConversationConnectionsResult['byKind'] {
  return {
    activity: items.filter((item) => item.kind === 'activity'),
    state: items.filter((item) => item.kind === 'state'),
    asset: items.filter((item) => item.kind === 'asset'),
    context: items.filter((item) => item.kind === 'context'),
    integration: items.filter((item) => item.kind === 'integration'),
    surface: items.filter((item) => item.kind === 'surface'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeProviderItem(value: unknown, input: { conversationId: string; extensionId: string }): ConversationConnectionItem | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const kind = value.kind;
  if (!id || !title || !['activity', 'state', 'asset', 'context', 'integration', 'surface'].includes(String(kind))) return null;
  const surfaces = Array.isArray(value.surfaces)
    ? value.surfaces.filter((surface): surface is ConversationConnectionSurface =>
        ['activityShelf', 'composerShelf', 'rightRail', 'workbench', 'sidebar', 'cli'].includes(String(surface)),
      )
    : [];
  const source = isRecord(value.source) ? value.source : {};
  return {
    id: `${input.extensionId}:${id}`,
    conversationId:
      typeof value.conversationId === 'string' && value.conversationId.trim() ? value.conversationId.trim() : input.conversationId,
    kind: kind as ConversationConnectionKind,
    title,
    ...(typeof value.subtitle === 'string' && value.subtitle.trim() ? { subtitle: value.subtitle.trim() } : {}),
    ...(typeof value.status === 'string' ? { status: value.status as ConversationConnectionStatus } : {}),
    active: value.active === true,
    meaningful: value.meaningful !== false,
    visibility:
      value.visibility === 'primary' || value.visibility === 'system' || value.visibility === 'hidden' ? value.visibility : 'system',
    extensionId: input.extensionId,
    source: {
      type: typeof source.type === 'string' && source.type.trim() ? source.type.trim() : 'extension',
      id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : id,
    },
    surfaces,
    ...(typeof value.createdAt === 'string' ? { createdAt: value.createdAt } : {}),
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
    ...(typeof value.dueAt === 'string' ? { dueAt: value.dueAt } : {}),
    actions: Array.isArray(value.actions)
      ? value.actions.flatMap((action): ConversationConnectionAction[] => {
          if (!isRecord(action) || typeof action.id !== 'string' || typeof action.label !== 'string') return [];
          return [{ id: action.id, label: action.label, ...(typeof action.command === 'string' ? { command: action.command } : {}) }];
        })
      : [],
    ...(value.payload !== undefined ? { payload: value.payload } : {}),
  };
}

async function listExtensionConnections(conversationId: string): Promise<ConversationConnectionItem[]> {
  const providers = listExtensionConversationConnectionProviderRegistrations();
  const host = getExtensionHostClient();
  const results: ConversationConnectionItem[] = [];
  for (const provider of providers) {
    try {
      const response = await host.invokeAction({
        extensionId: provider.extensionId,
        actionId: provider.action,
        input: { conversationId, providerId: provider.id },
      });
      if (!response.ok) continue;
      const rawItems = Array.isArray(response.result)
        ? response.result
        : isRecord(response.result) && Array.isArray(response.result.items)
          ? response.result.items
          : [];
      for (const rawItem of rawItems) {
        const normalized = normalizeProviderItem(rawItem, { conversationId, extensionId: provider.extensionId });
        if (normalized) results.push(normalized);
      }
    } catch {
      // Extension connection providers are best-effort so one broken extension
      // cannot hide core conversation activity.
    }
  }
  return results;
}

export async function listConversationConnections(
  conversationId: string,
  options: ConversationConnectionsOptions = {},
): Promise<ConversationConnectionsResult> {
  const normalized = normalizeConversationId(conversationId);
  const sessionMeta = readConversationSessionMeta(normalized, { profile: options.profile });
  const deferredResumes = (sessionMeta?.deferredResumes ?? []) as DeferredResumeSummary[];
  const executions = (
    await listConversationExecutions(normalized, { active: options.active, visibility: options.visibility })
  ).executions.map(mapExecution);
  const tasks = (options.tasks ?? [])
    .filter((task) => taskConversationId(task) === normalized)
    .map((task) => mapScheduledTask(normalized, task));
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
  const extensionItems = options.includeExtensionProviders === false ? [] : await listExtensionConnections(normalized);
  const items = [
    ...executions,
    ...deferredResumes.map((resume) => mapDeferredResume(normalized, resume)),
    ...tasks,
    ...queued,
    ...extensionItems,
  ]
    .filter((item) => item.meaningful)
    .filter((item) => (options.active ? item.active : true))
    .filter((item) => includeKind(item, options.kind))
    .filter((item) => includeSurface(item, options.surface))
    .filter((item) => includeVisibility(item, options.visibility))
    .sort(sortConnections);

  return {
    conversationId: normalized,
    items,
    byKind: byKind(items),
    primary: items.filter((item) => item.visibility === 'primary'),
    system: items.filter((item) => item.visibility === 'system'),
    hidden: items.filter((item) => item.visibility === 'hidden'),
  };
}
