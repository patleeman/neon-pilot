import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { transformSync } from 'esbuild';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  publishDesktopUserActionEvent,
  readDesktopUserActionEvents,
  resetDesktopUserActionEventsForTests,
  subscribeDesktopUserActionEvents,
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

  describe('action type coverage for non-close actions', () => {
    it.each(['move', 'resize', 'maximize', 'snap', 'restore'] as const)(
      'accepts and returns %s action with complete event data',
      (action) => {
        const result = publishDesktopUserActionEvent({
          action,
          windowId: 'chat:draft',
          title: 'Draft',
          route: '/conversations/new',
          createdAt: '2026-07-06T00:00:00.000Z',
        });

        expect(result.ok).toBe(true);
        expect(result.event).toMatchObject({
          source: 'user',
          action,
          windowId: 'chat:draft',
          title: 'Draft',
          route: '/conversations/new',
          createdAt: '2026-07-06T00:00:00.000Z',
        });
        expect(result.event.id).toMatch(/^desktop-user-action-/);

        const events = readDesktopUserActionEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual(result.event);
      },
    );
  });

  describe('buffer overflow trimming and pagination', () => {
    it('keeps only the last 100 events when more are published', () => {
      const ids: string[] = [];
      for (let i = 0; i < 110; i++) {
        const result = publishDesktopUserActionEvent({
          action: 'focus',
          windowId: `chat:${i}`,
          createdAt: `2026-07-06T00:00:${String(i).padStart(2, '0')}.000Z`,
        });
        ids.push(result.event.id);
      }

      const events = readDesktopUserActionEvents({ limit: 100 });
      expect(events).toHaveLength(100);
      expect(events[0]?.id).toBe(ids[10]);
      expect(events[99]?.id).toBe(ids[109]);
    });

    it('falls back to last N events when lastEventId cursor was trimmed', () => {
      const ids: string[] = [];
      for (let i = 0; i < 110; i++) {
        const result = publishDesktopUserActionEvent({
          action: 'focus',
          windowId: `chat:${i}`,
          createdAt: `2026-07-06T00:00:${String(i).padStart(2, '0')}.000Z`,
        });
        ids.push(result.event.id);
      }

      const events = readDesktopUserActionEvents({ lastEventId: ids[0], limit: 3 });
      expect(events).toHaveLength(3);
      expect(events[0]?.id).toBe(ids[107]);
      expect(events[2]?.id).toBe(ids[109]);
    });

    it('returns empty array for valid cursor at the end of buffer', () => {
      publishDesktopUserActionEvent({
        action: 'focus',
        windowId: 'chat:draft',
        createdAt: '2026-07-06T00:00:00.000Z',
      });

      const events = readDesktopUserActionEvents();
      const lastId = events[0]!.id;

      const afterLast = readDesktopUserActionEvents({ lastEventId: lastId });
      expect(afterLast).toEqual([]);
    });
  });

  describe('subscribeDesktopUserActionEvents', () => {
    it('receives events published after subscription', () => {
      const received: unknown[] = [];
      const unsubscribe = subscribeDesktopUserActionEvents((event) => {
        received.push(event);
      });

      const result = publishDesktopUserActionEvent({
        action: 'maximize',
        windowId: 'chat:draft',
        createdAt: '2026-07-06T00:00:00.000Z',
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(result.event);
      unsubscribe();
    });

    it('receives catch-up events for events published before subscription', () => {
      const published = publishDesktopUserActionEvent({
        action: 'focus',
        windowId: 'chat:draft',
        createdAt: '2026-07-06T00:00:00.000Z',
      });

      const received: unknown[] = [];
      const unsubscribe = subscribeDesktopUserActionEvents((event) => {
        received.push(event);
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(published.event);

      publishDesktopUserActionEvent({
        action: 'resize',
        windowId: 'chat:draft',
        createdAt: '2026-07-06T00:00:01.000Z',
      });
      expect(received).toHaveLength(2);
      unsubscribe();
    });

    it('stops receiving events after unsubscribe', () => {
      const received: unknown[] = [];
      const unsubscribe = subscribeDesktopUserActionEvents((event) => {
        received.push(event);
      });

      publishDesktopUserActionEvent({
        action: 'focus',
        windowId: 'chat:first',
        createdAt: '2026-07-06T00:00:00.000Z',
      });
      expect(received).toHaveLength(1);

      unsubscribe();

      publishDesktopUserActionEvent({
        action: 'move',
        windowId: 'chat:second',
        createdAt: '2026-07-06T00:00:01.000Z',
      });
      expect(received).toHaveLength(1);
    });

    it('supports multiple subscribers receiving the same events', () => {
      const received1: unknown[] = [];
      const received2: unknown[] = [];
      const unsub1 = subscribeDesktopUserActionEvents((e) => received1.push(e));
      const unsub2 = subscribeDesktopUserActionEvents((e) => received2.push(e));

      const result = publishDesktopUserActionEvent({
        action: 'snap',
        windowId: 'chat:draft',
        createdAt: '2026-07-06T00:00:00.000Z',
      });

      expect(received1).toHaveLength(1);
      expect(received1[0]).toEqual(result.event);
      expect(received2).toHaveLength(1);
      expect(received2[0]).toEqual(result.event);
      expect(received1[0]).toBe(received2[0]);
      expect(received1[0]).toBe(result.event);

      unsub1();
      unsub2();
    });
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

  it('preserves events across separately bundled module copies', async () => {
    const published = publishDesktopUserActionEvent({
      action: 'focus',
      windowId: 'chat:draft',
      createdAt: '2026-07-06T00:00:00.000Z',
    });
    const tempDir = mkdtempSync(resolve(tmpdir(), 'desktop-events-bundle-'));
    const copiedModulePath = resolve(tempDir, 'localApiDesktopEvents.copy.mjs');
    const source = readFileSync(resolve(process.cwd(), 'packages/desktop/server/app/localApiDesktopEvents.ts'), 'utf-8');
    const transformed = transformSync(source, { format: 'esm', loader: 'ts', target: 'node20' });
    writeFileSync(copiedModulePath, transformed.code);

    try {
      const bundledCopy = (await import(pathToFileURL(copiedModulePath).href)) as typeof import('./localApiDesktopEvents.js');

      expect(bundledCopy.readDesktopUserActionEvents()).toEqual([published.event]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
