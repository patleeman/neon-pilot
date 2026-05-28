import type { AgentSession } from '@earendil-works/pi-coding-agent';

import type { SseEvent } from './liveSessionEvents.js';
import { type ParallelPromptJob, readParallelState } from './liveSessionParallelJobs.js';
import {
  buildLiveSessionPresenceState,
  type LiveSessionPresenceHost,
  type LiveSessionSurfaceType,
  registerLiveSessionSurface,
  removeLiveSessionSurface,
} from './liveSessionPresence.js';
import { readQueueState } from './liveSessionQueue.js';
import { ensureStaleTurnState, type LiveSessionStaleTurnState } from './liveSessionStaleTurns.js';
import {
  type LiveSessionContextUsageHost,
  type LiveSessionParallelStateHost,
  type LiveSessionQueueStateHost,
  readCachedLiveSessionContextUsage,
  readCachedLiveSessionParallelState,
  readCachedLiveSessionQueueState,
  readLiveSessionContextUsage,
} from './liveSessionStateBroadcasts.js';
import { buildLiveSessionSnapshot } from './liveSessionStateSnapshot.js';
import { readGoalFromEntries } from './sessionGoalState.js';

export interface LiveSessionSubscriptionListener {
  send: (event: SseEvent) => void;
  tailBlocks?: number;
}

export interface LiveSessionSubscriptionHost
  extends
    LiveSessionPresenceHost,
    LiveSessionStaleTurnState,
    LiveSessionContextUsageHost,
    LiveSessionQueueStateHost,
    LiveSessionParallelStateHost {
  session: AgentSession;
  listeners: Set<LiveSessionSubscriptionListener>;
  title: string;
  parallelJobs?: ParallelPromptJob[];
}

export function subscribeLiveSession<TEntry extends LiveSessionSubscriptionHost>(
  entry: TEntry,
  listener: (event: SseEvent) => void,
  options:
    | {
        tailBlocks?: number;
        surface?: {
          surfaceId: string;
          surfaceType: LiveSessionSurfaceType;
        };
        deferInitialReplayMs?: number;
      }
    | undefined,
  callbacks: {
    resolveTitle: (entry: TEntry) => string;
    broadcastPresenceState: (entry: TEntry, options?: { exclude?: LiveSessionSubscriptionListener }) => void;
  },
): () => void {
  const subscription: LiveSessionSubscriptionListener = {
    send: listener,
    tailBlocks: options?.tailBlocks,
  };
  entry.listeners.add(subscription);

  const presenceChanged = options?.surface ? registerLiveSessionSurface(entry, options.surface) : false;

  const deferInitialReplayMs =
    typeof options?.deferInitialReplayMs === 'number' && Number.isFinite(options.deferInitialReplayMs) && options.deferInitialReplayMs > 0
      ? Math.round(options.deferInitialReplayMs)
      : 0;
  if (deferInitialReplayMs > 0) {
    const replayTimer = setTimeout(() => {
      if (entry.listeners.has(subscription)) {
        replayLiveSessionState(entry, subscription, options, callbacks.resolveTitle);
      }
    }, deferInitialReplayMs);
    replayTimer.unref?.();
  } else {
    replayLiveSessionState(entry, subscription, options, callbacks.resolveTitle);
  }

  if (presenceChanged) {
    callbacks.broadcastPresenceState(entry, { exclude: subscription });
  }

  return () => {
    entry.listeners.delete(subscription);
    if (options?.surface && removeLiveSessionSurface(entry, options.surface.surfaceId)) {
      callbacks.broadcastPresenceState(entry);
    }
  };
}

function replayLiveSessionState<TEntry extends LiveSessionSubscriptionHost>(
  entry: TEntry,
  subscription: LiveSessionSubscriptionListener,
  options:
    | {
        tailBlocks?: number;
        surface?: { surfaceId: string; surfaceType: LiveSessionSurfaceType };
        deferInitialReplayMs?: number;
      }
    | undefined,
  resolveTitle: (entry: TEntry) => string,
): void {
  ensureStaleTurnState(entry);
  const goalState = readGoalFromEntries(entry.session.sessionManager?.getEntries?.() ?? []);
  const systemPrompt = entry.session.systemPrompt?.trim() || null;
  const toolDefinitions = (entry.session.state.tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>,
  }));
  subscription.send({
    type: 'snapshot',
    goalState,
    ...(systemPrompt ? { systemPrompt } : {}),
    ...(toolDefinitions.length > 0 ? { toolDefinitions } : {}),
    ...buildLiveSessionSnapshot(entry, options?.tailBlocks),
  });
  const title = resolveTitle(entry);
  if (title) {
    subscription.send({ type: 'title_update', title });
  }
  subscription.send({
    type: 'context_usage',
    usage: readCachedLiveSessionContextUsage(entry) ?? readLiveSessionContextUsage(entry.session),
  });
  subscription.send({ type: 'queue_state', ...(readCachedLiveSessionQueueState(entry) ?? readQueueState(entry.session)) });
  subscription.send({ type: 'parallel_state', jobs: readCachedLiveSessionParallelState(entry) ?? readParallelState(entry.parallelJobs) });
  if (options?.surface || (entry.presenceBySurfaceId?.size ?? 0) > 0) {
    subscription.send({ type: 'presence_state', state: buildLiveSessionPresenceState(entry) });
  }
  if (
    entry.session.isStreaming &&
    (!entry.activeStaleTurnCustomType || entry.activeStaleTurnCustomType === 'conversation_automation_post_turn_review')
  ) {
    subscription.send({ type: 'agent_start' });
  }
}
