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
import { resetLocalWriteGrace } from '../session/sessionTabs.js';
import type { ScheduledTaskSummary, SessionMeta } from '../shared/types.js';
import { useConversations } from './useConversations.js';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const apiMocks = vi.hoisted(() => ({
  openConversationTabs: vi.fn(),
  sessionMeta: vi.fn(),
  setOpenConversationTabs: vi.fn(),
}));

vi.mock('../client/api', () => ({
  api: apiMocks,
}));

const mountedRoots: Root[] = [];
let latestHookResult: ReturnType<typeof useConversations> | null = null;

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
    setSessionsState((previous) => mergeSessions(previous, items));
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
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<StatefulHookProbeProviders input={input} />);
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

  it('loads row metadata for locally open ids before the full sessions snapshot arrives', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['open-one']));

    renderStatefulProbe({
      sessions: null,
      tasks: null,
    });

    await flushAsyncWork();

    expect(apiMocks.sessionMeta).toHaveBeenCalledWith('open-one');
    expect(latestHookResult?.tabs.map((session) => session.title)).toEqual(['Loaded open-one']);
    expect(JSON.parse(localStorage.getItem(OPEN_SESSION_IDS_STORAGE_KEY) ?? '[]')).toEqual(['open-one']);
  });

  it('does not let stale remote layout sync close locally visible live conversation tabs', async () => {
    localStorage.setItem(OPEN_SESSION_IDS_STORAGE_KEY, JSON.stringify(['conv-live']));
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
