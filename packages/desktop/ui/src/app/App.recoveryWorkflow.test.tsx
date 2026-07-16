// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Outlet } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopAppEvent, SessionMeta } from '../shared/types';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const subscribeDesktopAppEventsMock = vi.fn();
const apiMock = vi.hoisted(() => ({
  runs: vi.fn(),
  executions: vi.fn(),
  tasks: vi.fn(),
  daemon: vi.fn(),
  sessionMeta: vi.fn(),
  readConversationWorkspace: vi.fn(),
  sidebarConversations: vi.fn(),
  saveConversationWorkspaceLayout: vi.fn(),
  updateConversationWorkspace: vi.fn(),
  setSavedWorkspacePaths: vi.fn(),
  gateways: vi.fn(),
  markConversationAttentionRead: vi.fn(),
  extensionKeybindings: vi.fn(),
  extensionCommands: vi.fn(),
}));
const fetchSessionsSnapshotMock = vi.fn();
let desktopListener: {
  onopen?: () => void;
  onevent?: (event: DesktopAppEvent) => void;
  onerror?: () => void;
  onclose?: () => void;
} | null = null;

vi.mock('../desktop/desktopRealtime', () => ({
  subscribeDesktopRealtimeAppEvents: subscribeDesktopAppEventsMock,
}));

vi.mock('../client/api', () => ({
  api: apiMock,
}));

vi.mock('../session/sessionSnapshot', () => ({
  fetchSessionsSnapshot: fetchSessionsSnapshotMock,
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  ExtensionRegistryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useExtensionRegistry: () => ({
    extensions: [],
    routes: [],
    surfaces: [],
    topBarElements: [],
    messageActions: [],
    composerShelves: [],
    draftConversationCreate: [],
    newConversationPanels: [],
    settingsComponent: null,
    settingsComponents: [],
    composerControls: [],
    composerInputTools: [],
    toolbarActions: [],
    contextMenus: [],
    selectionActions: [],
    threadHeaderActions: [],
    statusBarItems: [],
    conversationHeaderElements: [],
    conversationDecorators: [],
    activityTreeItemElements: [],
    activityTreeItemStyles: [],
    conversationLifecycle: [],
    composerAttachmentProviders: [],
    composerAttachmentRenderers: [],
    composerAttachmentResolvers: [],
    activityTreeItemActions: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('../components/Layout', async () => {
  const { Sidebar } = await import('../components/Sidebar');
  const { useSseConnection } = await import('./contexts');

  function RecoveryLayout() {
    const { status } = useSseConnection();
    return (
      <div>
        <div role="status">{`Connection ${status}`}</div>
        <Sidebar />
        <main>
          <Outlet />
        </main>
      </div>
    );
  }

  return { Layout: RecoveryLayout };
});

vi.mock('../extensions/ExtensionRouteHost', async () => {
  const { ConversationPage } = await import('../pages/ConversationPage');
  return { ExtensionRouteHost: () => <ConversationPage /> };
});

vi.mock('../pages/ConversationPage', () => ({
  ConversationPage: () => <section>Conversation route conv-recovery</section>,
}));

function session(overrides: Partial<SessionMeta> & Pick<SessionMeta, 'id' | 'title'>): SessionMeta {
  return {
    file: `/tmp/${overrides.id}.jsonl`,
    timestamp: '2026-06-15T12:00:00.000Z',
    cwd: '/repo',
    cwdSlug: 'repo',
    model: 'openai/gpt-5.4',
    messageCount: 1,
    isRunning: false,
    ...overrides,
  };
}

const recoverySession = session({ id: 'conv-recovery', title: 'Recovered visible thread' });

async function flushApp() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function emitDesktopEvent(event: DesktopAppEvent) {
  await act(async () => {
    desktopListener?.onevent?.(event);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderAppAt(pathname: string) {
  window.history.pushState({}, '', pathname);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const { App } = await import('./App');

  await act(async () => {
    root.render(<App />);
  });
  await flushApp();

  return { container, root };
}

describe('App recovery workflow', () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    desktopListener = null;
    subscribeDesktopAppEventsMock.mockImplementation((listener) => {
      desktopListener = listener;
      listener.onopen?.();
      return () => {};
    });
    apiMock.runs.mockResolvedValue({
      scannedAt: 'now',
      runsRoot: '/runs',
      summary: { total: 0, recoveryActions: {}, statuses: {} },
      runs: [],
    });
    apiMock.executions.mockResolvedValue({ executions: [] });
    apiMock.tasks.mockResolvedValue([]);
    apiMock.daemon.mockResolvedValue(null);
    apiMock.sessionMeta.mockResolvedValue(recoverySession);
    apiMock.readConversationWorkspace.mockResolvedValue({
      sessionIds: ['conv-recovery'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'conv-recovery',
      workspacePaths: [],
    });
    apiMock.sidebarConversations.mockImplementation(async () => ({
      ...(await apiMock.readConversationWorkspace()),
      sessions: [recoverySession],
    }));
    apiMock.saveConversationWorkspaceLayout.mockResolvedValue({ ok: true });
    apiMock.updateConversationWorkspace.mockResolvedValue({ ok: true });
    apiMock.setSavedWorkspacePaths.mockResolvedValue([]);
    apiMock.gateways.mockResolvedValue({ providers: [], connections: [], bindings: [], events: [], chatTargets: [] });
    apiMock.markConversationAttentionRead.mockResolvedValue({ ok: true });
    apiMock.extensionKeybindings.mockResolvedValue([]);
    apiMock.extensionCommands.mockResolvedValue([]);
    fetchSessionsSnapshotMock.mockResolvedValue([recoverySession]);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('keeps the active route and sidebar row visible while reconnecting after a failed sessions refresh', async () => {
    ({ root } = await renderAppAt('/conversations/conv-recovery'));

    await screen.findByText('Conversation route conv-recovery');
    expect(screen.getByText('Recovered visible thread')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Connection open');

    act(() => {
      desktopListener?.onerror?.();
    });

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Connection reconnecting');
    });

    const sidebarRefreshesBeforeFailure = apiMock.sidebarConversations.mock.calls.length;
    apiMock.sidebarConversations.mockRejectedValueOnce(new Error('temporary sidebar projection outage'));
    fetchSessionsSnapshotMock.mockRejectedValueOnce(new Error('temporary session catalog outage'));
    await emitDesktopEvent({ type: 'invalidate', topics: ['sessions'] });
    await waitFor(() => expect(apiMock.sidebarConversations.mock.calls.length).toBeGreaterThan(sidebarRefreshesBeforeFailure));
    expect(fetchSessionsSnapshotMock).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Conversation route conv-recovery')).toBeTruthy();
    expect(screen.getByText('Recovered visible thread')).toBeTruthy();
    expect(document.querySelector('[data-sidebar-session-id="conv-recovery"]')?.className).toContain('ui-sidebar-session-row-active');
    expect(window.location.pathname).toBe('/conversations/conv-recovery');
  });
});
