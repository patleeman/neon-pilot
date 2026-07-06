import { beforeEach, describe, expect, it } from 'vitest';

import {
  type DesktopStateSnapshotInput,
  readDesktopStateSnapshot,
  resetDesktopStateSnapshotForTests,
  storeDesktopStateSnapshot,
} from './localApiDesktopState.js';

describe('localApiDesktopState store/read', () => {
  beforeEach(() => {
    resetDesktopStateSnapshotForTests();
  });

  it('returns an empty snapshot when nothing has been published', () => {
    expect(readDesktopStateSnapshot()).toEqual({
      windows: [],
      focusedWindowId: null,
      theme: null,
      publishedAt: null,
      revision: null,
      publisherId: null,
    });
  });

  it('stores a sanitized snapshot and reads it back verbatim', () => {
    const input: DesktopStateSnapshotInput = {
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 42, y: 34, width: 700, height: 500 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
          workspaceCwd: null,
          routeMetadata: { sessionId: 'draft' },
        },
        {
          id: 'route:system-notes:notes',
          kind: 'route',
          title: 'Notes',
          route: '/notes',
          bounds: { x: 90, y: 70, width: 760, height: 520 },
          focused: false,
          minimized: false,
          maximized: true,
          zIndex: 11,
          agentTouched: true,
          routeMetadata: { appId: 'system-notes', singleton: true },
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'dark',
      publishedAt: '2026-07-05T12:34:56.000Z',
      revision: 1,
      publisherId: 'windowed-layout:test',
    };

    const stored = storeDesktopStateSnapshot(input);
    expect(stored.ok).toBe(true);
    expect(stored.windows).toHaveLength(2);
    expect(stored.focusedWindowId).toBe('chat:draft');
    expect(stored.theme).toBe('dark');
    expect(stored.publishedAt).toBe('2026-07-05T12:34:56.000Z');
    expect(stored.revision).toBe(1);
    expect(stored.publisherId).toBe('windowed-layout:test');
    expect(stored.windows[1]?.agentTouched).toBe(true);

    expect(readDesktopStateSnapshot()).toEqual({
      windows: input.windows,
      focusedWindowId: 'chat:draft',
      theme: 'dark',
      publishedAt: '2026-07-05T12:34:56.000Z',
      revision: 1,
      publisherId: 'windowed-layout:test',
    });
  });

  it('drops invalid windows and clamps top-level maximized state when minimized', () => {
    const input: DesktopStateSnapshotInput = {
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 42, y: 34, width: 700, height: 500 },
          focused: true,
          minimized: false,
          maximized: true,
          zIndex: 10,
        },
        {
          id: 'route:notes',
          kind: 'route',
          title: 'Notes',
          route: '/notes',
          bounds: { x: 'oops' as unknown as number, y: 70, width: 760, height: 520 },
          focused: false,
          minimized: false,
          maximized: false,
          zIndex: 11,
        },
        {
          id: 'route:hidden-notes',
          kind: 'route',
          title: 'Hidden notes',
          route: '/notes',
          bounds: { x: -10, y: -10, width: 0, height: 760 },
          focused: false,
          minimized: false,
          maximized: false,
          zIndex: 12,
        },
        {
          id: 'route:min-notes',
          kind: 'route',
          title: 'Minimized notes',
          route: '/notes',
          bounds: { x: 4, y: 4, width: 760, height: 520 },
          focused: false,
          minimized: true,
          maximized: true,
          zIndex: 12,
        },
        {
          id: 'chat:draft', // duplicate id; should be dropped
          kind: 'chat',
          title: 'Duplicate',
          route: '/conversations/new',
          bounds: { x: 1, y: 1, width: 10, height: 10 },
          focused: false,
          minimized: false,
          maximized: false,
          zIndex: 13,
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'light',
      publishedAt: '2026-07-05T12:34:56.000Z',
    };

    const stored = storeDesktopStateSnapshot(input);
    expect(stored.windows).toHaveLength(2);
    expect(stored.windows[0]?.id).toBe('chat:draft');
    expect(stored.windows[0]?.maximized).toBe(true);
    expect(stored.windows[1]?.id).toBe('route:min-notes');
    expect(stored.windows[1]?.minimized).toBe(true);
    expect(stored.windows[1]?.maximized).toBe(false);
    expect(stored.windows[1]?.zIndex).toBe(0);
  });

  it('normalizes focused flags to match the focused window id', () => {
    const stored = storeDesktopStateSnapshot({
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 42, y: 34, width: 700, height: 500 },
          focused: false,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
        {
          id: 'route:notes',
          kind: 'route',
          title: 'Notes',
          route: '/notes',
          bounds: { x: 90, y: 70, width: 760, height: 520 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 11,
        },
        {
          id: 'route:minimized',
          kind: 'route',
          title: 'Minimized',
          route: '/minimized',
          bounds: { x: 90, y: 70, width: 760, height: 520 },
          focused: true,
          minimized: true,
          maximized: false,
          zIndex: 12,
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'light',
      publishedAt: '2026-07-05T12:34:56.000Z',
      revision: 4,
    });

    expect(stored.windows.map((windowEntry) => [windowEntry.id, windowEntry.focused])).toEqual([
      ['chat:draft', true],
      ['route:notes', false],
      ['route:minimized', false],
    ]);
  });

  it('forgets the focused window id when it does not reference a stored window', () => {
    const input: DesktopStateSnapshotInput = {
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'New conversation',
          route: '/conversations/new',
          bounds: { x: 42, y: 34, width: 700, height: 500 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'chat:missing',
      theme: 'light',
      publishedAt: '2026-07-05T12:34:56.000Z',
    };

    const stored = storeDesktopStateSnapshot(input);
    expect(stored.focusedWindowId).toBeNull();
    expect(readDesktopStateSnapshot().focusedWindowId).toBeNull();
    expect(readDesktopStateSnapshot().windows[0]?.focused).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(() => storeDesktopStateSnapshot(null as unknown as DesktopStateSnapshotInput)).toThrow(/must be an object/);
    expect(() => storeDesktopStateSnapshot({ windows: 'nope' } as unknown as DesktopStateSnapshotInput)).toThrow(
      /windows must be an array/,
    );
  });

  it('rejects payloads that exceed the maximum window count', () => {
    const windows = Array.from({ length: 257 }, (_, index) => ({
      id: `chat:${index}`,
      kind: 'chat',
      title: 'Window',
      route: '/conversations/new',
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      focused: false,
      minimized: false,
      maximized: false,
      zIndex: index,
    }));
    expect(() => storeDesktopStateSnapshot({ windows, theme: 'light', publishedAt: '2026-07-05T12:34:56.000Z' })).toThrow(
      /exceeds 256 windows/,
    );
  });

  it('fills in a server timestamp when the renderer omits one', () => {
    const before = new Date().getTime();
    const stored = storeDesktopStateSnapshot({
      windows: [],
      focusedWindowId: null,
      theme: 'light',
    });
    const after = new Date().getTime();
    const storedMs = new Date(stored.publishedAt).getTime();
    expect(storedMs).toBeGreaterThanOrEqual(before);
    expect(storedMs).toBeLessThanOrEqual(after);
  });

  it('ignores stale renderer revisions so older requests cannot overwrite newer state', () => {
    storeDesktopStateSnapshot({
      windows: [
        {
          id: 'route:newer',
          kind: 'route',
          title: 'Newer',
          route: '/newer',
          bounds: { x: 10, y: 10, width: 500, height: 400 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'route:newer',
      theme: 'dark',
      publishedAt: '2026-07-05T12:35:00.000Z',
      revision: 8,
      publisherId: 'windowed-layout:test',
    });

    const staleResult = storeDesktopStateSnapshot({
      windows: [
        {
          id: 'route:older',
          kind: 'route',
          title: 'Older',
          route: '/older',
          bounds: { x: 1, y: 1, width: 300, height: 240 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'route:older',
      theme: 'light',
      publishedAt: '2026-07-05T12:34:00.000Z',
      revision: 7,
      publisherId: 'windowed-layout:test',
    });

    expect(staleResult.ignored).toBe(true);
    expect(readDesktopStateSnapshot()).toMatchObject({
      windows: [expect.objectContaining({ id: 'route:newer' })],
      focusedWindowId: 'route:newer',
      theme: 'dark',
      revision: 8,
      publisherId: 'windowed-layout:test',
    });
  });

  it('accepts lower revisions from a fresh renderer publisher after reload', () => {
    storeDesktopStateSnapshot({
      windows: [
        {
          id: 'route:before-reload',
          kind: 'route',
          title: 'Before reload',
          route: '/before-reload',
          bounds: { x: 10, y: 10, width: 500, height: 400 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'route:before-reload',
      theme: 'dark',
      publishedAt: '2026-07-05T12:35:00.000Z',
      revision: 50,
      publisherId: 'windowed-layout:old',
    });

    const freshResult = storeDesktopStateSnapshot({
      windows: [
        {
          id: 'route:after-reload',
          kind: 'route',
          title: 'After reload',
          route: '/after-reload',
          bounds: { x: 20, y: 20, width: 500, height: 400 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'route:after-reload',
      theme: 'light',
      publishedAt: '2026-07-05T12:36:00.000Z',
      revision: 1,
      publisherId: 'windowed-layout:new',
    });

    expect(freshResult.ignored).toBeUndefined();
    expect(readDesktopStateSnapshot()).toMatchObject({
      windows: [expect.objectContaining({ id: 'route:after-reload' })],
      focusedWindowId: 'route:after-reload',
      theme: 'light',
      revision: 1,
      publisherId: 'windowed-layout:new',
    });
  });

  it('ignores an older in-flight publisher after a fresh renderer has published', () => {
    storeDesktopStateSnapshot({
      windows: [
        {
          id: 'route:after-reload',
          kind: 'route',
          title: 'After reload',
          route: '/after-reload',
          bounds: { x: 20, y: 20, width: 500, height: 400 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'route:after-reload',
      theme: 'light',
      publishedAt: '2026-07-05T12:36:00.000Z',
      revision: 1,
      publisherId: 'windowed-layout:new',
    });

    const lateOldResult = storeDesktopStateSnapshot({
      windows: [
        {
          id: 'route:before-reload',
          kind: 'route',
          title: 'Before reload',
          route: '/before-reload',
          bounds: { x: 10, y: 10, width: 500, height: 400 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'route:before-reload',
      theme: 'dark',
      publishedAt: '2026-07-05T12:35:00.000Z',
      revision: 50,
      publisherId: 'windowed-layout:old',
    });

    expect(lateOldResult.ignored).toBe(true);
    expect(readDesktopStateSnapshot()).toMatchObject({
      windows: [expect.objectContaining({ id: 'route:after-reload' })],
      focusedWindowId: 'route:after-reload',
      theme: 'light',
      revision: 1,
      publisherId: 'windowed-layout:new',
    });
  });

  it('returns defensive copies of stored windows to prevent caller mutation', () => {
    const input: DesktopStateSnapshotInput = {
      windows: [
        {
          id: 'chat:draft',
          kind: 'chat',
          title: 'Conversation',
          route: '/conversations/new',
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          focused: true,
          minimized: false,
          maximized: false,
          zIndex: 10,
        },
      ],
      focusedWindowId: 'chat:draft',
      theme: 'light',
      publishedAt: '2026-07-05T12:34:56.000Z',
    };
    storeDesktopStateSnapshot(input);
    const firstRead = readDesktopStateSnapshot();
    firstRead.windows[0]!.bounds.x = 9999;
    const secondRead = readDesktopStateSnapshot();
    expect(secondRead.windows[0]?.bounds.x).toBe(0);
  });
});
