// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useParams } from 'react-router-dom';
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
  openConversationTabs: vi.fn(),
  setOpenConversationTabs: vi.fn(),
  setSavedWorkspacePaths: vi.fn(),
  gateways: vi.fn(),
  markConversationAttentionRead: vi.fn(),
  prewarmLiveSession: vi.fn(),
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
    composerButtons: [],
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

vi.mock('../pages/ConversationPage', () => ({
  ConversationPage: ({ draft }: { draft?: boolean }) => {
    const { id } = useParams();
    return <main>{draft ? 'Draft conversation route' : `Conversation route ${id ?? 'missing'}`}</main>;
  },
}));

vi.mock('../extensions/ExtensionRouteHost', () => ({
  ExtensionRouteHost: () => <main>Extension route</main>,
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

const sessions = [
  session({ id: 'conv-first', title: 'First persisted thread' }),
  session({ id: 'conv-second', title: 'Second persisted thread' }),
];

async function flushApp() {
  await act(async () => {
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

function activeSidebarRow(id: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[data-sidebar-session-id="${id}"]`);
  if (!row) {
    throw new Error(`Missing sidebar row ${id}`);
  }
  return row;
}

async function findSidebarRow(id: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(document.querySelector(`[data-sidebar-session-id="${id}"]`)).not.toBeNull();
  });
  return activeSidebarRow(id);
}

async function expectActiveSidebarRow(id: string): Promise<void> {
  await waitFor(() => {
    const row = activeSidebarRow(id);
    expect(row.className).toContain('ui-sidebar-session-row-active');
  });
}

async function findSidebarConversationRowControl(id: string): Promise<HTMLElement> {
  const row = await findSidebarRow(id);
  if (row instanceof HTMLAnchorElement || row instanceof HTMLButtonElement) {
    return row;
  }
  const link = row.querySelector<HTMLAnchorElement>(`a[href="/conversations/${id}"]`);
  if (link) return link;
  const button = row.querySelector<HTMLButtonElement>('button[role="treeitem"], button');
  if (button) return button;
  throw new Error(`Missing sidebar row control ${id}: ${row.outerHTML}`);
}

describe('App sidebar conversation navigation workflow', () => {
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
    apiMock.sessionMeta.mockImplementation(async (id: string) => sessions.find((candidate) => candidate.id === id) ?? null);
    apiMock.openConversationTabs.mockResolvedValue({
      sessionIds: ['conv-first', 'conv-second'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'conv-first',
      workspacePaths: [],
    });
    apiMock.setOpenConversationTabs.mockResolvedValue({ ok: true });
    apiMock.setSavedWorkspacePaths.mockResolvedValue([]);
    apiMock.gateways.mockResolvedValue({ providers: [], connections: [], bindings: [], events: [], chatTargets: [] });
    apiMock.markConversationAttentionRead.mockResolvedValue({ ok: true });
    apiMock.prewarmLiveSession.mockResolvedValue({ ok: true });
    apiMock.extensionKeybindings.mockResolvedValue([]);
    apiMock.extensionCommands.mockResolvedValue([]);
    fetchSessionsSnapshotMock.mockResolvedValue(sessions);
    Object.defineProperty(window, 'neonPilotDesktop', {
      value: {
        getNavigationState: vi.fn().mockResolvedValue({ canGoBack: false, canGoForward: false }),
      },
      configurable: true,
    });
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

  it('opens an existing conversation from the sidebar and hydrates that route after reload', async () => {
    ({ root } = await renderAppAt('/conversations/conv-first'));

    await screen.findByText('Conversation route conv-first');
    await expectActiveSidebarRow('conv-first');

    const secondThreadLink = await findSidebarConversationRowControl('conv-second');
    await act(async () => {
      fireEvent.click(secondThreadLink);
      await Promise.resolve();
    });

    await screen.findByText('Conversation route conv-second');
    expect(window.location.pathname).toBe('/conversations/conv-second');
    await expectActiveSidebarRow('conv-second');

    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = '';

    ({ root } = await renderAppAt('/conversations/conv-second'));

    await screen.findByText('Conversation route conv-second');
    await expectActiveSidebarRow('conv-second');
    expect(screen.getByText('Second persisted thread')).toBeTruthy();
  });
});
