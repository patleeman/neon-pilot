import { listScheduledTasksCapability } from '../automation/scheduledTaskCapability.js';
import type { RuntimeScopeTaskSummary } from '../routes/context.js';
import { type AppEvent, subscribeAppEvents } from '../shared/appEvents.js';
import { type ConversationActivityResult, listConversationActivity } from './conversationActivity.js';
import { type DesktopConversationState, readDesktopConversationState } from './desktopConversationState.js';
import { type SseEvent, subscribe as subscribeLiveSession } from './liveSessions.js';

const ACTIVITY_INVALIDATION_TOPICS = new Set(['tasks', 'runs', 'executions', 'sessions', 'sessionFiles', 'automation']);

export interface ConversationAggregateState {
  conversationId: string;
  revision: number;
  updatedAt: string;
  conversation: DesktopConversationState;
  activity: ConversationActivityResult;
}

export type ConversationAggregateDelta =
  | {
      type: 'stream_events';
      conversationId: string;
      revision: number;
      events: SseEvent[];
      activity?: ConversationActivityResult;
    }
  | {
      type: 'activity';
      conversationId: string;
      revision: number;
      activity: ConversationActivityResult;
    };

export interface ReadConversationAggregateStateInput {
  conversationId: string;
  profile: string;
  tailBlocks?: number;
  tasks?: RuntimeScopeTaskSummary[];
}

export interface SubscribeConversationAggregateInput extends ReadConversationAggregateStateInput {
  surface?: {
    surfaceId: string;
    surfaceType: 'desktop_web' | 'mobile_web';
  };
  onDelta: (delta: ConversationAggregateDelta) => void;
}

const revisions = new Map<string, number>();

function currentRevision(conversationId: string): number {
  return revisions.get(conversationId) ?? 0;
}

function bumpRevision(conversationId: string): number {
  const next = currentRevision(conversationId) + 1;
  revisions.set(conversationId, next);
  return next;
}

async function listTasksForAggregate(input: Pick<ReadConversationAggregateStateInput, 'profile' | 'tasks'>) {
  if (input.tasks) {
    return input.tasks;
  }
  try {
    return await listScheduledTasksCapability(input.profile);
  } catch {
    return [];
  }
}

async function readConversationAggregateActivity(input: ReadConversationAggregateStateInput): Promise<ConversationActivityResult> {
  return listConversationActivity(input.conversationId, {
    profile: input.profile,
    tasks: await listTasksForAggregate(input),
  });
}

export async function readConversationAggregateState(input: ReadConversationAggregateStateInput): Promise<ConversationAggregateState> {
  const conversation = await readDesktopConversationState({
    conversationId: input.conversationId,
    profile: input.profile,
    tailBlocks: input.tailBlocks,
  });
  const activity = await readConversationAggregateActivity(input);
  return {
    conversationId: input.conversationId,
    revision: currentRevision(input.conversationId),
    updatedAt: new Date().toISOString(),
    conversation,
    activity,
  };
}

function isActivityInvalidation(event: AppEvent): boolean {
  return event.type === 'invalidate' && event.topics.some((topic) => ACTIVITY_INVALIDATION_TOPICS.has(topic));
}

export function subscribeConversationAggregate(input: SubscribeConversationAggregateInput): () => void {
  const conversationId = input.conversationId.trim();
  if (!conversationId) {
    throw new Error('conversationId required');
  }

  let closed = false;
  let activityRefreshInFlight = false;
  let activityRefreshQueued = false;
  let liveUnsubscribe: (() => void) | null = null;

  const publishActivity = async () => {
    if (closed) {
      return;
    }
    if (activityRefreshInFlight) {
      activityRefreshQueued = true;
      return;
    }
    activityRefreshInFlight = true;
    try {
      do {
        activityRefreshQueued = false;
        const activity = await readConversationAggregateActivity(input);
        if (closed) return;
        input.onDelta({
          type: 'activity',
          conversationId,
          revision: bumpRevision(conversationId),
          activity,
        });
      } while (activityRefreshQueued && !closed);
    } finally {
      activityRefreshInFlight = false;
    }
  };

  const attachLiveSession = () => {
    if (closed || liveUnsubscribe) {
      return;
    }
    liveUnsubscribe =
      subscribeLiveSession(
        conversationId,
        (event) => {
          if (closed) {
            return;
          }

          input.onDelta({
            type: 'stream_events',
            conversationId,
            revision: bumpRevision(conversationId),
            events: [event],
          });

          if (event.type === 'queue_state' || event.type === 'agent_start' || event.type === 'agent_end' || event.type === 'turn_end') {
            void publishActivity();
          }
        },
        {
          ...(input.tailBlocks ? { tailBlocks: input.tailBlocks } : {}),
          ...(input.surface ? { surface: input.surface } : {}),
        },
      ) ?? null;
  };

  attachLiveSession();

  const appUnsubscribe = subscribeAppEvents((event) => {
    if (
      (event.type === 'session_meta_changed' || event.type === 'session_file_changed') &&
      event.sessionId === conversationId &&
      !liveUnsubscribe
    ) {
      attachLiveSession();
    }

    if (isActivityInvalidation(event)) {
      void publishActivity();
    }
  });

  return () => {
    if (closed) {
      return;
    }
    closed = true;
    liveUnsubscribe?.();
    appUnsubscribe();
  };
}

export function clearConversationAggregateStateForTests(): void {
  revisions.clear();
}
