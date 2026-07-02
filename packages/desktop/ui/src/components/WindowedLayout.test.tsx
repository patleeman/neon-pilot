/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WindowedLayout } from './WindowedLayout';

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
    };
  }>,
}));

vi.mock('./Layout', () => ({
  Layout: mocks.layout,
}));

vi.mock('../extensions/ExtensionRouteHost', async () => {
  const { useLocation } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ExtensionRouteHost: ({ shellPresentation = 'stable' }: { shellPresentation?: 'stable' | 'windowed' }) => {
      const location = useLocation();
      return <div data-testid="extension-route-host">{`${location.pathname}:${shellPresentation}`}</div>;
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

vi.mock('../pages/ConversationPage', () => ({
  ConversationPage: () => <div data-testid="conversation-page">Conversation</div>,
}));

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
