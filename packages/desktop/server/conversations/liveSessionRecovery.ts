import { type AgentSession, type SessionManager } from '@earendil-works/pi-coding-agent';

import { getAssistantErrorDisplayMessage } from './sessionAssistantErrors.js';

interface DanglingToolCall {
  toolCallId: string;
  toolName?: string;
}

function extractAssistantToolCalls(entry: ReturnType<SessionManager['getBranch']>[number]): DanglingToolCall[] {
  if (entry?.type !== 'message' || entry.message.role !== 'assistant' || !Array.isArray(entry.message.content)) {
    return [];
  }

  return entry.message.content.flatMap((part) => {
    if (!part || typeof part !== 'object' || (part as { type?: unknown }).type !== 'toolCall') {
      return [];
    }
    const toolCallId = typeof (part as { id?: unknown }).id === 'string' ? (part as { id: string }).id.trim() : '';
    if (!toolCallId) {
      return [];
    }
    const toolName = typeof (part as { name?: unknown }).name === 'string' ? (part as { name: string }).name.trim() : undefined;
    return [{ toolCallId, ...(toolName ? { toolName } : {}) }];
  });
}

function resolveDanglingToolCallTail(sessionManager: Pick<SessionManager, 'getBranch'>): DanglingToolCall[] {
  const branch = sessionManager.getBranch();
  if (branch.length === 0) {
    return [];
  }

  const trailingToolResultIds = new Set<string>();
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry?.type === 'message' && entry.message.role === 'toolResult') {
      const toolCallId = typeof entry.message.toolCallId === 'string' ? entry.message.toolCallId.trim() : '';
      if (toolCallId) {
        trailingToolResultIds.add(toolCallId);
      }
      continue;
    }

    const toolCalls = extractAssistantToolCalls(entry);
    if (toolCalls.length === 0) {
      return [];
    }

    return toolCalls.filter((toolCall) => !trailingToolResultIds.has(toolCall.toolCallId));
  }

  return [];
}

function buildSyntheticAbortedToolResult(toolCall: DanglingToolCall, timestamp: number) {
  const toolName = toolCall.toolName ?? 'unknown';
  return {
    role: 'toolResult' as const,
    toolCallId: toolCall.toolCallId,
    toolName,
    content: [{ type: 'text' as const, text: 'aborted' }],
    isError: true,
    timestamp,
    details: {
      source: 'conversation-recovery',
      reason: 'dangling_tool_call',
      synthetic: true,
    },
  };
}

function buildTurnAbortedRecoveryMarker(timestamp: number) {
  return {
    role: 'custom' as const,
    customType: 'conversation_recovery_turn_aborted',
    display: false,
    content:
      "<turn_aborted>\nThe previous assistant turn was interrupted before one or more tool calls completed. Missing tool results were marked aborted. Continue from the user's latest message.\n</turn_aborted>",
    timestamp,
    details: {
      source: 'conversation-recovery',
      reason: 'dangling_tool_call',
      synthetic: true,
    },
  };
}

export function repairDanglingToolCallContext(session: Pick<AgentSession, 'sessionManager' | 'state'>): boolean {
  const sessionManager = session.sessionManager as
    | Partial<Pick<SessionManager, 'getBranch' | 'appendMessage' | 'buildSessionContext'>>
    | undefined;
  if (
    !sessionManager ||
    typeof sessionManager.getBranch !== 'function' ||
    typeof sessionManager.appendMessage !== 'function' ||
    typeof sessionManager.buildSessionContext !== 'function'
  ) {
    return false;
  }

  const danglingToolCalls = resolveDanglingToolCallTail(sessionManager as Pick<SessionManager, 'getBranch'>);
  if (danglingToolCalls.length === 0) {
    return false;
  }

  const timestamp = Date.now();
  for (const toolCall of danglingToolCalls) {
    sessionManager.appendMessage(buildSyntheticAbortedToolResult(toolCall, timestamp));
  }
  sessionManager.appendMessage(buildTurnAbortedRecoveryMarker(timestamp));
  session.state.messages = sessionManager.buildSessionContext().messages;
  return true;
}

export type TranscriptTailRecoveryReason = 'assistant_error' | 'dangling_tool_call';

export interface TranscriptTailRecoveryPlan {
  targetEntryId: string | null;
  reason: TranscriptTailRecoveryReason;
  summary: string;
  details?: unknown;
  danglingToolCalls?: DanglingToolCall[];
}

function buildTranscriptTailRecoveryPlan(input: {
  targetEntryId: string | null;
  reason: TranscriptTailRecoveryReason;
  errorMessage?: string;
  danglingToolCalls?: DanglingToolCall[];
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
      ...(input.danglingToolCalls ? { danglingToolCalls: input.danglingToolCalls } : {}),
    },
    ...(input.danglingToolCalls ? { danglingToolCalls: input.danglingToolCalls } : {}),
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
        targetEntryId: leafEntry.parentId ?? null,
        reason: 'assistant_error',
        errorMessage,
      });
    }
  }

  const danglingToolCalls = resolveDanglingToolCallTail(sessionManager);
  if (danglingToolCalls.length > 0) {
    return buildTranscriptTailRecoveryPlan({
      targetEntryId: null,
      reason: 'dangling_tool_call',
      danglingToolCalls,
    });
  }

  return null;
}
