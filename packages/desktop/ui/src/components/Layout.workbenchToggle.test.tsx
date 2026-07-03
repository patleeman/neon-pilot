// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { Link, MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { evaluateCommandEnablement, setExtensionCommandContext } from '../extensions/commands';
import { readExtensionSelection, setExtensionSelection } from '../extensions/selection';
import { SIDEBAR_WIDTH_STORAGE_KEY } from '../local/localSettings';
import { sessionStore } from '../store';
import { APP_LAYOUT_MODE_SESSION_STORAGE_KEY, APP_LAYOUT_MODE_STORAGE_KEY } from '../ui-state/appLayoutMode';
import { closeWorkbenchTabState, Layout } from './Layout';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const extensionRegistryMock = vi.hoisted(() => ({
  state: {
    extensions: [] as unknown[],
    routes: [],
    surfaces: [] as unknown[],
    topBarElements: [],
    messageActions: [],
    composerShelves: [],
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
  },
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => extensionRegistryMock.state,
}));

vi.mock('../extensions/NativeExtensionSurfaceHost', () => ({
  NativeExtensionSurfaceHost: ({
    surface,
    pathname,
    search,
    hash,
    instanceId,
  }: {
    surface: { id: string; title?: string };
    pathname?: string;
    search?: string;
    hash?: string;
    instanceId?: string | null;
  }) => (
    <div
      data-testid="native-extension-surface"
      data-surface-id={surface.id}
      data-pathname={pathname}
      data-search={search}
      data-hash={hash}
      data-instance-id={instanceId ?? ''}
    >
      {surface.title ?? surface.id}
    </div>
  ),
}));

vi.mock('./chat/ChatRail', async () => {
  const { createElement } = await import('react');
  return {
    ChatRail: ({ conversationId }: { conversationId?: string | null }) =>
      createElement('div', { 'data-chat-rail': '1' }, `Chat rail ${conversationId ?? ''}`),
  };
});

function installLocalStorageShim() {
  const items = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => items.clear(),
      getItem: (key: string) => items.get(key) ?? null,
      key: (index: number) => Array.from(items.keys())[index] ?? null,
      removeItem: (key: string) => items.delete(key),
      setItem: (key: string, value: string) => items.set(key, String(value)),
      get length() {
        return items.size;
      },
    },
  });
}

class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function ConversationRouteFixture() {
  const { id } = useParams();
  const location = useLocation();
  return (
    <div>
      <div>Conversation saved</div>
      <div>{`Conversation route ${id ?? 'missing'}`}</div>
      <div data-testid="route-search">{location.search}</div>
      <Link to="/conversations/conv-2">Open second conversation</Link>
    </div>
  );
}

function RouteRailFixture({ name, next, detail }: { name: string; next: string; detail?: string }) {
  return (
    <div>
      <div>{`${name} route`}</div>
      <Link to={next}>{`Open ${next}`}</Link>
      {detail ? <Link to={detail}>{`Open ${detail}`}</Link> : null}
    </div>
  );
}

function setWorkbenchModeForCurrentSession() {
  window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');
  window.sessionStorage.setItem(APP_LAYOUT_MODE_SESSION_STORAGE_KEY, 'workbench');
}

function seedConversationCwd(cwd: string, id = 'conv-1') {
  sessionStore.upsert({
    id,
    file: `/tmp/${id}.jsonl`,
    timestamp: new Date().toISOString(),
    cwd,
    cwdSlug: cwd.split('/').filter(Boolean).at(-1) ?? 'workspace',
    model: 'deepseek-v4-flash',
    title: 'Workspace conversation',
    messageCount: 0,
  });
}

function renderLayout(pathname = '/conversations/new') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="conversations/new" element={<div>Conversation draft</div>} />
          <Route path="conversations/:id" element={<ConversationRouteFixture />} />
          <Route path="automations" element={<div>Automations route</div>} />
          <Route path="route-a" element={<RouteRailFixture name="Route A" next="/route-b" detail="/route-a/detail" />} />
          <Route path="route-a/detail" element={<RouteRailFixture name="Route A detail" next="/route-b" />} />
          <Route path="route-b" element={<RouteRailFixture name="Route B" next="/route-a" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderEmbeddedWindowLayout(pathname = '/conversations/new') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="/" element={<Layout embeddedWindowChrome forceWorkbench />}>
          <Route path="conversations/new" element={<div>Conversation draft</div>} />
          <Route path="conversations/:id" element={<ConversationRouteFixture />} />
          <Route path="route-a" element={<RouteRailFixture name="Route A" next="/route-b" detail="/route-a/detail" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout workbench toggle', () => {
  beforeEach(() => {
    installLocalStorageShim();
    window.localStorage.clear();
    window.sessionStorage.clear();
    setViewportWidth(1600);
    document.documentElement.dataset.neonPilotDesktop = '1';
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverShim,
    });
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverShim,
    });
    vi.spyOn(api, 'extensionKeybindings').mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof api.extensionKeybindings>>>(() => {}),
    );
    vi.spyOn(api, 'extensionCommands').mockImplementation(() => new Promise<Awaited<ReturnType<typeof api.extensionCommands>>>(() => {}));
    vi.spyOn(api, 'models').mockResolvedValue({ models: [], perf: {} });
    vi.spyOn(api, 'conversationModelPreferences').mockResolvedValue({
      currentModel: null,
      currentThinkingLevel: null,
      currentServiceTier: null,
    });
    extensionRegistryMock.state.extensions = [];
    extensionRegistryMock.state.surfaces = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setExtensionCommandContext('conversation.isStreaming', null);
    setExtensionCommandContext('system-local-dictation.toggleAvailable', null);
    setExtensionCommandContext('workbench.hasActiveFile', null);
    setExtensionCommandContext('workbench.canToggleDiff', null);
    setExtensionCommandContext('browser.active', null);
    setExtensionSelection(null);
    delete document.documentElement.dataset.neonPilotDesktop;
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    window.localStorage.clear();
    window.sessionStorage.clear();
    sessionStore.reset?.();
  });

  it('does not render a compact workbench panel when the workbench is hidden', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');

    renderLayout();

    expect(screen.getByText('Conversation draft')).toBeTruthy();
    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect((screen.getByRole('button', { name: 'Show workbench' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('omits conversation sidebars when embedded in a chat window', async () => {
    seedConversationCwd('/repo/project', 'conv-1');
    sessionStore.upsert({
      id: 'conv-2',
      file: '/tmp/conv-2.jsonl',
      timestamp: '2026-07-02T12:00:00.000Z',
      cwd: '/repo/project',
      cwdSlug: 'project',
      model: 'deepseek-v4-flash',
      title: 'Second thread',
      messageCount: 3,
    });

    renderEmbeddedWindowLayout('/conversations/conv-1');

    expect(await screen.findByText('Conversation route conv-1')).toBeTruthy();
    expect(screen.queryByText('Threads')).toBeNull();
    expect(screen.queryByText('Second thread')).toBeNull();
    expect(document.querySelector('[data-windowed-chat-thread-rail="true"]')).toBeNull();
    expect(document.querySelector('.ui-sidebar-nav-item')).toBeNull();
    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
  });

  it('hides the right-sidebar toggle on routes without a declared right sidebar', () => {
    renderLayout('/automations');

    expect(screen.getByText('Automations route')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show workbench' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show right sidebar' })).toBeNull();
  });

  it('suppresses route-owned right sidebars inside embedded desktop windows', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: true,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [{ id: 'route-a', label: 'Route A', route: '/route-a', rightSidebarView: 'route-a-context' }],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'route-shell-fixture',
        id: 'route-a-context',
        title: 'Route A Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteAContext',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    renderEmbeddedWindowLayout('/route-a');

    expect(screen.getByText('Route A route')).toBeTruthy();
    expect(screen.queryByTestId('native-extension-surface')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show right sidebar' })).toBeNull();
    expect(evaluateCommandEnablement('layout.canToggleRightSidebar')).toBe(false);
  });

  it('hides the right-sidebar toggle when the declared route rail is missing', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: true,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [{ id: 'route-a', label: 'Route A', route: '/route-a', rightSidebarView: 'missing-context' }],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [];

    renderLayout('/route-a');

    expect(screen.getByText('Route A route')).toBeTruthy();
    expect(screen.queryByTestId('native-extension-surface')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show right sidebar' })).toBeNull();
    expect(evaluateCommandEnablement('layout.canToggleRightSidebar')).toBe(false);
  });

  it('ignores side-region declarations from disabled extensions', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: false,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [{ id: 'route-a', label: 'Route A', route: '/route-a', rightSidebarView: 'route-a-context' }],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'route-shell-fixture',
        id: 'route-a-context',
        title: 'Route A Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteAContext',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    renderLayout('/route-a');

    expect(screen.getByText('Route A route')).toBeTruthy();
    expect(screen.queryByTestId('native-extension-surface')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show right sidebar' })).toBeNull();
    expect(evaluateCommandEnablement('layout.canToggleRightSidebar')).toBe(false);
  });

  it('does not expose route-owned primary right rails as workbench tools', () => {
    setWorkbenchModeForCurrentSession();
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'route-shell-fixture',
        id: 'route-context',
        title: 'Route Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteContext',
        frontend: { entry: 'dist/frontend.js' },
      },
      {
        extensionId: 'route-shell-fixture',
        id: 'workbench-tool',
        title: 'Workbench Tool',
        location: 'rightRail',
        scope: 'conversation',
        placement: 'workbench-tool',
        component: 'WorkbenchTool',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    renderLayout('/conversations/conv-1');

    expect(screen.getByText('Open a tab')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Route Context' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Workbench Tool' })).toBeTruthy();
  });

  it('remembers route-owned right sidebar open state per route', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: true,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [
            { id: 'route-a', label: 'Route A', route: '/route-a', rightSidebarView: 'route-a-context' },
            { id: 'route-b', label: 'Route B', route: '/route-b', rightSidebarView: 'route-b-context' },
          ],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'route-shell-fixture',
        id: 'route-a-context',
        title: 'Route A Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteAContext',
        frontend: { entry: 'dist/frontend.js' },
      },
      {
        extensionId: 'route-shell-fixture',
        id: 'route-b-context',
        title: 'Route B Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteBContext',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    renderLayout('/route-a');

    const routeARail = screen.getByTestId('native-extension-surface');
    expect(screen.getByText('Route A route')).toBeTruthy();
    expect(routeARail.getAttribute('data-surface-id')).toBe('route-a-context');
    expect(routeARail.getAttribute('data-instance-id')).toBe('right-sidebar');
    expect(evaluateCommandEnablement('layout.canToggleRightSidebar')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Hide right sidebar' }));

    expect(screen.queryByTestId('native-extension-surface')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show right sidebar' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Open /route-b' }));

    expect(screen.getByText('Route B route')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide right sidebar' })).toBeTruthy();
    expect(screen.getByTestId('native-extension-surface').getAttribute('data-surface-id')).toBe('route-b-context');

    fireEvent.click(screen.getByRole('link', { name: 'Open /route-a' }));

    expect(screen.getByText('Route A route')).toBeTruthy();
    expect(screen.queryByTestId('native-extension-surface')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show right sidebar' })).toBeTruthy();
  });

  it('keys route-owned right sidebar open state by the matched route declaration', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: true,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [{ id: 'route-a', label: 'Route A', route: '/route-a', rightSidebarView: 'route-a-context' }],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'route-shell-fixture',
        id: 'route-a-context',
        title: 'Route A Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteAContext',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];

    renderLayout('/route-a?mode=inspect#rail');

    const routeRail = screen.getByTestId('native-extension-surface');
    expect(routeRail.getAttribute('data-surface-id')).toBe('route-a-context');
    expect(routeRail.getAttribute('data-pathname')).toBe('/route-a');
    expect(routeRail.getAttribute('data-search')).toBe('?mode=inspect');
    expect(routeRail.getAttribute('data-hash')).toBe('#rail');
    expect(routeRail.getAttribute('data-instance-id')).toBe('right-sidebar');

    fireEvent.click(screen.getByRole('button', { name: 'Hide right sidebar' }));
    fireEvent.click(screen.getByRole('link', { name: 'Open /route-a/detail' }));

    expect(screen.getByText('Route A detail route')).toBeTruthy();
    expect(screen.queryByTestId('native-extension-surface')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show right sidebar' })).toBeTruthy();
  });

  it('migrates route-owned right sidebar open state from the legacy right-rail storage key', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: true,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [{ id: 'route-a', label: 'Route A', route: '/route-a', rightSidebarView: 'route-a-context' }],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'route-shell-fixture',
        id: 'route-a-context',
        title: 'Route A Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteAContext',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];
    window.localStorage.setItem('pa:right-rail-open:%2Froute-a', 'closed');

    renderLayout('/route-a');

    expect(screen.getByText('Route A route')).toBeTruthy();
    expect(screen.queryByTestId('native-extension-surface')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show right sidebar' }));

    expect(screen.getByTestId('native-extension-surface').getAttribute('data-surface-id')).toBe('route-a-context');
    expect(window.localStorage.getItem('pa:right-sidebar-open:%2Froute-a')).toBe('open');
  });

  it('clears route resource selection when the active route shell changes', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: true,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [
            { id: 'route-a', label: 'Route A', route: '/route-a', rightSidebarView: 'route-a-context' },
            { id: 'route-b', label: 'Route B', route: '/route-b', rightSidebarView: 'route-b-context' },
          ],
        },
      },
    ];
    extensionRegistryMock.state.surfaces = [
      {
        extensionId: 'route-shell-fixture',
        id: 'route-a-context',
        title: 'Route A Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteAContext',
        frontend: { entry: 'dist/frontend.js' },
      },
      {
        extensionId: 'route-shell-fixture',
        id: 'route-b-context',
        title: 'Route B Context',
        location: 'rightRail',
        scope: 'global',
        placement: 'primary',
        component: 'RouteBContext',
        frontend: { entry: 'dist/frontend.js' },
      },
    ];
    setExtensionSelection({
      kind: 'resource',
      resource: { type: 'skill', id: 'skill:demo', label: 'Demo Skill', source: 'system-skills' },
    });

    renderLayout('/route-a');
    expect(readExtensionSelection()?.kind).toBe('resource');

    fireEvent.click(screen.getByRole('link', { name: 'Open /route-b' }));

    expect(screen.getByText('Route B route')).toBeTruthy();
    expect(readExtensionSelection()).toBeNull();
  });

  it('preserves text selection when the active route shell changes', () => {
    extensionRegistryMock.state.extensions = [
      {
        id: 'route-shell-fixture',
        name: 'Route Shell Fixture',
        enabled: true,
        packageRoot: '/tmp/route-shell-fixture',
        packageType: 'system',
        schemaVersion: 2,
        contributes: {
          nav: [
            { id: 'route-a', label: 'Route A', route: '/route-a' },
            { id: 'route-b', label: 'Route B', route: '/route-b' },
          ],
        },
      },
    ];
    setExtensionSelection({ kind: 'text', text: 'selected transcript text' });

    renderLayout('/route-a');
    fireEvent.click(screen.getByRole('link', { name: 'Open /route-b' }));

    expect(screen.getByText('Route B route')).toBeTruthy();
    expect(readExtensionSelection()).toEqual({
      kind: 'text',
      text: 'selected transcript text',
      updatedAt: expect.any(String),
    });
  });

  it('starts with the workbench closed even when the previous app session left it open', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'workbench');

    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show workbench' })).toBeTruthy();
  });

  it('uses the desktop right-rail shortcut to toggle the workbench on conversation routes', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect(evaluateCommandEnablement('layout.canToggleRightSidebar')).toBe(true);

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { action: 'toggle-right-rail' } }));
    });

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Hide workbench' }) as HTMLButtonElement).disabled).toBe(false);

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { action: 'toggle-right-rail' } }));
    });

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    expect((screen.getByRole('button', { name: 'Show workbench' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('persists workbench mode after toggling app chrome and restores it on rerender', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');
    const view = renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show workbench' }));

    expect(window.localStorage.getItem(APP_LAYOUT_MODE_STORAGE_KEY)).toBe('workbench');
    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();

    view.unmount();
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Hide workbench' })).toBeTruthy();
  });

  it('restores saved sidebar and workbench document widths on conversation workbench routes', () => {
    setWorkbenchModeForCurrentSession();
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '280');
    window.localStorage.setItem('pa:workbench-document-width', '640');

    renderLayout('/conversations/conv-1');

    const sidebarPane = screen.getByLabelText('Loading sidebar').closest<HTMLElement>('[style*="width"]');
    const workbenchPane = document.querySelector<HTMLElement>('[data-workbench-document-pane="true"]');

    expect(sidebarPane?.style.width).toBe('280px');
    expect(workbenchPane?.style.width).toBe('640px');
  });

  it('persists dragged sidebar and workbench widths across conversation route transitions', () => {
    setWorkbenchModeForCurrentSession();

    renderLayout('/conversations/conv-1');

    expect(screen.getByText('Conversation route conv-1')).toBeTruthy();
    let resizeHandles = [...document.querySelectorAll<HTMLElement>('.cursor-col-resize')];
    expect(resizeHandles.length).toBeGreaterThanOrEqual(2);

    act(() => {
      fireEvent.mouseDown(resizeHandles[0], { clientX: 224 });
      fireEvent.mouseMove(document, { clientX: 300 });
      fireEvent.mouseUp(document);
    });

    act(() => {
      fireEvent.mouseDown(resizeHandles[1], { clientX: 1000 });
      fireEvent.mouseMove(document, { clientX: 900 });
      fireEvent.mouseUp(document);
    });

    expect(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('300');
    expect(window.localStorage.getItem('pa:workbench-document-width')).toBe('620');

    fireEvent.click(screen.getByRole('link', { name: 'Open second conversation' }));

    expect(screen.getByText('Conversation route conv-2')).toBeTruthy();
    resizeHandles = [...document.querySelectorAll<HTMLElement>('.cursor-col-resize')];
    expect(resizeHandles.length).toBeGreaterThanOrEqual(2);
    const sidebarPane = screen.getByLabelText('Loading sidebar').closest<HTMLElement>('[style*="width"]');
    const workbenchPane = document.querySelector<HTMLElement>('[data-workbench-document-pane="true"]');

    expect(sidebarPane?.style.width).toBe('300px');
    expect(workbenchPane?.style.width).toBe('620px');
  });

  it('accepts command-only desktop shortcut events for command-backed app chrome actions', () => {
    window.localStorage.setItem(APP_LAYOUT_MODE_STORAGE_KEY, 'compact');
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'layout.toggleRightRail' } }));
    });

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
  });

  it('accepts command-only desktop shortcut events for workbench refresh', () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    setExtensionCommandContext('workbench.hasActiveFile', true);
    renderLayout('/conversations/conv-1?workspaceFile=%2Frepo%2FREADME.md');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.refreshActiveFile' } }));
    });

    expect(refreshListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('clears remembered file selection after closing the active workbench file', async () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    renderLayout('/conversations/conv-1?workspaceFile=README.md');

    await waitFor(() => {
      expect(screen.getByTestId('route-search').textContent).toBe('?workspaceFile=README.md');
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.closeActiveFile' } }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('route-search').textContent).toBe('');
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.refreshActiveFile' } }));
    });

    expect(refreshListener).not.toHaveBeenCalled();
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('closes the workbench when the last workbench tab is closed', async () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    renderLayout('/conversations/conv-1');

    expect(document.querySelector('[data-workbench-document-pane="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'File Explorer' }));

    await waitFor(() => {
      expect(screen.queryByText('Open a tab')).toBeNull();
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.closeActiveTab' } }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-workbench-document-pane="true"]')).toBeNull();
    });
    expect(window.localStorage.getItem(APP_LAYOUT_MODE_STORAGE_KEY)).toBe('compact');
    expect(screen.getByRole('button', { name: 'Show workbench' })).toBeTruthy();
  });

  it('reuses the existing File Explorer tab from the new-tab launcher', async () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getByRole('button', { name: 'File Explorer' }));
    await waitFor(() => {
      expect(screen.queryByText('Open a tab')).toBeNull();
    });
    expect(screen.getAllByLabelText('Close File Explorer')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    const fileExplorerButtons = screen.getAllByRole('button', { name: 'File Explorer' });
    fireEvent.click(fileExplorerButtons[fileExplorerButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('Open a tab')).toBeNull();
    });
    expect(screen.getAllByLabelText('Close File Explorer')).toHaveLength(1);
  });

  it('hides File Explorer from the new-tab launcher for conversations without a project workspace', () => {
    setWorkbenchModeForCurrentSession();

    renderLayout('/conversations/conv-1');

    expect(screen.getByText('Open a tab')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'File Explorer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Chat' })).toBeTruthy();
  });

  it('removes restored File Explorer tabs for chat-workspace conversations', async () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/Users/patrick/.neon-pilot/chat-workspaces/fast-tick');
    window.localStorage.setItem(
      'pa:workbench-tabs',
      JSON.stringify({
        tabs: [
          { id: 'files', mode: 'files' },
          { id: 'browser-1', mode: 'browser' },
        ],
        activeTabId: 'files',
      }),
    );

    renderLayout('/conversations/conv-1?workspaceFile=README.md');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'File Explorer' })).toBeNull();
      expect(screen.queryByLabelText('Close File Explorer')).toBeNull();
      expect(screen.queryByText('Not available in chat conversations')).toBeNull();
      expect(screen.getByRole('button', { name: 'Browser' })).toBeTruthy();
      expect(screen.getByTestId('route-search').textContent).toBe('');
    });
  });

  it('restores open workbench tabs after a reload-style remount', async () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    window.localStorage.setItem(
      'pa:workbench-tabs',
      JSON.stringify({
        tabs: [
          { id: 'files', mode: 'files' },
          { id: 'terminal-1', mode: 'terminal' },
        ],
        activeTabId: 'terminal-1',
      }),
    );

    renderLayout('/conversations/conv-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'File Explorer' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Terminal' })).toBeTruthy();
    });
    expect(screen.getByTitle('Terminal').className).toContain('ui-workbench-tab-active');
  });

  it('publishes browser command context when the browser workbench tab is active', async () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    renderLayout('/conversations/conv-1');

    expect(evaluateCommandEnablement('browser.active')).toBe(false);

    act(() => {
      window.dispatchEvent(new CustomEvent('pa:workbench-open-tool-tab', { detail: { tool: 'browser' } }));
    });

    await waitFor(() => {
      expect(evaluateCommandEnablement('browser.active')).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    const fileExplorerButtons = screen.getAllByRole('button', { name: 'File Explorer' });
    fireEvent.click(fileExplorerButtons[fileExplorerButtons.length - 1]);

    await waitFor(() => {
      expect(evaluateCommandEnablement('browser.active')).toBe(false);
    });
  });

  it('executes browser tab commands through shared workbench browser state', async () => {
    setWorkbenchModeForCurrentSession();
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('pa:workbench-open-tool-tab', { detail: { tool: 'browser' } }));
    });

    await waitFor(() => {
      expect(evaluateCommandEnablement('browser.active')).toBe(true);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'browser.newTab' } }));
    });

    await waitFor(() => {
      const state = JSON.parse(window.localStorage.getItem('pa:workbench-browser-tabs') ?? 'null') as {
        tabs?: unknown[];
        activeTabId?: string;
      } | null;
      expect(state?.tabs).toHaveLength(2);
      expect(state?.activeTabId).toBe((state?.tabs?.[1] as { id?: string } | undefined)?.id);
    });
  });

  it('marks file selection for cleanup when closing File Explorer while another tab remains', () => {
    const state = closeWorkbenchTabState(
      [
        { id: 'files', mode: 'files' },
        { id: 'extension-notes', mode: 'extension:system-notes:notes' },
      ],
      'extension-notes',
      'files',
    );

    expect(state.nextTabs).toEqual([{ id: 'extension-notes', mode: 'extension:system-notes:notes' }]);
    expect(state.nextActiveTabId).toBe('extension-notes');
    expect(state.nextWouldHaveNoTabs).toBe(false);
    expect(state.shouldClearFileSelection).toBe(true);
  });

  it('does not consume global keybindings for unavailable commands', async () => {
    vi.mocked(api.extensionKeybindings).mockResolvedValue([
      {
        extensionId: 'host',
        surfaceId: 'refresh-workbench-file',
        packageType: 'system',
        title: 'Refresh workbench file',
        keys: ['F5'],
        command: 'workbench.refreshActiveFile',
        scope: 'global',
        defaultKeys: ['F5'],
        enabled: true,
      },
    ]);
    vi.mocked(api.extensionCommands).mockResolvedValue([]);
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    renderLayout('/conversations/conv-1');
    await waitFor(() => expect(api.extensionKeybindings).toHaveBeenCalled());

    const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(refreshListener).not.toHaveBeenCalled();
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('does not execute global keybindings while a shortcut capture control is active', async () => {
    vi.mocked(api.extensionKeybindings).mockResolvedValue([
      {
        extensionId: 'host',
        surfaceId: 'refresh-workbench-file',
        packageType: 'system',
        title: 'Refresh workbench file',
        keys: ['F5'],
        command: 'workbench.refreshActiveFile',
        scope: 'global',
        defaultKeys: ['F5'],
        enabled: true,
      },
    ]);
    vi.mocked(api.extensionCommands).mockResolvedValue([]);
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    const capture = document.createElement('button');
    capture.className = 'ui-shortcut-capture ui-shortcut-capture-capturing';
    document.body.append(capture);
    renderLayout('/conversations/conv-1?workspaceFile=%2Frepo%2FREADME.md');
    await waitFor(() => expect(api.extensionKeybindings).toHaveBeenCalled());

    const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(refreshListener).not.toHaveBeenCalled();
    capture.remove();
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('executes available global keybindings through shared host commands', async () => {
    vi.mocked(api.extensionKeybindings).mockResolvedValue([
      {
        extensionId: 'host',
        surfaceId: 'refresh-workbench-file',
        packageType: 'system',
        title: 'Refresh workbench file',
        keys: ['F5'],
        command: 'workbench.refreshActiveFile',
        scope: 'global',
        defaultKeys: ['F5'],
        enabled: true,
      },
    ]);
    vi.mocked(api.extensionCommands).mockResolvedValue([]);
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');
    const refreshListener = vi.fn();
    window.addEventListener('pa:workbench-refresh-active-file', refreshListener);
    renderLayout('/conversations/conv-1?workspaceFile=%2Frepo%2FREADME.md');
    await waitFor(() => expect(api.extensionKeybindings).toHaveBeenCalled());

    const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(refreshListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-refresh-active-file', refreshListener);
  });

  it('accepts command-only desktop shortcut events for workbench diff toggle', () => {
    setWorkbenchModeForCurrentSession();
    const diffListener = vi.fn();
    window.addEventListener('pa:workbench-toggle-diff', diffListener);
    setExtensionCommandContext('workbench.canToggleDiff', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'workbench.toggleDiff' } }));
    });

    expect(diffListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-toggle-diff', diffListener);
  });

  it('renders the workbench diff toggle in the file toolbar', async () => {
    setWorkbenchModeForCurrentSession();
    sessionStore.upsert({
      id: 'conv-1',
      file: '/tmp/conv-1.jsonl',
      timestamp: new Date().toISOString(),
      cwd: '/repo',
      cwdSlug: 'repo',
      model: 'deepseek-v4-flash',
      title: 'Workspace conversation',
      messageCount: 0,
    });
    const diffListener = vi.fn();
    window.addEventListener('pa:workbench-toggle-diff', diffListener);

    renderLayout('/conversations/conv-1?workspaceFile=README.md');

    act(() => {
      window.dispatchEvent(
        new CustomEvent('pa:workbench-diff-state', {
          detail: { cwd: '/repo', path: 'README.md', canToggleDiff: true, diffEnabled: true },
        }),
      );
    });

    const toggle = await screen.findByRole('button', { name: 'Hide diff overlay' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);

    expect(diffListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('pa:workbench-toggle-diff', diffListener);
  });

  it('accepts command-only desktop shortcut events for composer stop', () => {
    const stopListener = vi.fn();
    window.addEventListener('neon-pilot:composer-stop', stopListener);
    setExtensionCommandContext('conversation.isStreaming', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'composer.stop' } }));
    });

    expect(stopListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('neon-pilot:composer-stop', stopListener);
  });

  it('accepts command-only desktop shortcut events for available dictation toggle', () => {
    const dictationListener = vi.fn();
    window.addEventListener('neon-pilot:dictation-toggle', dictationListener);
    setExtensionCommandContext('system-local-dictation.toggleAvailable', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'dictation.toggle' } }));
    });

    expect(dictationListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('neon-pilot:dictation-toggle', dictationListener);
  });

  it('accepts command-only desktop shortcut events for available composer drawing creation', () => {
    const createDrawingListener = vi.fn();
    window.addEventListener('neon-pilot-composer-create-drawing-command', createDrawingListener);
    setExtensionCommandContext('composer.canCreateDrawing', true);
    renderLayout('/conversations/conv-1');

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'composer.createDrawing' } }));
    });

    expect(createDrawingListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('neon-pilot-composer-create-drawing-command', createDrawingListener);
  });

  it('accepts command-only desktop shortcut events for focus traversal', () => {
    const offsetParentDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() {
        return document.body;
      },
    });
    renderLayout('/conversations/conv-1');
    const focusable = [
      ...document.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'),
    ].filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0);
    expect(focusable.length).toBeGreaterThan(0);
    expect(document.activeElement).not.toBe(focusable[0]);

    act(() => {
      window.dispatchEvent(new CustomEvent('neon-pilot-desktop-shortcut', { detail: { command: 'focus.next' } }));
    });

    expect(document.activeElement).toBe(focusable[0]);
    if (offsetParentDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParentDescriptor);
    } else {
      delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
    }
  });

  it('opens a side chat after reservation without waiting for live-session creation', async () => {
    setWorkbenchModeForCurrentSession();
    const reserveConversation = vi.spyOn(api, 'reserveConversation').mockResolvedValue({
      id: 'side-chat-1',
      sessionFile: '/tmp/side-chat-1.jsonl',
      cwd: '/repo',
      perf: {},
    });
    const createLiveSession = vi
      .spyOn(api, 'createLiveSession')
      .mockImplementation(() => new Promise<Awaited<ReturnType<typeof api.createLiveSession>>>(() => {}));
    vi.mocked(api.conversationModelPreferences).mockResolvedValue({
      currentModel: 'deepseek-v4-flash',
      currentThinkingLevel: 'high',
      currentServiceTier: 'priority',
    });

    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Chat' }).at(-1)!);

    await waitFor(() => {
      expect(reserveConversation).toHaveBeenCalledWith(undefined);
    });
    await waitFor(
      () => {
        expect(document.querySelector('[data-chat-rail="1"]')).not.toBeNull();
      },
      { timeout: 3000 },
    );

    expect(createLiveSession).toHaveBeenCalledWith(undefined, undefined, {
      workspaceCwd: undefined,
      reservedSessionFile: '/tmp/side-chat-1.jsonl',
      model: 'deepseek-v4-flash',
      thinkingLevel: 'high',
      serviceTier: 'priority',
    });
  });

  it('uses the conversation title for side chat tabs when metadata is available', async () => {
    setWorkbenchModeForCurrentSession();
    sessionStore.upsert({
      id: 'side-chat-1',
      file: '/tmp/side-chat-1.jsonl',
      timestamp: new Date().toISOString(),
      cwd: '/repo',
      cwdSlug: 'repo',
      model: 'deepseek-v4-flash',
      title: 'Investigate onboarding crash',
      messageCount: 0,
    });
    vi.spyOn(api, 'reserveConversation').mockResolvedValue({
      id: 'side-chat-1',
      sessionFile: '/tmp/side-chat-1.jsonl',
      cwd: '/repo',
      perf: {},
    });
    vi.spyOn(api, 'createLiveSession').mockImplementation(() => new Promise<Awaited<ReturnType<typeof api.createLiveSession>>>(() => {}));

    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Chat' }).at(-1)!);

    expect(await screen.findByRole('button', { name: 'Investigate onboarding crash' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Chat side-cha/ })).toBeNull();
  });

  it('keeps the workbench new tab button outside the scrollable tab lane', () => {
    setWorkbenchModeForCurrentSession();
    seedConversationCwd('/repo');

    renderLayout('/conversations/conv-1');

    fireEvent.click(screen.getByRole('button', { name: /File Explorer/ }));

    const newTabButton = screen.getByRole('button', { name: 'New tab' });
    expect(newTabButton.className).toContain('shrink-0');
    expect(newTabButton.parentElement?.className).toContain('overflow-hidden');
    expect(newTabButton.closest('.overflow-x-auto')).toBeNull();
    expect(document.querySelector('.ui-workbench-tab')?.parentElement?.className).toContain('overflow-x-auto');
  });
});
