// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExtensionPage } from './ExtensionPage';
import { useExtensionRegistry } from './useExtensionRegistry';

vi.mock('../components/notifications/notificationStore', () => ({
  addNotification: vi.fn(),
}));

vi.mock('./NativeExtensionSurfaceHost', () => ({
  NativeExtensionSurfaceHost: ({ surface }: { surface: { extensionId: string; id: string } }) => (
    <div data-testid="surface-host" data-extension-id={surface.extensionId} data-surface-id={surface.id} />
  ),
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

  it('renders the most specific extension route when parent and child routes both match', () => {
    vi.mocked(useExtensionRegistry).mockReturnValue({
      loading: false,
      error: null,
      surfaces: [],
      routes: [
        { route: '/extensions', extensionId: 'system-extension-manager', surfaceId: 'extensions-page', packageType: 'system' },
        { route: '/extensions/search-paths', extensionId: 'system-extension-manager', surfaceId: 'extension-search-paths', packageType: 'system' },
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
});
