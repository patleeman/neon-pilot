/* @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  tabs: [] as Array<{ id: string; title?: string; messageCount?: number }>,
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
    Layout: () => mocks.layout({ children: <Outlet /> }),
  };
});

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

vi.mock('../extensions/useExtensionRegistry', () => ({
  useExtensionRegistry: () => ({
    loading: mocks.registryLoading,
    error: null,
    extensions: mocks.extensions,
    surfaces: [],
  }),
}));

vi.mock('../hooks/useConversations', () => ({
  useConversations: () => ({
    pinnedSessions: mocks.pinnedSessions,
    tabs: mocks.tabs,
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

describe('WindowedLayout route windows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.neonPilotDesktop;
    mocks.layout.mockClear();
    mocks.archiveSession.mockClear();
    mocks.registryLoading = false;
    mocks.pinnedSessions = [];
    mocks.tabs = [];
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
    expect(screen.getAllByTestId('embedded-layout')).toHaveLength(1);
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

  it('closes the start menu when the desktop is clicked outside it', () => {
    renderWindowedLayout();

    fireEvent.click(screen.getByRole('button', { name: /neon pilot/i }));
    expect(screen.getByRole('dialog', { name: /start menu/i })).toBeTruthy();

    fireEvent.mouseDown(screen.getByLabelText(/windowed neon pilot desktop/i));

    expect(screen.queryByRole('dialog', { name: /start menu/i })).toBeNull();
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

      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({ visible: false, sessionKey: null });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({ visible: false, sessionKey: '@global:tab-tab-a' });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({ visible: false, sessionKey: '@global:tab-tab-b' });
      const initialHiddenCalls = setWorkbenchBrowserBounds.mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(setWorkbenchBrowserBounds.mock.calls.length).toBeGreaterThan(initialHiddenCalls);
      expect(setWorkbenchBrowserBounds).toHaveBeenLastCalledWith({ visible: false, sessionKey: '@global:tab-tab-b' });
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

  it('uses product accents for diagnostics, skills, and workflow app windows', async () => {
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
    ).toBe('telemetry');
    expect(
      screen
        .getByRole('region', { name: /skills/i })
        .querySelector('.wos-window__titlebar')
        ?.getAttribute('data-accent'),
    ).toBe('extensions');
    expect(
      screen
        .getByRole('region', { name: /workflows/i })
        .querySelector('.wos-window__titlebar')
        ?.getAttribute('data-accent'),
    ).toBe('routines');
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
          nav: [{ id: 'extensions-nav', label: 'Extensions', route: '/extensions' }],
          views: [{ id: 'extensions-page', title: 'Extensions', location: 'main', route: '/extensions' }],
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
      'Model Arena',
      'Routines',
      'Extensions',
      'Skills',
      'Diagnostics',
      'Settings',
    ]);

    for (const label of [
      'Chat',
      'Automations',
      'Workflows',
      'Extensions',
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

  it('renders chat windows directly in the taskbar with larger default bounds', () => {
    const { container } = renderWindowedLayout();

    expect(container.querySelector('.wos-taskbar__group')).toBeNull();

    const chatWindow = screen.getByRole('region', { name: /new conversation/i });
    expect(chatWindow.getAttribute('style')).toContain('width: 1180px');
    expect(chatWindow.getAttribute('style')).toContain('height: 760px');
    const taskbar = screen.getByRole('navigation', { name: /open windows/i });
    expect(
      within(taskbar)
        .getByRole('button', { name: /new conversation/i })
        .getAttribute('data-focused'),
    ).toBe('true');
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
    const chatGroupButton = within(taskbar).getByRole('button', { name: /chat 2/i });
    expect(chatGroupButton.getAttribute('data-focused')).toBe('true');
    expect(within(taskbar).queryByRole('button', { name: /planning thread/i })).toBeNull();
    expect(screen.queryByRole('menu', { name: /open chat windows/i })).toBeNull();

    fireEvent.click(chatGroupButton);

    const chatMenu = screen.getByRole('menu', { name: /open chat windows/i });
    expect(within(chatMenu).getByRole('menuitem', { name: /new conversation/i })).toBeTruthy();
    expect(within(chatMenu).getByRole('menuitem', { name: /planning thread/i })).toBeTruthy();

    fireEvent.click(within(chatMenu).getByRole('menuitem', { name: /new conversation/i }));

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /open chat windows/i })).toBeNull();
    });
    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
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
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({ visible: false, sessionKey: null });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({ visible: false, sessionKey: '@global:tab-tab-a' });
      expect(setWorkbenchBrowserBounds).toHaveBeenCalledWith({ visible: false, sessionKey: '@global:tab-tab-b' });
    });
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
      expect(container.querySelector('.windowed-os-shell')?.getAttribute('data-focused-window-id')).toBe('route:routines');
    });
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
    const chatGroupButton = within(taskbar).getByRole('button', { name: /chat 2/i });
    expect(chatGroupButton.getAttribute('data-focused')).toBe('true');

    const suspendListener = vi.fn();
    window.addEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, suspendListener);
    try {
      fireEvent.click(chatGroupButton);

      const chatMenu = screen.getByRole('menu', { name: /open chat windows/i });
      expect(within(chatMenu).getByRole('menuitem', { name: /planning thread/i })).toBeTruthy();
      expect(within(chatMenu).getByRole('menuitem', { name: /new conversation/i })).toBeTruthy();
      expect(suspendListener).toHaveBeenCalled();
      const event = suspendListener.mock.calls.at(-1)?.[0] as CustomEvent<{ durationMs?: number }> | undefined;
      expect(event?.detail?.durationMs).toBeGreaterThanOrEqual(1500);
    } finally {
      window.removeEventListener(WINDOWED_SHELL_BROWSER_SUSPEND_EVENT, suspendListener);
    }
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

  it('prunes persisted route windows when their nav item is no longer available', async () => {
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

    await waitFor(() => expect(screen.queryByText('/workflows:windowed')).toBeNull());
    expect(screen.queryByRole('region', { name: /workflows/i })).toBeNull();
    expect(await screen.findByTestId('embedded-layout')).toBeTruthy();
    expect(screen.getByRole('region', { name: /new conversation/i })).toBeTruthy();
  });

  it('keeps persisted nested route windows when their parent nav item is available', async () => {
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
    expect(screen.getByRole('region', { name: /routines detail/i })).toBeTruthy();
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

    renderWindowedLayout();

    expect(await screen.findByText('/routines:windowed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /minimize routines/i }));

    expect(screen.getByRole('region', { name: /new conversation/i }).getAttribute('data-focused')).toBe('true');
    expect(screen.queryByRole('region', { name: /routines/i })).toBeNull();
    expect(screen.getByRole('button', { name: /routines/i }).getAttribute('data-minimized')).toBe('true');
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
