// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Outlet, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesktopAppEvent, SessionMeta } from '../shared/types';
import { useLiveTitles } from './contexts';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const subscribeDesktopAppEventsMock = vi.fn();
const apiMock = vi.hoisted(() => ({
  runs: vi.fn(),
  executions: vi.fn(),
  tasks: vi.fn(),
  daemon: vi.fn(),
  sessionMeta: vi.fn(),
  openConversationTabs: vi.fn(),
  sidebarConversations: vi.fn(),
  setOpenConversationTabs: vi.fn(),
  updateConversationWorkspace: vi.fn(),
  setSavedWorkspacePaths: vi.fn(),
  gateways: vi.fn(),
  markConversationAttentionRead: vi.fn(),
  extensionKeybindings: vi.fn(),
  extensionCommands: vi.fn(),
}));
const fetchSessionsSnapshotMock = vi.fn();
let desktopListener: { onopen?: () => void; onevent?: (event: DesktopAppEvent) => void } | null = null;

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
  return {
    Layout: () => (
      <div>
        <Sidebar />
        <main>
          <Outlet />
        </main>
      </div>
    ),
  };
});

vi.mock('../extensions/ExtensionRouteHost', () => ({
  ExtensionRouteHost: () => <main>Extension route</main>,
}));

vi.mock('../pages/ConversationPage', () => ({
  ConversationPage: () => {
    const { id } = useParams();
    const { setTitle } = useLiveTitles();

    useEffect(() => {
      if (id === 'conv-live') {
        setTitle(id, 'Live generated title');
      }
    }, [id, setTitle]);

    return (
      <section>
        <h1>{id === 'conv-live' ? 'Live generated title' : 'Conversation route'}</h1>
        <p>Pending prompt: Draft question waiting for live session</p>
        <section aria-label="Queued prompts">
          <h2>Queued</h2>
          <p>Queued follow-up after current turn</p>
        </section>
      </section>
    );
  },
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

const liveSession = session({ id: 'conv-live', title: 'Initial sidebar title' });

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

describe('App chat primary live workflow', () => {
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
    apiMock.sessionMeta.mockResolvedValue(liveSession);
    apiMock.openConversationTabs.mockResolvedValue({
      sessionIds: ['conv-live'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'conv-live',
      workspacePaths: [],
    });
    apiMock.sidebarConversations.mockImplementation(async () => ({
      ...(await apiMock.openConversationTabs()),
      sessions: [liveSession],
    }));
    apiMock.setOpenConversationTabs.mockResolvedValue({ ok: true });
    apiMock.updateConversationWorkspace.mockResolvedValue({ ok: true });
    apiMock.setSavedWorkspacePaths.mockResolvedValue([]);
    apiMock.gateways.mockResolvedValue({ providers: [], connections: [], bindings: [], events: [], chatTargets: [] });
    apiMock.markConversationAttentionRead.mockResolvedValue({ ok: true });
    apiMock.extensionKeybindings.mockResolvedValue([]);
    apiMock.extensionCommands.mockResolvedValue([]);
    fetchSessionsSnapshotMock.mockResolvedValue([liveSession]);
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

  it('keeps live title, running state, pending prompt, and queued prompt visible on the active conversation route', async () => {
    ({ root } = await renderAppAt('/conversations/conv-live'));

    await screen.findByRole('heading', { name: 'Live generated title' });
    await waitFor(() => {
      expect(screen.getAllByText('Live generated title').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByText('Pending prompt: Draft question waiting for live session')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Queued' })).toBeTruthy();
    expect(screen.getByText('Queued follow-up after current turn')).toBeTruthy();

    apiMock.executions.mockResolvedValueOnce({
      executions: [
        {
          id: 'queued-run',
          kind: 'background-command',
          visibility: 'primary',
          conversationId: 'conv-live',
          title: 'queued follow-up',
          status: 'queued',
          capabilities: { canCancel: false, canRerun: false, canFollowUp: false, hasLog: false, hasResult: false },
        },
      ],
    });
    await emitDesktopEvent({ type: 'invalidate', topics: ['executions'] });

    await waitFor(() => {
      expect(screen.getByLabelText('Background work running')).toBeTruthy();
    });

    await emitDesktopEvent({ type: 'session_meta_changed', sessionId: 'conv-live', running: true });

    await waitFor(() => {
      expect(screen.getByLabelText('Running conversation')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Background work running')).toBeNull();
    expect(window.location.pathname).toBe('/conversations/conv-live');
  });
});
