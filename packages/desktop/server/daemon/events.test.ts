import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('crypto', () => ({ randomUUID: vi.fn(() => 'uuid-1') }));

import { createDaemonEvent, DAEMON_EVENT_VERSION, isDaemonEvent } from './events.js';

describe('daemon events', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));
  });

  it('creates versioned daemon events with generated ids, normalized timestamps, and default payloads', () => {
    expect(createDaemonEvent({ type: 'run.started', source: 'test' })).toEqual({
      id: 'evt_uuid-1',
      version: DAEMON_EVENT_VERSION,
      type: 'run.started',
      source: 'test',
      timestamp: '2026-05-22T12:00:00.000Z',
      payload: {},
    });
    expect(
      createDaemonEvent({ id: 'event-1', type: 'run.done', source: 'test', timestamp: '2026-05-22T11:00:00.000Z', payload: { ok: true } }),
    ).toEqual({
      id: 'event-1',
      version: 1,
      type: 'run.done',
      source: 'test',
      timestamp: '2026-05-22T11:00:00.000Z',
      payload: { ok: true },
    });
  });

  it('falls back to current time for malformed timestamps', () => {
    expect(createDaemonEvent({ type: 'run.started', source: 'test', timestamp: 'not iso' }).timestamp).toBe('2026-05-22T12:00:00.000Z');
  });

  it('validates daemon event envelopes strictly', () => {
    const event = createDaemonEvent({ type: 'run.started', source: 'test' });
    expect(isDaemonEvent(event)).toBe(true);
    expect(isDaemonEvent({ ...event, timestamp: '2026-05-22T12:00:00Z' })).toBe(false);
    expect(isDaemonEvent({ ...event, payload: null })).toBe(false);
    expect(isDaemonEvent({ ...event, source: 1 })).toBe(false);
    expect(isDaemonEvent(null)).toBe(false);
  });
});
