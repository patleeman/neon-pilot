import { type AgentSession, type SessionManager } from '@earendil-works/pi-coding-agent';

import { getAssistantErrorDisplayMessage } from './sessionAssistantErrors.js';

function resolveDanglingToolCallRepairLeafId(sessionManager: Pick<SessionManager, 'getBranch'>): string | null | undefined {
  const branch = sessionManager.getBranch();
  if (branch.length === 0) {
    return undefined;
  }

  let pendingAssistant:
    | {
        parentId: string | null | undefined;
        unresolvedToolCallIds: Set<string>;
      }
    | undefined;

  for (const entry of branch) {
    if (pendingAssistant) {
      if (entry?.type === 'message' && entry.message.role === 'toolResult') {
        const toolCallId = entry.message.toolCallId?.trim();
        if (toolCallId) {
          pendingAssistant.unresolvedToolCallIds.delete(toolCallId);
        }
        if (pendingAssistant.unresolvedToolCallIds.size === 0) {
          pendingAssistant = undefined;
        }
        continue;
      }

      if (pendingAssistant.unresolvedToolCallIds.size > 0) {
        return pendingAssistant.parentId ?? null;
      }
    }

    if (entry?.type !== 'message' || entry.message.role !== 'assistant') {
      continue;
    }

    const toolCallIds = entry.message.content.flatMap((part) => {
      if (part.type !== 'toolCall') {
        return [];
      }
      const toolCallId = part.id?.trim();
      return toolCallId ? [toolCallId] : [];
    });

    if (toolCallIds.length > 0) {
      pendingAssistant = {
        parentId: entry.parentId,
        unresolvedToolCallIds: new Set(toolCallIds),
      };
    }
  }

  return pendingAssistant && pendingAssistant.unresolvedToolCallIds.size > 0 ? (pendingAssistant.parentId ?? null) : undefined;
}

export function repairDanglingToolCallContext(session: Pick<AgentSession, 'sessionManager' | 'state'>): boolean {
  const sessionManager = session.sessionManager as
    | Partial<Pick<SessionManager, 'getBranch' | 'getEntry' | 'branch' | 'resetLeaf' | 'buildSessionContext'>>
    | undefined;
  if (
    !sessionManager ||
    typeof sessionManager.getBranch !== 'function' ||
    typeof sessionManager.getEntry !== 'function' ||
    typeof sessionManager.branch !== 'function' ||
    typeof sessionManager.resetLeaf !== 'function' ||
    typeof sessionManager.buildSessionContext !== 'function'
  ) {
    return false;
  }

  const repairLeafId = resolveDanglingToolCallRepairLeafId(sessionManager as Pick<SessionManager, 'getBranch'>);
  if (repairLeafId === undefined) {
    return false;
  }

  if (repairLeafId === null) {
    sessionManager.resetLeaf();
  } else {
    sessionManager.branch(repairLeafId);
  }
  session.state.messages = sessionManager.buildSessionContext().messages;
  return true;
}

export type TranscriptTailRecoveryReason = 'assistant_error' | 'dangling_tool_call';

export interface TranscriptTailRecoveryPlan {
  targetEntryId: string | null;
  reason: TranscriptTailRecoveryReason;
  summary: string;
  details?: unknown;
}

function resolveVisibleSessionBranchTargetId(entryId: string | null | undefined): string | null {
  return entryId ?? null;
}

function buildTranscriptTailRecoveryPlan(input: {
  targetEntryId: string | null;
  reason: TranscriptTailRecoveryReason;
  errorMessage?: string;
}): TranscriptTailRecoveryPlan {
  const summaryLines =
    input.reason === 'assistant_error'
      ? ['Recovered from a failed tail so the conversation can continue from the last stable point.']
      : ['Recovered from an unfinished tool-use tail so the conversation can continue from the last stable point.'];

  const errorMessage = input.errorMessage?.trim();
  if (errorMessage) {
    summaryLines.push(`Error: ${errorMessage}`);
  }

  return {
    targetEntryId: input.targetEntryId,
    reason: input.reason,
    summary: summaryLines.join('\n'),
    details: {
      source: 'conversation-recovery',
      reason: input.reason,
      ...(errorMessage ? { errorMessage } : {}),
    },
  };
}

function isContextOverflowMessage(message: string | undefined): boolean {
  return /context_length_exceeded|context window|context overflow/i.test(message ?? '');
}

function hasPriorOverflowTailRecovery(branch: ReturnType<SessionManager['getBranch']>): boolean {
  return branch.some((entry) => {
    if (entry?.type !== 'branch_summary') return false;
    const details = entry.details;
    if (!details || typeof details !== 'object') return false;
    const record = details as Record<string, unknown>;
    return (
      record.source === 'conversation-recovery' &&
      record.reason === 'assistant_error' &&
      typeof record.errorMessage === 'string' &&
      isContextOverflowMessage(record.errorMessage)
    );
  });
}

export function resolveTranscriptTailRecoveryPlan(sessionManager: Pick<SessionManager, 'getBranch'>): TranscriptTailRecoveryPlan | null {
  const branch = sessionManager.getBranch();
  if (branch.length === 0) {
    return null;
  }

  const leafEntry = branch[branch.length - 1];
  if (leafEntry?.type === 'message' && leafEntry.message.role === 'assistant') {
    const errorMessage = getAssistantErrorDisplayMessage(leafEntry.message);
    if (errorMessage) {
      if (isContextOverflowMessage(errorMessage) && hasPriorOverflowTailRecovery(branch)) {
        return null;
      }
      return buildTranscriptTailRecoveryPlan({
        targetEntryId: resolveVisibleSessionBranchTargetId(leafEntry.parentId ?? null),
        reason: 'assistant_error',
        errorMessage,
      });
    }
  }

  const danglingToolCallRepairLeafId = resolveDanglingToolCallRepairLeafId(sessionManager);
  if (danglingToolCallRepairLeafId !== undefined) {
    return buildTranscriptTailRecoveryPlan({
      targetEntryId: danglingToolCallRepairLeafId,
      reason: 'dangling_tool_call',
    });
  }

  return null;
}
