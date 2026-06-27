// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppDataContext, LiveTitlesContext, SseConnectionContext } from '../app/contexts.js';
import {
  ACTIVE_SESSION_ID_STORAGE_KEY,
  ARCHIVED_SESSION_IDS_STORAGE_KEY,
  OPEN_SESSION_IDS_STORAGE_KEY,
  PINNED_SESSION_IDS_STORAGE_KEY,
} from '../local/localSettings.js';
import { mergeSessionSnapshotPreservingOrder } from '../session/sessionListState.js';
import { openConversationTab, resetLocalWriteGrace, resetRemoteConversationLayoutCache } from '../session/sessionTabs.js';
import type { ScheduledTaskSummary, SessionMeta } from '../shared/types.js';
import { conversationRuntimeStore, sessionStore, taskStore } from '../store';
import { useConversations } from './useConversations.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const apiMocks = vi.hoisted(() => ({
  readConversationWorkspace: vi.fn(),
  sidebarConversations: vi.fn(),
  sessionMeta: vi.fn(),
  saveConversationWorkspaceLayout: vi.fn(),
  updateConversationWorkspace: vi.fn(),
}));

const fetchSessionsSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

vi.mock('../session/sessionSnapshot', () => ({
  fetchSessionsSnapshot: fetchSessionsSnapshotMock,
}));

const mountedRoots: Root[] = [];
let latestHookResult: ReturnType<typeof useConversations> | null = null;

/**
 * Exposed by ControllableStatefulProbe so the test can inject a full session
 * snapshot mid-test, simulating an SSE sessions_snapshot arrival.
 */
const snapshotControlRef: { current: ((sessions: SessionMeta[]) => void) | null } = { current: null };

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function createSession(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: 'conv-auto',
    file: '/tmp/conv-auto.jsonl',
    timestamp: '2026-03-16T09:30:00.000Z',
    cwd: '/home/user/project',
    cwdSlug: 'neon-pilot',
    model: 'openai/gpt-5.4',
    title: 'Automation: Morning Briefing',
    messageCount: 4,
    isRunning: false,
    ...overrides,
  };
}

function createTask(overrides: Partial<ScheduledTaskSummary> = {}): ScheduledTaskSummary {
  return {
    id: 'morning-briefing',
    title: 'Morning Briefing',
    scheduleType: 'cron',
    running: true,
    enabled: true,
    prompt: 'Assemble the morning briefing.',
    threadConversationId: 'conv-auto',
    ...overrides,
  };
}

function HookProbe() {
  latestHookResult = useConversations();
  return null;
}

function mergeSessions(previous: SessionMeta[] | null, items: SessionMeta[]): SessionMeta[] {
  const next = [...(previous ?? [])];
  const indexes = new Map(next.map((session, index) => [session.id, index]));
  for (const item of items) {
    const index = indexes.get(item.id);
    if (index === undefined) {
      indexes.set(item.id, next.length);
      next.push(item);
    } else {
      next[index] = item;
    }
  }
  return next;
}

function renderProbe(input: {
  sessions: SessionMeta[];
  tasks: ScheduledTaskSummary[] | null;
  liveTitles?: Map<string, string>;
  sseStatus?: React.ContextType<typeof SseConnectionContext>['status'];
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  renderProbeIntoRoot(root, input);

  mountedRoots.push(root);
}

function renderProbeIntoRoot(
  root: Root,
  input: {
    sessions: SessionMeta[];
    tasks: ScheduledTaskSummary[] | null;
    liveTitles?: Map<string, string>;
    sseStatus?: React.ContextType<typeof SseConnectionContext>['status'];
  },
) {
  // Seed the reactive entity store so hooks read the same data the test expects
  // via AppDataContext (backward compat during migration).
  if (input.sessions) {
    sessionStore.replaceAll(input.sessions);
    sessionStore.markReady?.();
  }
  if (input.tasks) taskStore.replaceAll(input.tasks);

  act(() => {
    root.render(
      <SseConnectionContext.Provider value={{ status: input.sseStatus ?? 'offline' }}>
        <AppDataContext.Provider
          value={{
            projects: null,
            sessions: input.sessions,
            tasks: input.tasks,
            runs: null,
            setProjects: () => {},
            setSessions: () => {},
            setTasks: () => {},
            setRuns: () => {},
          }}
        >
          <LiveTitlesContext.Provider value={{ titles: input.liveTitles ?? new Map(), setTitle: () => {} }}>
            <HookProbe />
          </LiveTitlesContext.Provider>
        </AppDataContext.Provider>
      </SseConnectionContext.Provider>,
    );
  });
}

function StatefulHookProbeProviders({
  input,
}: {
  input: { sessions: SessionMeta[]; tasks: ScheduledTaskSummary[] | null; liveTitles?: Map<string, string> };
}) {
  const [sessions, setSessionsState] = React.useState<SessionMeta[] | null>(input.sessions);
  const setSessions = React.useCallback((items: SessionMeta[]) => {
    setSessionsState((previous) => {
      const merged = mergeSessions(previous, items);
      sessionStore.replaceAll(merged);
      sessionStore.markReady?.();
      return merged;
    });
  }, []);

  // Seed the store with initial data
  React.useEffect(() => {
    if (input.sessions) {
      sessionStore.replaceAll(input.sessions);
      sessionStore.markReady?.();
    }
    if (input.tasks) {
      taskStore.replaceAll(input.tasks);
    }
  }, []);

  return (
    <SseConnectionContext.Provider value={{ status: 'offline' }}>
      <AppDataContext.Provider
        value={{
          projects: null,
          sessions,
          tasks: input.tasks,
          runs: null,
          setProjects: () => {},
          setSessions,
          setTasks: () => {},
          setRuns: () => {},
        }}
      >
        <LiveTitlesContext.Provider value={{ titles: input.liveTitles ?? new Map(), setTitle: () => {} }}>
          <HookProbe />
        </LiveTitlesContext.Provider>
      </AppDataContext.Provider>
    </SseConnectionContext.Provider>
  );
}

function renderStatefulProbe(input: {
  sessions: SessionMeta[] | null;
  tasks: ScheduledTaskSummary[] | null;
  liveTitles?: Map<string, string>;
}) {
  // Seed the store synchronously before rendering
  if (input.sessions) {
    sessionStore.replaceAll(input.sessions);
    sessionStore.markReady?.();
  }
  if (input.tasks) taskStore.replaceAll(input.tasks);

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<StatefulHookProbeProviders input={input} />);
  });

  mountedRoots.push(root);
}

/**
 * Probe that uses the real mergeSessionSnapshotPreservingOrder, matching what
 * App.tsx does. This allows reproducing the race where individual sessionMeta
 * fetches replace the sessions array (snapshot semantics) instead of merging.
 */
function SnapshotStatefulHookProbeProviders({
  input,
}: {
  input: { sessions: SessionMeta[] | null; tasks: ScheduledTaskSummary[] | null; liveTitles?: Map<string, string> };
}) {
  const [sessions, setSessionsState] = React.useState<SessionMeta[] | null>(input.sessions);
  const setSessions = React.useCallback((items: SessionMeta[]) => {
    setSessionsState((previous) => {
      const merged = mergeSessionSnapshotPreservingOrder(previous, items);
      sessionStore.replaceAll(merged);
      sessionStore.markReady?.();
      return merged;
    });
  }, []);

  // Expose a setter so the test can simulate an SSE sessions_snapshot arriving.
  const applySnapshot = React.useCallback((snapshot: SessionMeta[]) => {
    setSessionsState(snapshot);
    sessionStore.replaceAll(snapshot);
    sessionStore.markReady?.();
  }, []);

  React.useEffect(() => {
    snapshotControlRef.current = applySnapshot;
    return () => {
      snapshotControlRef.current = null;
    };
  }, [applySnapshot]);

  return (
    <SseConnectionContext.Provider value={{ status: 'offline' }}>
      <AppDataContext.Provider
        value={{
          projects: null,
          sessions,
          tasks: input.tasks,
          runs: null,
          setProjects: () => {},
          setSessions,
          setTasks: () => {},
          setRuns: () => {},
        }}
      >
        <LiveTitlesContext.Provider value={{ titles: input.liveTitles ?? new Map(), setTitle: () => {} }}>
          <HookProbe />
        </LiveTitlesContext.Provider>
      </AppDataContext.Provider>
    </SseConnectionContext.Provider>
  );
}

function renderSnapshotProbe(input: {
  sessions: SessionMeta[] | null;
  tasks: ScheduledTaskSummary[] | null;
  liveTitles?: Map<string, string>;
}) {
  // Seed the store synchronously before rendering so the hook sees the data
  // on the first render instead of waiting for a useEffect.
  if (input.sessions) {
    sessionStore.replaceAll(input.sessions);
    sessionStore.markReady?.();
  }
  if (input.tasks) taskStore.replaceAll(input.tasks);

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<SnapshotStatefulHookProbeProviders input={input} />);
  });

  mountedRoots.push(root);
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe('useConversations', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    apiMocks.readConversationWorkspace.mockReset();
    apiMocks.sidebarConversations.mockReset();
    apiMocks.sessionMeta.mockReset();
    apiMocks.saveConversationWorkspaceLayout.mockReset();
    apiMocks.updateConversationWorkspace.mockReset();
    fetchSessionsSnapshotMock.mockReset();
    apiMocks.readConversationWorkspace.mockResolvedValue({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    fetchSessionsSnapshotMock.mockImplementation(async () => [...sessionStore.getAll()]);
    apiMocks.sidebarConversations.mockImplementation(async () => ({
      ...(await apiMocks.readConversationWorkspace()),
      sessions: await fetchSessionsSnapshotMock(),
    }));
    apiMocks.saveConversationWorkspaceLayout.mockResolvedValue({
      ok: true,
      sessionIds: ['conv-auto'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 2,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:01.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    apiMocks.updateConversationWorkspace.mockResolvedValue({
      ok: true,
      sessionIds: ['conv-auto'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 2,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:01.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    apiMocks.sessionMeta.mockImplementation(async (id: string) => createSession({ id, title: `Loaded ${id}` }));
    sessionStore.replaceAll([]);
    taskStore.replaceAll([]);
    sessionStore.markReady?.();
    resetLocalWriteGrace();
    resetRemoteConversationLayoutCache();
    latestHookResult = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      act(() => {
        root?.unmount();
      });
    }
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens a running automation thread in the workspace tab list when execution starts', async () => {
    renderProbe({
      sessions: [createSession()],
      tasks: [createTask()],
    });

    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['conv-auto']);
    expect(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(apiMocks.updateConversationWorkspace).toHaveBeenCalledWith({ operation: 'open', sessionId: 'conv-auto', active: false });
  });

  it('does not keep the conversation list loading just because app events are reconnecting', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['conv-ready'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'conv-ready',
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      sessions: [createSession({ id: 'conv-ready', title: 'Ready Thread' })],
    });

    renderProbe({
      sessions: [createSession({ id: 'conv-ready', title: 'Ready Thread' })],
      tasks: [],
      sseStatus: 'connecting',
    });

    await flushAsyncWork();

    expect(latestHookResult?.loading).toBe(false);
    expect(latestHookResult?.tabs.map((session) => session.title)).toEqual(['Ready Thread']);
  });

  it('does not accept a stale open operation response that drops existing threads', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['existing-thread'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'existing-thread',
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    apiMocks.updateConversationWorkspace.mockResolvedValueOnce({
      sessionIds: ['new-thread'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'new-thread',
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 2,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:01.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    apiMocks.saveConversationWorkspaceLayout.mockResolvedValueOnce({
      sessionIds: ['existing-thread', 'new-thread'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'new-thread',
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 3,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:02.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });

    renderProbe({
      sessions: [createSession({ id: 'existing-thread' }), createSession({ id: 'new-thread' })],
      tasks: null,
    });
    await flushAsyncWork();

    act(() => {
      openConversationTab('new-thread');
    });
    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['existing-thread', 'new-thread']);
    expect(apiMocks.saveConversationWorkspaceLayout).toHaveBeenCalledWith(
      ['existing-thread', 'new-thread'],
      [],
      [],
      undefined,
      'new-thread',
      {
        conversationWorkspaceMigrated: true,
        lockedConversationIds: [],
      },
    );
  });

  it('sorts archived conversations by latest activity', async () => {
    renderProbe({
      sessions: [
        createSession({ id: 'older', timestamp: '2026-03-16T09:30:00.000Z', lastActivityAt: '2026-03-16T09:55:00.000Z' }),
        createSession({ id: 'newest', timestamp: '2026-03-15T09:30:00.000Z', lastActivityAt: '2026-03-16T10:05:00.000Z' }),
        createSession({ id: 'middle', timestamp: '2026-03-16T10:00:00.000Z' }),
      ],
      tasks: null,
    });

    await flushAsyncWork();

    expect(latestHookResult?.archivedSessions.map((session) => session.id)).toEqual(['newest', 'middle', 'older']);
  });

  it('trusts the backend sidebar projection instead of inventing ghost rows for stale ids', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['real-open'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      sessions: [createSession({ id: 'real-open', title: 'Real conversation' })],
    });

    renderProbe({
      sessions: [],
      tasks: null,
    });

    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['real-open']);
    expect(latestHookResult?.pinnedSessions.map((session) => session.id)).toEqual([]);
    expect(latestHookResult?.archivedConversationIds).toEqual([]);
    expect(latestHookResult?.activeId).toBeNull();
    expect(apiMocks.saveConversationWorkspaceLayout).not.toHaveBeenCalled();
    expect(apiMocks.updateConversationWorkspace).not.toHaveBeenCalled();
  });

  it('hydrates remote layout when local layout is empty', async () => {
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: ['remote-conv'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'remote-conv',
      workspacePaths: [],
    });

    renderProbe({
      sessions: [createSession({ id: 'remote-conv', title: 'Remote conversation' })],
      tasks: null,
    });

    expect(latestHookResult?.layoutHydrating).toBe(true);
    await flushAsyncWork();

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['remote-conv']);
    expect(latestHookResult?.activeId).toBe('remote-conv');
    expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBeNull();
  });

  it('uses backend sidebar projection as the source of truth for stale workspace ids', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['real-open'],
      pinnedSessionIds: ['real-pinned'],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 2,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:01.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      sessions: [createSession({ id: 'real-open', title: 'Real open' }), createSession({ id: 'real-pinned', title: 'Real pinned' })],
    });

    renderProbe({ sessions: [], tasks: null });
    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['real-open']);
    expect(latestHookResult?.pinnedSessions.map((session) => session.id)).toEqual(['real-pinned']);
    expect(latestHookResult?.activeId).toBeNull();
    expect(latestHookResult?.tabs.some((session) => session.title === 'Connecting…')).toBe(false);
  });

  it('retries remote layout hydration without declaring an empty workspace', async () => {
    apiMocks.sidebarConversations.mockRejectedValueOnce(new Error('backend warming')).mockResolvedValueOnce({
      sessionIds: ['remote-after-retry'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'remote-after-retry',
      workspacePaths: [],
    });

    renderProbe({
      sessions: [createSession({ id: 'remote-after-retry', title: 'Remote after retry' })],
      tasks: null,
    });

    await flushAsyncWork();

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(latestHookResult?.layoutHydrating).toBe(true);
    expect(latestHookResult?.loading).toBe(true);
    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual([]);

    await vi.waitFor(() => expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    await flushAsyncWork();

    expect(latestHookResult?.layoutHydrating).toBe(false);
    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['remote-after-retry']);
    expect(latestHookResult?.activeId).toBe('remote-after-retry');
  });

  it('ignores stale browser-local conversations when cold-start backend layout is empty', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['local-open']));
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['local-pinned']));
    localStorage.setItem(ACTIVE_SESSION_ID_STORAGE_KEY, 'local-open');
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 0,
      conversationWorkspaceUpdatedAt: null,
      conversationWorkspaceMigratedAt: null,
    });

    renderProbe({
      sessions: [
        createSession({ id: 'local-open', title: 'Local open conversation' }),
        createSession({ id: 'local-pinned', title: 'Local pinned conversation' }),
      ],
      tasks: null,
    });

    await flushAsyncWork();

    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
    expect(apiMocks.saveConversationWorkspaceLayout).not.toHaveBeenCalled();
    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual([]);
    expect(latestHookResult?.pinnedSessions.map((session) => session.id)).toEqual([]);
    expect(latestHookResult?.activeId).toBeNull();
    expect(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY)).toBe(JSON.stringify(['local-open']));
    expect(localStorage.getItem(PINNED_SESSION_IDS_STORAGE_KEY)).toBe(JSON.stringify(['local-pinned']));
    expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBe('local-open');
  });

  it('loads row metadata for backend-open ids before the full sessions snapshot arrives', async () => {
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: ['open-one'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
    });

    renderStatefulProbe({
      sessions: null,
      tasks: null,
    });

    await flushAsyncWork();

    expect(apiMocks.sessionMeta).toHaveBeenCalledWith('open-one');
    expect(latestHookResult?.tabs.map((session) => session.title)).toEqual(['Loaded open-one']);
  });

  it('loads missing row metadata when a partial sessions snapshot already exists', async () => {
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: ['real-open', 'stale-but-known'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'stale-but-known',
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 2,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:01.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });

    renderStatefulProbe({
      sessions: [createSession({ id: 'real-open', title: 'Real open' })],
      tasks: null,
    });

    await flushAsyncWork();

    expect(apiMocks.sessionMeta).toHaveBeenCalledWith('stale-but-known');
    expect(latestHookResult?.tabs.map((session) => session.title)).toEqual(['Real open', 'Loaded stale-but-known']);
  });

  it('keeps a placeholder tab when row metadata fails before any full snapshot arrives', async () => {
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: ['open-missing-meta'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'open-missing-meta',
      workspacePaths: [],
    });
    apiMocks.sessionMeta.mockRejectedValue(new Error('session meta unavailable'));

    renderStatefulProbe({
      sessions: [],
      tasks: null,
    });

    await flushAsyncWork();

    expect(apiMocks.sessionMeta).toHaveBeenCalledWith('open-missing-meta');
    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['open-missing-meta']);
    expect(latestHookResult?.tabs.map((session) => session.title)).toEqual(['Connecting…']);
    expect(latestHookResult?.activeId).toBe('open-missing-meta');
  });

  it('keeps a multi-action workspace flow in backend-backed projection without localStorage writes', async () => {
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: ['open-a', 'open-b'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'open-a',
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    apiMocks.updateConversationWorkspace.mockImplementation(
      async (
        input:
          | { operation: string; sessionId?: string | null }
          | {
              operation: 'move';
              sessionId: string;
              targetSection: 'open' | 'pinned';
              targetSessionId?: string | null;
              position?: 'before' | 'after' | null;
            },
      ) => ({
        ok: true,
        sessionIds: ['open-a'],
        pinnedSessionIds: ['open-b'],
        archivedSessionIds: input.operation === 'close' ? ['open-c'] : [],
        activeConversationId: null,
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 2,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:01.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      }),
    );

    renderProbe({
      sessions: [
        createSession({ id: 'open-a', title: 'Open A' }),
        createSession({ id: 'open-b', title: 'Open B' }),
        createSession({ id: 'open-c', title: 'Open C' }),
      ],
      tasks: null,
    });
    await flushAsyncWork();

    act(() => {
      latestHookResult?.openSession('open-c');
      latestHookResult?.pinSession('open-b');
      latestHookResult?.archiveSession('open-a');
      latestHookResult?.restoreSession('open-a');
      latestHookResult?.moveSession('open-a', 'open', 'open-c', 'before');
      latestHookResult?.closeSession('open-c');
    });

    expect(latestHookResult?.pinnedIds).toEqual(['open-b']);
    expect(latestHookResult?.openIds).toEqual(['open-a']);
    expect(latestHookResult?.archivedConversationIds).toEqual(['open-c']);
    expect(apiMocks.updateConversationWorkspace).toHaveBeenCalledTimes(6);
    expect(apiMocks.updateConversationWorkspace).toHaveBeenNthCalledWith(1, { operation: 'open', sessionId: 'open-c' });
    expect(apiMocks.updateConversationWorkspace).toHaveBeenNthCalledWith(2, {
      operation: 'move',
      sessionId: 'open-b',
      targetSection: 'pinned',
      targetSessionId: null,
      position: 'before',
    });
    expect(apiMocks.updateConversationWorkspace).toHaveBeenLastCalledWith({ operation: 'close', sessionId: 'open-c' });
    expect(apiMocks.saveConversationWorkspaceLayout).not.toHaveBeenCalled();
    expect(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PINNED_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toBeNull();
  });

  it('does not let an older manual refetch overwrite a newer snapshot', async () => {
    let resolveFirst!: (snapshot: Awaited<ReturnType<typeof apiMocks.sidebarConversations>>) => void;
    let resolveSecond!: (snapshot: Awaited<ReturnType<typeof apiMocks.sidebarConversations>>) => void;
    const first = new Promise<Awaited<ReturnType<typeof apiMocks.sidebarConversations>>>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<Awaited<ReturnType<typeof apiMocks.sidebarConversations>>>((resolve) => {
      resolveSecond = resolve;
    });
    apiMocks.sidebarConversations
      .mockResolvedValueOnce({
        sessionIds: ['initial'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: null,
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 1,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
        sessions: [createSession({ id: 'initial', title: 'Initial session' })],
      })
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    renderProbe({
      sessions: [createSession({ id: 'initial', title: 'Initial session' })],
      tasks: null,
    });

    await flushAsyncWork();

    const firstRefetch = latestHookResult?.refetch();
    const secondRefetch = latestHookResult?.refetch();

    await act(async () => {
      resolveSecond({
        sessionIds: ['newer'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: null,
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 3,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:02.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
        sessions: [createSession({ id: 'newer', title: 'Newer snapshot' })],
      });
      await secondRefetch;
    });

    expect(sessionStore.get('newer')?.title).toBe('Newer snapshot');
    expect(sessionStore.get('initial')).toBeUndefined();

    await act(async () => {
      resolveFirst({
        sessionIds: ['older'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: null,
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 2,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:01.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
        sessions: [createSession({ id: 'older', title: 'Older snapshot' })],
      });
      await firstRefetch;
    });

    expect(sessionStore.get('newer')?.title).toBe('Newer snapshot');
    expect(sessionStore.get('older')).toBeUndefined();
  });

  it('does not let session refresh close backend-visible live conversation tabs', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['conv-live'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    renderProbeIntoRoot(root, {
      sessions: [createSession({ id: 'conv-live', title: 'Running tab' })],
      tasks: null,
      liveTitles: new Map([['conv-live', 'Running tab']]),
    });
    await flushAsyncWork();
    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['conv-live']);

    renderProbeIntoRoot(root, {
      sessions: [createSession({ id: 'conv-live', title: 'Running tab', messageCount: 5 })],
      tasks: null,
      liveTitles: new Map([['conv-live', 'Running tab']]),
    });
    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['conv-live']);
    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
  });

  it('keeps a newly reserved conversation in the sidebar through snapshot refresh', async () => {
    apiMocks.sidebarConversations.mockResolvedValueOnce({
      sessionIds: ['reserved-conv'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'reserved-conv',
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });

    const reservedSession = createSession({
      id: 'reserved-conv',
      file: '/tmp/reserved-conv.jsonl',
      title: 'New Conversation',
      messageCount: 0,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    renderProbeIntoRoot(root, {
      sessions: [reservedSession],
      tasks: null,
    });
    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['reserved-conv']);
    expect(latestHookResult?.activeId).toBe('reserved-conv');

    renderProbeIntoRoot(root, {
      sessions: [{ ...reservedSession, messageCount: 1, title: 'Reserved conversation persisted' }],
      tasks: null,
    });
    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['reserved-conv']);
    expect(latestHookResult?.tabs.map((session) => session.title)).toEqual(['Reserved conversation persisted']);
    expect(latestHookResult?.activeId).toBe('reserved-conv');
    expect(apiMocks.sidebarConversations).toHaveBeenCalledTimes(1);
  });

  describe('bootstrap / individual sessionMeta fetch race', () => {
    it('preserves all open IDs when individual sessionMeta fetches resolve out of order', async () => {
      apiMocks.sidebarConversations.mockResolvedValue({
        sessionIds: ['open-a', 'open-b', 'open-c'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: null,
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 1,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      });

      // Deferred promises let us control resolution order.
      let resolveA!: (session: SessionMeta) => void;
      let resolveB!: (session: SessionMeta) => void;
      let resolveC!: (session: SessionMeta) => void;
      const promiseA = new Promise<SessionMeta>((r) => {
        resolveA = r;
      });
      const promiseB = new Promise<SessionMeta>((r) => {
        resolveB = r;
      });
      const promiseC = new Promise<SessionMeta>((r) => {
        resolveC = r;
      });

      apiMocks.sessionMeta.mockImplementation(async (id: string) => {
        if (id === 'open-a') return promiseA;
        if (id === 'open-b') return promiseB;
        if (id === 'open-c') return promiseC;
        return createSession({ id });
      });

      renderSnapshotProbe({ sessions: null, tasks: null });
      await flushAsyncWork();

      // All three fetches started.
      expect(apiMocks.sessionMeta).toHaveBeenCalledTimes(3);

      // Resolve 'open-b' first — without the fix this would replace the
      // sessions array with just [B], then the pruning effect would run with
      // knownSessionIds = {B, C} (A is no longer in inflight after .finally)
      // and prune A from openIds.
      resolveB(createSession({ id: 'open-b', title: 'Session B' }));
      await flushAsyncWork();

      expect(latestHookResult?.tabs.map((s) => s.id)).toEqual(['open-a', 'open-b', 'open-c']);

      // Resolve remaining.
      resolveA(createSession({ id: 'open-a', title: 'Session A' }));
      resolveC(createSession({ id: 'open-c', title: 'Session C' }));
      await flushAsyncWork();

      expect(latestHookResult?.tabs.map((s) => s.id)).toEqual(['open-a', 'open-b', 'open-c']);
      expect(latestHookResult?.tabs.map((s) => s.title)).toEqual(['Session A', 'Session B', 'Session C']);
    });

    it('does not let individual sessionMeta fetches overwrite a later-arriving full snapshot', async () => {
      apiMocks.sidebarConversations.mockResolvedValue({
        sessionIds: ['open-a', 'open-b'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: null,
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 1,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      });

      let resolveA!: (session: SessionMeta) => void;
      let resolveB!: (session: SessionMeta) => void;
      const promiseA = new Promise<SessionMeta>((r) => {
        resolveA = r;
      });
      const promiseB = new Promise<SessionMeta>((r) => {
        resolveB = r;
      });

      apiMocks.sessionMeta.mockImplementation(async (id: string) => {
        if (id === 'open-a') return promiseA;
        if (id === 'open-b') return promiseB;
        return createSession({ id });
      });

      renderSnapshotProbe({ sessions: null, tasks: null });
      await flushAsyncWork();
      expect(apiMocks.sessionMeta).toHaveBeenCalledTimes(2);

      // Simulate SSE sessions_snapshot arriving with both sessions before
      // the individual fetches resolve.
      act(() => {
        snapshotControlRef.current?.([
          createSession({ id: 'open-a', title: 'Snapshot A' }),
          createSession({ id: 'open-b', title: 'Snapshot B' }),
        ]);
      });
      await flushAsyncWork();

      expect(latestHookResult?.tabs.map((s) => s.title)).toEqual(['Snapshot A', 'Snapshot B']);

      // Individual meta fetches finally resolve — they must NOT overwrite
      // the full snapshot that arrived first.
      resolveA(createSession({ id: 'open-a', title: 'Individual A' }));
      resolveB(createSession({ id: 'open-b', title: 'Individual B' }));
      await flushAsyncWork();

      expect(latestHookResult?.tabs.map((s) => s.title)).toEqual(['Snapshot A', 'Snapshot B']);
      expect(latestHookResult?.tabs.map((s) => s.id)).toEqual(['open-a', 'open-b']);
    });

    it('keeps backend workspace IDs even when no individual meta fetches are in flight', async () => {
      apiMocks.sidebarConversations.mockResolvedValue({
        sessionIds: ['real-open', 'stale-open'],
        pinnedSessionIds: ['stale-pinned'],
        archivedSessionIds: ['stale-archived'],
        activeConversationId: 'stale-open',
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 1,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      });

      // Use the snapshot-style probe to match app behavior.
      renderSnapshotProbe({
        sessions: [createSession({ id: 'real-open', title: 'Real conversation' })],
        tasks: null,
      });

      await flushAsyncWork();

      expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['real-open', 'stale-open']);
      expect(latestHookResult?.pinnedSessions.map((session) => session.id)).toEqual(['stale-pinned']);
      expect(latestHookResult?.archivedConversationIds).toEqual(['stale-archived']);
      expect(latestHookResult?.activeId).toBe('stale-open');
    });
  });

  it('uses the latest session snapshot as the source of truth for running state', async () => {
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: ['conv-running'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    renderProbeIntoRoot(root, {
      sessions: [createSession({ id: 'conv-running', isRunning: true })],
      tasks: null,
    });
    await flushAsyncWork();
    expect(latestHookResult?.tabs[0]?.isRunning).toBe(true);

    renderProbeIntoRoot(root, {
      sessions: [createSession({ id: 'conv-running', isRunning: false })],
      tasks: null,
    });
    await flushAsyncWork();
    expect(latestHookResult?.tabs[0]?.isRunning).toBe(false);
  });

  it('keeps sidebar running state from live presence when the session snapshot is stale', async () => {
    apiMocks.sidebarConversations.mockResolvedValue({
      sessionIds: ['conv-running'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
      remoteControlledConversationIds: [],
      conversationWorkspaceRevision: 1,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    renderProbeIntoRoot(root, {
      sessions: [createSession({ id: 'conv-running', isRunning: false })],
      tasks: null,
    });
    await flushAsyncWork();
    expect(latestHookResult?.tabs[0]?.isRunning).toBe(false);

    await act(async () => {
      conversationRuntimeStore.apply({
        id: 'conv-running',
        running: true,
        revision: 1,
        updatedAt: '2026-04-01T00:00:01.000Z',
      });
    });

    expect(latestHookResult?.tabs[0]?.isRunning).toBe(true);
  });
});
