import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  openConversationTabs: vi.fn(),
  sidebarConversations: vi.fn(),
  saveConversationWorkspaceLayout: vi.fn(),
  updateConversationWorkspace: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  ARCHIVED_SESSION_IDS_STORAGE_KEY,
  OPEN_SESSION_IDS_STORAGE_KEY,
  PINNED_SESSION_IDS_STORAGE_KEY,
} from '../local/localSettings';
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
  resetLocalWriteGrace,
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
    apiMocks.sidebarConversations.mockReset();
    apiMocks.openConversationTabs.mockReset();
    apiMocks.saveConversationWorkspaceLayout.mockReset();
    apiMocks.updateConversationWorkspace.mockReset();
    apiMocks.saveConversationWorkspaceLayout.mockResolvedValue({ ok: true });
    apiMocks.updateConversationWorkspace.mockResolvedValue({ ok: true });
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

  it('starts from an empty layout before the server snapshot arrives', () => {
    localStorage.setItem(
      OPEN_SESSION_IDS_STORAGE_KEY,
      JSON.stringify([' session-1 ', '', null, 'session-2', 'session-3', 'pending-shell']),
    );
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['session-2', ' session-4 ', 'session-2']));
    localStorage.setItem(ARCHIVED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['session-3', 'session-4', ' session-5 ', 'session-5']));

    expect(readConversationLayout()).toEqual({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: null,
    });
    expect(readOpenSessionIds()).toEqual([]);
    expect(readPinnedSessionIds()).toEqual([]);
    expect(readArchivedSessionIds()).toEqual([]);
  });

  it('coalesces concurrent remote layout reads', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/repo'],
      activeConversationId: 'session-1',
      remoteControlledConversationIds: ['session-2'],
    });

    const [left, right] = await Promise.all([fetchRemoteConversationLayout(), fetchRemoteConversationLayout()]);

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(left).toBe(right);
    expect(left).toEqual({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/repo'],
      activeSessionId: 'session-1',
      remoteControlledConversationIds: ['session-2'],
      conversationWorkspaceRevision: 0,
      conversationWorkspaceUpdatedAt: null,
      conversationWorkspaceMigratedAt: null,
    });
  });

  it('updates the remote workspace cache from backend workspace events', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/stale'],
      activeConversationId: 'session-1',
      remoteControlledConversationIds: [],
    });

    await fetchRemoteConversationLayout();

    applyRemoteConversationLayout({
      sessionIds: ['session-1'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'session-1',
      workspacePaths: ['/fresh'],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 2,
      conversationWorkspaceUpdatedAt: '2026-06-15T12:01:00.000Z',
      conversationWorkspaceMigratedAt: '2026-06-15T12:00:00.000Z',
    });

    const layout = await fetchRemoteConversationLayout();

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(layout.workspacePaths).toEqual(['/fresh']);
    expect(layout.conversationWorkspaceRevision).toBe(2);
  });

  it('ignores stale backend workspace events after a newer revision is applied', async () => {
    applyRemoteConversationLayout({
      sessionIds: ['newer-open'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'newer-open',
      workspacePaths: ['/newer'],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 3,
      conversationWorkspaceUpdatedAt: '2026-06-15T12:03:00.000Z',
      conversationWorkspaceMigratedAt: '2026-06-15T12:00:00.000Z',
    });

    const staleLayout = applyRemoteConversationLayout({
      sessionIds: ['older-open'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'older-open',
      workspacePaths: ['/older'],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 2,
      conversationWorkspaceUpdatedAt: '2026-06-15T12:02:00.000Z',
      conversationWorkspaceMigratedAt: '2026-06-15T12:00:00.000Z',
    });

    expect(staleLayout).toEqual({
      sessionIds: ['newer-open'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: 'newer-open',
    });
    expect(readConversationLayout()).toEqual(staleLayout);

    const cachedLayout = await fetchRemoteConversationLayout();
    expect(apiMocks.sidebarConversations).not.toHaveBeenCalled();
    expect(cachedLayout.workspacePaths).toEqual(['/newer']);
    expect(cachedLayout.conversationWorkspaceRevision).toBe(3);
  });

  it('ignores stale remote fetches after newer backend workspace events apply', async () => {
    let resolveFetch: (layout: unknown) => void = () => undefined;
    apiMocks.sidebarConversations.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const refresh = fetchRemoteConversationLayout({ refresh: true });

    applyRemoteConversationLayout({
      sessionIds: ['newer-open'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'newer-open',
      workspacePaths: ['/newer'],
      remoteControlledConversationIds: ['newer-open'],
      conversationWorkspaceRevision: 4,
      conversationWorkspaceUpdatedAt: '2026-06-15T12:04:00.000Z',
      conversationWorkspaceMigratedAt: '2026-06-15T12:00:00.000Z',
    });

    resolveFetch({
      sessionIds: ['older-open'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/older'],
      activeConversationId: 'older-open',
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 3,
      conversationWorkspaceUpdatedAt: '2026-06-15T12:03:00.000Z',
      conversationWorkspaceMigratedAt: '2026-06-15T12:00:00.000Z',
    });

    const layout = await refresh;

    expect(layout.workspacePaths).toEqual(['/newer']);
    expect(layout.remoteControlledConversationIds).toEqual(['newer-open']);
    expect(layout.conversationWorkspaceRevision).toBe(4);
    expect(readConversationLayout()).toEqual({
      sessionIds: ['newer-open'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: 'newer-open',
    });

    const cachedLayout = await fetchRemoteConversationLayout();
    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(cachedLayout.workspacePaths).toEqual(['/newer']);
    expect(cachedLayout.conversationWorkspaceRevision).toBe(4);
  });

  it('keeps a local workspace write over an equal-revision backend event during the write grace window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:03:00.000Z'));

    applyRemoteConversationLayout({
      sessionIds: ['open-a'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'open-a',
      workspacePaths: ['/repo'],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 3,
      conversationWorkspaceUpdatedAt: '2026-06-15T12:03:00.000Z',
      conversationWorkspaceMigratedAt: '2026-06-15T12:00:00.000Z',
    });

    closeConversationTab('open-a');

    const staleLayout = applyRemoteConversationLayout({
      sessionIds: ['open-a'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'open-a',
      workspacePaths: ['/repo'],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 3,
      conversationWorkspaceUpdatedAt: '2026-06-15T12:03:00.000Z',
      conversationWorkspaceMigratedAt: '2026-06-15T12:00:00.000Z',
    });

    expect(staleLayout).toEqual({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: ['open-a'],
      activeSessionId: null,
    });
    expect(readConversationLayout()).toEqual(staleLayout);

    resetLocalWriteGrace();
  });

  it('coalesces concurrent remote layout refreshes without reusing the cache', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T00:00:00.000Z'));
    apiMocks.sidebarConversations
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

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(2);
    expect(left).toBe(right);
    expect(left.sessionIds).toEqual(['fresh-session']);
    expect(left.workspacePaths).toEqual(['/fresh']);
  });

  it('reuses a fresh remote layout cache even when refresh is requested', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['cached-session'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/cached'],
      activeConversationId: 'cached-session',
      remoteControlledConversationIds: [],
    });

    await fetchRemoteConversationLayout();
    const layout = await fetchRemoteConversationLayout({ refresh: true });

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(layout.sessionIds).toEqual(['cached-session']);
    expect(layout.workspacePaths).toEqual(['/cached']);
  });

  it('uses the optimistic local layout cache for refreshes during local write grace', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['cached-session'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: ['/cached'],
      activeConversationId: 'cached-session',
      remoteControlledConversationIds: ['remote-controlled-session'],
    });
    apiMocks.updateConversationWorkspace.mockResolvedValueOnce({
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

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(layout).toEqual({
      sessionIds: ['cached-session', 'local-session'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeSessionId: 'local-session',
      workspacePaths: ['/cached'],
      remoteControlledConversationIds: ['remote-controlled-session'],
      conversationWorkspaceRevision: 0,
      conversationWorkspaceUpdatedAt: null,
      conversationWorkspaceMigratedAt: null,
    });
  });

  it('uses the backend workspace layout even when old localStorage keys exist', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['legacy-open']));
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['legacy-pin']));
    localStorage.setItem(ARCHIVED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['legacy-archived']));
    localStorage.setItem(ACTIVE_SESSION_ID_STORAGE_KEY, 'legacy-open');
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      workspacePaths: [],
      activeConversationId: null,
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 0,
      conversationWorkspaceUpdatedAt: null,
      conversationWorkspaceMigratedAt: null,
    });
    apiMocks.saveConversationWorkspaceLayout.mockResolvedValueOnce({
      sessionIds: ['legacy-open'],
      pinnedSessionIds: ['legacy-pin'],
      archivedSessionIds: ['legacy-archived'],
      workspacePaths: [],
      activeConversationId: 'legacy-open',
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });

    const layout = await fetchRemoteConversationLayout();

    expect(apiMocks.saveConversationWorkspaceLayout).not.toHaveBeenCalled();
    expect(layout.sessionIds).toEqual([]);
    expect(layout.pinnedSessionIds).toEqual([]);
    expect(layout.archivedSessionIds).toEqual([]);
    expect(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY)).toBe(JSON.stringify(['legacy-open']));
    expect(localStorage.getItem(PINNED_SESSION_IDS_STORAGE_KEY)).toBe(JSON.stringify(['legacy-pin']));
    expect(localStorage.getItem(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toBe(JSON.stringify(['legacy-archived']));
    expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBe('legacy-open');
  });

  it('does not persist local workspace actions to localStorage', () => {
    ensureConversationTabOpen('session-1');
    pinConversationTab('session-1');
    setConversationArchivedState('session-1', true);

    expect(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PINNED_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBeNull();
    expect(apiMocks.updateConversationWorkspace).toHaveBeenCalled();
    expect(apiMocks.saveConversationWorkspaceLayout).not.toHaveBeenCalled();
  });

  it('applies remote conversation layout exactly without archiving closed tabs', () => {
    replaceConversationLayout({ sessionIds: ['session-1', 'session-2'], pinnedSessionIds: ['session-3'], archivedSessionIds: [] });

    const layout = applyRemoteConversationLayout({ sessionIds: ['session-2'], pinnedSessionIds: [], archivedSessionIds: [] });

    expect(layout).toEqual({ sessionIds: ['session-2'], pinnedSessionIds: [], archivedSessionIds: [], activeSessionId: null });
    expect(readArchivedSessionIds()).toEqual([]);
    expect(apiMocks.saveConversationWorkspaceLayout).toHaveBeenCalledTimes(1);
    expect(apiMocks.updateConversationWorkspace).not.toHaveBeenCalled();
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
