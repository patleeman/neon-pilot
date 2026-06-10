// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopAppEvent } from '../shared/types';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const subscribeDesktopAppEventsMock = vi.fn();
const apiRunsMock = vi.fn();
const apiExecutionsMock = vi.fn();
const apiTasksMock = vi.fn();
const apiDaemonMock = vi.fn();
const apiSessionMetaMock = vi.fn();
const fetchSessionsSnapshotMock = vi.fn();
let desktopListener: { onopen?: () => void; onevent?: (event: DesktopAppEvent) => void } | null = null;

vi.mock('../desktop/desktopRealtime', () => ({
  subscribeDesktopRealtimeAppEvents: subscribeDesktopAppEventsMock,
}));

vi.mock('../client/api', () => ({
  api: {
    runs: apiRunsMock,
    executions: apiExecutionsMock,
    tasks: apiTasksMock,
    daemon: apiDaemonMock,
    sessionMeta: apiSessionMetaMock,
  },
}));

vi.mock('../session/sessionSnapshot', () => ({
  fetchSessionsSnapshot: fetchSessionsSnapshotMock,
}));

vi.mock('../components/Layout', async () => {
  const { useAppEvents } = await import('./contexts');
  const { useAllSessions, useAllExecutions } = await import('../store');
  const AppDataOnlyProbe = React.memo(function AppDataOnlyProbe() {
    const sessions = useAllSessions();
    const globalWithProbe = globalThis as typeof globalThis & { __APP_DATA_ONLY_RENDER_COUNT__?: number };
    globalWithProbe.__APP_DATA_ONLY_RENDER_COUNT__ = (globalWithProbe.__APP_DATA_ONLY_RENDER_COUNT__ ?? 0) + 1;
    return <span>app data sessions {sessions.length}</span>;
  });

  return {
    Layout: () => {
      const sessions = useAllSessions();
      const executions = useAllExecutions();
      const { versions } = useAppEvents();
      const session = sessions.find((candidate) => candidate.id === 'conv-1');
      return (
        <main>
          <span>{session?.isRunning ? 'conversation running' : 'conversation idle'}</span>
          <span>executions version {versions.executions}</span>
          <span>runs version {versions.runs}</span>
          {(executions ?? []).map((execution) => (
            <span key={execution.id}>{execution.title}</span>
          ))}
          <AppDataOnlyProbe />
        </main>
      );
    },
  };
});

vi.mock('../navigation/lazyRouteRecovery', () => ({
  lazyRouteWithRecovery: () => () => null,
}));

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderApp() {
  window.history.pushState({}, '', '/conversations/conv-1');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const { App } = await import('./App');

  await act(async () => {
    root.render(<App />);
  });
  await act(async () => {
    vi.advanceTimersByTime(16_000);
    await Promise.resolve();
    await Promise.resolve();
  });

  await flushReact();
  return { container, root };
}

async function emitDesktopEvent(event: DesktopAppEvent) {
  await act(async () => {
    desktopListener?.onevent?.(event);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flushInvalidationRefresh() {
  await act(async () => {
    vi.advanceTimersByTime(150);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('App execution state integration', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    desktopListener = null;
    subscribeDesktopAppEventsMock.mockImplementation((listener) => {
      desktopListener = listener;
      listener.onopen?.();
      return () => {};
    });
    apiRunsMock.mockResolvedValue({
      scannedAt: 'now',
      runsRoot: '/runs',
      summary: { total: 0, recoveryActions: {}, statuses: {} },
      runs: [],
    });
    apiExecutionsMock.mockResolvedValue({ executions: [] });
    apiTasksMock.mockResolvedValue([]);
    apiDaemonMock.mockResolvedValue(null);
    apiSessionMetaMock.mockResolvedValue(null);
    fetchSessionsSnapshotMock.mockResolvedValue([
      { id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' },
    ]);
    delete (globalThis as typeof globalThis & { __APP_DATA_ONLY_RENDER_COUNT__?: number }).__APP_DATA_ONLY_RENDER_COUNT__;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
    vi.useRealTimers();
  });

  it('bootstraps executions and renders product execution state', async () => {
    apiExecutionsMock.mockResolvedValueOnce({
      executions: [
        {
          id: 'run-1',
          kind: 'background-command',
          visibility: 'primary',
          conversationId: 'conv-1',
          title: 'npm test',
          status: 'running',
          capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
        },
      ],
    });

    ({ container, root } = await renderApp());

    expect(apiExecutionsMock).toHaveBeenCalled();
    expect(container.textContent).toContain('npm test');
  });

  it('refreshes executions when an executions invalidation arrives', async () => {
    ({ container, root } = await renderApp());
    apiExecutionsMock.mockClear();
    apiExecutionsMock.mockResolvedValueOnce({
      executions: [
        {
          id: 'run-2',
          kind: 'subagent',
          visibility: 'primary',
          conversationId: 'conv-1',
          title: 'review diff',
          status: 'running',
          capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
        },
      ],
    });

    await emitDesktopEvent({ type: 'invalidate', topics: ['executions'] });
    await flushInvalidationRefresh();

    expect(apiExecutionsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('executions version 1');
    expect(container.textContent).toContain('review diff');
  });

  it('refreshes execution projections when a runs snapshot arrives', async () => {
    apiExecutionsMock.mockResolvedValueOnce({
      executions: [
        {
          id: 'run-1',
          kind: 'subagent',
          visibility: 'primary',
          conversationId: 'conv-1',
          title: 'stale active run',
          status: 'running',
          capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
        },
      ],
    });
    ({ container, root } = await renderApp());
    expect(container.textContent).toContain('stale active run');

    apiExecutionsMock.mockClear();
    apiExecutionsMock.mockResolvedValueOnce({ executions: [] });

    await emitDesktopEvent({
      type: 'runs',
      result: { scannedAt: 'later', runsRoot: '/runs', summary: { total: 0, recoveryActions: {}, statuses: {} }, runs: [] },
    });

    expect(apiExecutionsMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('executions version 1');
    expect(container.textContent).toContain('runs version 1');
    expect(container.textContent).not.toContain('stale active run');
  });

  it('updates conversation running state immediately from session meta change events', async () => {
    apiSessionMetaMock.mockResolvedValue({ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' });
    ({ container, root } = await renderApp());

    await emitDesktopEvent({
      type: 'sessions',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' }],
    });
    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: true });

    expect(apiSessionMetaMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('conversation running');

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiSessionMetaMock).toHaveBeenCalledWith('conv-1');
  });

  it('preserves running state when the running event arrives before the session row', async () => {
    fetchSessionsSnapshotMock.mockResolvedValueOnce([]);
    apiSessionMetaMock.mockResolvedValue({
      id: 'conv-1',
      title: 'Conversation',
      cwd: '/repo',
      timestamp: '2026-01-01T00:00:00.000Z',
      isRunning: false,
    });
    ({ container, root } = await renderApp());

    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: true });
    expect(container.textContent).toContain('conversation idle');

    await emitDesktopEvent({
      type: 'sessions',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z', isRunning: false }],
    });

    expect(container.textContent).toContain('conversation running');

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('conversation running');
  });

  it('keeps an active running event from being overwritten by a stale sessions snapshot while meta refresh is pending', async () => {
    ({ container, root } = await renderApp());

    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: true });
    expect(container.textContent).toContain('conversation running');

    await emitDesktopEvent({
      type: 'sessions_snapshot',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z', isRunning: false }],
    });

    expect(container.textContent).toContain('conversation running');
  });

  it('keeps running state across later stale snapshots until a stopped event arrives', async () => {
    apiSessionMetaMock.mockResolvedValue({
      id: 'conv-1',
      title: 'Conversation',
      cwd: '/repo',
      timestamp: '2026-01-01T00:00:00.000Z',
      isRunning: false,
    });
    ({ container, root } = await renderApp());

    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: true });
    expect(container.textContent).toContain('conversation running');

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
      await Promise.resolve();
    });

    await emitDesktopEvent({
      type: 'sessions_snapshot',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z', isRunning: false }],
    });

    expect(container.textContent).toContain('conversation running');

    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: false });
    expect(container.textContent).toContain('conversation idle');
  });

  it('coalesces repeated session meta change refreshes for the same conversation', async () => {
    apiSessionMetaMock.mockResolvedValue({ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' });
    ({ root } = await renderApp());

    await emitDesktopEvent({
      type: 'sessions',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' }],
    });
    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: true });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: false });
    await act(async () => {
      vi.advanceTimersByTime(749);
      await Promise.resolve();
    });

    expect(apiSessionMetaMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiSessionMetaMock).toHaveBeenCalledTimes(1);
    expect(apiSessionMetaMock).toHaveBeenCalledWith('conv-1');
  });

  it('handles sessions_snapshot events the same as sessions events', async () => {
    ({ container, root } = await renderApp());

    await emitDesktopEvent({
      type: 'sessions_snapshot',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' }],
    });

    expect(container.textContent).toContain('app data sessions 1');
  });

  it('handles session_meta_changed running:false and clears the running indicator', async () => {
    apiSessionMetaMock.mockResolvedValue({ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' });
    ({ container, root } = await renderApp());

    // Set running: true via sessions_snapshot
    await emitDesktopEvent({
      type: 'sessions_snapshot',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z' }],
    });
    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: true });
    expect(container.textContent).toContain('conversation running');

    // Clear via session_meta_changed with running: false
    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: false });
    expect(container.textContent).toContain('conversation idle');
  });

  it('does not let stale meta refresh undo a stopped running event', async () => {
    apiSessionMetaMock.mockResolvedValue({
      id: 'conv-1',
      title: 'Conversation',
      cwd: '/repo',
      timestamp: '2026-01-01T00:00:00.000Z',
      isRunning: true,
    });
    ({ container, root } = await renderApp());

    await emitDesktopEvent({
      type: 'sessions_snapshot',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z', isRunning: true }],
    });
    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-1', running: false });
    expect(container.textContent).toContain('conversation idle');

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiSessionMetaMock).toHaveBeenCalledWith('conv-1');
    expect(container.textContent).toContain('conversation idle');

    await emitDesktopEvent({
      type: 'sessions_snapshot',
      sessions: [{ id: 'conv-1', title: 'Conversation', cwd: '/repo', timestamp: '2026-01-01T00:00:00.000Z', isRunning: true }],
    });

    expect(container.textContent).toContain('conversation idle');
  });

  it('does not wake AppData consumers for unrelated app event versions', async () => {
    ({ root } = await renderApp());
    const globalWithProbe = globalThis as typeof globalThis & { __APP_DATA_ONLY_RENDER_COUNT__?: number };
    const renderCount = globalWithProbe.__APP_DATA_ONLY_RENDER_COUNT__;

    await emitDesktopEvent({ type: 'invalidate', topics: ['workspace'] });

    expect(globalWithProbe.__APP_DATA_ONLY_RENDER_COUNT__).toBe(renderCount);
  });
});
