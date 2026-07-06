import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  publishDesktopUserActionEvent,
  readDesktopUserActionEvents,
  resetDesktopUserActionEventsForTests,
} from './localApiDesktopEvents.js';

describe('localApiDesktopEvents readDesktopUserActionEvents', () => {
  beforeEach(() => {
    resetDesktopUserActionEventsForTests();
  });

  it('returns an empty array when no events have been published', () => {
    expect(readDesktopUserActionEvents()).toEqual([]);
  });

  it('returns all events when no cursor is provided, limited by default to 50', () => {
    const published: string[] = [];
    for (let i = 0; i < 60; i++) {
      const result = publishDesktopUserActionEvent({
        action: 'focus',
        windowId: `chat:${i}`,
        createdAt: `2026-07-06T00:00:${String(i).padStart(2, '0')}.000Z`,
      });
      published.push(result.event.id);
    }

    const events = readDesktopUserActionEvents();
    expect(events).toHaveLength(50);
    // Should return the last 50 events
    expect(events[0]?.id).toBe(published[10]);
    expect(events[events.length - 1]?.id).toBe(published[59]);
  });

  it('respects a custom limit', () => {
    for (let i = 0; i < 20; i++) {
      publishDesktopUserActionEvent({
        action: 'focus',
        windowId: `chat:${i}`,
        createdAt: `2026-07-06T00:00:${String(i).padStart(2, '0')}.000Z`,
      });
    }

    const events = readDesktopUserActionEvents({ limit: 5 });
    expect(events).toHaveLength(5);
  });

  it('returns events after a given lastEventId cursor', () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = publishDesktopUserActionEvent({
        action: i % 2 === 0 ? 'focus' : 'minimize',
        windowId: `chat:${i}`,
        createdAt: `2026-07-06T00:00:${String(i).padStart(2, '0')}.000Z`,
      });
      ids.push(result.event.id);
    }

    // Read events after the 4th event
    const events = readDesktopUserActionEvents({ lastEventId: ids[3] });
    expect(events).toHaveLength(6); // events at index 4..9
    expect(events[0]?.id).toBe(ids[4]);
    expect(events[5]?.id).toBe(ids[9]);
  });

  it('applies limit when returning events after a cursor', () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = publishDesktopUserActionEvent({
        action: 'focus',
        windowId: `chat:${i}`,
        createdAt: `2026-07-06T00:00:${String(i).padStart(2, '0')}.000Z`,
      });
      ids.push(result.event.id);
    }

    const events = readDesktopUserActionEvents({ lastEventId: ids[2], limit: 3 });
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.id)).toEqual([ids[3], ids[4], ids[5]]);
  });

  it('returns last N events when lastEventId cursor is not found', () => {
    for (let i = 0; i < 10; i++) {
      publishDesktopUserActionEvent({
        action: 'focus',
        windowId: `chat:${i}`,
        createdAt: `2026-07-06T00:00:${String(i).padStart(2, '0')}.000Z`,
      });
    }

    const events = readDesktopUserActionEvents({ lastEventId: 'nonexistent-cursor', limit: 3 });
    expect(events).toHaveLength(3);
  });

  it('includes kind, title, and route metadata when present', () => {
    publishDesktopUserActionEvent({
      action: 'close',
      windowId: 'route:system-notes:notes',
      kind: 'route',
      title: 'Notes',
      route: '/notes',
      createdAt: '2026-07-06T00:00:00.000Z',
    });

    const events = readDesktopUserActionEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'close',
      windowId: 'route:system-notes:notes',
      kind: 'route',
      title: 'Notes',
      route: '/notes',
    });
  });

  it('clamps limit to the available event count', () => {
    for (let i = 0; i < 3; i++) {
      publishDesktopUserActionEvent({
        action: 'focus',
        windowId: `chat:${i}`,
        createdAt: `2026-07-06T00:00:0${i}.000Z`,
      });
    }

    const events = readDesktopUserActionEvents({ limit: 100 });
    expect(events).toHaveLength(3);
  });

  it('throws for invalid limit values', () => {
    expect(() => readDesktopUserActionEvents({ limit: 0 })).toThrow('limit must be a positive integer up to 100.');
    expect(() => readDesktopUserActionEvents({ limit: -1 })).toThrow('limit must be a positive integer up to 100.');
    expect(() => readDesktopUserActionEvents({ limit: 1.5 })).toThrow('limit must be a positive integer up to 100.');
    expect(() => readDesktopUserActionEvents({ limit: 101 })).toThrow('limit must be a positive integer up to 100.');
    expect(() => readDesktopUserActionEvents({ limit: NaN })).toThrow('limit must be a positive integer up to 100.');
  });

  it('throws for non-string lastEventId', () => {
    expect(() => readDesktopUserActionEvents({ lastEventId: 42 as unknown as string })).toThrow('lastEventId must be a string.');
  });

  it('preserves events across module reloads for bundled duplicate imports', async () => {
    const published = publishDesktopUserActionEvent({
      action: 'focus',
      windowId: 'chat:draft',
      createdAt: '2026-07-06T00:00:00.000Z',
    });

    vi.resetModules();
    const reloaded = await import('./localApiDesktopEvents.js');

    expect(reloaded.readDesktopUserActionEvents()).toEqual([published.event]);
  });
});
