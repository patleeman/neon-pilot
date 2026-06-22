import type { AgentSession } from '@earendil-works/pi-coding-agent';

import { resolveTranscriptTailRecoveryPlan } from './liveSessionRecovery.js';

export interface LiveSessionRunningStateHost {
  session: Pick<AgentSession, 'isStreaming' | 'sessionManager'>;
  lastDurableRunState?: string;
  isCompacting?: boolean;
}

function isTerminalDurableRunState(state: string | undefined): boolean {
  return state === 'waiting' || state === 'interrupted' || state === 'completed' || state === 'failed' || state === 'cancelled';
}

function hasDanglingToolCallTail(sessionManager: Pick<AgentSession['sessionManager'], 'getBranch'>): boolean {
  const branch = sessionManager.getBranch();
  if (branch.length === 0) return false;

  const trailingToolResultIds = new Set<string>();
  let index = branch.length - 1;
  while (index >= 0) {
    const entry = branch[index] as { type?: unknown; message?: { role?: unknown; toolCallId?: unknown } } | undefined;
    if (entry?.type !== 'message' || entry.message?.role !== 'toolResult') break;
    const toolCallId = typeof entry.message.toolCallId === 'string' ? entry.message.toolCallId.trim() : '';
    if (toolCallId) trailingToolResultIds.add(toolCallId);
    index -= 1;
  }

  const candidate = branch[index] as
    | { type?: unknown; message?: { role?: unknown; content?: Array<{ type?: unknown; id?: unknown }> } }
    | undefined;
  if (candidate?.type !== 'message' || candidate.message?.role !== 'assistant') return false;
  const toolCallIds = (candidate.message.content ?? []).flatMap((part) =>
    part.type === 'toolCall' && typeof part.id === 'string' && part.id.trim() ? [part.id.trim()] : [],
  );
  return toolCallIds.some((toolCallId) => !trailingToolResultIds.has(toolCallId));
}

export function computeCanonicalLiveSessionRunning(entry: LiveSessionRunningStateHost): boolean {
  if (entry.isCompacting) {
    return true;
  }
  if (isTerminalDurableRunState(entry.lastDurableRunState)) {
    return false;
  }
  if (entry.lastDurableRunState === 'running' || entry.lastDurableRunState === 'recovering') {
    return true;
  }
  if (!entry.session.isStreaming) {
    return false;
  }
  const sessionManager = entry.session.sessionManager;
  if (sessionManager && typeof sessionManager.getBranch === 'function') {
    if (hasDanglingToolCallTail(sessionManager) || resolveTranscriptTailRecoveryPlan(sessionManager)?.reason === 'dangling_tool_call') {
      return false;
    }
  }
  return true;
}
