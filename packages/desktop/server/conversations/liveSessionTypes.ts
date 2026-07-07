import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { DesktopRootLayout } from '@neon-pilot/core';

import type { WebLiveConversationRunState } from './conversationRuns.js';
import type { LiveContextUsage } from './liveSessionEvents.js';
import type { ParallelPromptJob, ParallelPromptPreview } from './liveSessionParallelJobs.js';
import type { LiveSessionPresenceHost } from './liveSessionPresence.js';
import type { QueuedPromptPreview } from './liveSessionQueue.js';
import type { LiveSessionStaleTurnState } from './liveSessionStaleTurns.js';
import type { LiveSessionSubscriptionListener } from './liveSessionSubscription.js';

export type LiveListener = LiveSessionSubscriptionListener;

import type { LiveSessionLifecycleHandler } from './liveSessionLifecycle.js';

export interface PersistedTokensSnapshot {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

export interface LiveEntry extends LiveSessionPresenceHost, LiveSessionStaleTurnState {
  sessionId: string;
  session: AgentSession;
  desktopRootLayout?: DesktopRootLayout;
  cwd: string;
  listeners: Set<LiveListener>;
  title: string;
  lastContextUsage?: LiveContextUsage | null;
  lastContextUsageJson: string | null;
  lastContextUsageMessageCount?: number;
  lastQueueState?: { steering: QueuedPromptPreview[]; followUp: QueuedPromptPreview[] };
  lastQueueStateJson: string | null;
  lastParallelState?: ParallelPromptPreview[];
  lastParallelStateJson?: string | null;
  currentTurnError?: string | null;
  currentAssistantMessageText?: string;
  currentAssistantMessageHadDelta?: boolean;
  lastDurableRunState?: WebLiveConversationRunState;
  contextUsageTimer?: ReturnType<typeof setTimeout>;
  pendingAutoCompactionReason?: 'overflow' | 'threshold' | null;
  lastCompactionSummaryTitle?: string | null;
  isCompacting?: boolean;
  running: boolean;
  tracePersistedTokens?: PersistedTokensSnapshot;
  pendingAutoModeContinuation?: boolean;
  directBashRunning?: boolean;
  directBashAbortControllers?: Set<AbortController>;
  traceRunId?: string | null;
  traceRunStartedAtMs?: number | null;
  traceRunTurnCount?: number;
  traceRunStepCount?: number;
  traceRunFirstAssistantAtMs?: number | null;
  traceRunFirstToolAtMs?: number | null;
  lifecycleHandlers: Array<LiveSessionLifecycleHandler>;
  parallelJobs?: ParallelPromptJob[];
  importingParallelJobs?: boolean;
}
