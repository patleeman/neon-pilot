/* @vitest-environment jsdom */

import { CANONICAL_WINDOWED_DESKTOP_APPS } from '@neon-pilot/windowed-os-ui';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT, type WindowedParentWindowLifecycleDetail } from '../windowed/windowedChildWindowEvents';
import { WindowedLayout } from './WindowedLayout';
import { WINDOWED_SHELL_BROWSER_SUSPEND_EVENT } from './workbench/workbenchBrowserEvents';

const mocks = vi.hoisted(() => ({
  layout: vi.fn(({ children }: { children?: ReactNode }) => (
    <div data-testid="embedded-layout">
      embedded layout
      {children}
    </div>
  )),
  archiveSession: vi.fn(),
  registryLoading: false,
  pinnedSessions: [] as Array<{ id: string; title?: string; messageCount?: number }>,
  tabs: [] as Array<{ id: string; title?: string; messageCount?: number; workspaceCwd?: string | null }>,
  conversationsLoading: false,
  topBarElements: [] as Array<{ extensionId: string; id: string; component: string; label?: string; frontendEntry?: string }>,
  surfaces: [] as Array<Record<string, unknown>>,
  extensions: [
    {
      id: 'system-routines',
      enabled: true,
      contributes: {
        nav: [{ id: 'routines', label: 'Routines', route: '/routines' }],
      },
    },
  ] as Array<{
    id: string;
    enabled: boolean;
    contributes?: {
      nav?: Array<{ id: string; label: string; route: string }>;
      views?: Array<{ id: string; title: string; location: string; route?: string }>;
      settingsComponent?: { id: string; label: string; sectionId: string };
    };
  }>,
}));

vi.mock('./Layout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    Layout: ({
      embeddedWindowChrome,
      forceWorkbench,
      suppressWorkbench,
    }: {
      embeddedWindowChrome?: boolean;
      forceWorkbench?: boolean;
      suppressWorkbench?: boolean;
    }) =>
      mocks.layout({
        children: (
          <div
            data-testid="mock-layout-props"
            data-embedded-window-chrome={embeddedWindowChrome ? 'true' : 'false'}
            data-force-workbench={forceWorkbench ? 'true' : 'false'}
            data-suppress-workbench={suppressWorkbench ? 'true' : 'false'}
          >
            <Outlet />
          </div>
        ),
      }),
  };
});

vi.mock('../extensions/NativeExtensionSurfaceHost', () => ({
  NativeExtensionSurfaceHost: ({
    cwd,
    instanceId,
    shellPresentation,
    surface,
  }: {
    cwd?: string | null;
    instanceId?: string | null;
    shellPresentation?: 'stable' | 'windowed';
    surface: { extensionId: string; id: string };
  }) => (
    <div
      data-testid="native-extension-surface"
      data-cwd={cwd ?? ''}
      data-extension-id={surface.extensionId}
      data-instance-id={instanceId ?? ''}
      data-shell-presentation={shellPresentation ?? 'stable'}
      data-surface-id={surface.id}
    />
  ),
}));

vi.mock('../extensions/ExtensionRouteHost', async () => {
  const { useLocation, useNavigate } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ExtensionRouteHost: ({ shellPresentation = 'stable' }: { shellPresentation?: 'stable' | 'windowed' }) => {
      const location = useLocation();
      const navigate = useNavigate();
      return (
        <div data-testid="extension-route-host">
          {`${location.pathname}:${shellPresentation}`}
          <button type="button" aria-label="Navigate within extension app" onClick={() => navigate('/routines/checkpoint')} />
          <button type="button" aria-label="Navigate to settings app" onClick={() => navigate('/settings/providers')} />
        </div>
      );
    },
  };
});

vi.mock('../extensions/TopBarElementHost', () => ({
  TopBarElementHost: ({ registration }: { registration: { label?: string; id: string } }) => (
    <button type="button">{registration.label ?? registration.id}</button>
  ),
}));

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({
    loading: mocks.registryLoading,
    error: null,
    extensions: mocks.extensions,
    surfaces: mocks.surfaces,
    topBarElements: mocks.topBarElements,
  }),
}));

vi.mock('../hooks/useConversations', () => ({
  useConversations: () => ({
    pinnedSessions: mocks.pinnedSessions,
    tabs: mocks.tabs,
    loading: mocks.conversationsLoading,
    archiveSession: mocks.archiveSession,
  }),
}));

vi.mock('../pages/ConversationPage', async () => {
  const { useLocation, useNavigate } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ConversationPage: () => {
      const location = useLocation();
      const navigate = useNavigate();
      return (
        <div data-testid="conversation-page" data-pathname={location.pathname}>
          Conversation
          <button type="button" onClick={() => navigate('/conversations/session-2')}>
            Navigate inside window
          </button>
        </div>
      );
    },
  };
});

function renderWindowedLayout() {
  return render(
    <BrowserRouter>
      <WindowedLayout />
    </BrowserRouter>,
  );
}

function seedWindowedWindows(windows: unknown[]) {
  window.localStorage.setItem('pa:windowed-os-shell-windows:v1', JSON.stringify(windows));
}

type ChildToolKind = 'browser' | 'files' | 'terminal';

function surfaceForChildTool(kind: ChildToolKind): Record<string, unknown> {
  if (kind === 'browser') {
    return {
      extensionId: 'system-browser',
      id: 'browser-workbench',
      title: 'Browser',
      location: 'workbench',
      component: 'BrowserWorkbenchPanel',
      toolSlot: 'browser',
    };
  }
  if (kind === 'files') {
    return {
      extensionId: 'system-files',
      id: 'files-panel',
      title: 'Files',
      location: 'rightRail',
      component: 'WorkspaceFilesPanel',
      toolSlot: 'files',
    };
  }
  return {
    extensionId: 'system-terminal',
    id: 'terminal-panel',
    title: 'Terminal',
    location: 'rightRail',
    component: 'TerminalPanel',
    toolSlot: 'terminal',
  };
}

describe('WindowedLayout route windows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    delete window.neonPilotDesktop;
    mocks.layout.mockClear();
    mocks.archiveSession.mockClear();
    mocks.registryLoading = false;
    mocks.pinnedSessions = [];
    mocks.tabs = [];
    mocks.conversationsLoading = false;
    mocks.topBarElements = [];
    mocks.surfaces = [];
    mocks.extensions = [
      {
        id: 'system-routines',
        enabled: true,
        contributes: {
          nav: [{ id: 'routines', label: 'Routines', route: '/routines' }],
        },
      },
    ];
  });

  it('deactivates stale browser views as soon as the windowed shell mounts', async () => {
    window.localStorage.setItem(
      'pa:workbench-browser-tabs',
      JSON.stringify({
        version: 1,
        activeTabId: 'tab-a',
        tabs: [
          { id: 'tab-a', title: 'Docs', url: 'https://example.com', urlDraft: '' },
          { id: 'tab-b', title: 'Search', url: 'https://example.org', urlDraft: '' },
        ],
        closedTabs: [],
      }),
    );
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    window.neonPilotDesktop = { setWorkbenchBrowserBounds } as unknown as typeof window.neonPilotDesktop;

    renderWindowedLayout();

    expect(document.body.getAttribute('data-neon-pilot-windowed-shell-active')).toBe('true');
    await waitFor(() => {
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: null,
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: '@global:tab-tab-a',
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: '@global:tab-tab-b',
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
    });
  });

  it('allows native browser views for a single focused chat window after shell settling', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
    ]);

    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    window.neonPilotDesktop = { setWorkbenchBrowserBounds } as unknown as typeof window.neonPilotDesktop;

    const { container } = renderWindowedLayout();
    const shell = container.querySelector('.windowed-os-shell');
    await screen.findByRole('region', { name: /new conversation/i });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1300));
    });

    expect(shell?.getAttribute('data-native-browser-blocked')).toBeNull();
    expect(shell?.getAttribute('data-frame-paint-blocked')).toBeNull();
    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-iframe-blocked')).toBeNull();
  });

  it('keeps native browser views suppressed while a focused chat window is clipped by the desktop work area', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 690, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
    ]);

    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    window.neonPilotDesktop = { setWorkbenchBrowserBounds } as unknown as typeof window.neonPilotDesktop;

    const { container } = renderWindowedLayout();
    const shell = container.querySelector('.windowed-os-shell');
    const chatWindow = await screen.findByRole('region', { name: /new conversation/i });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1300));
    });

    expect(shell?.getAttribute('data-native-browser-blocked')).toBe('true');
    expect(shell?.getAttribute('data-frame-paint-blocked')).toBe('true');
    expect(chatWindow.getAttribute('data-iframe-blocked')).toBe('true');
    expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
      visible: false,
      deactivate: true,
      destroy: true,
      windowedShellActive: true,
    });
  });

  it('renders non-chat routes through the extension host without the embedded stable layout', async () => {
    renderWindowedLayout();

    expect(screen.getByTestId('embedded-layout')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /routines/i }));

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/routines:windowed');

    const routinesWindow = screen.getByRole('region', { name: /routines/i });
    expect(within(routinesWindow).getByTestId('extension-route-host')).toBeTruthy();
    expect(within(routinesWindow).queryByTestId('embedded-layout')).toBeNull();
    expect(routinesWindow.querySelector('.wos-window-route-body--extension')?.classList.contains('wos-chat-surface')).toBe(false);
    expect(screen.getAllByTestId('embedded-layout')).toHaveLength(1);
  });

  it('restores persisted windows with their routed content mounted inside each frame', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
      {
        id: 'route:system-routines:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 72, width: 620, height: 440 },
        minimized: false,
        focused: false,
      },
    ]);

    renderWindowedLayout();

    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });

    expect(within(chatWindow).getByTestId('embedded-layout')).toBeTruthy();
    expect(within(chatWindow).getByTestId('conversation-page').dataset.pathname).toBe('/conversations/new');
    expect(chatWindow.querySelector('.wos-window-route-body--chat')?.textContent).toContain('Conversation');
    expect(within(routinesWindow).getByTestId('extension-route-host').textContent).toBe('/routines:windowed');
    expect(routinesWindow.querySelector('.wos-window-route-body--extension')?.textContent).toContain('/routines:windowed');
  });

  it('renders chat windows inside the canonical windowed chat surface with child tool launchers only', () => {
    renderWindowedLayout();

    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    const chatSurface = chatWindow.querySelector('.wos-window-route-body--chat');

    expect(chatSurface).toBeTruthy();
    expect(chatSurface?.classList.contains('wos-chat-surface')).toBe(true);
    expect(chatSurface?.getAttribute('data-workbench-collapsed')).toBe('true');
    expect(within(chatWindow).getByTestId('embedded-layout')).toBeTruthy();
    expect(within(chatWindow).getByTestId('mock-layout-props').dataset.forceWorkbench).toBe('false');
    expect(within(chatWindow).getByTestId('mock-layout-props').dataset.suppressWorkbench).toBe('true');
    expect(within(chatWindow).queryByRole('button', { name: /show tools panel/i })).toBeNull();
    expect(within(chatWindow).queryByRole('button', { name: /hide tools panel/i })).toBeNull();
    expect(
      within(chatWindow)
        .getByRole('button', { name: /open browser window/i })
        .getAttribute('data-density'),
    ).toBe('icon');
    expect((within(chatWindow).getByRole('button', { name: /open browser window/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(chatWindow)
        .getByRole('button', { name: /open browser window/i })
        .getAttribute('title'),
    ).toContain('Enable the Browser');
    expect(
      within(chatWindow)
        .getByRole('button', { name: /open files window/i })
        .getAttribute('data-density'),
    ).toBe('icon');
    expect((within(chatWindow).getByRole('button', { name: /open files window/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(chatWindow)
        .getByRole('button', { name: /open files window/i })
        .getAttribute('title'),
    ).toContain('Enable the Files');
    expect(
      within(chatWindow)
        .getByRole('button', { name: /open terminal window/i })
        .getAttribute('data-density'),
    ).toBe('icon');
    expect((within(chatWindow).getByRole('button', { name: /open terminal window/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(chatWindow.querySelector('.wos-chat-window-toolbar__label')).toBeNull();
    expect(chatWindow.querySelector('.wos-chat-window-toolbar__status')).toBeNull();
    expect(chatWindow.querySelector('.wos-chat-window-toolbar__actions')?.children).toHaveLength(3);
    expect(within(chatWindow).getByTestId('conversation-page').dataset.pathname).toBe('/conversations/new');
  });

  it('suppresses the legacy attached workbench even when stored state requested it open', () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 32, y: 32, width: 1180, height: 720 },
        minimized: false,
        focused: true,
        workbenchCollapsed: false,
      },
    ]);

    renderWindowedLayout();

    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    const chatSurface = chatWindow.querySelector('.wos-window-route-body--chat');

    expect(chatSurface?.getAttribute('data-workbench-collapsed')).toBe('true');
    expect(within(chatWindow).queryByRole('button', { name: /hide tools panel/i })).toBeNull();
    expect(within(chatWindow).getByTestId('mock-layout-props').dataset.forceWorkbench).toBe('false');
    expect(within(chatWindow).getByTestId('mock-layout-props').dataset.suppressWorkbench).toBe('true');
  });

  it('keeps compact chat windows in the child-tools-only layout', () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 32, y: 32, width: 520, height: 360 },
        minimized: false,
        focused: true,
      },
    ]);

    renderWindowedLayout();

    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    const chatSurface = chatWindow.querySelector('.wos-window-route-body--chat');

    expect(chatSurface?.getAttribute('data-compact')).toBe('true');
    expect(chatSurface?.getAttribute('data-workbench-collapsed')).toBe('true');
    expect(within(chatWindow).queryByRole('button', { name: /show tools panel/i })).toBeNull();
    expect(chatWindow.querySelector('.wos-chat-window-toolbar__actions')?.children).toHaveLength(3);
    expect(within(chatWindow).getByTestId('mock-layout-props').dataset.forceWorkbench).toBe('false');
    expect(within(chatWindow).getByTestId('mock-layout-props').dataset.suppressWorkbench).toBe('true');
  });

  it('keeps the windowed shell app controls text-only without monogram badges or secondary labels', () => {
    const { container } = renderWindowedLayout();

    expect(container.querySelector('.wos-taskbar .wos-app-monogram')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    expect(within(startMenu).getByText('Neon Pilot')).toBeTruthy();
    expect(within(startMenu).queryByText('APPS')).toBeNull();
    expect(within(startMenu).queryByText('Stable shell')).toBeNull();
    expect(startMenu.querySelector('.wos-app-monogram')).toBeNull();
  });

  it('defaults the windowed OS shell to the light theme and renders a taskbar theme control', () => {
    const { container } = renderWindowedLayout();

    expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-wos-theme')).toBe('light');
    expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-wos-theme-mode')).toBe('light');
    expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-wos-theme-phase')).toBeTruthy();
    const desktopControls = screen.getByLabelText('Desktop controls');
    expect(within(desktopControls).getByRole('radiogroup', { name: /windowed os theme/i })).toBeTruthy();
    expect(within(desktopControls).getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true');
    expect(within(desktopControls).getByRole('radio', { name: 'Time of day' }).getAttribute('aria-checked')).toBe('false');
  });

  it('restores the persisted windowed OS theme and updates it from the taskbar', () => {
    window.localStorage.setItem('pa:windowed-os-theme:v1', 'dark');
    const { container } = renderWindowedLayout();

    const shell = container.querySelector('.windowed-os-shell');
    const desktopControls = screen.getByLabelText('Desktop controls');
    expect(shell?.getAttribute('data-wos-theme')).toBe('dark');
    expect(within(desktopControls).getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(within(desktopControls).getByRole('radio', { name: 'Light' }));

    expect(shell?.getAttribute('data-wos-theme')).toBe('light');
    expect(window.localStorage.getItem('pa:windowed-os-theme:v1')).toBe('light');
    expect(within(desktopControls).getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true');
  });

  it('keeps automatic windowed OS theme mode selected while painting the resolved theme', () => {
    window.localStorage.setItem('pa:windowed-os-theme:v1', 'auto');
    const { container } = renderWindowedLayout();

    const shell = container.querySelector('.windowed-os-shell');
    const desktopControls = screen.getByLabelText('Desktop controls');

    expect(shell?.getAttribute('data-wos-theme-mode')).toBe('auto');
    expect(['light', 'dark']).toContain(shell?.getAttribute('data-wos-theme'));
    expect(shell?.getAttribute('data-wos-theme-phase')).toBeTruthy();
    expect(within(desktopControls).getByRole('radio', { name: 'Time of day' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(within(desktopControls).getByRole('radio', { name: 'Dark' }));

    expect(shell?.getAttribute('data-wos-theme-mode')).toBe('dark');
    expect(shell?.getAttribute('data-wos-theme')).toBe('dark');
    expect(window.localStorage.getItem('pa:windowed-os-theme:v1')).toBe('dark');
  });

  it('renders extension top-bar elements in the right side of the windowed taskbar', () => {
    mocks.topBarElements = [
      {
        extensionId: 'system-caffeinate',
        id: 'caffeinate-toggle',
        component: 'CaffeinateToggle',
        label: 'Caffeinate toggle',
      },
    ];

    renderWindowedLayout();

    const openWindows = screen.getByRole('navigation', { name: 'Open windows' });
    const desktopControls = screen.getByLabelText('Desktop controls');
    const extensionActions = within(desktopControls).getByLabelText('Taskbar extension actions');

    expect(within(openWindows).queryByRole('button', { name: 'Caffeinate toggle' })).toBeNull();
    expect(within(extensionActions).getByRole('button', { name: 'Caffeinate toggle' })).toBeTruthy();
    expect(within(desktopControls).getByLabelText('Taskbar system controls')).toBeTruthy();
  });

  it('does not render stable-shell-only top-bar bootstraps in the windowed taskbar', () => {
    mocks.topBarElements = [
      {
        extensionId: 'system-onboarding',
        id: 'onboarding-bootstrap',
        component: 'OnboardingBootstrap',
        label: 'Setup tour',
      },
      {
        extensionId: 'system-caffeinate',
        id: 'caffeinate-toggle',
        component: 'CaffeinateToggle',
        label: 'Caffeinate toggle',
      },
    ];

    renderWindowedLayout();

    const desktopControls = screen.getByLabelText('Desktop controls');
    const extensionActions = within(desktopControls).getByLabelText('Taskbar extension actions');
    expect(within(desktopControls).queryByRole('button', { name: 'Setup tour' })).toBeNull();
    expect(within(extensionActions).getByRole('button', { name: 'Caffeinate toggle' })).toBeTruthy();
  });

  it('focuses Start menu search on open and closes it with Escape', () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const search = within(startMenu).getByRole('searchbox', { name: /search apps/i });
    expect(document.activeElement).toBe(search);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
  });

  it('opens the first filtered Start menu app with Enter', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const search = within(startMenu).getByRole('searchbox', { name: /search apps/i });
    fireEvent.change(search, { target: { value: 'routines' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/routines:windowed');
    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
  });

  it('opens the highlighted filtered Start menu app with arrow navigation and Enter', async () => {
    mocks.extensions = [
      {
        id: 'system-gateways',
        enabled: true,
        contributes: {
          nav: [{ id: 'gateways', label: 'Gateways', route: '/gateways' }],
        },
      },
      {
        id: 'system-telemetry',
        enabled: true,
        contributes: {
          nav: [{ id: 'diagnostics', label: 'Diagnostics', route: '/telemetry' }],
        },
      },
      {
        id: 'system-model-gateway',
        enabled: true,
        contributes: {},
      },
    ];
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const search = within(startMenu).getByRole('searchbox', { name: /search apps/i });
    fireEvent.change(search, { target: { value: 'gateway' } });

    const gateways = within(startMenu).getByRole('button', { name: 'Gateways' });
    const aiGateway = within(startMenu).getByRole('button', { name: 'AI Gateway' });
    expect(gateways.getAttribute('data-active')).toBe('true');

    fireEvent.keyDown(search, { key: 'ArrowDown' });

    expect(gateways.getAttribute('data-active')).toBe('false');
    expect(aiGateway.getAttribute('data-active')).toBe('true');

    fireEvent.keyDown(search, { key: 'Enter' });

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/ai-gateway:windowed');
    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
  });

  it('orders and accents launcher apps from the canonical windowed desktop roster', () => {
    mocks.extensions = [
      {
        id: 'system-settings',
        enabled: true,
        contributes: {
          views: [{ id: 'settings-duplicate', title: 'Settings', location: 'main', route: '/settings' }],
        },
      },
      {
        id: 'system-extension-manager',
        enabled: true,
        contributes: {
          nav: [{ id: 'extensions', label: 'App Manager', route: '/extensions' }],
        },
      },
      {
        id: 'system-telemetry',
        enabled: true,
        contributes: {
          nav: [{ id: 'diagnostics', label: 'Diagnostics', route: '/telemetry' }],
        },
      },
      {
        id: 'system-gateways',
        enabled: true,
        contributes: {
          nav: [{ id: 'gateways', label: 'Gateways', route: '/gateways' }],
        },
      },
      {
        id: 'system-model-gateway',
        enabled: true,
        contributes: {
          nav: [{ id: 'ai-gateway', label: 'AI Gateway', route: '/ai-gateway' }],
        },
      },
      {
        id: 'system-model-arena',
        enabled: true,
        contributes: {
          nav: [{ id: 'model-arena', label: 'Model Arena', route: '/model-arena' }],
        },
      },
      {
        id: 'system-automations',
        enabled: true,
        contributes: {
          nav: [{ id: 'automations', label: 'Automations', route: '/automations' }],
        },
      },
      {
        id: 'system-skills',
        enabled: true,
        contributes: {
          nav: [{ id: 'skills', label: 'Skills', route: '/skills' }],
        },
      },
      {
        id: 'system-routines',
        enabled: true,
        contributes: {
          nav: [{ id: 'routines', label: 'Routines', route: '/routines' }],
        },
      },
      {
        id: 'system-dynamic-workflows',
        enabled: true,
        contributes: {
          nav: [{ id: 'workflows', label: 'Workflows', route: '/workflows' }],
        },
      },
    ];

    const { container } = renderWindowedLayout();
    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const menuTitles = Array.from(container.querySelectorAll('.wos-start-menu__item .wos-app-tile__label')).map(
      (element) => element.textContent,
    );
    expect(menuTitles).toEqual(CANONICAL_WINDOWED_DESKTOP_APPS.map((app) => app.title));

    for (const app of CANONICAL_WINDOWED_DESKTOP_APPS) {
      const button = screen.getByRole('button', { name: app.title });
      expect(button.querySelector('.wos-app-monogram')).toBeNull();
      const tile = button.querySelector('.wos-app-tile');
      expect(tile?.getAttribute('data-variant')).toBe('menu');
      expect(tile?.getAttribute('data-accent')).toBe(app.accent);
    }
  });

  it('keeps enabled canonical beta apps available when extension nav contributions are missing', async () => {
    mocks.extensions = [
      {
        id: 'system-automations',
        enabled: true,
        contributes: {},
      },
      {
        id: 'system-dynamic-workflows',
        enabled: false,
        contributes: {},
      },
      {
        id: 'system-routines',
        enabled: true,
        contributes: {
          nav: [{ id: 'routines', label: 'Routines', route: '/routines' }],
        },
      },
    ];

    const { container } = renderWindowedLayout();
    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const menuTitles = Array.from(container.querySelectorAll('.wos-start-menu__item .wos-app-tile__label')).map(
      (element) => element.textContent,
    );
    expect(menuTitles).toEqual(['Chat', 'Automations', 'Routines', 'Settings']);
    expect(menuTitles).not.toContain('Workflows');

    fireEvent.mouseDown(within(startMenu).getByRole('button', { name: /^automations$/i }), { button: 0 });

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/automations:windowed');
    expect(screen.getByRole('region', { name: /^automations$/i })).toBeTruthy();
  });

  it('searches the Start menu by canonical app aliases', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    fireEvent.change(within(startMenu).getByRole('searchbox', { name: /search apps/i }), { target: { value: 'preferences' } });

    expect(within(startMenu).getByRole('button', { name: /^settings$/i })).toBeTruthy();
    expect(within(startMenu).queryByRole('button', { name: /^chat$/i })).toBeNull();

    fireEvent.mouseDown(within(startMenu).getByRole('button', { name: /^settings$/i }), { button: 0 });

    expect(await screen.findByRole('region', { name: /^settings$/i })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
  });

  it('closes the start menu when the desktop is clicked outside it', () => {
    const { container } = renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    expect(screen.getByRole('dialog', { name: /start menu/i })).toBeTruthy();
    expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-start-menu-open')).toBe('true');

    fireEvent.mouseDown(screen.getByLabelText(/windowed neon pilot desktop/i));

    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
    expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-start-menu-open')).toBeNull();
  });

  it('keeps the leading edge of Start menu rows clickable for pointer launch', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const routines = within(startMenu).getByRole('button', { name: /^routines$/i });
    fireEvent.mouseDown(routines, { clientX: 2, clientY: 8 });
    fireEvent.click(routines, { clientX: 2, clientY: 8 });

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/routines:windowed');
    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
  });

  it('keeps Start menu pointer launch working after prior window focus and desktop dismissal', async () => {
    mocks.extensions = [
      ...mocks.extensions,
      {
        id: 'system-automations',
        enabled: true,
        contributes: {
          nav: [{ id: 'automations', label: 'Automations', route: '/automations' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /start menu/i })).getByRole('button', { name: /^routines$/i }));
    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });

    fireEvent.mouseDown(routinesWindow);
    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    expect(screen.getByRole('dialog', { name: /start menu/i })).toBeTruthy();
    fireEvent.mouseDown(screen.getByLabelText(/windowed neon pilot desktop/i));
    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const automations = within(startMenu).getByRole('button', { name: /^automations$/i });
    fireEvent.mouseDown(automations, { button: 0, clientX: 2, clientY: 8 });

    const automationsWindow = await screen.findByRole('region', { name: /^automations$/i });
    expect(within(automationsWindow).getByTestId('extension-route-host').textContent).toBe('/automations:windowed');
    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
  });

  it('keeps ordinary window content mounted while the Start menu is open', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^routines$/i }));
    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    expect(within(routinesWindow).getByTestId('extension-route-host').textContent).toBe('/routines:windowed');

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    expect(screen.getByRole('dialog', { name: /start menu/i })).toBeTruthy();
    expect(within(routinesWindow).getByTestId('extension-route-host').textContent).toBe('/routines:windowed');
    expect(routinesWindow.querySelector('.wos-window__iframe-shield')).toBeTruthy();
  });

  it('keeps stored native browser tabs hidden while the start menu is open', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(
      'pa:workbench-browser-tabs',
      JSON.stringify({
        version: 1,
        activeTabId: 'tab-a',
        tabs: [
          { id: 'tab-a', title: 'Docs', url: 'https://example.com', urlDraft: '' },
          { id: 'tab-b', title: 'Search', url: 'https://example.org', urlDraft: '' },
        ],
        closedTabs: [],
      }),
    );
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    window.neonPilotDesktop = { setWorkbenchBrowserBounds } as unknown as typeof window.neonPilotDesktop;

    try {
      renderWindowedLayout();

      fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
      expect(screen.getByRole('dialog', { name: /start menu/i })).toBeTruthy();

      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: null,
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: '@global:tab-tab-a',
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: '@global:tab-tab-b',
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      const initialHiddenCalls = setWorkbenchBrowserBounds.mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(setWorkbenchBrowserBounds.mock.calls.length).toBeGreaterThan(initialHiddenCalls);
      expect(setWorkbenchBrowserBounds).toHaveBeenLastCalledWith({
        visible: false,
        sessionKey: '@global:tab-tab-b',
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('adds enabled main extension views to the start menu even when they do not contribute sidebar nav', async () => {
    mocks.extensions = [
      ...mocks.extensions,
      {
        id: 'system-dynamic-workflows',
        enabled: true,
        contributes: {
          views: [{ id: 'workflows-page', title: 'Workflows', location: 'main', route: '/workflows' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^workflows$/i }));

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/workflows:windowed');
    expect(screen.getByRole('region', { name: /workflows/i })).toBeTruthy();
  });

  it('opens AI Gateway as its own windowed app route', async () => {
    mocks.extensions = [
      ...mocks.extensions,
      {
        id: 'system-model-gateway',
        enabled: true,
        contributes: {
          nav: [{ id: 'ai-gateway-nav', label: 'AI Gateway', route: '/ai-gateway' }],
          views: [{ id: 'ai-gateway-page', title: 'AI Gateway', location: 'main', route: '/ai-gateway' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^ai gateway$/i }));

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/ai-gateway:windowed');
    const aiGatewayWindow = screen.getByRole('region', { name: /ai gateway/i });
    expect(aiGatewayWindow.querySelector('.wos-window__titlebar')?.getAttribute('data-accent')).toBe('gateways');
  });

  it('uses canonical product accents for diagnostics, skills, and workflow app windows', async () => {
    mocks.extensions = [
      {
        id: 'system-diagnostics',
        enabled: true,
        contributes: {
          nav: [{ id: 'telemetry-nav', label: 'Diagnostics', route: '/telemetry' }],
        },
      },
      {
        id: 'system-skills',
        enabled: true,
        contributes: {
          nav: [{ id: 'skills-nav', label: 'Skills', route: '/skills' }],
        },
      },
      {
        id: 'system-workflows',
        enabled: true,
        contributes: {
          views: [{ id: 'workflows-page', title: 'Workflows', location: 'main', route: '/workflows' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^diagnostics$/i }));
    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^skills$/i }));
    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^workflows$/i }));

    await screen.findByRole('region', { name: /workflows/i });

    expect(
      screen
        .getByRole('region', { name: /diagnostics/i })
        .querySelector('.wos-window__titlebar')
        ?.getAttribute('data-accent'),
    ).toBe('diagnostics');
    expect(
      screen
        .getByRole('region', { name: /skills/i })
        .querySelector('.wos-window__titlebar')
        ?.getAttribute('data-accent'),
    ).toBe('skills');
    expect(
      screen
        .getByRole('region', { name: /workflows/i })
        .querySelector('.wos-window__titlebar')
        ?.getAttribute('data-accent'),
    ).toBe('workflows');
  });

  it('uses the drawing accent for drawing and sketch app windows', async () => {
    mocks.extensions = [
      {
        id: 'system-drawing-workbench',
        enabled: true,
        contributes: {
          nav: [{ id: 'drawing-nav', label: 'Drawing Board', route: '/drawing-board' }],
          views: [{ id: 'drawing-page', title: 'Drawing Board', location: 'main', route: '/drawing-board' }],
        },
      },
      {
        id: 'system-sketches',
        enabled: true,
        contributes: {
          nav: [{ id: 'sketch-nav', label: 'Sketches', route: '/sketches' }],
          views: [{ id: 'sketch-page', title: 'Sketches', location: 'main', route: '/sketches' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^drawing board$/i }));
    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^sketches$/i }));

    await screen.findByRole('region', { name: /sketches/i });

    expect(
      screen
        .getByRole('region', { name: /drawing board/i })
        .querySelector('.wos-window__titlebar')
        ?.getAttribute('data-accent'),
    ).toBe('drawing');
    expect(
      screen
        .getByRole('region', { name: /sketches/i })
        .querySelector('.wos-window__titlebar')
        ?.getAttribute('data-accent'),
    ).toBe('drawing');
  });

  it('deduplicates start menu routes when an extension contributes both nav and a main view', () => {
    mocks.extensions = [
      {
        id: 'system-routines',
        enabled: true,
        contributes: {
          nav: [{ id: 'routines-nav', label: 'Routines', route: '/routines' }],
          views: [{ id: 'routines-page', title: 'Routines', location: 'main', route: '/routines' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    const startMenu = screen.getByRole('dialog', { name: /start menu/i });

    expect(within(startMenu).getAllByRole('button', { name: /^routines$/i })).toHaveLength(1);
  });

  it('keeps top-level app windows distinct when extensions reuse nav ids', async () => {
    mocks.extensions = [
      {
        id: 'system-alpha',
        enabled: true,
        contributes: {
          nav: [{ id: 'page', label: 'Alpha', route: '/alpha' }],
        },
      },
      {
        id: 'system-beta',
        enabled: true,
        contributes: {
          nav: [{ id: 'page', label: 'Beta', route: '/beta' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^alpha$/i }));
    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^beta$/i }));

    const alphaWindow = await screen.findByRole('region', { name: /^alpha$/i });
    const betaWindow = await screen.findByRole('region', { name: /^beta$/i });
    expect(alphaWindow.getAttribute('data-window-id')).toBe('route:system-alpha:page');
    expect(betaWindow.getAttribute('data-window-id')).toBe('route:system-beta:page');
    expect(within(alphaWindow).getByText('/alpha:windowed')).toBeTruthy();
    expect(within(betaWindow).getByText('/beta:windowed')).toBeTruthy();
  });

  it('cascades dense app launches without reusing window origins', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1680 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    mocks.extensions = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'].map((label) => ({
      id: `system-${label.toLowerCase()}`,
      enabled: true,
      contributes: {
        nav: [{ id: 'page', label, route: `/${label.toLowerCase()}` }],
      },
    }));

    const { container } = renderWindowedLayout();

    for (const label of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']) {
      fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }));
      await screen.findByRole('region', { name: new RegExp(`^${label}$`, 'i') });
    }

    const origins = Array.from(container.querySelectorAll<HTMLElement>('.wos-window')).map(
      (windowElement) => `${windowElement.style.left}:${windowElement.style.top}`,
    );

    expect(origins).toHaveLength(9);
    expect(new Set(origins).size).toBe(origins.length);
  });

  it('keeps densely cascaded app launches above the taskbar-safe gutter', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 960 });
    mocks.extensions = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map((label) => ({
      id: `system-${label.toLowerCase()}`,
      enabled: true,
      contributes: {
        nav: [{ id: 'page', label, route: `/${label.toLowerCase()}` }],
      },
    }));

    const { container } = renderWindowedLayout();

    for (const label of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta']) {
      fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }));
      await screen.findByRole('region', { name: new RegExp(`^${label}$`, 'i') });
    }

    const routeWindows = Array.from(container.querySelectorAll<HTMLElement>('.wos-window[data-window-id^="route:"]'));
    expect(routeWindows.length).toBeGreaterThanOrEqual(6);
    for (const windowElement of routeWindows) {
      expect(windowElement.style.width).toBe('1040px');
      expect(windowElement.style.height).toBe('650px');
      expect(Number.parseInt(windowElement.style.top, 10) + 650).toBeLessThanOrEqual(860);
    }
  });

  it('marks already-open desktop apps in the Start menu from the current window stack', async () => {
    mocks.tabs = [{ id: 'session-1', title: 'Planning thread', messageCount: 4 }];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'chat:session-1',
        kind: 'chat',
        title: 'Planning thread',
        route: '/conversations/session-1',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        archivedOnClose: true,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 120, y: 96, width: 760, height: 520 },
        minimized: false,
        focused: false,
        singleton: true,
      },
    ]);

    const { container } = renderWindowedLayout();
    await screen.findByRole('region', { name: /planning thread/i });

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const chatButton = within(startMenu).getByRole('button', { name: /^chat$/i });
    const routinesButton = within(startMenu).getByRole('button', { name: /^routines$/i });

    expect(chatButton.getAttribute('data-open')).toBe('true');
    expect(chatButton.getAttribute('data-focused')).toBe('true');
    expect(chatButton.querySelector('.wos-app-tile__count')?.textContent).toBe('2');
    expect(routinesButton.getAttribute('data-open')).toBe('true');
    expect(routinesButton.getAttribute('data-focused')).toBeNull();
    expect(routinesButton.querySelector('.wos-app-tile__count')).toBeNull();
    expect(container.querySelectorAll('.wos-start-menu__item[data-open="true"]')).toHaveLength(2);
  });

  it('reuses persisted route windows stored with legacy unqualified ids', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines/checkpoint',
        bounds: { x: 60, y: 48, width: 800, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    expect(await screen.findByText('/routines/checkpoint:windowed')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /start menu/i })).getByRole('button', { name: /^routines$/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('region', { name: /^routines$/i })).toHaveLength(1);
    });
    const routinesWindow = screen.getByRole('region', { name: /^routines$/i });
    expect(routinesWindow.getAttribute('data-window-id')).toBe('route:system-routines:routines');
    expect(within(routinesWindow).getByText('/routines:windowed')).toBeTruthy();
  });

  it('closes saved chat windows without archiving the underlying conversation', async () => {
    mocks.tabs = [{ id: 'session-1', title: 'Planning thread', messageCount: 4 }];
    seedWindowedWindows([
      {
        id: 'chat:session-1',
        kind: 'chat',
        title: 'Planning thread',
        route: '/conversations/session-1',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
        archivedOnClose: true,
      },
    ]);

    renderWindowedLayout();

    const chatWindow = await screen.findByRole('region', { name: /planning thread/i });
    fireEvent.click(within(chatWindow).getByRole('button', { name: /close planning thread/i }));

    expect(screen.queryByRole('region', { name: /planning thread/i })).toBeNull();
    expect(mocks.archiveSession).not.toHaveBeenCalled();
  });

  it('exposes the canonical top-level desktop apps without nested route duplicates', () => {
    mocks.extensions = [
      {
        id: 'system-skills',
        enabled: true,
        contributes: {
          nav: [{ id: 'skills-nav', label: 'Skills', route: '/skills' }],
          views: [{ id: 'skills-page', title: 'Skills', location: 'main', route: '/skills' }],
        },
      },
      {
        id: 'system-telemetry',
        enabled: true,
        contributes: {
          nav: [{ id: 'telemetry-nav', label: 'Diagnostics', route: '/telemetry' }],
          views: [{ id: 'telemetry-page', title: 'Diagnostics', location: 'main', route: '/telemetry' }],
        },
      },
      {
        id: 'system-prompt-assembly',
        enabled: true,
        contributes: {
          settingsComponent: {
            id: 'prompt-assembly',
            label: 'Prompt Assembly',
            sectionId: 'settings-prompt-assembly',
          },
        },
      },
      {
        id: 'system-routines',
        enabled: true,
        contributes: {
          nav: [{ id: 'routines-nav', label: 'Routines', route: '/routines' }],
          views: [{ id: 'routines-page', title: 'Routines', location: 'main', route: '/routines' }],
        },
      },
      {
        id: 'system-model-arena',
        enabled: true,
        contributes: {
          nav: [{ id: 'model-arena-nav', label: 'Model Arena', route: '/model-arena' }],
          views: [{ id: 'model-arena-page', title: 'Model Arena', location: 'main', route: '/model-arena' }],
        },
      },
      {
        id: 'system-extension-manager',
        enabled: true,
        contributes: {
          nav: [{ id: 'extensions-nav', label: 'App Manager', route: '/extensions' }],
          views: [{ id: 'extensions-page', title: 'App Manager', location: 'main', route: '/extensions' }],
        },
      },
      {
        id: 'system-dynamic-workflows',
        enabled: true,
        contributes: {
          nav: [{ id: 'workflows-nav', label: 'Workflows', route: '/workflows' }],
          views: [{ id: 'workflows-page', title: 'Workflows', location: 'main', route: '/workflows' }],
        },
      },
      {
        id: 'system-automations',
        enabled: true,
        contributes: {
          nav: [{ id: 'automations-nav', label: 'Automations', route: '/automations' }],
          views: [{ id: 'automations-page', title: 'Automations', location: 'main', route: '/automations' }],
        },
      },
      {
        id: 'system-gateways',
        enabled: true,
        contributes: {
          nav: [{ id: 'gateways-nav', label: 'Gateways', route: '/gateways' }],
          views: [{ id: 'gateways-page', title: 'Gateways', location: 'main', route: '/gateways' }],
        },
      },
      {
        id: 'system-model-gateway',
        enabled: true,
        contributes: {
          nav: [{ id: 'ai-gateway-nav', label: 'AI Gateway', route: '/ai-gateway' }],
          views: [{ id: 'ai-gateway-page', title: 'AI Gateway', location: 'main', route: '/ai-gateway' }],
        },
      },
      {
        id: 'system-settings',
        enabled: true,
        contributes: {
          nav: [{ id: 'settings-nav', label: 'Settings', route: '/settings' }],
          views: [
            { id: 'settings-page', title: 'Settings', location: 'main', route: '/settings' },
            { id: 'provider-settings', title: 'Provider settings', location: 'main', route: '/settings/providers' },
          ],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    const startMenu = screen.getByRole('dialog', { name: /start menu/i });
    const appButtons = within(startMenu)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim());

    expect(appButtons).toEqual([
      'Chat',
      'Automations',
      'Workflows',
      'Gateways',
      'AI Gateway',
      'Model Arena',
      'Routines',
      'App Manager',
      'Skills',
      'Diagnostics',
      'Settings',
    ]);

    for (const label of [
      'Chat',
      'Automations',
      'Workflows',
      'App Manager',
      'Gateways',
      'Model Arena',
      'Routines',
      'Skills',
      'Diagnostics',
      'Settings',
    ]) {
      expect(within(startMenu).getAllByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toHaveLength(1);
    }

    expect(within(startMenu).queryByRole('button', { name: /provider settings/i })).toBeNull();
    expect(within(startMenu).queryByRole('button', { name: /prompt assembly/i })).toBeNull();
  });

  it('does not promote nested main extension views into top-level desktop applications', () => {
    mocks.extensions = [
      {
        id: 'system-settings',
        enabled: true,
        contributes: {
          views: [
            { id: 'provider-settings', title: 'Provider settings', location: 'main', route: '/settings/providers' },
            { id: 'desktop-settings', title: 'Desktop settings', location: 'main', route: '/settings/desktop' },
          ],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    const startMenu = screen.getByRole('dialog', { name: /start menu/i });

    expect(within(startMenu).queryByRole('button', { name: /provider settings/i })).toBeNull();
    expect(within(startMenu).queryByRole('button', { name: /desktop settings/i })).toBeNull();
    expect(within(startMenu).getByRole('button', { name: /^settings$/i })).toBeTruthy();
  });

  it('opens matching route windows from desktop navigation events', async () => {
    renderWindowedLayout();

    fireEvent(
      window,
      new CustomEvent('neon-pilot-desktop-navigate', {
        detail: { route: '/settings/providers' },
      }),
    );

    const routeHosts = await screen.findAllByTestId('extension-route-host');
    expect(routeHosts.some((host) => host.textContent === '/settings/providers:windowed')).toBe(true);

    const settingsWindow = screen.getByRole('region', { name: /settings/i });
    expect(within(settingsWindow).getByText('/settings/providers:windowed')).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: /open windows/i })).getByRole('button', { name: /settings/i })).toBeTruthy();
  });

  it('uses canonical app-specific default bounds for launched route windows', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));

    const settingsWindow = await screen.findByRole('region', { name: /^settings$/i });
    expect(settingsWindow.getAttribute('style')).toContain('width: 940px');
    expect(settingsWindow.getAttribute('style')).toContain('height: 560px');
  });

  it('uses the canonical Workflows window target before desktop fitting clamps it', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 960 });
    mocks.extensions = [
      {
        id: 'system-workflows',
        enabled: true,
        contributes: {
          nav: [{ id: 'workflows', label: 'Workflows', route: '/workflows' }],
        },
      },
    ];

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /^workflows$/i }));

    const workflowsWindow = await screen.findByRole('region', { name: /^workflows$/i });
    expect(workflowsWindow.getAttribute('style')).toContain('width: 1040px');
    expect(workflowsWindow.getAttribute('style')).toContain('height: 612px');
  });

  it('keeps embedded extension navigation in the current window when it stays inside the same desktop app', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /routines/i }));

    const routinesWindow = await screen.findByRole('region', { name: /routines/i });
    fireEvent.click(within(routinesWindow).getByRole('button', { name: /navigate within extension app/i }));

    await waitFor(() => {
      expect(within(routinesWindow).getByText('/routines/checkpoint:windowed')).toBeTruthy();
    });
    expect(screen.getAllByRole('region', { name: /routines/i })).toHaveLength(1);
    expect(within(screen.getByRole('navigation', { name: /open windows/i })).getAllByRole('button', { name: /routines/i })).toHaveLength(1);
  });

  it('opens a matching desktop app window when embedded extension navigation crosses app boundaries', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /routines/i }));

    const routinesWindow = await screen.findByRole('region', { name: /routines/i });
    fireEvent.click(within(routinesWindow).getByRole('button', { name: /navigate to settings app/i }));

    const settingsWindow = await screen.findByRole('region', { name: /settings/i });
    expect(within(settingsWindow).getByText('/settings/providers:windowed')).toBeTruthy();
    expect(within(routinesWindow).getByText('/routines:windowed')).toBeTruthy();
    expect(routinesWindow.getAttribute('data-focused')).toBe('false');
    expect(settingsWindow.getAttribute('data-focused')).toBe('true');
    expect(within(screen.getByRole('navigation', { name: /open windows/i })).getByRole('button', { name: /settings/i })).toBeTruthy();
  });

  it('renders chat windows directly in the taskbar with desktop-fitted default bounds', () => {
    const { container } = renderWindowedLayout();

    expect(container.querySelector('.wos-taskbar__group')).toBeNull();

    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    expect(chatWindow.getAttribute('style')).toContain('width: 940px');
    expect(chatWindow.getAttribute('style')).toContain('height: 648px');
    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    expect(
      within(taskbar)
        .getByRole('button', { name: /new conversation/i })
        .getAttribute('data-focused'),
    ).toBe('true');
  });

  it('maximizes windows to the taskbar-safe desktop work area when layout measurement falls back', async () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /routines/i }));

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    fireEvent.click(within(routinesWindow).getByRole('button', { name: /maximize routines/i }));

    expect(routinesWindow.getAttribute('style')).toContain('left: 0px');
    expect(routinesWindow.getAttribute('style')).toContain('top: 0px');
    expect(routinesWindow.getAttribute('style')).toContain('width: 1024px');
    expect(routinesWindow.getAttribute('style')).toContain('height: 724px');
  });

  it('restores a maximized window to its original size when dragged from the titlebar', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);
    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    fireEvent.click(within(routinesWindow).getByRole('button', { name: /maximize routines/i }));
    expect(routinesWindow.getAttribute('style')).toContain('width: 1024px');
    expect(routinesWindow.getAttribute('style')).toContain('height: 724px');

    const titlebar = routinesWindow.querySelector<HTMLElement>('.wos-window__titlebar');
    expect(titlebar).toBeTruthy();

    fireEvent.mouseDown(titlebar!, { button: 0, clientX: 512, clientY: 18 });
    fireEvent.mouseMove(window, { clientX: 560, clientY: 80 });
    fireEvent.mouseUp(window, { clientX: 560, clientY: 80 });

    expect(routinesWindow.getAttribute('style')).toContain('left: 180px');
    expect(routinesWindow.getAttribute('style')).toContain('top: 62px');
    expect(routinesWindow.getAttribute('style')).toContain('width: 760px');
    expect(routinesWindow.getAttribute('style')).toContain('height: 520px');
    expect(within(routinesWindow).getByRole('button', { name: /maximize routines/i })).toBeTruthy();
  });

  it('fits newly opened app windows to the current desktop before first paint', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 820 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 620 });

    renderWindowedLayout();

    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    expect(chatWindow.getAttribute('style')).toContain('width: 736px');
    expect(chatWindow.getAttribute('style')).toContain('height: 500px');

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(screen.getByRole('button', { name: /routines/i }));

    const routinesWindow = await screen.findByRole('region', { name: /routines/i });
    expect(routinesWindow.getAttribute('style')).toContain('width: 736px');
    expect(routinesWindow.getAttribute('style')).toContain('height: 500px');
  });

  it('fits persisted window sizes to a narrower desktop during restore', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 620 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    seedWindowedWindows([
      {
        id: 'route:settings',
        kind: 'route',
        title: 'Settings',
        route: '/settings',
        bounds: { x: 180, y: 140, width: 980, height: 560 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const settingsWindow = await screen.findByRole('region', { name: /^settings$/i });
    await waitFor(() => {
      expect(settingsWindow.getAttribute('style')).toContain('width: 536px');
      expect(settingsWindow.getAttribute('style')).toContain('height: 560px');
      expect(settingsWindow.getAttribute('style')).toContain('left: 180px');
    });
  });

  it('resizes windows from the top-left corner while keeping partial offscreen movement recoverable', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    const resizeHandle = routinesWindow.querySelector<HTMLElement>('.wos-resize-nw');
    expect(resizeHandle).toBeTruthy();

    fireEvent.mouseDown(resizeHandle!, { button: 0, clientX: 42, clientY: 34 });
    fireEvent.mouseMove(window, { clientX: -120, clientY: -80 });
    fireEvent.mouseUp(window);

    expect(routinesWindow.getAttribute('style')).toContain('left: -120px');
    expect(routinesWindow.getAttribute('style')).toContain('top: -80px');
    expect(routinesWindow.getAttribute('style')).toContain('width: 862px');
    expect(routinesWindow.getAttribute('style')).toContain('height: 614px');
  });

  it('resizes from the titlebar top edge while keeping titlebar controls unobstructed', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    routinesWindow.getBoundingClientRect = () =>
      ({
        x: 42,
        y: 34,
        left: 42,
        top: 34,
        right: 742,
        bottom: 534,
        width: 700,
        height: 500,
        toJSON: () => ({}),
      }) as DOMRect;
    const titlebar = routinesWindow.querySelector<HTMLElement>('.wos-window__titlebar');
    expect(titlebar).toBeTruthy();

    fireEvent.mouseDown(titlebar!, { button: 0, clientX: 392, clientY: 36 });
    fireEvent.mouseMove(window, { clientX: 392, clientY: -80 });
    fireEvent.mouseUp(window);

    expect(routinesWindow.getAttribute('style')).toContain('left: 42px');
    expect(routinesWindow.getAttribute('style')).toContain('top: -82px');
    expect(routinesWindow.getAttribute('style')).toContain('width: 700px');
    expect(routinesWindow.getAttribute('style')).toContain('height: 616px');
    expect(within(routinesWindow).getByRole('button', { name: /close routines/i })).toBeTruthy();
  });

  it('does not start a top-right resize gesture from the close button hit area', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    const closeButton = within(routinesWindow).getByRole('button', { name: /close routines/i });
    const initialStyle = routinesWindow.getAttribute('style');

    fireEvent.mouseDown(closeButton, { button: 0, clientX: 736, clientY: 42 });
    fireEvent.mouseMove(window, { clientX: 790, clientY: -40 });
    fireEvent.mouseUp(window);

    expect(routinesWindow.getAttribute('style')).toBe(initialStyle);
  });

  it('does not start drag or resize gestures from the titlebar control cluster gap', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    const controls = routinesWindow.querySelector<HTMLElement>('.wos-window__controls');
    expect(controls).toBeTruthy();
    const initialStyle = routinesWindow.getAttribute('style');

    fireEvent.mouseDown(controls!, { button: 0, clientX: 706, clientY: 36 });
    fireEvent.mouseMove(window, { clientX: 790, clientY: -40 });
    fireEvent.mouseUp(window);

    expect(routinesWindow.getAttribute('style')).toBe(initialStyle);
  });

  it('resizes windows from the bottom-right corner using visible resize handles', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    const resizeHandle = routinesWindow.querySelector<HTMLElement>('.wos-resize-se');
    expect(resizeHandle).toBeTruthy();

    fireEvent.mouseDown(resizeHandle!, { button: 0, clientX: 742, clientY: 534 });
    fireEvent.mouseMove(window, { clientX: 920, clientY: 650 });
    fireEvent.mouseUp(window);

    expect(routinesWindow.getAttribute('style')).toContain('left: 42px');
    expect(routinesWindow.getAttribute('style')).toContain('top: 34px');
    expect(routinesWindow.getAttribute('style')).toContain('width: 878px');
    expect(routinesWindow.getAttribute('style')).toContain('height: 616px');
  });

  it('groups multiple open chat windows under a taskbar chat menu', async () => {
    mocks.tabs = [{ id: 'session-1', title: 'Planning thread', messageCount: 4 }];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'chat:session-1',
        kind: 'chat',
        title: 'Planning thread',
        route: '/conversations/session-1',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        archivedOnClose: true,
      },
    ]);

    const { container } = renderWindowedLayout();

    expect(await screen.findByRole('region', { name: /planning thread/i })).toBeTruthy();
    expect(container.querySelector('.wos-taskbar__group')).toBeTruthy();

    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    const chatGroupButton = within(taskbar).getByRole('button', { name: /chat \(2 windows\)/i });
    expect(chatGroupButton.getAttribute('data-focused')).toBe('true');
    expect(within(taskbar).queryByRole('button', { name: /planning thread/i })).toBeNull();
    expect(screen.queryByRole('menu', { name: /open chat windows/i })).toBeNull();

    fireEvent.click(chatGroupButton);

    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
    expect(screen.getByRole('region', { name: /planning thread/i }).getAttribute('data-focused')).toBe('false');

    const chatMenu = screen.getByRole('menu', { name: /open chat windows/i });
    expect(within(chatMenu).getByRole('menuitem', { name: /new conversation/i })).toBeTruthy();
    expect(within(chatMenu).getByRole('menuitem', { name: /planning thread/i })).toBeTruthy();

    fireEvent.click(within(chatMenu).getByRole('menuitem', { name: /planning thread/i }));

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /open chat windows/i })).toBeNull();
    });
    expect(screen.getByRole('region', { name: /planning thread/i }).getAttribute('data-focused')).toBe('true');
  });

  it('removes stale stored chat windows after conversations load', async () => {
    mocks.tabs = [{ id: 'session-1', title: 'Planning thread', messageCount: 4 }];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'Draft',
        route: '/conversations',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
        archivedOnClose: true,
      },
      {
        id: 'chat:session-1',
        kind: 'chat',
        title: 'Old planning title',
        route: '/conversations/old-session-1',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: false,
        archivedOnClose: false,
      },
      {
        id: 'chat:archived-session',
        kind: 'chat',
        title: 'Archived thread',
        route: '/conversations/archived-session',
        bounds: { x: 120, y: 100, width: 760, height: 520 },
        minimized: false,
        focused: true,
        archivedOnClose: true,
      },
    ]);

    renderWindowedLayout();

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /archived thread/i })).toBeNull();
    });

    const draftWindow = screen.getByRole('region', { name: /new conversation/i });
    const planningWindow = screen.getByRole('region', { name: /planning thread/i });
    expect(within(draftWindow).getByTestId('conversation-page').dataset.pathname).toBe('/conversations/new');
    expect(within(planningWindow).getByTestId('conversation-page').dataset.pathname).toBe('/conversations/session-1');
    expect(planningWindow.getAttribute('data-focused')).toBe('true');
  });

  it('drops stored child windows that no longer have a parent window', () => {
    seedWindowedWindows([
      {
        id: 'chat:missing:browser',
        kind: 'browser',
        title: 'Browser',
        route: '/conversations/missing',
        bounds: { x: 100, y: 80, width: 760, height: 520 },
        minimized: false,
        focused: true,
        parentWindowId: 'chat:missing',
        parentWindowTitle: 'Missing thread',
      },
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
        archivedOnClose: false,
      },
    ]);

    renderWindowedLayout();

    expect(screen.queryByRole('region', { name: /^browser$/i })).toBeNull();
    expect(screen.getByRole('region', { name: /new conversation/i })).toBeTruthy();
  });

  it('does not drop stored chat windows while the conversation list is still loading', () => {
    mocks.conversationsLoading = true;
    seedWindowedWindows([
      {
        id: 'chat:pending-session',
        kind: 'chat',
        title: 'Pending thread',
        route: '/conversations/pending-session',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        archivedOnClose: true,
      },
    ]);

    renderWindowedLayout();

    expect(screen.getByRole('region', { name: /pending thread/i })).toBeTruthy();
  });

  it('broadcasts browser suspension when window focus changes', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);
    const suspendListener = vi.fn();
    window.addEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, suspendListener);

    try {
      renderWindowedLayout();
      await screen.findByRole('region', { name: /routines/i });
      suspendListener.mockClear();

      fireEvent.pointerDown(screen.getByRole('region', { name: /new conversation/i }));

      await waitFor(() => {
        expect(suspendListener).toHaveBeenCalled();
      });
      const event = suspendListener.mock.calls.at(-1)?.[0] as CustomEvent<{ durationMs?: number }> | undefined;
      expect(event?.detail?.durationMs).toBeGreaterThanOrEqual(1500);
      expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
    } finally {
      window.removeEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, suspendListener);
    }
  });

  it('hides every stored native browser tab when window focus changes', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);
    window.localStorage.setItem(
      'pa:workbench-browser-tabs',
      JSON.stringify({
        version: 1,
        activeTabId: 'tab-a',
        tabs: [
          { id: 'tab-a', title: 'Docs', url: 'https://example.com', urlDraft: '' },
          { id: 'tab-b', title: 'Search', url: 'https://example.org', urlDraft: '' },
        ],
        closedTabs: [],
      }),
    );
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    window.neonPilotDesktop = { setWorkbenchBrowserBounds } as unknown as typeof window.neonPilotDesktop;

    renderWindowedLayout();
    await screen.findByRole('region', { name: /routines/i });
    setWorkbenchBrowserBounds.mockClear();

    fireEvent.pointerDown(screen.getByRole('region', { name: /new conversation/i }));

    await waitFor(() => {
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: null,
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: '@global:tab-tab-a',
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
        visible: false,
        sessionKey: '@global:tab-tab-b',
        deactivate: true,
        destroy: true,
        windowedShellActive: true,
      });
    });
  });

  it('keeps native browser views suppressed while a route window is focused', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);
    window.localStorage.setItem(
      'pa:workbench-browser-tabs',
      JSON.stringify({
        version: 1,
        activeTabId: 'tab-a',
        tabs: [{ id: 'tab-a', title: 'Docs', url: 'https://example.com', urlDraft: '' }],
        closedTabs: [],
      }),
    );
    const setWorkbenchBrowserBounds = vi.fn(async () => null);
    window.neonPilotDesktop = { setWorkbenchBrowserBounds } as unknown as typeof window.neonPilotDesktop;

    renderWindowedLayout();
    await screen.findByRole('region', { name: /routines/i });
    setWorkbenchBrowserBounds.mockClear();

    await waitFor(
      () => {
        expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
          visible: false,
          sessionKey: null,
          deactivate: true,
          destroy: true,
          windowedShellActive: true,
        });
        expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({
          visible: false,
          sessionKey: '@global:tab-tab-a',
          deactivate: true,
          destroy: true,
          windowedShellActive: true,
        });
      },
      { timeout: 750 },
    );
  });

  it('marks the shell as native-browser-blocked while non-chat windows own the foreground', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    const { container } = renderWindowedLayout();
    await screen.findByRole('region', { name: /routines/i });

    expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-native-browser-blocked')).toBe('true');
    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-iframe-blocked')).toBe('true');
    expect(screen.getByRole('region', { name: /routines/i }).getAttribute('data-iframe-blocked')).toBeNull();
  });

  it('keeps overlapped window contents mounted while browser-frame paint is blocked', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: false,
        singleton: true,
      },
    ]);

    const { container } = renderWindowedLayout();
    const shell = container.querySelector('.windowed-os-shell');

    expect(await screen.findByText('Conversation')).toBeTruthy();
    expect(await screen.findByText('/routines:windowed')).toBeTruthy();
    expect(shell?.getAttribute('data-frame-paint-blocked')).toBe('true');
    expect(within(screen.getByRole('region', { name: /new conversation/i })).getByTestId('conversation-page')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: /routines/i })).getByTestId('extension-route-host')).toBeTruthy();
  });

  it('publishes the single focused window id for native browser layering checks', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: false,
        singleton: true,
      },
    ]);

    const { container } = renderWindowedLayout();
    expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-focused-window-id')).toBe('chat:draft');

    fireEvent.pointerDown(await screen.findByRole('region', { name: /routines/i }));

    await waitFor(() => {
      expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-focused-window-id')).toBe('route:system-routines:routines');
    });
  });

  it('marks start menu chrome as a browser-blocking shell interaction', async () => {
    const { container } = renderWindowedLayout();
    const shell = container.querySelector('.windowed-os-shell');

    await waitFor(
      () => {
        expect(shell?.hasAttribute('data-window-interaction')).toBe(false);
      },
      { timeout: 1500 },
    );

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));

    expect(shell?.getAttribute('data-window-interaction')).toBe('true');
  });

  it('keeps native browser views suppressed when a higher window overlaps the focused chat', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: false,
        singleton: true,
      },
    ]);
    const { container } = renderWindowedLayout();
    const shell = container.querySelector('.windowed-os-shell');

    expect(shell?.getAttribute('data-window-interaction')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    });

    expect(shell?.getAttribute('data-window-interaction')).toBe('true');
  });

  it('keeps native browser views suppressed when a higher window overlaps a background chat', () => {
    seedWindowedWindows([
      {
        id: 'chat:background',
        kind: 'chat',
        title: 'Background conversation',
        route: '/conversations/background',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'chat:active',
        kind: 'chat',
        title: 'Active conversation',
        route: '/conversations/active',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
      },
    ]);
    const { container } = renderWindowedLayout();
    const shell = container.querySelector('.windowed-os-shell');

    expect(shell?.getAttribute('data-native-browser-blocked')).toBe('true');
    expect(shell?.getAttribute('data-window-interaction')).toBe('true');
  });

  it('keeps renderer iframe paint enabled when multiple windows are visible but not overlapping', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 620, height: 500 },
        minimized: false,
        focused: true,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 700, y: 70, width: 300, height: 360 },
        minimized: false,
        focused: false,
        singleton: true,
      },
    ]);

    const { container } = renderWindowedLayout();
    await screen.findByRole('region', { name: /routines/i });

    const shell = container.querySelector('.windowed-os-shell');
    expect(shell?.getAttribute('data-native-browser-blocked')).toBe('true');
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1300));
    });
    expect(shell?.getAttribute('data-window-interaction')).toBeNull();
    expect(shell?.getAttribute('data-frame-paint-blocked')).toBeNull();
    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-iframe-blocked')).toBeNull();
    expect(screen.getByRole('region', { name: /routines/i }).getAttribute('data-iframe-blocked')).toBeNull();
  });

  it('marks overlapping windows so embedded iframes cannot paint over the foreground stack', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: false,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    await screen.findByRole('region', { name: /routines/i });
    const chatWindow = document.querySelector<HTMLElement>('.wos-window[data-window-id="chat:draft"]');
    const routinesWindow = document.querySelector<HTMLElement>('.wos-window[data-window-id="route:system-routines:routines"]');
    expect(chatWindow).toBeTruthy();
    expect(routinesWindow).toBeTruthy();
    expect(chatWindow!.getAttribute('data-iframe-blocked')).toBe('true');
    expect(routinesWindow!.getAttribute('data-iframe-blocked')).toBeNull();
  });

  it('keeps window stacks browser-blocking while multiple windows are visible', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: false,
        singleton: true,
      },
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
    ]);
    const { container } = renderWindowedLayout();
    const shell = container.querySelector('.windowed-os-shell');

    expect(shell?.getAttribute('data-window-interaction')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    });

    expect(shell?.getAttribute('data-window-interaction')).toBe('true');

    fireEvent.pointerDown(await screen.findByRole('region', { name: /routines/i }));

    expect(shell?.getAttribute('data-window-interaction')).toBe('true');
  });

  it('blocks embedded iframe paint when any route window is dragged beyond the desktop edge', async () => {
    seedWindowedWindows([
      {
        id: 'route:system-routines:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: -72, y: 58, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);
    const { container } = renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /routines/i });
    const shell = container.querySelector('.windowed-os-shell');

    expect(shell?.getAttribute('data-frame-paint-blocked')).toBe('true');
    expect(shell?.getAttribute('data-window-interaction')).toBe('true');
    expect(routinesWindow.getAttribute('data-iframe-blocked')).toBeNull();
  });

  it('does not auto-create taskbar windows for every known chat session', () => {
    mocks.tabs = [
      { id: 'session-1', title: 'Planning thread', messageCount: 4 },
      { id: 'session-2', title: 'Follow-up thread', messageCount: 2 },
    ];

    renderWindowedLayout();

    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    expect(within(taskbar).getByRole('button', { name: /new conversation/i })).toBeTruthy();
    expect(within(taskbar).queryByText('Planning thread')).toBeNull();
    expect(within(taskbar).queryByText('Follow-up thread')).toBeNull();
  });

  it('opens existing chat sessions as focused taskbar windows from desktop navigation events', async () => {
    mocks.tabs = [
      { id: 'session-1', title: 'Planning thread', messageCount: 4 },
      { id: 'session-2', title: 'Follow-up thread', messageCount: 2 },
    ];

    renderWindowedLayout();

    fireEvent(
      window,
      new CustomEvent('neon-pilot-desktop-navigate', {
        detail: { route: '/conversations/session-1' },
      }),
    );

    const planningWindow = await screen.findByRole('region', { name: /planning thread/i });
    expect(planningWindow.getAttribute('data-focused')).toBe('true');
    expect(planningWindow.querySelector('.wos-window__titlebar')?.getAttribute('data-accent')).toBe('chat');
    expect(within(planningWindow).getByTestId('embedded-layout')).toBeTruthy();

    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    const chatGroupButton = within(taskbar).getByRole('button', { name: /chat \(2 windows\)/i });
    expect(chatGroupButton.getAttribute('data-focused')).toBe('true');

    const suspendListener = vi.fn();
    window.addEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, suspendListener);
    try {
      fireEvent.click(chatGroupButton);

      const chatMenu = screen.getByRole('menu', { name: /open chat windows/i });
      expect(within(chatMenu).getByRole('menuitem', { name: /planning thread/i })).toBeTruthy();
      expect(within(chatMenu).getByRole('menuitem', { name: /^new conversation$/i })).toBeTruthy();
      expect(within(chatMenu).queryByText('Focused')).toBeNull();
      expect(suspendListener).toHaveBeenCalled();
      const event = suspendListener.mock.calls.at(-1)?.[0] as CustomEvent<{ durationMs?: number }> | undefined;
      expect(event?.detail?.durationMs).toBeGreaterThanOrEqual(1500);
    } finally {
      window.removeEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, suspendListener);
    }
  });

  it('marks minimized chat windows in the grouped taskbar menu', async () => {
    mocks.tabs = [
      { id: 'session-1', title: 'Planning thread', messageCount: 4 },
      { id: 'session-2', title: 'Review thread', messageCount: 2 },
    ];
    seedWindowedWindows([
      {
        id: 'chat:session-1',
        kind: 'chat',
        title: 'Planning thread',
        route: '/conversations/session-1',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: true,
        focused: false,
        archivedOnClose: true,
      },
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
      },
      {
        id: 'chat:session-2',
        kind: 'chat',
        title: 'Review thread',
        route: '/conversations/session-2',
        bounds: { x: 124, y: 104, width: 760, height: 520 },
        minimized: false,
        focused: false,
        archivedOnClose: true,
      },
    ]);

    renderWindowedLayout();

    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    fireEvent.click(within(taskbar).getByRole('button', { name: /chat \(3 windows\)/i }));

    const chatMenu = await screen.findByRole('menu', { name: /open chat windows/i });
    expect(within(chatMenu).getByRole('menuitem', { name: /^review thread$/i })).toBeTruthy();
    expect(within(chatMenu).queryByText('Focused')).toBeNull();
    expect(within(chatMenu).getByRole('menuitem', { name: /planning thread minimized/i })).toBeTruthy();
  });

  it('keeps embedded chat navigation scoped to the window route', async () => {
    mocks.tabs = [
      { id: 'session-1', title: 'Planning thread', messageCount: 4 },
      { id: 'session-2', title: 'Review thread', messageCount: 2 },
    ];
    window.history.replaceState(null, '', '/settings/providers');

    renderWindowedLayout();

    fireEvent(
      window,
      new CustomEvent('neon-pilot-desktop-navigate', {
        detail: { route: '/conversations/session-1' },
      }),
    );

    const planningWindow = await screen.findByRole('region', { name: /planning thread/i });
    expect(within(planningWindow).getByTestId('conversation-page').dataset.pathname).toBe('/conversations/session-1');

    fireEvent.click(within(planningWindow).getByRole('button', { name: /navigate inside window/i }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /review thread/i }).getAttribute('data-focused')).toBe('true');
    });
    expect(window.location.pathname).toBe('/settings/providers');
    expect(screen.queryByRole('region', { name: /planning thread/i })).toBeNull();
    expect(within(screen.getByRole('region', { name: /review thread/i })).getByTestId('conversation-page').dataset.pathname).toBe(
      '/conversations/session-2',
    );
  });

  it('consumes handled desktop navigation events before embedded stable listeners see them', async () => {
    mocks.tabs = [{ id: 'session-1', title: 'Planning thread', messageCount: 4 }];
    const earlierBubbleListener = vi.fn();
    const laterBubbleListener = vi.fn();

    window.addEventListener('neon-pilot-desktop-navigate', earlierBubbleListener);
    renderWindowedLayout();
    window.addEventListener('neon-pilot-desktop-navigate', laterBubbleListener);

    const event = new CustomEvent('neon-pilot-desktop-navigate', {
      cancelable: true,
      detail: { route: '/conversations/session-1' },
    });

    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(await screen.findByRole('region', { name: /planning thread/i })).toBeTruthy();
    expect(earlierBubbleListener).not.toHaveBeenCalled();
    expect(laterBubbleListener).not.toHaveBeenCalled();

    window.removeEventListener('neon-pilot-desktop-navigate', earlierBubbleListener);
    window.removeEventListener('neon-pilot-desktop-navigate', laterBubbleListener);
  });

  it('consumes unknown desktop navigation events before the embedded stable layout can move the outer route', () => {
    window.history.replaceState(null, '', '/settings/providers');
    const laterBubbleListener = vi.fn();

    renderWindowedLayout();
    window.addEventListener('neon-pilot-desktop-navigate', laterBubbleListener);

    const event = new CustomEvent('neon-pilot-desktop-navigate', {
      cancelable: true,
      detail: { route: '/unknown-windowed-route' },
    });

    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).toBe('/settings/providers');
    expect(laterBubbleListener).not.toHaveBeenCalled();
    expect(screen.queryByText('/unknown-windowed-route:windowed')).toBeNull();

    window.removeEventListener('neon-pilot-desktop-navigate', laterBubbleListener);
  });

  it('marks draft chat navigation events as handled', () => {
    renderWindowedLayout();

    const event = new CustomEvent('neon-pilot-desktop-navigate', {
      cancelable: true,
      detail: { route: '/conversations/new' },
    });

    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getAllByRole('region', { name: /new conversation/i })).toHaveLength(1);
    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
  });

  it('reuses the draft chat window for new-conversation navigation events', () => {
    renderWindowedLayout();

    fireEvent(
      window,
      new CustomEvent('neon-pilot-desktop-navigate', {
        detail: { route: '/conversations/session-1' },
      }),
    );

    fireEvent(
      window,
      new CustomEvent('neon-pilot-desktop-navigate', {
        detail: { route: '/conversations/new' },
      }),
    );

    expect(screen.getAllByRole('region', { name: /new conversation/i })).toHaveLength(1);
    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
  });

  it('prunes persisted route windows when their app is no longer available', async () => {
    seedWindowedWindows([
      {
        id: 'route:legacy-tool',
        kind: 'route',
        title: 'Legacy Tool',
        route: '/legacy-tool',
        bounds: { x: 60, y: 48, width: 800, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    await waitFor(() => expect(screen.queryByText('/legacy-tool:windowed')).toBeNull());
    expect(screen.queryByRole('region', { name: /legacy tool/i })).toBeNull();
    expect(await screen.findByTestId('embedded-layout')).toBeTruthy();
    expect(screen.getByRole('region', { name: /new conversation/i })).toBeTruthy();
  });

  it('keeps persisted nested route windows under the canonical parent app window', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines-detail',
        kind: 'route',
        title: 'Routines detail',
        route: '/routines/checkpoint',
        bounds: { x: 60, y: 48, width: 800, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/routines/checkpoint:windowed');
    const routinesWindow = screen.getByRole('region', { name: /^routines$/i });
    expect(routinesWindow.getAttribute('data-window-id')).toBe('route:system-routines:routines');
    expect(within(screen.getByRole('navigation', { name: /open windows/i })).getByRole('button', { name: /^routines$/i })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /routines detail/i })).toBeNull();
  });

  it('deduplicates persisted route windows that belong to the same desktop app', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 60, y: 48, width: 800, height: 500 },
        minimized: false,
        focused: false,
        singleton: true,
      },
      {
        id: 'route:routines-detail',
        kind: 'route',
        title: 'Routines detail',
        route: '/routines/checkpoint',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    await screen.findByText('/routines/checkpoint:windowed');

    expect(screen.getAllByRole('region', { name: /^routines$/i })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: /routines detail/i })).toBeNull();
    expect(within(screen.getByRole('navigation', { name: /open windows/i })).getAllByRole('button', { name: /^routines$/i })).toHaveLength(
      1,
    );
  });

  it('recovers persisted windows that load outside the current desktop bounds', async () => {
    seedWindowedWindows([
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 5000, y: -5000, width: 720, height: 420 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /routines/i });
    await waitFor(() => {
      expect(routinesWindow.getAttribute('style')).toContain('left: 928px');
      expect(routinesWindow.getAttribute('style')).toContain('top: -386px');
    });
  });

  it('does not prune persisted extension route windows while the registry is loading', async () => {
    mocks.registryLoading = true;
    seedWindowedWindows([
      {
        id: 'route:workflows',
        kind: 'route',
        title: 'Workflows',
        route: '/workflows',
        bounds: { x: 60, y: 48, width: 800, height: 500 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routeHost = await screen.findByTestId('extension-route-host');
    expect(routeHost.textContent).toBe('/workflows:windowed');
    expect(screen.getByRole('region', { name: /workflows/i })).toBeTruthy();
  });

  it('focuses the next visible window when the focused route window is minimized', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    const { container } = renderWindowedLayout();

    expect(await screen.findByText('/routines:windowed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /minimize routines/i }));

    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
    expect(screen.queryByRole('region', { name: /routines/i })).toBeNull();
    const minimizedWindow = Array.from(container.querySelectorAll<HTMLElement>('.wos-window[data-minimized="true"]')).find(
      (windowElement) => windowElement.textContent?.includes('/routines:windowed'),
    );
    expect(minimizedWindow).not.toBeNull();
    expect(minimizedWindow?.getAttribute('data-minimized')).toBe('true');
    expect(minimizedWindow?.getAttribute('aria-hidden')).toBe('true');
    expect(minimizedWindow?.style.display).toBe('none');
    expect(minimizedWindow?.querySelector('[data-testid="extension-route-host"]')?.textContent).toBe('/routines:windowed');
    expect(screen.getByRole('button', { name: /routines/i }).getAttribute('data-minimized')).toBe('true');
  });

  it('emits parent lifecycle events when chat windows are minimized or closed', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: true,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: false,
        singleton: true,
      },
    ]);
    const lifecycleEvents: WindowedParentWindowLifecycleDetail[] = [];
    const handleLifecycle = (event: Event) => {
      lifecycleEvents.push((event as CustomEvent<WindowedParentWindowLifecycleDetail>).detail);
    };
    window.addEventListener(WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT, handleLifecycle);

    try {
      renderWindowedLayout();

      fireEvent.click(screen.getByRole('button', { name: /minimize new conversation/i }));
      expect(lifecycleEvents).toContainEqual({
        parentWindowId: 'chat:draft',
        parentWindowKind: 'chat',
        parentWindowTitle: 'New conversation',
        reason: 'minimized',
      });

      fireEvent.click(screen.getByRole('button', { name: /new conversation/i }));
      expect(lifecycleEvents).toContainEqual({
        parentWindowId: 'chat:draft',
        parentWindowKind: 'chat',
        parentWindowTitle: 'New conversation',
        reason: 'restored',
      });

      fireEvent.click(screen.getByRole('button', { name: /close new conversation/i }));
      expect(lifecycleEvents).toContainEqual({
        parentWindowId: 'chat:draft',
        parentWindowKind: 'chat',
        parentWindowTitle: 'New conversation',
        reason: 'closed',
      });
    } finally {
      window.removeEventListener(WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT, handleLifecycle);
    }
  });

  it('opens a terminal child window from chat and attaches it to the parent lifecycle', async () => {
    mocks.surfaces = [
      {
        extensionId: 'system-terminal',
        id: 'terminal-panel',
        title: 'Terminal',
        location: 'rightRail',
        component: 'TerminalPanel',
        toolSlot: 'terminal',
      },
    ];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: true,
      },
    ]);

    const { container } = renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /terminal window/i }));

    const chatWindow = container.querySelector<HTMLElement>('[data-window-id="chat:draft"]');
    const terminalWindow = screen.getByRole('region', { name: 'Terminal' });
    expect(terminalWindow.getAttribute('data-window-id')).toBe('chat:draft:terminal');
    expect(terminalWindow.getAttribute('data-parent-window-attached')).toBe('true');
    expect(terminalWindow.getAttribute('data-parent-window-id')).toBe('chat:draft');
    expect(terminalWindow.getAttribute('data-parent-window-title')).toBe('New conversation');
    expect(terminalWindow.className).toContain('wos-window--terminal');
    expect(terminalWindow.querySelector('.wos-window__titlebar')?.getAttribute('data-accent')).toBe('chat');
    expect(terminalWindow.closest('[data-window-id="chat:draft"]')).toBeNull();
    expect(chatWindow?.compareDocumentPosition(terminalWindow) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(chatWindow?.querySelector('.wos-window-route-body--chat')?.getAttribute('data-workbench-collapsed')).toBe('true');

    const terminalBody = terminalWindow.querySelector('[data-windowed-subwindow="terminal"]');
    expect(terminalBody?.getAttribute('data-parent-window-id')).toBe('chat:draft');
    expect(terminalBody?.getAttribute('data-parent-window-title')).toBe('New conversation');
    const terminalTaskbarButton = within(screen.getByRole('navigation', { name: /open windows/i })).getByRole('button', {
      name: /^terminal$/i,
    });
    expect(terminalTaskbarButton.querySelector('.wos-app-tile')?.getAttribute('data-accent')).toBe('chat');
    expect(terminalTaskbarButton.getAttribute('title')).toBe('Terminal attached to New conversation');
    expect(terminalTaskbarButton.querySelector('.wos-app-tile__meta')?.textContent).toBe('New conversation');
    expect(terminalTaskbarButton.querySelector('.wos-app-tile__meta')?.getAttribute('aria-hidden')).toBe('true');

    const terminalHost = screen.getByTestId('native-extension-surface');
    expect(terminalHost.getAttribute('data-extension-id')).toBe('system-terminal');
    expect(terminalHost.getAttribute('data-surface-id')).toBe('terminal-panel');
    expect(terminalHost.getAttribute('data-shell-presentation')).toBe('windowed');
    expect(terminalHost.getAttribute('data-instance-id')).toBe('chat:draft:terminal');

    fireEvent.click(screen.getByRole('button', { name: /minimize new conversation/i }));
    expect(chatWindow?.getAttribute('data-minimized')).toBe('true');
    expect(terminalWindow.getAttribute('data-minimized')).toBe('true');
    expect((terminalWindow as HTMLElement).style.display).toBe('none');

    fireEvent.click(screen.getByRole('button', { name: /new conversation/i }));
    expect(chatWindow?.getAttribute('data-minimized')).toBeNull();
    expect(terminalWindow.getAttribute('data-minimized')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close new conversation/i }));
    expect(screen.queryByRole('region', { name: 'Terminal' })).toBeNull();
  });

  it('opens a workspace child window from chat with the parent workspace cwd', async () => {
    mocks.surfaces = [
      {
        extensionId: 'system-files',
        id: 'files-panel',
        title: 'Files',
        location: 'rightRail',
        component: 'WorkspaceFilesPanel',
        toolSlot: 'files',
      },
    ];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: true,
        workspaceCwd: '/Users/patrick/workingdir/neon-pilot',
      },
    ]);

    const { container } = renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /files window/i }));

    const chatWindow = container.querySelector<HTMLElement>('[data-window-id="chat:draft"]');
    const workspaceWindow = screen.getByRole('region', { name: 'Files' });
    expect(workspaceWindow.getAttribute('data-window-id')).toBe('chat:draft:files');
    expect(workspaceWindow.getAttribute('data-parent-window-attached')).toBe('true');
    expect(workspaceWindow.getAttribute('data-parent-window-id')).toBe('chat:draft');
    expect(workspaceWindow.getAttribute('data-parent-window-title')).toBe('New conversation');
    expect(workspaceWindow.className).toContain('wos-window--files');
    expect(workspaceWindow.querySelector('.wos-window__titlebar')?.getAttribute('data-accent')).toBe('chat');
    expect(chatWindow?.querySelector('.wos-window-route-body--chat')?.getAttribute('data-workbench-collapsed')).toBe('true');

    const workspaceBody = workspaceWindow.querySelector('[data-windowed-subwindow="files"]');
    expect(workspaceBody?.getAttribute('data-parent-window-id')).toBe('chat:draft');
    expect(workspaceBody?.getAttribute('data-parent-window-title')).toBe('New conversation');
    const workspaceTaskbarButton = within(screen.getByRole('navigation', { name: /open windows/i })).getByRole('button', {
      name: /^files$/i,
    });
    expect(workspaceTaskbarButton.querySelector('.wos-app-tile')?.getAttribute('data-accent')).toBe('chat');

    const workspaceHost = screen.getByTestId('native-extension-surface');
    expect(workspaceHost.getAttribute('data-extension-id')).toBe('system-files');
    expect(workspaceHost.getAttribute('data-surface-id')).toBe('files-panel');
    expect(workspaceHost.getAttribute('data-shell-presentation')).toBe('windowed');
    expect(workspaceHost.getAttribute('data-instance-id')).toBe('chat:draft:files');
    expect(workspaceHost.getAttribute('data-cwd')).toBe('/Users/patrick/workingdir/neon-pilot');

    fireEvent.click(screen.getByRole('button', { name: /minimize new conversation/i }));
    expect(workspaceWindow.getAttribute('data-minimized')).toBe('true');
    expect((workspaceWindow as HTMLElement).style.display).toBe('none');

    fireEvent.click(screen.getByRole('button', { name: /new conversation/i }));
    expect(workspaceWindow.getAttribute('data-minimized')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close new conversation/i }));
    expect(screen.queryByRole('region', { name: 'Files' })).toBeNull();
  });

  it('retargets chat child windows when a draft chat navigates into a saved conversation', async () => {
    mocks.tabs = [{ id: 'session-2', title: 'Saved planning thread', messageCount: 1 }];
    mocks.surfaces = [
      {
        extensionId: 'system-terminal',
        id: 'terminal-panel',
        title: 'Terminal',
        location: 'rightRail',
        component: 'TerminalPanel',
        toolSlot: 'terminal',
      },
    ];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: true,
      },
    ]);

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /terminal window/i }));
    expect(screen.getByRole('region', { name: 'Terminal' }).getAttribute('data-window-id')).toBe('chat:draft:terminal');

    fireEvent.click(screen.getByRole('button', { name: /navigate inside window/i }));

    const terminalWindow = screen.getByRole('region', { name: 'Terminal' });
    expect(screen.queryByRole('region', { name: /new conversation/i })).toBeNull();
    expect(screen.getByRole('region', { name: /saved planning thread/i })).toBeTruthy();
    expect(terminalWindow.getAttribute('data-window-id')).toBe('chat:session-2:terminal');
    expect(terminalWindow.getAttribute('data-parent-window-id')).toBe('chat:session-2');
    expect(terminalWindow.getAttribute('data-parent-window-title')).toBe('Saved planning thread');
    expect(terminalWindow.querySelector('[data-windowed-subwindow="terminal"]')?.getAttribute('data-parent-window-id')).toBe(
      'chat:session-2',
    );
    expect(screen.getByTestId('native-extension-surface').getAttribute('data-instance-id')).toBe('chat:session-2:terminal');
  });

  it.each([
    ['browser' as const, 'Browser'],
    ['files' as const, 'Files'],
  ])('retargets %s child windows when a draft chat navigates into a saved conversation', async (kind, title) => {
    mocks.tabs = [{ id: 'session-2', title: 'Saved planning thread', messageCount: 1, workspaceCwd: '/Users/patrick/project' }];
    mocks.surfaces = [surfaceForChildTool(kind)];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: true,
        workspaceCwd: '/Users/patrick/draft',
      },
    ]);

    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${kind} window`, 'i') }));
    expect(screen.getByRole('region', { name: title }).getAttribute('data-window-id')).toBe(`chat:draft:${kind}`);

    fireEvent.click(screen.getByRole('button', { name: /navigate inside window/i }));

    const childWindow = screen.getByRole('region', { name: title });
    expect(screen.queryByRole('region', { name: /new conversation/i })).toBeNull();
    expect(screen.getByRole('region', { name: /saved planning thread/i })).toBeTruthy();
    expect(childWindow.getAttribute('data-window-id')).toBe(`chat:session-2:${kind}`);
    expect(childWindow.getAttribute('data-parent-window-id')).toBe('chat:session-2');
    expect(childWindow.getAttribute('data-parent-window-title')).toBe('Saved planning thread');
    expect(childWindow.querySelector(`[data-windowed-subwindow="${kind}"]`)?.getAttribute('data-parent-window-id')).toBe('chat:session-2');
    expect(screen.getByTestId('native-extension-surface').getAttribute('data-instance-id')).toBe(`chat:session-2:${kind}`);
    if (kind === 'files') {
      expect(screen.getByTestId('native-extension-surface').getAttribute('data-cwd')).toBe('/Users/patrick/project');
    }
  });

  it('keeps independently minimized child windows minimized when a parent chat restores', async () => {
    mocks.surfaces = [
      {
        extensionId: 'system-terminal',
        id: 'terminal-panel',
        title: 'Terminal',
        location: 'rightRail',
        component: 'TerminalPanel',
        toolSlot: 'terminal',
      },
    ];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: true,
      },
    ]);

    const { container } = renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /terminal window/i }));
    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    const terminalTaskbarButton = within(taskbar).getByRole('button', { name: /^terminal$/i });
    fireEvent.click(terminalTaskbarButton);
    expect(terminalTaskbarButton.getAttribute('data-minimized')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /minimize new conversation/i }));
    fireEvent.click(screen.getByRole('button', { name: /new conversation/i }));

    expect(container.querySelector('[data-window-id="chat:draft"]')?.getAttribute('data-minimized')).toBeNull();
    expect(container.querySelector('[data-window-id="chat:draft:terminal"]')?.getAttribute('data-minimized')).toBe('true');
    expect(terminalTaskbarButton.getAttribute('data-minimized')).toBe('true');
  });

  it('opens a browser child window from chat and attaches it to the parent lifecycle', async () => {
    mocks.surfaces = [
      {
        extensionId: 'system-browser',
        id: 'browser-tabs',
        title: 'Browser',
        location: 'rightRail',
        component: 'BrowserTabsPanel',
        toolSlot: 'browser',
      },
      {
        extensionId: 'system-browser',
        id: 'browser-workbench',
        title: 'Browser',
        location: 'workbench',
        component: 'BrowserWorkbenchPanel',
      },
    ];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: true,
      },
    ]);

    const { container } = renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /browser window/i }));

    const chatWindow = container.querySelector<HTMLElement>('[data-window-id="chat:draft"]');
    const browserWindow = screen.getByRole('region', { name: 'Browser' });
    const shell = container.querySelector('.windowed-os-shell');
    expect(browserWindow.getAttribute('data-window-id')).toBe('chat:draft:browser');
    expect(browserWindow.getAttribute('data-parent-window-attached')).toBe('true');
    expect(browserWindow.getAttribute('data-parent-window-id')).toBe('chat:draft');
    expect(browserWindow.getAttribute('data-parent-window-title')).toBe('New conversation');
    expect(browserWindow.className).toContain('wos-window--browser');
    expect(browserWindow.getAttribute('data-focused')).toBe('true');
    expect(chatWindow?.getAttribute('data-focused')).toBe('false');
    expect(shell?.getAttribute('data-focused-window-id')).toBe('chat:draft:browser');
    expect(shell?.getAttribute('data-native-browser-blocked')).toBe('true');
    expect(shell?.getAttribute('data-frame-paint-blocked')).toBe('true');
    expect(chatWindow?.querySelector('.wos-window-route-body--chat')?.getAttribute('data-workbench-collapsed')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1250));
    });

    expect(shell?.getAttribute('data-native-browser-blocked')).toBeNull();
    expect(shell?.getAttribute('data-frame-paint-blocked')).toBeNull();
    expect(browserWindow.closest('[data-window-id="chat:draft"]')).toBeNull();
    expect(chatWindow?.compareDocumentPosition(browserWindow) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const browserBody = browserWindow.querySelector('[data-windowed-subwindow="browser"]');
    expect(browserBody?.getAttribute('data-parent-window-id')).toBe('chat:draft');
    expect(browserBody?.getAttribute('data-parent-window-title')).toBe('New conversation');
    const browserTaskbarButton = within(screen.getByRole('navigation', { name: /open windows/i })).getByRole('button', {
      name: /^browser$/i,
    });
    expect(browserTaskbarButton.querySelector('.wos-app-tile')?.getAttribute('data-accent')).toBe('chat');
    expect(browserTaskbarButton.getAttribute('title')).toBe('Browser attached to New conversation');
    expect(browserTaskbarButton.querySelector('.wos-app-tile__meta')?.textContent).toBe('New conversation');
    expect(browserTaskbarButton.querySelector('.wos-app-tile__meta')?.getAttribute('aria-hidden')).toBe('true');

    const browserHost = screen.getByTestId('native-extension-surface');
    expect(browserHost.getAttribute('data-extension-id')).toBe('system-browser');
    expect(browserHost.getAttribute('data-surface-id')).toBe('browser-workbench');
    expect(browserHost.getAttribute('data-shell-presentation')).toBe('windowed');
    expect(browserHost.getAttribute('data-instance-id')).toBe('chat:draft:browser');

    fireEvent.click(screen.getByRole('button', { name: /minimize new conversation/i }));
    expect(chatWindow?.getAttribute('data-minimized')).toBe('true');
    expect(browserWindow.getAttribute('data-minimized')).toBe('true');
    expect((browserWindow as HTMLElement).style.display).toBe('none');

    fireEvent.click(screen.getByRole('button', { name: /new conversation/i }));
    expect(chatWindow?.getAttribute('data-minimized')).toBeNull();
    expect(browserWindow.getAttribute('data-minimized')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close new conversation/i }));
    expect(screen.queryByRole('region', { name: 'Browser' })).toBeNull();
  });

  it.each([
    ['browser' as const, 'Browser'],
    ['files' as const, 'Files'],
    ['terminal' as const, 'Terminal'],
  ])('restores a persisted %s child window with parent lifecycle metadata', async (kind, title) => {
    mocks.tabs = [{ id: 'session-2', title: 'Saved planning thread', messageCount: 1, workspaceCwd: '/Users/patrick/project' }];
    mocks.surfaces = [surfaceForChildTool(kind)];
    seedWindowedWindows([
      {
        id: 'chat:session-2',
        kind: 'chat',
        title: 'Saved planning thread',
        route: '/conversations/session-2',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: false,
        workspaceCwd: '/Users/patrick/project',
      },
      {
        id: `chat:session-2:${kind}`,
        kind,
        title,
        route: '/conversations/session-2',
        bounds: { x: 154, y: 96, width: 680, height: 420 },
        minimized: false,
        focused: true,
        workspaceCwd: '/Users/patrick/project',
        parentWindowId: 'chat:session-2',
        parentWindowTitle: 'Saved planning thread',
      },
    ]);

    const { container } = renderWindowedLayout();

    const childWindow = screen.getByRole('region', { name: title });
    const chatWindow = container.querySelector<HTMLElement>('[data-window-id="chat:session-2"]');
    const childBody = childWindow.querySelector(`[data-windowed-subwindow="${kind}"]`);
    const taskbarButton = within(screen.getByRole('navigation', { name: /open windows/i })).getByRole('button', {
      name: new RegExp(`^${title}$`, 'i'),
    });
    const host = screen.getByTestId('native-extension-surface');

    expect(childWindow.getAttribute('data-window-id')).toBe(`chat:session-2:${kind}`);
    expect(childWindow.getAttribute('data-parent-window-attached')).toBe('true');
    expect(childWindow.getAttribute('data-parent-window-id')).toBe('chat:session-2');
    expect(childWindow.getAttribute('data-parent-window-title')).toBe('Saved planning thread');
    expect(childWindow.getAttribute('data-focused')).toBe('true');
    expect(chatWindow?.getAttribute('data-focused')).toBe('false');
    expect(childBody?.getAttribute('data-parent-window-id')).toBe('chat:session-2');
    expect(childBody?.getAttribute('data-parent-window-title')).toBe('Saved planning thread');
    expect(taskbarButton.getAttribute('title')).toBe(`${title} attached to Saved planning thread`);
    expect(taskbarButton.querySelector('.wos-app-tile__meta')?.textContent).toBe('Saved planning thread');
    expect(host.getAttribute('data-extension-id')).toBe(
      kind === 'browser' ? 'system-browser' : kind === 'files' ? 'system-files' : 'system-terminal',
    );
    expect(host.getAttribute('data-instance-id')).toBe(`chat:session-2:${kind}`);
    if (kind !== 'browser') {
      expect(host.getAttribute('data-cwd')).toBe('/Users/patrick/project');
    }

    fireEvent.click(screen.getByRole('button', { name: /minimize saved planning thread/i }));
    expect(childWindow.getAttribute('data-minimized')).toBe('true');
    expect((childWindow as HTMLElement).style.display).toBe('none');
    expect(childWindow.getAttribute('data-focused')).toBe('false');
    expect(chatWindow?.getAttribute('data-focused')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /saved planning thread/i }));
    expect(childWindow.getAttribute('data-minimized')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close saved planning thread/i }));
    expect(screen.queryByRole('region', { name: title })).toBeNull();
  });

  it('disables the browser child window action when the browser surface is unavailable', () => {
    mocks.surfaces = [];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: true,
      },
    ]);

    const { container } = renderWindowedLayout();
    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    const browserButton = within(chatWindow).getByRole('button', { name: /browser window/i }) as HTMLButtonElement;

    expect(browserButton.disabled).toBe(true);
    expect(browserButton.getAttribute('title')).toContain('Enable the Browser');
    fireEvent.click(browserButton);

    expect(screen.queryByRole('region', { name: 'Browser' })).toBeNull();
    expect(container.querySelector('[data-window-id="chat:draft:browser"] .ui-error-state')).toBeNull();
  });

  it('restores persisted child windows whose parent chat still exists', async () => {
    mocks.surfaces = [
      {
        extensionId: 'system-browser',
        id: 'browser-workbench',
        title: 'Browser',
        location: 'workbench',
        component: 'BrowserWorkbenchPanel',
      },
    ];
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 900, height: 560 },
        minimized: false,
        focused: false,
      },
      {
        id: 'chat:draft:browser',
        kind: 'browser',
        title: 'Browser',
        route: '/conversations/new',
        bounds: { x: 96, y: 92, width: 760, height: 460 },
        minimized: false,
        focused: true,
        parentWindowId: 'chat:draft',
        parentWindowTitle: 'New conversation',
      },
    ]);

    renderWindowedLayout();

    const browserWindow = screen.getByRole('region', { name: 'Browser' });
    expect(browserWindow.getAttribute('data-window-id')).toBe('chat:draft:browser');
    expect(browserWindow.getAttribute('data-parent-window-id')).toBe('chat:draft');
    expect(browserWindow.querySelector('[data-windowed-subwindow="browser"]')).toBeTruthy();
    expect(screen.getByTestId('native-extension-surface').getAttribute('data-instance-id')).toBe('chat:draft:browser');
  });

  it('toggles a focused route window from the taskbar between minimized and restored', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    expect(await screen.findByText('/routines:windowed')).toBeTruthy();
    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    const routinesTaskbarButton = within(taskbar).getByRole('button', { name: /^routines$/i });

    fireEvent.click(routinesTaskbarButton);

    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
    expect(screen.queryByRole('region', { name: /^routines$/i })).toBeNull();
    expect(routinesTaskbarButton.getAttribute('data-minimized')).toBe('true');

    fireEvent.click(routinesTaskbarButton);

    const restoredWindow = await screen.findByRole('region', { name: /^routines$/i });
    const restoredTaskbarButton = within(taskbar).getByRole('button', { name: /^routines$/i });
    expect(restoredWindow.getAttribute('data-focused')).toBe('true');
    expect(restoredTaskbarButton.getAttribute('data-minimized')).not.toBe('true');
  });

  it('clears stale restore bounds when a maximized singleton route window is closed and reopened', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:system-routines:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    expect(await screen.findByText('/routines:windowed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /maximize routines/i }));
    expect(screen.getByRole('button', { name: /restore routines/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /close routines/i }));
    expect(screen.queryByRole('region', { name: /^routines$/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /start menu/i })).getByRole('button', { name: /^routines$/i }));

    const reopenedWindow = await screen.findByRole('region', { name: /^routines$/i });
    expect(within(reopenedWindow).getByRole('button', { name: /maximize routines/i })).toBeTruthy();
    expect(within(reopenedWindow).queryByRole('button', { name: /restore routines/i })).toBeNull();
  });

  it('restores a persisted maximized route window even when in-memory restore bounds are gone', async () => {
    seedWindowedWindows([
      {
        id: 'route:system-routines:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 0, y: 0, width: 1024, height: 724 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    const routinesWindow = await screen.findByRole('region', { name: /^routines$/i });
    expect(within(routinesWindow).getByRole('button', { name: /maximize routines/i })).toBeTruthy();

    fireEvent.click(within(routinesWindow).getByRole('button', { name: /maximize routines/i }));

    const restoredWindow = await screen.findByRole('region', { name: /^routines$/i });
    expect(restoredWindow.style.width).not.toBe('1024px');
    expect(restoredWindow.style.height).not.toBe('724px');
    expect(within(restoredWindow).getByRole('button', { name: /maximize routines/i })).toBeTruthy();
    expect(within(restoredWindow).queryByRole('button', { name: /restore routines/i })).toBeNull();
  });

  it('focuses the next visible window when the focused route window is closed', async () => {
    seedWindowedWindows([
      {
        id: 'chat:draft',
        kind: 'chat',
        title: 'New conversation',
        route: '/conversations/new',
        bounds: { x: 42, y: 34, width: 700, height: 500 },
        minimized: false,
        focused: false,
      },
      {
        id: 'route:routines',
        kind: 'route',
        title: 'Routines',
        route: '/routines',
        bounds: { x: 90, y: 70, width: 760, height: 520 },
        minimized: false,
        focused: true,
        singleton: true,
      },
    ]);

    renderWindowedLayout();

    expect(await screen.findByText('/routines:windowed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /close routines/i }));

    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
    expect(screen.queryByRole('region', { name: /routines/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /routines/i })).toBeNull();
  });
});
