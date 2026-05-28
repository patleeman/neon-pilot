import type { AgentSession } from '@earendil-works/pi-coding-agent';

import { normalizeModelContextWindow } from '../models/modelContextWindows.js';
import type { LiveContextUsage, SseEvent } from './liveSessionEvents.js';
import { type ParallelPromptJob, readParallelState } from './liveSessionParallelJobs.js';
import { type QueuedPromptPreview, readQueueState } from './liveSessionQueue.js';
import { estimateContextUsageSegments, estimateSessionContextTokens } from './sessionContextUsage.js';

export interface LiveSessionContextUsageHost {
  session: AgentSession;
  lastContextUsage?: LiveContextUsage | null;
  lastContextUsageJson: string | null;
  lastContextUsageMessageCount?: number;
  contextUsageTimer?: ReturnType<typeof setTimeout>;
}

export interface LiveSessionQueueStateHost {
  session: AgentSession;
  lastQueueState?: LiveSessionQueueState;
  lastQueueStateJson: string | null;
}

export interface LiveSessionParallelStateHost {
  parallelJobs?: ParallelPromptJob[];
  lastParallelState?: LiveSessionParallelState;
  lastParallelStateJson?: string | null;
}

export interface LiveSessionQueueState {
  steering: QueuedPromptPreview[];
  followUp: QueuedPromptPreview[];
}

export type LiveSessionParallelState = ReturnType<typeof readParallelState>;

export function readLiveSessionContextUsage(session: AgentSession): LiveContextUsage | null {
  try {
    const usage = session.getContextUsage();
    const modelId = session.model?.id;
    const contextWindow = normalizeModelContextWindow(modelId, usage?.contextWindow, session.model?.contextWindow ?? 128_000);

    if (!usage) {
      const tokens = estimateSessionContextTokens(session.messages);
      if (!Number.isSafeInteger(tokens) || tokens < 0) {
        return null;
      }

      return {
        tokens,
        modelId,
        contextWindow,
        percent: contextWindow > 0 ? (tokens / contextWindow) * 100 : null,
        segments: estimateContextUsageSegments(session.messages, tokens),
      };
    }

    if (usage.tokens === null) {
      return {
        ...usage,
        modelId,
        contextWindow,
        percent: null,
      };
    }

    if (!Number.isSafeInteger(usage.tokens) || usage.tokens < 0) {
      return null;
    }

    return {
      ...usage,
      modelId,
      contextWindow,
      percent: contextWindow > 0 ? (usage.tokens / contextWindow) * 100 : null,
      segments: estimateContextUsageSegments(session.messages, usage.tokens),
    };
  } catch {
    return null;
  }
}

function readSessionMessageCount(session: AgentSession): number | null {
  const messages = (session as AgentSession & { messages?: unknown[] }).messages;
  return Array.isArray(messages) ? messages.length : null;
}

export function readCachedLiveSessionContextUsage(entry: LiveSessionContextUsageHost): LiveContextUsage | null | undefined {
  const messageCount = readSessionMessageCount(entry.session);
  if (
    entry.lastContextUsageJson === null ||
    entry.lastContextUsageMessageCount === undefined ||
    messageCount === null ||
    entry.lastContextUsageMessageCount !== messageCount
  ) {
    return undefined;
  }

  return entry.lastContextUsage ?? null;
}

export function broadcastLiveSessionContextUsage(entry: LiveSessionContextUsageHost, send: (event: SseEvent) => void, force = false): void {
  const usage = readLiveSessionContextUsage(entry.session);
  const nextJson = JSON.stringify(usage);
  if (!force && entry.lastContextUsageJson === nextJson) {
    return;
  }

  entry.lastContextUsage = usage;
  entry.lastContextUsageJson = nextJson;
  entry.lastContextUsageMessageCount = readSessionMessageCount(entry.session) ?? undefined;
  send({ type: 'context_usage', usage });
}

export function broadcastLiveSessionQueueState(entry: LiveSessionQueueStateHost, send: (event: SseEvent) => void, force = false): void {
  const queueState = readQueueState(entry.session);
  const nextJson = JSON.stringify(queueState);
  if (!force && entry.lastQueueStateJson === nextJson) {
    return;
  }

  entry.lastQueueState = queueState;
  entry.lastQueueStateJson = nextJson;
  send({ type: 'queue_state', ...queueState });
}

export function readCachedLiveSessionQueueState(entry: LiveSessionQueueStateHost): LiveSessionQueueState | undefined {
  return entry.lastQueueStateJson === null ? undefined : entry.lastQueueState;
}

export function broadcastLiveSessionParallelState(
  entry: LiveSessionParallelStateHost,
  send: (event: SseEvent) => void,
  force = false,
): void {
  const jobs = readParallelState(entry.parallelJobs);
  const nextJson = JSON.stringify(jobs);
  if (!force && entry.lastParallelStateJson === nextJson) {
    return;
  }

  entry.lastParallelState = jobs;
  entry.lastParallelStateJson = nextJson;
  send({ type: 'parallel_state', jobs });
}

export function readCachedLiveSessionParallelState(entry: LiveSessionParallelStateHost): LiveSessionParallelState | undefined {
  return entry.lastParallelStateJson == null ? undefined : entry.lastParallelState;
}

export function scheduleLiveSessionContextUsage(entry: LiveSessionContextUsageHost, send: (event: SseEvent) => void, delayMs = 400): void {
  if (entry.contextUsageTimer) {
    return;
  }

  entry.contextUsageTimer = setTimeout(() => {
    entry.contextUsageTimer = undefined;
    broadcastLiveSessionContextUsage(entry, send);
  }, delayMs);
}

export function clearLiveSessionContextUsageTimer(entry: LiveSessionContextUsageHost): void {
  if (!entry.contextUsageTimer) {
    return;
  }

  clearTimeout(entry.contextUsageTimer);
  entry.contextUsageTimer = undefined;
}
