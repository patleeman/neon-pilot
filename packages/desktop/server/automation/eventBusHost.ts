import { startBackgroundRun, startScheduledTaskRun } from '../daemon/client.js';
import { invalidateAppTopics } from '../shared/appEvents.js';
import {
  createEventBusSubscription,
  deleteEventBusSubscription,
  emitEventBusEvent,
  type EventBusAction,
  type EventBusDispatchInput,
  type EventBusDispatchResult,
  getEventBusDbPath,
  listEventBusEvents,
  listEventBusSubscriptions,
  updateEventBusSubscription,
} from './eventBus.js';

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

async function dispatchEventBusReaction(input: EventBusDispatchInput): Promise<EventBusDispatchResult> {
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
      },
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

export async function replayEvent(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const eventId = readString(record.eventId);
  if (!eventId) throw new Error('eventId is required.');
  const dbPath = getEventBusDbPath();
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
  return {
    events: listEventBusEvents({
      limit: typeof record.limit === 'number' ? record.limit : undefined,
      type: readString(record.type),
    }),
  };
}

export async function listSubscriptions() {
  return { subscriptions: listEventBusSubscriptions() };
}

export async function saveSubscription(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const subscriptionId = readString(record.id) ?? readString(record.subscriptionId);
  const existing = subscriptionId ? listEventBusSubscriptions().some((subscription) => subscription.id === subscriptionId) : false;
  const saved =
    subscriptionId && existing
      ? updateEventBusSubscription({ subscriptionId, patch: record })
      : createEventBusSubscription({ subscription: { ...record, ...(subscriptionId ? { id: subscriptionId } : {}) } as never });
  await notifyEventBusChanged();
  return { subscription: saved };
}

export async function deleteSubscription(input: unknown) {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const subscriptionId = readString(record.subscriptionId) ?? readString(record.id);
  if (!subscriptionId) throw new Error('subscriptionId is required.');
  const deleted = deleteEventBusSubscription({ subscriptionId });
  await notifyEventBusChanged();
  return { ok: true, deleted };
}
