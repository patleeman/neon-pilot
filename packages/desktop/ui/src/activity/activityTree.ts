import { summarizeConversationBackgroundWorkKind } from '../conversation/conversationExecutionActivity';
import type { ExecutionRecord, SessionMeta } from '../shared/types';

export type ActivityTreeItemKind = 'conversation' | 'execution' | 'run' | 'terminal' | 'artifact' | 'checkpoint' | 'group';
export type ActivityTreeItemStatus = 'idle' | 'running' | 'queued' | 'failed' | 'done';

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

function formatConversationActivityTitle(session: SessionMeta): string {
  const title = session.title || 'Untitled thread';
  switch (session.offshootKind) {
    case 'subagent':
      return `subagent: ${title}`;
    case 'fork':
      return `fork: ${title}`;
    case 'rewind':
      return `rewind: ${title}`;
    case 'duplicate':
      return `duplicate: ${title}`;
    case 'side':
      return `side: ${title}`;
    default:
      return title;
  }
}

export function buildActivityTreeItems({ conversations, executions = [] }: BuildActivityTreeInput): ActivityTreeItem[] {
  const conversationIds = new Set(conversations.map((session) => session.id));
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

    items.push({
      id: buildExecutionActivityId(execution.id),
      kind: 'execution',
      parentId: buildConversationActivityId(parentConversationId),
      title: execution.title || execution.id,
      subtitle: execution.kind,
      status: normalizeRunStatus(execution.status),
      route: sourceConversationId
        ? `/conversations/${encodeURIComponent(sourceConversationId)}`
        : `/conversations/${encodeURIComponent(parentConversationId)}?run=${encodeURIComponent(execution.id)}`,
      updatedAt: execution.updatedAt ?? execution.startedAt ?? execution.createdAt,
      metadata: { executionId: execution.id, runId: execution.id, conversationId: routeConversationId },
    });
  }

  return items;
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
