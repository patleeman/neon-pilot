import { startBackgroundRun, startScheduledTaskRun } from '../daemon/client.js';
import { invalidateAppTopics } from '../shared/appEvents.js';
import {
  cancelEventBusDelayedEvent,
  createEventBusSubscription,
  deleteEventBusSubscription,
  emitEventBusEvent,
  type EventBusAction,
  type EventBusDispatchInput,
  type EventBusDispatchResult,
  getEventBusDbPath,
  listEventBusDelayedEvents,
  listEventBusEvents,
  listEventBusSubscriptions,
  processDueEventBusEvents,
  pruneEventBusEvents,
  scheduleEventBusEvent,
  updateEventBusSubscription,
} from './eventBus.js';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function runResultOutput(result: { accepted: boolean; runId: string; reason?: string; logPath?: string }): Record<string, unknown> {
  return {
    accepted: result.accepted,
    runId: result.runId,
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.logPath ? { logPath: result.logPath } : {}),
  };
}

function cwdForAction(action: EventBusAction, event: EventBusDispatchInput['event']): string {
  return (
    ('cwd' in action ? readString(action.cwd) : undefined) ??
    readString(event.metadata.cwd) ??
    readString(event.payload.cwd) ??
    process.cwd()
  );
}

function taskSlug(prefix: string, eventId: string): string {
  return `${prefix}-${eventId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)}`;
}

function eventContextPrompt(prompt: string, input: EventBusDispatchInput): string {
  return [
    prompt,
    '',
    'Event context:',
    JSON.stringify(
      {
        id: input.event.id,
        type: input.event.type,
        source: input.event.source,
        payload: input.event.payload,
        metadata: input.event.metadata,
      },
      null,
      2,
    ),
  ].join('\n');
}

export async function dispatchEventBusReaction(input: EventBusDispatchInput): Promise<EventBusDispatchResult> {
  const { action } = input.subscription;
  if (action.type === 'run_task') {
    const result = await startScheduledTaskRun(action.taskId);
    return { status: 'completed', output: runResultOutput(result) };
  }

  if (action.type === 'run_script') {
    const result = await startBackgroundRun({
      taskSlug: taskSlug('event-script', input.event.id),
      cwd: cwdForAction(action, input.event),
      shellCommand: action.command,
      source: { type: 'event-bus', id: input.event.id },
      manifestMetadata: { eventType: input.event.type, subscriptionId: input.subscription.id },
    });
    return { status: 'completed', output: runResultOutput(result) };
  }

  if (action.type === 'start_agent' || action.type === 'start_thread') {
    const result = await startBackgroundRun({
      taskSlug: taskSlug(action.type === 'start_agent' ? 'event-agent' : 'event-thread', input.event.id),
      cwd: cwdForAction(action, input.event),
      agent: {
        prompt: eventContextPrompt(action.prompt, input),
        ...(action.model ? { model: action.model } : {}),
        ...(action.type === 'start_agent' ? { noSession: true } : {}),
      },
      source: { type: 'event-bus', id: input.event.id },
      manifestMetadata: { eventType: input.event.type, subscriptionId: input.subscription.id },
    });
    return { status: 'completed', output: runResultOutput(result) };
  }

  if (action.type === 'publish_event') {
    const emitted = await emitEventBusEvent({
      dbPath: readString(input.event.dbPath),
      event: {
        type: action.eventType,
        source: `subscription:${input.subscription.id}`,
        payload: {
          ...(action.payload ?? {}),
          parentEventId: input.event.id,
        },
        metadata: {
          subscriptionId: input.subscription.id,
          parentEventType: input.event.type,
        },
        recorded: action.recorded !== false,
      },
      dispatchDepth: Number(input.event.metadata.dispatchDepth ?? 0) + 1,
      dispatch: dispatchEventBusReaction,
    });
    return { status: 'completed', output: { eventId: emitted.event.id, reactionCount: emitted.reactions.length } };
  }

  return { status: 'failed', error: 'Unsupported event bus action.' };
}

async function notifyEventBusChanged(): Promise<void> {
  await invalidateAppTopics('automation', 'tasks', 'runs');
}

export async function emitEvent(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const emitted = await emitEventBusEvent({
    dbPath: readString(record.dbPath),
    event: {
      type: readString(record.type) ?? readString(record.eventType) ?? '',
      source: readString(record.source) ?? 'manual',
      payload: readRecord(record.payload),
      metadata: readRecord(record.metadata),
      occurredAt: readString(record.occurredAt),
      recorded: record.recorded !== false,
    },
    dispatch: dispatchEventBusReaction,
  });
  await notifyEventBusChanged();
  return emitted;
}

export async function delayEvent(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const delayMs = readNumber(record.delayMs);
  const dueAt =
    readString(record.dueAt) ??
    readString(record.emitAt) ??
    (delayMs !== undefined ? new Date(Date.now() + Math.max(0, delayMs)).toISOString() : undefined);
  if (!dueAt) throw new Error('dueAt, emitAt, or delayMs is required.');
  const delayed = scheduleEventBusEvent({
    dbPath: readString(record.dbPath),
    dueAt,
    event: {
      type: readString(record.type) ?? readString(record.eventType) ?? '',
      source: readString(record.source) ?? 'manual',
      payload: readRecord(record.payload),
      metadata: readRecord(record.metadata),
      recorded: record.recorded !== false,
    },
  });
  await notifyEventBusChanged();
  return { delayedEvent: delayed };
}

export async function replayEvent(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const eventId = readString(record.eventId);
  if (!eventId) throw new Error('eventId is required.');
  const dbPath = readString(record.dbPath) ?? getEventBusDbPath();
  const event = listEventBusEvents({ dbPath, limit: 500 }).find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`Event not found: ${eventId}`);
  const emitted = await emitEventBusEvent({
    dbPath,
    replayOfEventId: event.id,
    event: {
      type: event.type,
      source: event.source,
      payload: event.payload,
      metadata: event.metadata,
      recorded: event.recorded,
    },
    dispatch: dispatchEventBusReaction,
  });
  await notifyEventBusChanged();
  return emitted;
}

export async function listEvents(input: unknown = {}) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  await processDueEventBusEvents({ dbPath: readString(record.dbPath), dispatch: dispatchEventBusReaction });
  return {
    events: listEventBusEvents({
      dbPath: readString(record.dbPath),
      limit: typeof record.limit === 'number' ? record.limit : undefined,
      type: readString(record.type),
    }),
    delayedEvents: listEventBusDelayedEvents({
      dbPath: readString(record.dbPath),
      includeCompleted: record.includeCompletedDelayed === true,
      limit: typeof record.delayedLimit === 'number' ? record.delayedLimit : undefined,
    }),
  };
}

export async function listSubscriptions(input: unknown = {}) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const subscriptions = listEventBusSubscriptions({ dbPath: readString(record.dbPath) });
  return {
    subscriptions,
    summary: {
      total: subscriptions.length,
      enabled: subscriptions.filter((subscription) => subscription.enabled).length,
      disabled: subscriptions.filter((subscription) => !subscription.enabled).length,
    },
  };
}

export async function saveSubscription(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const subscriptionId = readString(record.id) ?? readString(record.subscriptionId);
  const dbPath = readString(record.dbPath);
  const existing = subscriptionId
    ? listEventBusSubscriptions({ dbPath }).some((subscription) => subscription.id === subscriptionId)
    : false;
  const saved =
    subscriptionId && existing
      ? updateEventBusSubscription({ dbPath, subscriptionId, patch: record })
      : createEventBusSubscription({
          dbPath,
          subscription: { ...record, ...(subscriptionId ? { id: subscriptionId } : {}) } as never,
        });
  await notifyEventBusChanged();
  return { subscription: saved };
}

export async function deleteSubscription(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const subscriptionId = readString(record.subscriptionId) ?? readString(record.id);
  if (!subscriptionId) throw new Error('subscriptionId is required.');
  const deleted = deleteEventBusSubscription({ dbPath: readString(record.dbPath), subscriptionId });
  await notifyEventBusChanged();
  return { ok: true, deleted };
}

export async function cancelDelayedEvent(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const delayedEventId = readString(record.delayedEventId) ?? readString(record.id);
  if (!delayedEventId) throw new Error('delayedEventId is required.');
  const cancelled = cancelEventBusDelayedEvent({ dbPath: readString(record.dbPath), delayedEventId });
  await notifyEventBusChanged();
  return { ok: true, cancelled };
}

export async function pruneEvents(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const result = pruneEventBusEvents({
    dbPath: readString(record.dbPath),
    olderThan: readString(record.olderThan),
    keepLatest: typeof record.keepLatest === 'number' ? record.keepLatest : undefined,
  });
  await notifyEventBusChanged();
  return result;
}

export async function processDueEvents(input: unknown = {}) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const result = await processDueEventBusEvents({
    dbPath: readString(record.dbPath),
    now: readString(record.now),
    limit: typeof record.limit === 'number' ? record.limit : undefined,
    dispatch: dispatchEventBusReaction,
  });
  await notifyEventBusChanged();
  return result;
}
