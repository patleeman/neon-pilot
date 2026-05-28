import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  openConversationTabs: vi.fn(),
  setOpenConversationTabs: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import { ARCHIVED_SESSION_IDS_STORAGE_KEY, OPEN_SESSION_IDS_STORAGE_KEY, PINNED_SESSION_IDS_STORAGE_KEY } from '../local/localSettings';
import {
  applyRemoteConversationLayout,
  closeConversationTab,
  ensureConversationTabOpen,
  fetchRemoteConversationLayout,
  moveConversationTab,
  pinConversationTab,
  readArchivedSessionIds,
  readConversationLayout,
  readOpenSessionIds,
  readPinnedSessionIds,
  reopenMostRecentlyArchivedConversation,
  replaceConversationLayout,
  resetRemoteConversationLayoutCache,
  setConversationArchivedState,
  shiftConversationTab,
  unpinConversationTab,
} from './sessionTabs';

interface MockStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function createStorage(): MockStorage {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

describe('sessionTabs', () => {
  const dispatchEvent = vi.fn();

  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal('localStorage', createStorage());
    vi.stubGlobal('window', { dispatchEvent });
    apiMocks.openConversationTabs.mockReset();
    apiMocks.setOpenConversationTabs.mockReset();
    apiMocks.setOpenConversationTabs.mockResolvedValue({ ok: true });
    resetRemoteConversationLayoutCache();

    if (typeof CustomEvent === 'undefined') {
      vi.stubGlobal(
        'CustomEvent',
        class CustomEvent<T = unknown> {
          type: string;
          detail: T | null;

          constructor(type: string, init?: CustomEventInit<T>) {
            this.type = type;
            this.detail = init?.detail ?? null;
          }
        },
      );
    }
  });

  afterEach(() => {
    dispatchEvent.mockReset();
    vi.unstubAllGlobals();
  });

  it('sanitizes stored open, pinned, and archived session ids', () => {
    localStorage.setItem(
      OPEN_SESSION_IDS_STORAGE_KEY,
      JSON.stringify([' session-1 ', '', null, 'session-2', 'session-3', 'pending-shell']),
    );
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['session-2', ' session-4 ', 'session-2']));
    localStorage.setItem(ARCHIVED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['session-3', 'session-4', ' session-5 ', 'session-5']));

    expect(readConversationLayout()).toEqual({
      sessionIds: ['session-1', 'session-3'],
      pinnedSessionIds: ['session-2', 'session-4'],
      archivedSessionIds: ['session-5'],
      activeSessionId: null,
    });
    expect(readOpenSessionIds()).toEqual(['session-1', 'session-3']);
    expect(readPinnedSessionIds()).toEqual(['session-2', 'session-4']);
    expect(readArchivedSessionIds()).toEqual(['session-5']);
  });

  it('coalesces concurrent remote layout reads', async () => {
    apiMocks.openConversationTabs.mockResolvedValueOnce({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/repo'],
      activeConversationId: 'session-1',
      remoteControlledConversationIds: ['session-2'],
    });

    const [left, right] = await Promise.all([fetchRemoteConversationLayout(), fetchRemoteConversationLayout()]);

    expect(apiMocks.openConversationTabs).toHaveBeenCalledTimes(1);
    expect(left).toBe(right);
    expect(left).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/repo'],
      activeSessionId: 'session-1',
      remoteControlledConversationIds: ['session-2'],
    });
  });

  it('coalesces concurrent remote layout refreshes without reusing the cache', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T00:00:00.000Z'));
    apiMocks.openConversationTabs
      .mockResolvedValueOnce({
        sessionIds: ['cached-session'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        workspacePaths: ['/cached'],
        activeConversationId: 'cached-session',
        remoteControlledConversationIds: [],
      })
      .mockResolvedValueOnce({
        sessionIds: ['fresh-session'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        workspacePaths: ['/fresh'],
        activeConversationId: 'fresh-session',
        remoteControlledConversationIds: [],
      });

    await fetchRemoteConversationLayout();
    vi.advanceTimersByTime(5001);
    const [left, right] = await Promise.all([
      fetchRemoteConversationLayout({ refresh: true }),
      fetchRemoteConversationLayout({ refresh: true }),
    ]);

    expect(apiMocks.openConversationTabs).toHaveBeenCalledTimes(2);
    expect(left).toBe(right);
    expect(left.sessionIds).toEqual(['fresh-session']);
    expect(left.workspacePaths).toEqual(['/fresh']);
  });

  it('reuses a fresh remote layout cache even when refresh is requested', async () => {
    apiMocks.openConversationTabs.mockResolvedValueOnce({
      sessionIds: ['cached-session'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/cached'],
      activeConversationId: 'cached-session',
      remoteControlledConversationIds: [],
    });

    await fetchRemoteConversationLayout();
    const layout = await fetchRemoteConversationLayout({ refresh: true });

    expect(apiMocks.openConversationTabs).toHaveBeenCalledTimes(1);
    expect(layout.sessionIds).toEqual(['cached-session']);
    expect(layout.workspacePaths).toEqual(['/cached']);
  });

  it('uses the optimistic local layout cache for refreshes during local write grace', async () => {
    apiMocks.openConversationTabs.mockResolvedValueOnce({
      sessionIds: ['cached-session'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/cached'],
      activeConversationId: 'cached-session',
      remoteControlledConversationIds: ['remote-controlled-session'],
    });
    apiMocks.setOpenConversationTabs.mockResolvedValueOnce({
      sessionIds: ['cached-session', 'local-session'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/cached'],
      activeConversationId: 'local-session',
      remoteControlledConversationIds: ['remote-controlled-session'],
    });

    await fetchRemoteConversationLayout();
    ensureConversationTabOpen('local-session');

    const layout = await fetchRemoteConversationLayout({ refresh: true });

    expect(apiMocks.openConversationTabs).toHaveBeenCalledTimes(1);
    expect(layout).toEqual({
      sessionIds: ['local-session'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: 'local-session',
      workspacePaths: ['/cached'],
      remoteControlledConversationIds: ['remote-controlled-session'],
    });
  });

  it('applies remote conversation layout exactly without archiving closed tabs', () => {
    replaceConversationLayout({ sessionIds: ['session-1', 'session-2'], pinnedSessionIds: ['session-3'], archivedSessionIds: [] });

    const layout = applyRemoteConversationLayout({ sessionIds: ['session-2'], pinnedSessionIds: [], archivedSessionIds: [] });

    expect(layout).toEqual({ sessionIds: ['session-2'], pinnedSessionIds: [], archivedSessionIds: [], activeSessionId: null });
    expect(readArchivedSessionIds()).toEqual([]);
  });

  it('opens a conversation tab once even when asked repeatedly', () => {
    expect([...ensureConversationTabOpen('session-1')]).toEqual(['session-1']);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    expect([...ensureConversationTabOpen(' session-1 ')]).toEqual(['session-1']);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect([...readOpenSessionIds()]).toEqual(['session-1']);
    expect([...readArchivedSessionIds()]).toEqual([]);
  });

  it('does not persist pending conversation shell ids', () => {
    expect(ensureConversationTabOpen('pending-shell')).toEqual([]);
    expect(readConversationLayout().activeSessionId).toBeNull();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('does not reopen a conversation that is already pinned', () => {
    replaceConversationLayout({ sessionIds: ['session-1'], pinnedSessionIds: ['session-2'] });
    dispatchEvent.mockReset();

    expect(ensureConversationTabOpen('session-2')).toEqual(['session-1']);
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(readConversationLayout()).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: ['session-2'],
      archivedSessionIds: [],
      activeSessionId: null,
    });
  });

  it('moves conversations between the open and pinned shelves while preserving archived overrides', () => {
    replaceConversationLayout({
      sessionIds: ['session-1', 'session-2'],
      pinnedSessionIds: ['session-3'],
      archivedSessionIds: ['session-4'],
      activeSessionId: null,
    });
    dispatchEvent.mockReset();

    expect(moveConversationTab('session-2', 'pinned', 'session-3', 'before')).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: ['session-2', 'session-3'],
      archivedSessionIds: ['session-4'],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    dispatchEvent.mockReset();
    expect(moveConversationTab('session-2', 'open', 'session-1', 'after')).toEqual({
      sessionIds: ['session-1', 'session-2'],
      pinnedSessionIds: ['session-3'],
      archivedSessionIds: ['session-4'],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('shifts an open conversation left or right within its shelf', () => {
    replaceConversationLayout({ sessionIds: ['session-1', 'session-2', 'session-3'], pinnedSessionIds: [] });
    dispatchEvent.mockReset();

    expect(shiftConversationTab('session-2', -1)).toEqual({
      sessionIds: ['session-2', 'session-1', 'session-3'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    dispatchEvent.mockReset();
    expect(shiftConversationTab('session-2', 1)).toEqual({
      sessionIds: ['session-1', 'session-2', 'session-3'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('shifts a pinned conversation within the pinned shelf only', () => {
    replaceConversationLayout({ sessionIds: ['session-3'], pinnedSessionIds: ['session-1', 'session-2'] });
    dispatchEvent.mockReset();

    expect(shiftConversationTab('session-2', -1)).toEqual({
      sessionIds: ['session-3'],
      pinnedSessionIds: ['session-2', 'session-1'],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    dispatchEvent.mockReset();
    expect(shiftConversationTab('session-2', -1)).toEqual({
      sessionIds: ['session-3'],
      pinnedSessionIds: ['session-2', 'session-1'],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('ignores shift requests that would move past a shelf edge', () => {
    replaceConversationLayout({ sessionIds: ['session-1', 'session-2'], pinnedSessionIds: [] });
    dispatchEvent.mockReset();

    expect(shiftConversationTab('session-1', -1)).toEqual({
      sessionIds: ['session-1', 'session-2'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('pins a conversation by removing it from open tabs', () => {
    replaceConversationLayout({ sessionIds: ['session-1', 'session-2'], pinnedSessionIds: [] });
    dispatchEvent.mockReset();

    expect(pinConversationTab('session-2')).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: ['session-2'],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('pins a conversation to the front of the pinned shelf', () => {
    replaceConversationLayout({ sessionIds: ['session-1', 'session-2'], pinnedSessionIds: ['session-3'] });
    dispatchEvent.mockReset();

    expect(pinConversationTab('session-2')).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: ['session-2', 'session-3'],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('unpins a conversation back into open tabs by default', () => {
    replaceConversationLayout({ sessionIds: ['session-1'], pinnedSessionIds: ['session-2'] });
    dispatchEvent.mockReset();

    expect(unpinConversationTab('session-2')).toEqual({
      sessionIds: ['session-1', 'session-2'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('can close a pinned conversation without reopening it in open tabs', () => {
    replaceConversationLayout({ sessionIds: ['session-1'], pinnedSessionIds: ['session-2'] });
    dispatchEvent.mockReset();

    expect(unpinConversationTab('session-2', { open: false })).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: ['session-2'],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('only dispatches changes when a tab actually closes', () => {
    ensureConversationTabOpen('session-1');
    dispatchEvent.mockReset();

    expect([...closeConversationTab('missing')]).toEqual(['session-1']);
    expect(dispatchEvent).not.toHaveBeenCalled();

    expect([...closeConversationTab('session-1')]).toEqual([]);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(readConversationLayout()).toEqual({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: ['session-1'],
      activeSessionId: null,
    });
  });

  it('clears the active conversation when closing or archiving it out of the workspace', () => {
    replaceConversationLayout({ sessionIds: ['parent', 'child'], pinnedSessionIds: [], activeSessionId: 'child' });
    dispatchEvent.mockReset();

    closeConversationTab('child');

    expect(readConversationLayout()).toEqual({
      sessionIds: ['parent'],
      pinnedSessionIds: [],
      archivedSessionIds: ['child'],
      activeSessionId: null,
    });

    replaceConversationLayout({ sessionIds: ['parent', 'child'], pinnedSessionIds: [], archivedSessionIds: [], activeSessionId: 'child' });

    setConversationArchivedState('child', true);

    expect(readConversationLayout()).toEqual({
      sessionIds: ['parent'],
      pinnedSessionIds: [],
      archivedSessionIds: ['child'],
      activeSessionId: null,
    });
  });

  it('can archive and reopen a conversation regardless of whether it was open or pinned', () => {
    replaceConversationLayout({ sessionIds: ['session-1'], pinnedSessionIds: ['session-2'] });
    dispatchEvent.mockReset();

    expect(setConversationArchivedState('session-2', true)).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: ['session-2'],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    dispatchEvent.mockReset();
    expect(setConversationArchivedState('session-2', false)).toEqual({
      sessionIds: ['session-1', 'session-2'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('can explicitly archive a conversation that is not currently in the workspace', () => {
    replaceConversationLayout({ sessionIds: ['session-1'], pinnedSessionIds: [] });
    dispatchEvent.mockReset();

    expect(setConversationArchivedState('session-3', true)).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: ['session-3'],
      activeSessionId: null,
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('reopens the most recently archived conversation first', () => {
    replaceConversationLayout({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: ['session-2', 'session-3'],
      activeSessionId: null,
    });
    dispatchEvent.mockReset();

    expect(reopenMostRecentlyArchivedConversation()).toEqual({
      reopenedSessionId: 'session-3',
      layout: {
        sessionIds: ['session-1', 'session-3'],
        pinnedSessionIds: [],
        archivedSessionIds: ['session-2'],
        activeSessionId: null,
      },
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);

    dispatchEvent.mockReset();
    expect(reopenMostRecentlyArchivedConversation()).toEqual({
      reopenedSessionId: 'session-2',
      layout: {
        sessionIds: ['session-1', 'session-3', 'session-2'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeSessionId: null,
      },
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no archived conversation to reopen', () => {
    replaceConversationLayout({ sessionIds: ['session-1'], pinnedSessionIds: [] });
    dispatchEvent.mockReset();

    expect(reopenMostRecentlyArchivedConversation()).toEqual({
      reopenedSessionId: null,
      layout: {
        sessionIds: ['session-1'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeSessionId: null,
      },
    });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
