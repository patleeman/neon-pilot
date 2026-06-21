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
  if (
    sessionManager &&
    typeof sessionManager.getBranch === 'function' &&
    resolveTranscriptTailRecoveryPlan(sessionManager)?.reason === 'dangling_tool_call'
  ) {
    return false;
  }
  return true;
}
