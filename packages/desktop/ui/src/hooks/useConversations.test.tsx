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
import { resetLocalWriteGrace } from '../session/sessionTabs.js';
import type { ScheduledTaskSummary, SessionMeta } from '../shared/types.js';
import { sessionStore, taskStore } from '../store';
import { useConversations } from './useConversations.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const apiMocks = vi.hoisted(() => ({
  openConversationTabs: vi.fn(),
  sessionMeta: vi.fn(),
  setOpenConversationTabs: vi.fn(),
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

function renderProbe(input: { sessions: SessionMeta[]; tasks: ScheduledTaskSummary[] | null; liveTitles?: Map<string, string> }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  renderProbeIntoRoot(root, input);

  mountedRoots.push(root);
}

function renderProbeIntoRoot(
  root: Root,
  input: { sessions: SessionMeta[]; tasks: ScheduledTaskSummary[] | null; liveTitles?: Map<string, string> },
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
      <SseConnectionContext.Provider value={{ status: 'offline' }}>
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
    apiMocks.openConversationTabs.mockReset();
    apiMocks.sessionMeta.mockReset();
    apiMocks.setOpenConversationTabs.mockReset();
    fetchSessionsSnapshotMock.mockReset();
    apiMocks.openConversationTabs.mockResolvedValue({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
    });
    apiMocks.setOpenConversationTabs.mockResolvedValue({
      ok: true,
      sessionIds: ['conv-auto'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
    });
    apiMocks.sessionMeta.mockImplementation(async (id: string) => createSession({ id, title: `Loaded ${id}` }));
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(ARCHIVED_SESSION_IDS_STORAGE_KEY, JSON.stringify([]));
    resetLocalWriteGrace();
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

    expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['conv-auto']);
    expect(apiMocks.setOpenConversationTabs).toHaveBeenCalled();
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

  it('drops stale layout ids that are not in the loaded session snapshot', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['real-open', 'stale-open']));
    localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['stale-pinned']));
    localStorage.setItem(ARCHIVED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['stale-archived']));
    localStorage.setItem(ACTIVE_SESSION_ID_STORAGE_KEY, 'stale-open');

    renderProbe({
      sessions: [createSession({ id: 'real-open', title: 'Real conversation' })],
      tasks: null,
    });

    await flushAsyncWork();

    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['real-open']);
    expect(latestHookResult?.pinnedSessions).toEqual([]);
    expect(latestHookResult?.archivedConversationIds).toEqual([]);
    expect(latestHookResult?.activeId).toBeNull();
    expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['real-open']);
    expect(localStorage.getItem(PINNED_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBeNull();
  });

  it('hydrates remote layout when local layout is empty', async () => {
    apiMocks.openConversationTabs.mockResolvedValue({
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

    expect(apiMocks.openConversationTabs).toHaveBeenCalledTimes(1);
    expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['remote-conv']);
    expect(latestHookResult?.activeId).toBe('remote-conv');
    expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBe('remote-conv');
  });

  it('loads row metadata for backend-open ids before the full sessions snapshot arrives', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['open-one']));
    apiMocks.openConversationTabs.mockResolvedValue({
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
    expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['open-one']);
  });

  it('does not let an older manual refetch overwrite a newer snapshot', async () => {
    let resolveFirst!: (sessions: SessionMeta[]) => void;
    let resolveSecond!: (sessions: SessionMeta[]) => void;
    const first = new Promise<SessionMeta[]>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<SessionMeta[]>((resolve) => {
      resolveSecond = resolve;
    });
    fetchSessionsSnapshotMock.mockReturnValueOnce(first).mockReturnValueOnce(second);

    renderProbe({
      sessions: [createSession({ id: 'initial', title: 'Initial session' })],
      tasks: null,
    });

    await flushAsyncWork();

    const firstRefetch = latestHookResult?.refetch();
    const secondRefetch = latestHookResult?.refetch();

    await act(async () => {
      resolveSecond([createSession({ id: 'newer', title: 'Newer snapshot' })]);
      await secondRefetch;
    });

    expect(sessionStore.get('newer')?.title).toBe('Newer snapshot');
    expect(sessionStore.get('initial')).toBeUndefined();

    await act(async () => {
      resolveFirst([createSession({ id: 'older', title: 'Older snapshot' })]);
      await firstRefetch;
    });

    expect(sessionStore.get('newer')?.title).toBe('Newer snapshot');
    expect(sessionStore.get('older')).toBeUndefined();
  });

  it('does not let stale remote layout sync close locally visible live conversation tabs', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-live']));
    apiMocks.openConversationTabs.mockResolvedValueOnce({
      sessionIds: ['conv-live'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
    });
    apiMocks.openConversationTabs.mockResolvedValue({
      sessionIds: [],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: null,
      workspacePaths: [],
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
    expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['conv-live']);
  });

  describe('bootstrap / individual sessionMeta fetch race', () => {
    it('preserves all open IDs when individual sessionMeta fetches resolve out of order', async () => {
      localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['open-a', 'open-b', 'open-c']));
      apiMocks.openConversationTabs.mockResolvedValue({
        sessionIds: ['open-a', 'open-b', 'open-c'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: null,
        workspacePaths: [],
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
      expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['open-a', 'open-b', 'open-c']);

      // Resolve remaining.
      resolveA(createSession({ id: 'open-a', title: 'Session A' }));
      resolveC(createSession({ id: 'open-c', title: 'Session C' }));
      await flushAsyncWork();

      expect(latestHookResult?.tabs.map((s) => s.id)).toEqual(['open-a', 'open-b', 'open-c']);
      expect(latestHookResult?.tabs.map((s) => s.title)).toEqual(['Session A', 'Session B', 'Session C']);
      expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['open-a', 'open-b', 'open-c']);
    });

    it('does not let individual sessionMeta fetches overwrite a later-arriving full snapshot', async () => {
      localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['open-a', 'open-b']));
      apiMocks.openConversationTabs.mockResolvedValue({
        sessionIds: ['open-a', 'open-b'],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        activeConversationId: null,
        workspacePaths: [],
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
      expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['open-a', 'open-b']);
    });

    it('still prunes stale layout IDs when no individual meta fetches are in flight', async () => {
      localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['real-open', 'stale-open']));
      localStorage.setItem(PINNED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['stale-pinned']));
      localStorage.setItem(ARCHIVED_SESSION_IDS_STORAGE_KEY, JSON.stringify(['stale-archived']));
      localStorage.setItem(ACTIVE_SESSION_ID_STORAGE_KEY, 'stale-open');

      // Use the snapshot-style probe to match app behavior.
      renderSnapshotProbe({
        sessions: [createSession({ id: 'real-open', title: 'Real conversation' })],
        tasks: null,
      });

      await flushAsyncWork();

      expect(latestHookResult?.tabs.map((session) => session.id)).toEqual(['real-open']);
      expect(latestHookResult?.pinnedSessions).toEqual([]);
      expect(latestHookResult?.archivedConversationIds).toEqual([]);
      expect(latestHookResult?.activeId).toBeNull();
      expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['real-open']);
      expect(localStorage.getItem(PINNED_SESSION_IDS_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(ARCHIVED_SESSION_IDS_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(ACTIVE_SESSION_ID_STORAGE_KEY)).toBeNull();
    });
  });

  it('uses the latest session snapshot as the source of truth for running state', () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-running']));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    renderProbeIntoRoot(root, {
      sessions: [createSession({ id: 'conv-running', isRunning: true })],
      tasks: null,
    });
    expect(latestHookResult?.tabs[0]?.isRunning).toBe(true);

    renderProbeIntoRoot(root, {
      sessions: [createSession({ id: 'conv-running', isRunning: false })],
      tasks: null,
    });
    expect(latestHookResult?.tabs[0]?.isRunning).toBe(false);
  });
});
