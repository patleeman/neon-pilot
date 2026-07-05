// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { addNotification } from '../components/notifications/notificationStore';
import { useApi } from '../hooks/useApi';
import { ExtensionPage } from './ExtensionPage';
import { useExtensionRegistry } from './useExtensionRegistry';

vi.mock('../components/notifications/notificationStore', () => ({
  addNotification: vi.fn(),
}));

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn(() => ({
    data: null,
    loading: true,
    refreshing: false,
    error: null,
    refetch: vi.fn(),
    replaceData: vi.fn(),
  })),
}));

vi.mock('../hooks/useInvalidateOnTopics', () => ({
  useInvalidateOnTopics: vi.fn(),
}));

vi.mock('./NativeExtensionSurfaceHost', () => ({
  NativeExtensionSurfaceHost: ({
    surface,
    shellPresentation,
  }: {
    surface: { extensionId: string; id: string };
    shellPresentation?: 'stable' | 'windowed';
  }) => {
    const [mountedSurfaceId] = useState(surface.id);
    return (
      <div
        data-testid="surface-host"
        data-extension-id={surface.extensionId}
        data-surface-id={surface.id}
        data-mounted-surface-id={mountedSurfaceId}
        data-shell-presentation={shellPresentation ?? 'windowed'}
      />
    );
  },
}));

vi.mock('./useExtensionRegistry', () => ({
  useExtensionRegistry: vi.fn(() => ({
    loading: false,
    error: null,
    extensions: [],
    surfaces: [],
  })),
}));

describe('ExtensionPage', () => {
  afterEach(() => {
    vi.mocked(useExtensionRegistry).mockReset();
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      extensions: [],
      routes: [],
      surfaces: [],
    } as never);
    vi.mocked(useApi).mockReset();
    vi.mocked(useApi).mockReturnValue({
      data: null,
      loading: true,
      refreshing: false,
      error: null,
      refetch: vi.fn(),
      replaceData: vi.fn(),
    });
  });

  it('falls back to the bundled extension manager page when the registry route is missing', () => {
    render(
      <MemoryRouter initialEntries={['/apps']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-extension-id')).toBe('system-extension-manager');
    expect(host.getAttribute('data-surface-id')).toBe('app-manager-page');
    expect(screen.queryByText(/Extension surface unavailable/i)).toBeNull();
  });

  it('renders manifest-contributed main view routes through the native extension host', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      surfaces: [],
      routes: [{ route: '/settings/providers', extensionId: 'system-settings', surfaceId: 'providers', packageType: 'system' }],
      extensions: [
        {
          id: 'system-settings',
          name: 'Settings panels',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [
              {
                id: 'settings',
                title: 'Settings',
                location: 'main',
                route: '/settings',
                component: 'SettingsPage',
              },
              {
                id: 'providers',
                title: 'Provider settings',
                location: 'main',
                route: '/settings/providers',
                component: 'ProviderSettingsPage',
              },
            ],
          },
        },
      ],
    } as never);

    render(
      <MemoryRouter initialEntries={['/settings/providers']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-extension-id')).toBe('system-settings');
    expect(host.getAttribute('data-surface-id')).toBe('providers');
    expect(screen.queryByText(/Extension surface unavailable/i)).toBeNull();
  });

  it('passes desktop shell presentation through to native extension pages', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      surfaces: [],
      routes: [{ route: '/automations', extensionId: 'system-automations', surfaceId: 'page', packageType: 'system' }],
      extensions: [
        {
          id: 'system-automations',
          name: 'Automations',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [{ id: 'page', title: 'Automations', location: 'main', route: '/automations', component: 'AutomationsPage' }],
          },
        },
      ],
    } as never);

    render(
      <MemoryRouter initialEntries={['/automations']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('surface-host').getAttribute('data-shell-presentation')).toBe('windowed');
  });

  it('shows visible registry loading chrome by default', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: true,
      error: null,
      extensions: [],
      routes: [],
      surfaces: [],
    } as never);

    const { container } = render(
      <MemoryRouter initialEntries={['/skills']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Loading app page' })).toBeTruthy();
    expect(screen.getByText('Loading app page')).toBeTruthy();
    expect(screen.getByText('Preparing the window contents.')).toBeTruthy();
    expect(container.querySelector('.wos-window-route-loading')).toBeTruthy();
    expect(container.querySelector('.wos-state-block')).toBeTruthy();
  });

  it('shows visible registry loading chrome when desktop shell presentation is explicit', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: true,
      error: null,
      extensions: [],
      routes: [],
      surfaces: [],
    } as never);

    const { container } = render(
      <MemoryRouter initialEntries={['/skills']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Loading app page' })).toBeTruthy();
    expect(screen.getByText('Loading app page')).toBeTruthy();
    expect(screen.getByText('Preparing the window contents.')).toBeTruthy();
    expect(container.querySelector('.wos-window-route-loading')).toBeTruthy();
    expect(container.querySelector('.wos-state-block')).toBeTruthy();
  });

  it('shows visible unavailable route chrome in the desktop shell', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/missing-extension-route']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'No page is registered here' })).toBeTruthy();
    expect(screen.getByText('No page is registered here')).toBeTruthy();
    expect(screen.getByText('This address does not match a conversation, setting, or installed app page.')).toBeTruthy();
    expect(container.querySelector('.wos-window-route-loading')).toBeTruthy();
    expect(container.querySelector('.wos-state-block')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Go to Chat' })).toBeNull();
  });

  it('renders honest pending states for core roster apps before their stores land', () => {
    render(
      <MemoryRouter initialEntries={['/documents']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Documents store pending' })).toBeTruthy();
    expect(screen.getByText('Shared app collections will appear here after the documents store lands.')).toBeTruthy();

    cleanup();
    render(
      <MemoryRouter initialEntries={['/inbox']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Inbox pending' })).toBeTruthy();
    expect(
      screen.getByText('Worker results, persona messages, and questions will arrive here after Inbox is wired to the documents store.'),
    ).toBeTruthy();

    cleanup();
    vi.mocked(useApi).mockReturnValue({
      data: { items: [], total: 0 },
      loading: false,
      refreshing: false,
      error: null,
      refetch: vi.fn(),
      replaceData: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/activity']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });

  it('renders core feature pages while the extension registry is loading', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: true,
      error: null,
      extensions: [],
      routes: [],
      surfaces: [],
    } as never);
    vi.mocked(useApi).mockReturnValue({
      data: { items: [], total: 0 },
      loading: false,
      refreshing: false,
      error: null,
      refetch: vi.fn(),
      replaceData: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/activity']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Loading app page' })).toBeNull();
  });

  it('renders core feature pages when the extension registry errors', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: 'registry unavailable',
      extensions: [],
      routes: [],
      surfaces: [],
    } as never);
    vi.mocked(useApi).mockReturnValue({
      data: { items: [], total: 0 },
      loading: false,
      refreshing: false,
      error: null,
      refetch: vi.fn(),
      replaceData: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/activity']}>
        <ExtensionPage shellPresentation="windowed" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Apps unavailable' })).toBeNull();
  });

  it('renders the most specific extension route when parent and child routes both match', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      surfaces: [],
      routes: [
        { route: '/apps', extensionId: 'system-extension-manager', surfaceId: 'extensions-page', packageType: 'system' },
        {
          route: '/apps/search-paths',
          extensionId: 'system-extension-manager',
          surfaceId: 'extension-search-paths',
          packageType: 'system',
        },
      ],
      extensions: [
        {
          id: 'system-extension-manager',
          name: 'App Manager',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [
              {
                id: 'extensions-page',
                title: 'App Manager',
                location: 'main',
                route: '/apps',
                component: 'ExtensionManagerPage',
              },
              {
                id: 'extension-search-paths',
                title: 'Extension search paths',
                location: 'main',
                route: '/apps/search-paths',
                component: 'ExtensionSearchPathsPage',
              },
            ],
          },
        },
      ],
    } as never);

    render(
      <MemoryRouter initialEntries={['/apps/search-paths']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-extension-id')).toBe('system-extension-manager');
    expect(host.getAttribute('data-surface-id')).toBe('extension-search-paths');
  });

  it('remounts the native surface when moving between extension page routes', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      surfaces: [],
      routes: [
        { route: '/automations', extensionId: 'system-automations', surfaceId: 'automations-page', packageType: 'system' },
        { route: '/apps', extensionId: 'system-extension-manager', surfaceId: 'extensions-page', packageType: 'system' },
      ],
      extensions: [
        {
          id: 'system-automations',
          name: 'Automations',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [
              { id: 'automations-page', title: 'Automations', location: 'main', route: '/automations', component: 'AutomationsPage' },
            ],
          },
        },
        {
          id: 'system-extension-manager',
          name: 'App Manager',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [{ id: 'extensions-page', title: 'App Manager', location: 'main', route: '/apps', component: 'ExtensionManagerPage' }],
          },
        },
      ],
    } as never);

    function Harness() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate('/apps')}>
            App Manager
          </button>
          <ExtensionPage />
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={['/automations']}>
        <Routes>
          <Route path="*" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('surface-host').getAttribute('data-mounted-surface-id')).toBe('automations-page');

    fireEvent.click(screen.getByRole('button', { name: 'App Manager' }));

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-surface-id')).toBe('extensions-page');
    expect(host.getAttribute('data-mounted-surface-id')).toBe('extensions-page');
  });

  it('shows a calm recovery state for unknown extension routes without warning toasts', () => {
    vi.mocked(addNotification).mockClear();

    render(
      <MemoryRouter initialEntries={['/missing-extension-route']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('No page is registered here')).toBeTruthy();
    expect(screen.getByText('This address does not match a conversation, setting, or installed app page.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Go to Chat' })).toBeNull();
    expect(screen.getByRole('status', { name: 'No page is registered here' })).toBeTruthy();
    expect(screen.queryByText(/Extension surface unavailable/i)).toBeNull();
    expect(addNotification).not.toHaveBeenCalled();
  });
});
