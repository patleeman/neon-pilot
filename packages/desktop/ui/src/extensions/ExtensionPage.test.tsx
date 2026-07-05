// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { addNotification } from '../components/notifications/notificationStore';
import { ExtensionPage } from './ExtensionPage';
import { useExtensionRegistry } from './useExtensionRegistry';

vi.mock('../components/notifications/notificationStore', () => ({
  addNotification: vi.fn(),
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
        data-shell-presentation={shellPresentation ?? 'stable'}
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

  it('passes windowed shell presentation through to native extension pages', () => {
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
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Loading app page');
    expect(screen.queryByText(/Loading app/i)).toBeNull();
  });

  it('shows visible registry loading chrome in the windowed shell', () => {
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

  it('shows visible unavailable route chrome in the windowed shell', () => {
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

  it('shows a calm recovery state for unknown extension routes without warning toasts', () => {
    render(
      <MemoryRouter initialEntries={['/missing-extension-route']}>
        <ExtensionPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('No page is registered here')).toBeTruthy();
    expect(screen.getByText('This address does not match a conversation, setting, or installed app page.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Chat' }).getAttribute('href')).toBe('/conversations/new');
    expect(screen.queryByText(/Extension surface unavailable/i)).toBeNull();
    expect(addNotification).not.toHaveBeenCalled();
  });
});
