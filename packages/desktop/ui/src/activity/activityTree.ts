import { summarizeConversationBackgroundWorkKind } from '../conversation/conversationExecutionActivity';
import type { ExecutionRecord, ParallelPromptPreview, SessionMeta } from '../shared/types';

type ActivityTreeItemKind = 'conversation' | 'execution' | 'run' | 'terminal' | 'artifact' | 'checkpoint' | 'group';
type ActivityTreeItemStatus = 'idle' | 'running' | 'queued' | 'failed' | 'done';

/**
 * Human-friendly subtitle for an execution, avoiding raw internal enum kinds.
 * Worker executions are labeled as background workers rather than "subagent".
 */
function formatExecutionSubtitle(execution: ExecutionRecord): string | undefined {
  if (execution.workerRole === 'worker') return 'Background worker';
  switch (execution.kind) {
    case 'background-command':
      return 'Background command';
    case 'subagent':
      return 'Subagent';
    case 'scheduled-task':
      return 'Scheduled task';
    case 'deferred-resume':
      return 'Deferred resume';
    case 'conversation':
      return 'Conversation';
    default:
      return undefined;
  }
}

function executionIsActive(status: string | undefined): boolean {
  // Match server-side terminalStatus(): only completed/failed/cancelled/interrupted are terminal
  return !(status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'interrupted');
}

export interface ActivityTreeItem {
  id: string;
  kind: ActivityTreeItemKind;
  parentId?: string;
  title: string;
  subtitle?: string;
  status: ActivityTreeItemStatus;
  route?: string;
  accentColor?: string;
  backgroundColor?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BuildActivityTreeInput {
  conversations: readonly SessionMeta[];
  executions?: readonly ExecutionRecord[];
  /**
   * Parallel prompt workers to project as execution-kind child items. Each
   * preview is nested under its parent conversation when association can be
   * derived from the input: an explicit `parentConversationId`, or by looking
   * up the `childConversationId` in `conversations` and using that child's
   * `parentSessionId`.
   */
  parallelPrompts?: readonly ActivityTreeParallelPromptPreview[];
}

/**
 * Parallel prompt preview extended with an optional explicit parent
 * conversation id, used only for Activity-tree association. The worker role
 * is never trusted from caller metadata: projections always treat parallel
 * prompts as non-persona workers.
 */
export interface ActivityTreeParallelPromptPreview extends ParallelPromptPreview {
  parentConversationId?: string;
}

export function buildConversationActivityId(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function buildRunActivityId(runId: string): string {
  return buildExecutionActivityId(runId);
}

export function buildExecutionActivityId(executionId: string): string {
  return `execution:${executionId}`;
}

export function buildParallelPromptActivityId(previewId: string): string {
  return `parallel:${previewId}`;
}

function formatConversationActivityTitle(session: SessionMeta): string {
  return session.title || 'Untitled conversation';
}

export function buildActivityTreeItems({
  conversations,
  executions = [],
  parallelPrompts = [],
}: BuildActivityTreeInput): ActivityTreeItem[] {
  const conversationIds = new Set(conversations.map((session) => session.id));
  const conversationsById = new Map(conversations.map((session) => [session.id, session] as const));
  const activeExecutionConversationIds = new Set(
    executions.flatMap((execution) =>
      execution.conversationId && executionIsActive(execution.status) && execution.visibility !== 'hidden'
        ? [execution.conversationId]
        : [],
    ),
  );
  const activeExecutionsByConversationId = new Map<string, ExecutionRecord[]>();
  for (const execution of executions) {
    if (!execution.conversationId || !executionIsActive(execution.status) || execution.visibility === 'hidden') continue;
    const items = activeExecutionsByConversationId.get(execution.conversationId) ?? [];
    items.push(execution);
    activeExecutionsByConversationId.set(execution.conversationId, items);
  }
  const conversationIdBySourceRunId = new Map(
    conversations.flatMap((session) => (session.sourceRunId ? [[session.sourceRunId, session.id] as const] : [])),
  );
  const items: ActivityTreeItem[] = conversations.map((session) => ({
    id: buildConversationActivityId(session.id),
    kind: 'conversation',
    parentId:
      session.parentSessionId && conversationIds.has(session.parentSessionId)
        ? buildConversationActivityId(session.parentSessionId)
        : undefined,
    title: formatConversationActivityTitle(session),
    subtitle: session.cwd || undefined,
    status: session.isRunning ? 'running' : 'idle',
    route: `/conversations/${encodeURIComponent(session.id)}`,
    updatedAt: session.timestamp,
    metadata: {
      conversationId: session.id,
      cwd: session.cwd,
      isRunning: Boolean(session.isRunning),
      needsAttention: Boolean(session.needsAttention),
      hasPendingRuns: !session.isRunning && activeExecutionConversationIds.has(session.id),
      backgroundWorkKind: summarizeConversationBackgroundWorkKind(activeExecutionsByConversationId.get(session.id) ?? []),
    },
  }));

  for (const execution of executions) {
    const parentConversationId = execution.conversationId;
    if (!parentConversationId || !conversationIds.has(parentConversationId) || execution.visibility === 'hidden') {
      continue;
    }

    const sourceConversationId = execution.kind === 'subagent' ? conversationIdBySourceRunId.get(execution.id) : undefined;
    const routeConversationId = sourceConversationId ?? parentConversationId;

    const isWorker = execution.workerRole === 'worker';
    const workerTitle = isWorker && execution.workerName ? execution.workerName : undefined;
    items.push({
      id: buildExecutionActivityId(execution.id),
      kind: 'execution',
      parentId: buildConversationActivityId(parentConversationId),
      title: workerTitle ?? execution.title ?? execution.id,
      subtitle: formatExecutionSubtitle(execution),
      status: normalizeRunStatus(execution.status),
      route: sourceConversationId
        ? `/conversations/${encodeURIComponent(sourceConversationId)}`
        : `/conversations/${encodeURIComponent(parentConversationId)}?run=${encodeURIComponent(execution.id)}`,
      updatedAt: execution.updatedAt ?? execution.startedAt ?? execution.createdAt,
      metadata: { executionId: execution.id, runId: execution.id, conversationId: routeConversationId },
    });
  }

  for (const preview of parallelPrompts) {
    const explicitParent = preview.parentConversationId?.trim();
    const parentConversationId =
      explicitParent && conversationIds.has(explicitParent)
        ? explicitParent
        : resolveParallelPromptParentConversationId(preview, conversationsById);
    if (!parentConversationId || !conversationIds.has(parentConversationId)) {
      continue;
    }

    const workerName = typeof preview.workerName === 'string' ? preview.workerName.trim() : '';
    items.push({
      id: buildParallelPromptActivityId(preview.id),
      kind: 'execution',
      parentId: buildConversationActivityId(parentConversationId),
      title: workerName || preview.id,
      subtitle: 'Background worker',
      status: normalizeParallelPromptStatus(preview.status),
      route: `/conversations/${encodeURIComponent(preview.childConversationId)}`,
      metadata: {
        parallelPromptId: preview.id,
        childConversationId: preview.childConversationId,
        parentConversationId,
        workerRole: 'worker',
        workerName: workerName || undefined,
      },
    });
  }

  return items;
}

function resolveParallelPromptParentConversationId(
  preview: ParallelPromptPreview,
  conversationsById: Map<string, SessionMeta>,
): string | undefined {
  const child = conversationsById.get(preview.childConversationId);
  if (!child) return undefined;
  const parentSessionId = typeof child.parentSessionId === 'string' ? child.parentSessionId.trim() : '';
  return parentSessionId || undefined;
}

function normalizeRunStatus(status: string | undefined): ActivityTreeItemStatus {
  switch (status) {
    case 'running':
      return 'running';
    case 'queued':
    case 'pending':
      return 'queued';
    case 'failed':
    case 'error':
      return 'failed';
    case 'completed':
    case 'succeeded':
    case 'success':
      return 'done';
    default:
      return 'idle';
  }
}

function normalizeParallelPromptStatus(status: ParallelPromptPreview['status']): ActivityTreeItemStatus {
  switch (status) {
    case 'running':
    case 'importing':
      return 'running';
    case 'ready':
      return 'done';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
}
