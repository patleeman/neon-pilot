// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act, useState } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { addNotification } from '../components/notifications/notificationStore';
import { ExtensionPage } from './ExtensionPage';
import { useExtensionRegistry } from './useExtensionRegistry';

const nativeHostMockState = vi.hoisted(() => ({ nextMountId: 0 }));
const extensionConfirmApi = vi.hoisted(() => ({
  list: vi.fn(async () => ({ ok: true, confirmations: [] })),
  resolve: vi.fn(async () => ({ ok: true, acknowledged: true })),
}));

vi.mock('../client/api', () => ({
  api: {
    extensionUiConfirmations: extensionConfirmApi.list,
    resolveExtensionUiConfirmation: extensionConfirmApi.resolve,
  },
}));

vi.mock('../components/notifications/notificationStore', () => ({
  addNotification: vi.fn(),
}));

vi.mock('./NativeExtensionSurfaceHost', () => ({
  NativeExtensionSurfaceHost: ({ surface, search }: { surface: { extensionId: string; id: string }; search: string }) => {
    const [mountedSurfaceId] = useState(surface.id);
    const [mountId] = useState(() => ++nativeHostMockState.nextMountId);
    return (
      <div
        data-testid="surface-host"
        data-extension-id={surface.extensionId}
        data-surface-id={surface.id}
        data-mounted-surface-id={mountedSurfaceId}
        data-mount-id={mountId}
        data-search={search}
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
    nativeHostMockState.nextMountId = 0;
    extensionConfirmApi.list.mockClear();
    extensionConfirmApi.resolve.mockClear();
    window.localStorage.clear();
    vi.mocked(useExtensionRegistry).mockReset();
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      extensions: [],
      routes: [],
      surfaces: [],
    } as never);
  });

  it('falls back to the bundled extension manager page when the registry route is missing', () => {
    render(
      <MemoryRouter initialEntries={['/extensions']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-extension-id')).toBe('system-extension-manager');
    expect(host.getAttribute('data-surface-id')).toBe('extensions-page');
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

  it('renders and resolves backend confirmations requested by an extension page', async () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      applications: [],
      applicationNavigation: [],
      routes: [],
      extensions: [],
      surfaces: [
        {
          extensionId: 'reading-list',
          id: 'reading-list-page',
          title: 'Reading List',
          location: 'main',
          route: '/reading-list',
          component: 'ReadingListPage',
          packageType: 'user',
          frontend: { entry: 'dist/frontend.js' },
        },
      ],
    } as never);

    render(
      <MemoryRouter initialEntries={['/reading-list']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('neon-pilot-extension-ui-confirm', {
          detail: {
            requestId: 'delete-article',
            extensionId: 'reading-list',
            title: 'Delete article?',
            message: 'This removes it from your reading list.',
            confirmLabel: 'Delete',
            cancelLabel: 'Keep',
            timeoutMs: 60_000,
          },
        }),
      );
    });

    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(extensionConfirmApi.resolve).toHaveBeenCalledWith('delete-article', 'confirmed'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a disabled application recoverable even when its stale surface is still registered', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      applications: [
        {
          id: 'fixture:reports',
          extensionId: 'fixture',
          title: 'Reports',
          startRoute: '/reports-home',
          routes: ['/reports-home', '/reports'],
          instancePolicy: 'singleton',
          available: false,
          navigationSlots: [],
        },
      ],
      applicationNavigation: [],
      surfaces: [
        {
          extensionId: 'fixture',
          id: 'reports-page',
          title: 'Reports',
          location: 'main',
          route: '/reports',
          component: 'ReportsPage',
          packageType: 'user',
          frontend: { entry: 'dist/frontend.js' },
        },
      ],
      routes: [],
      extensions: [],
    } as never);

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Reports can’t open')).toBeTruthy();
    expect(screen.getByText(/saved view has been kept/i)).toBeTruthy();
    expect(screen.queryByTestId('surface-host')).toBeNull();
  });

  it('renders a live native surface instead of a placeholder for a legacy stored application id', () => {
    window.localStorage.setItem(
      'neon-pilot:application-workspace:v1',
      JSON.stringify({
        pinnedApplicationIds: [],
        pinsInitialized: true,
        activeViewId: 'system-settings:default',
        openViews: [
          {
            id: 'system-settings:default',
            applicationId: 'system-settings:default',
            route: '/settings',
            title: 'Settings',
            lastActiveAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      applications: [
        {
          id: 'system-settings:system',
          extensionId: 'system-settings',
          title: 'System',
          startRoute: '/settings',
          routes: ['/settings'],
          instancePolicy: 'singleton',
          available: true,
          navigationSlots: [],
        },
      ],
      applicationNavigation: [],
      surfaces: [
        {
          extensionId: 'system-settings',
          id: 'settings-page',
          title: 'Settings',
          location: 'main',
          route: '/settings',
          component: 'SettingsPage',
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
        },
      ],
      routes: [],
      extensions: [],
    } as never);

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('surface-host').getAttribute('data-surface-id')).toBe('settings-page');
    expect(screen.queryByText(/can’t open/)).toBeNull();
  });

  it('keeps registry loading visually quiet while preserving status semantics', () => {
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

    expect(container.textContent).toBe('');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading extension page');
    expect(screen.queryByText(/Loading extension/i)).toBeNull();
  });

  it('keeps a registered application route quiet while its surface catches up', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      applications: [],
      applicationNavigation: [
        {
          id: 'automations',
          extensionId: 'system-automations',
          applicationId: 'system-agent:agent',
          label: 'Automations',
          route: '/automations',
          order: 10,
        },
      ],
      extensions: [],
      routes: [],
      surfaces: [],
    } as never);

    const { container } = render(
      <MemoryRouter initialEntries={['/automations']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading extension page');
    expect(screen.queryByText('No page is registered here')).toBeNull();
  });

  it('keeps a manifest-declared page quiet while application registration catches up', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      applications: [],
      applicationNavigation: [],
      extensions: [
        {
          id: 'system-gateways',
          enabled: true,
          packageType: 'system',
          contributes: {
            views: [
              {
                id: 'page',
                title: 'Gateways',
                location: 'main',
                route: '/gateways',
                component: 'GatewaysPage',
                applicationId: 'system-agent:agent',
              },
            ],
          },
        },
      ],
      routes: [],
      surfaces: [],
    } as never);

    const { container } = render(
      <MemoryRouter initialEntries={['/gateways']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading extension page');
    expect(screen.queryByText('No page is registered here')).toBeNull();
  });

  it('renders the most specific extension route when parent and child routes both match', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      surfaces: [],
      routes: [
        { route: '/extensions', extensionId: 'system-extension-manager', surfaceId: 'extensions-page', packageType: 'system' },
        {
          route: '/extensions/search-paths',
          extensionId: 'system-extension-manager',
          surfaceId: 'extension-search-paths',
          packageType: 'system',
        },
      ],
      extensions: [
        {
          id: 'system-extension-manager',
          name: 'Extension Manager',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [
              {
                id: 'extensions-page',
                title: 'Extensions',
                location: 'main',
                route: '/extensions',
                component: 'ExtensionManagerPage',
              },
              {
                id: 'extension-search-paths',
                title: 'Extension search paths',
                location: 'main',
                route: '/extensions/search-paths',
                component: 'ExtensionSearchPathsPage',
              },
            ],
          },
        },
      ],
    } as never);

    render(
      <MemoryRouter initialEntries={['/extensions/search-paths']}>
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
        { route: '/skills', extensionId: 'system-skills', surfaceId: 'skills-page', packageType: 'system' },
        { route: '/gateways', extensionId: 'system-gateways', surfaceId: 'page', packageType: 'system' },
      ],
      extensions: [
        {
          id: 'system-skills',
          name: 'Skills',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [{ id: 'skills-page', title: 'Skills', location: 'main', route: '/skills', component: 'SkillsPage' }],
          },
        },
        {
          id: 'system-gateways',
          name: 'Gateways',
          enabled: true,
          packageType: 'system',
          frontend: { entry: 'dist/frontend.js' },
          contributes: {
            views: [{ id: 'page', title: 'Gateways', location: 'main', route: '/gateways', component: 'GatewaysPage' }],
          },
        },
      ],
    } as never);

    function Harness() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate('/gateways')}>
            Gateways
          </button>
          <ExtensionPage />
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={['/skills']}>
        <Routes>
          <Route path="*" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('surface-host').getAttribute('data-mounted-surface-id')).toBe('skills-page');

    fireEvent.click(screen.getByRole('button', { name: 'Gateways' }));

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-surface-id')).toBe('page');
    expect(host.getAttribute('data-mounted-surface-id')).toBe('page');
  });

  it('preserves a native surface when only its route state changes', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      surfaces: [
        {
          extensionId: 'fixture-reports',
          id: 'reports-page',
          title: 'Reports',
          location: 'main',
          route: '/reports',
          component: 'ReportsPage',
          packageType: 'user',
          frontend: { entry: 'dist/frontend.js' },
        },
      ],
      routes: [],
      extensions: [],
    } as never);

    function Harness() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => navigate('/reports?sort=recent')}>
            Sort reports
          </button>
          <ExtensionPage />
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={['/reports?sort=name']}>
        <Routes>
          <Route path="*" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    );

    const initialMountId = screen.getByTestId('surface-host').getAttribute('data-mount-id');
    fireEvent.click(screen.getByRole('button', { name: 'Sort reports' }));

    const host = screen.getByTestId('surface-host');
    expect(host.getAttribute('data-search')).toBe('?sort=recent');
    expect(host.getAttribute('data-mount-id')).toBe(initialMountId);
  });

  it('shows a calm recovery state for unknown extension routes without warning toasts', () => {
    render(
      <MemoryRouter initialEntries={['/missing-extension-route']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('No page is registered here')).toBeTruthy();
    expect(screen.getByText('This address does not match a conversation, setting, or installed extension page.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Chat' }).getAttribute('href')).toBe('/conversations/new');
    expect(screen.queryByText(/Extension surface unavailable/i)).toBeNull();
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('recovers a missing saved application view whose route includes search and hash state', () => {
    window.localStorage.setItem(
      'neon-pilot:application-workspace:v1',
      JSON.stringify({
        pinnedApplicationIds: [],
        pinsInitialized: true,
        activeViewId: 'missing:reports:/reports',
        openViews: [
          {
            id: 'missing:reports:/reports',
            applicationId: 'missing:reports',
            route: '/reports?tab=quarterly#summary',
            title: 'Reports · quarterly',
            lastActiveAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    render(
      <MemoryRouter initialEntries={['/reports?tab=quarterly#summary']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Reports can’t open')).toBeTruthy();
    expect(screen.getByText(/saved view has been kept/i)).toBeTruthy();
  });
});
