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
      fromRevision: number;
      toRevision: number;
      revision: number;
      events: SseEvent[];
      activity?: ConversationActivityResult;
    }
  | {
      type: 'activity';
      conversationId: string;
      fromRevision: number;
      toRevision: number;
      revision: number;
      activity: ConversationActivityResult;
    };

export interface ConversationAggregateDeltaListResult {
  conversationId: string;
  fromRevision: number;
  toRevision: number;
  deltas: ConversationAggregateDelta[];
  resyncRequired?: boolean;
  reason?: 'delta_range_expired' | 'delta_range_too_large';
}

export interface ReadConversationAggregateStateInput {
  conversationId: string;
  profile: string;
  tailBlocks?: number;
  tasks?: RuntimeScopeTaskSummary[];
  signal?: AbortSignal;
}

export interface SubscribeConversationAggregateInput extends ReadConversationAggregateStateInput {
  surface?: {
    surfaceId: string;
    surfaceType: 'desktop_web' | 'mobile_web';
  };
  onDelta: (delta: ConversationAggregateDelta) => void;
}

const revisions = new Map<string, number>();
const deltaJournal = new Map<string, ConversationAggregateDelta[]>();
const MAX_DELTA_JOURNAL_ENTRIES = 500;
const MAX_DELTA_CATCHUP_LIMIT = 200;

function currentRevision(conversationId: string): number {
  return revisions.get(conversationId) ?? 0;
}

function bumpRevision(conversationId: string): number {
  const next = currentRevision(conversationId) + 1;
  revisions.set(conversationId, next);
  return next;
}

function rememberDelta(delta: ConversationAggregateDelta): ConversationAggregateDelta {
  const existing = deltaJournal.get(delta.conversationId) ?? [];
  const next = [...existing, delta].slice(-MAX_DELTA_JOURNAL_ENTRIES);
  deltaJournal.set(delta.conversationId, next);
  return delta;
}

function createActivityDelta(conversationId: string, activity: ConversationActivityResult): ConversationAggregateDelta {
  const fromRevision = currentRevision(conversationId);
  const toRevision = bumpRevision(conversationId);
  return rememberDelta({
    type: 'activity',
    conversationId,
    fromRevision,
    toRevision,
    revision: toRevision,
    activity,
  });
}

function createStreamEventsDelta(conversationId: string, events: SseEvent[]): ConversationAggregateDelta {
  const fromRevision = currentRevision(conversationId);
  const toRevision = bumpRevision(conversationId);
  return rememberDelta({
    type: 'stream_events',
    conversationId,
    fromRevision,
    toRevision,
    revision: toRevision,
    events,
  });
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
    signal: input.signal,
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

export function readConversationAggregateDeltas(input: {
  conversationId: string;
  afterRevision: number;
  limit?: number;
}): ConversationAggregateDeltaListResult {
  const conversationId = input.conversationId.trim();
  const current = currentRevision(conversationId);
  const afterRevision = Number.isSafeInteger(input.afterRevision) && input.afterRevision >= 0 ? input.afterRevision : 0;
  const limit =
    typeof input.limit === 'number' && Number.isSafeInteger(input.limit) && input.limit > 0
      ? Math.min(input.limit, MAX_DELTA_CATCHUP_LIMIT)
      : MAX_DELTA_CATCHUP_LIMIT;
  const journal = deltaJournal.get(conversationId) ?? [];

  if (afterRevision >= current) {
    return { conversationId, fromRevision: current, toRevision: current, deltas: [] };
  }

  const firstAvailable = journal[0];
  if (!firstAvailable || firstAvailable.fromRevision > afterRevision) {
    return {
      conversationId,
      fromRevision: afterRevision,
      toRevision: current,
      deltas: [],
      resyncRequired: true,
      reason: 'delta_range_expired',
    };
  }

  const deltas = journal.filter((delta) => delta.fromRevision >= afterRevision);
  if (deltas.length > limit) {
    return {
      conversationId,
      fromRevision: afterRevision,
      toRevision: current,
      deltas: [],
      resyncRequired: true,
      reason: 'delta_range_too_large',
    };
  }

  return {
    conversationId,
    fromRevision: afterRevision,
    toRevision: current,
    deltas,
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
        input.onDelta(createActivityDelta(conversationId, activity));
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

          input.onDelta(createStreamEventsDelta(conversationId, [event]));

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
  deltaJournal.clear();
}
