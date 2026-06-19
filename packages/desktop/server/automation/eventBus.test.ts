import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cancelEventBusDelayedEvent,
  closeEventBusDbs,
  createEventBusSubscription,
  emitEventBusEvent,
  listEventBusDelayedEvents,
  listEventBusEvents,
  processDueEventBusEvents,
  pruneEventBusEvents,
  scheduleEventBusEvent,
} from './eventBus.js';

const tempDirs: string[] = [];

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'neon-pilot-event-bus-'));
  tempDirs.push(dir);
  return join(dir, 'event-bus.sqlite');
}

describe('event bus store', () => {
  afterEach(() => {
    closeEventBusDbs();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records emitted events newest-first with payloads and metadata', async () => {
    const dbPath = tempDbPath();
    const emitted = await emitEventBusEvent({
      dbPath,
      event: {
        type: 'tweet.created',
        source: 'script:twitter-watch',
        payload: { tweetId: 'tw-1' },
        metadata: { account: 'neon' },
        occurredAt: '2026-06-19T10:00:00.000Z',
      },
    });

    expect(emitted.event).toMatchObject({
      id: expect.stringMatching(/^evt_/),
      type: 'tweet.created',
      source: 'script:twitter-watch',
      payload: { tweetId: 'tw-1' },
      metadata: { account: 'neon' },
      occurredAt: '2026-06-19T10:00:00.000Z',
      recorded: true,
    });
    expect(emitted.reactions).toEqual([]);
    expect(listEventBusEvents({ dbPath })).toEqual([expect.objectContaining({ id: emitted.event.id, type: 'tweet.created' })]);
  });

  it('dispatches matching enabled subscriptions and records reaction outcomes', async () => {
    const dbPath = tempDbPath();
    await createEventBusSubscription({
      dbPath,
      subscription: {
        id: 'sub-agent',
        name: 'Route tweet to agent',
        pattern: 'tweet.*',
        action: { type: 'start_agent', prompt: 'Summarize tweet' },
      },
    });
    await createEventBusSubscription({
      dbPath,
      subscription: {
        id: 'sub-disabled',
        name: 'Disabled',
        pattern: '*',
        enabled: false,
        action: { type: 'run_script', command: 'echo ignored' },
      },
    });

    const emitted = await emitEventBusEvent({
      dbPath,
      event: { type: 'tweet.created', source: 'script:test', payload: { tweetId: 'tw-2' } },
      dispatch: async ({ subscription, event }) => ({
        status: 'completed',
        output: { handledBy: subscription.id, eventId: event.id },
      }),
    });

    expect(emitted.reactions).toEqual([
      expect.objectContaining({
        subscriptionId: 'sub-agent',
        actionType: 'start_agent',
        status: 'completed',
        output: { handledBy: 'sub-agent', eventId: emitted.event.id },
      }),
    ]);
    expect(listEventBusEvents({ dbPath })[0]?.reactions).toEqual(emitted.reactions);
  });

  it('dispatches unrecorded events without adding them to the durable stream', async () => {
    const dbPath = tempDbPath();
    await createEventBusSubscription({
      dbPath,
      subscription: {
        id: 'sub-ephemeral',
        name: 'Handle transient tick',
        pattern: 'tick.*',
        action: { type: 'run_script', command: 'echo tick' },
      },
    });

    const emitted = await emitEventBusEvent({
      dbPath,
      event: { type: 'tick.minute', source: 'scheduler', recorded: false },
      dispatch: async ({ subscription }) => ({ status: 'completed', output: { handledBy: subscription.id } }),
    });

    expect(emitted.event.recorded).toBe(false);
    expect(emitted.reactions).toEqual([
      expect.objectContaining({ subscriptionId: 'sub-ephemeral', status: 'completed', output: { handledBy: 'sub-ephemeral' } }),
    ]);
    expect(listEventBusEvents({ dbPath })).toEqual([]);
  });

  it('supports replay by re-emitting a previous event against current subscriptions', async () => {
    const dbPath = tempDbPath();
    const original = await emitEventBusEvent({
      dbPath,
      event: { type: 'order.created', source: 'api', payload: { orderId: 'ord-1' } },
    });
    await createEventBusSubscription({
      dbPath,
      subscription: {
        id: 'sub-order',
        name: 'Order worker',
        pattern: 'order.created',
        action: { type: 'run_task', taskId: 'order-worker' },
      },
    });

    const replayed = await emitEventBusEvent({
      dbPath,
      replayOfEventId: original.event.id,
      event: original.event,
      dispatch: async () => ({ status: 'completed', output: { runId: 'run-1' } }),
    });

    expect(replayed.event.id).not.toBe(original.event.id);
    expect(replayed.event.replayOfEventId).toBe(original.event.id);
    expect(replayed.event.type).toBe('order.created');
    expect(replayed.reactions).toEqual([expect.objectContaining({ subscriptionId: 'sub-order', status: 'completed' })]);
  });

  it('rejects subscriptions that would consume and emit the same event type', () => {
    const dbPath = tempDbPath();

    expect(() =>
      createEventBusSubscription({
        dbPath,
        subscription: {
          id: 'loop',
          name: 'Loop',
          pattern: 'order.*',
          action: { type: 'publish_event', eventType: 'order.created' },
        },
      }),
    ).toThrow('Subscription cannot publish an event type that matches its own pattern.');
  });

  it('schedules, cancels, and processes delayed events', async () => {
    const dbPath = tempDbPath();
    const cancelled = scheduleEventBusEvent({
      dbPath,
      id: 'delay-cancel',
      dueAt: '2026-06-19T10:00:00.000Z',
      event: { type: 'tick.cancelled', source: 'test' },
    });
    const due = scheduleEventBusEvent({
      dbPath,
      id: 'delay-due',
      dueAt: '2026-06-19T10:00:00.000Z',
      event: { type: 'tick.due', source: 'test', payload: { ok: true } },
    });

    expect(cancelled.status).toBe('pending');
    expect(due.status).toBe('pending');
    expect(cancelEventBusDelayedEvent({ dbPath, delayedEventId: 'delay-cancel' })).toBe(true);

    const processed = await processDueEventBusEvents({ dbPath, now: '2026-06-19T10:00:01.000Z' });

    expect(processed.processed).toBe(1);
    expect(processed.emitted).toEqual([expect.objectContaining({ type: 'tick.due', payload: { ok: true } })]);
    expect(listEventBusEvents({ dbPath })).toEqual([expect.objectContaining({ type: 'tick.due' })]);
    expect(listEventBusDelayedEvents({ dbPath })).toEqual([]);
    expect(listEventBusDelayedEvents({ dbPath, includeCompleted: true })).toEqual([
      expect.objectContaining({ id: 'delay-cancel', status: 'cancelled' }),
      expect.objectContaining({ id: 'delay-due', status: 'emitted', emittedEventId: processed.emitted[0]?.id }),
    ]);
  });

  it('allows the first rate-limited recorded reaction and rejects the second in the same minute', async () => {
    const dbPath = tempDbPath();
    await createEventBusSubscription({
      dbPath,
      subscription: {
        id: 'sub-limited',
        name: 'Limited',
        pattern: 'limited.*',
        maxReactionsPerMinute: 1,
        action: { type: 'run_script', command: 'echo ok' },
      },
    });

    const first = await emitEventBusEvent({
      dbPath,
      event: { type: 'limited.one', source: 'test' },
      dispatch: async () => ({ status: 'completed', output: { ok: true } }),
    });
    const second = await emitEventBusEvent({
      dbPath,
      event: { type: 'limited.two', source: 'test' },
      dispatch: async () => ({ status: 'completed', output: { ok: true } }),
    });

    expect(first.reactions[0]).toEqual(expect.objectContaining({ status: 'completed' }));
    expect(second.reactions[0]).toEqual(
      expect.objectContaining({ status: 'failed', error: 'Subscription rate limit exceeded: 1/minute.' }),
    );
  });

  it('prunes recorded events by keep-latest retention', async () => {
    const dbPath = tempDbPath();
    await emitEventBusEvent({
      dbPath,
      event: { type: 'retention.old', source: 'test', occurredAt: '2026-06-19T09:00:00.000Z' },
    });
    await emitEventBusEvent({
      dbPath,
      event: { type: 'retention.new', source: 'test', occurredAt: '2026-06-19T10:00:00.000Z' },
    });

    expect(pruneEventBusEvents({ dbPath, keepLatest: 1 })).toEqual({ deleted: 1 });
    expect(listEventBusEvents({ dbPath })).toEqual([expect.objectContaining({ type: 'retention.new' })]);
  });
});
