import { describe, expect, it } from 'vitest';

import {
  activateDueAttentionEvents,
  completeAttentionEvents,
  createEmptyAttentionEventsState,
  groupAttentionEventsForDelivery,
  retryAttentionEvents,
  scheduleAttentionEvent,
} from './attention-events.js';

describe('attention events', () => {
  it('schedules, activates, groups, completes, and retries attention events', () => {
    const state = createEmptyAttentionEventsState();

    scheduleAttentionEvent(state, {
      id: 'event-1',
      sessionFile: '/tmp/session.jsonl',
      prompt: 'First wakeup',
      dueAt: '2026-04-15T10:00:00.000Z',
      createdAt: '2026-04-15T09:00:00.000Z',
      attempts: 0,
      source: { kind: 'timer' },
      delivery: { mode: 'batchable' },
    });
    scheduleAttentionEvent(state, {
      id: 'event-2',
      sessionFile: '/tmp/session.jsonl',
      prompt: 'Second wakeup',
      dueAt: '2026-04-15T10:01:00.000Z',
      createdAt: '2026-04-15T09:00:00.000Z',
      attempts: 0,
      source: { kind: 'background-run', id: 'run-1' },
      delivery: { mode: 'batchable', priority: 'high' },
    });
    scheduleAttentionEvent(state, {
      id: 'event-3',
      sessionFile: '/tmp/session.jsonl',
      prompt: 'Approval needed',
      dueAt: '2026-04-15T10:02:00.000Z',
      createdAt: '2026-04-15T09:00:00.000Z',
      attempts: 0,
      source: { kind: 'approval' },
      delivery: { mode: 'isolated', requireAck: true },
    });

    const activated = activateDueAttentionEvents(state, {
      sessionFile: '/tmp/session.jsonl',
      at: new Date('2026-04-15T10:05:00.000Z'),
    });

    expect(activated).toHaveLength(3);
    expect(groupAttentionEventsForDelivery(activated).map((group) => group.map((event) => event.id))).toEqual([
      ['event-2', 'event-1'],
      ['event-3'],
    ]);

    expect(completeAttentionEvents(state, { ids: ['event-1', 'event-2'], completedAt: '2026-04-15T10:06:00.000Z' })).toHaveLength(2);
    expect(state.events['event-1']?.status).toBe('completed');

    expect(
      retryAttentionEvents(state, {
        ids: ['event-3'],
        dueAt: '2026-04-15T10:07:00.000Z',
        lastError: 'busy',
      }),
    ).toHaveLength(1);
    expect(state.events['event-3']).toMatchObject({ status: 'scheduled', attempts: 1, lastError: 'busy' });
  });
});
