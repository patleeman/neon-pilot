import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesktopTopBar, readBrowserNavigationState } from './DesktopTopBar.js';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

function renderTopBar(
  environment: React.ComponentProps<typeof DesktopTopBar>['environment'] = null,
  overrides: Partial<React.ComponentProps<typeof DesktopTopBar>> = {},
): string {
  return renderToString(
    <MemoryRouter>
      <DesktopTopBar
        environment={environment}
        sidebarOpen
        onToggleSidebar={() => {}}
        showRailToggle={false}
        railOpen={false}
        onToggleRail={() => {}}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('DesktopTopBar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores unsafe persisted browser navigation indexes', () => {
    const storage = new Map<string, string>([['__pa_nav_max_idx__', String(Number.MAX_SAFE_INTEGER + 1)]]);
    vi.stubGlobal('window', {
      history: { state: { idx: 0 } },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    expect(readBrowserNavigationState()).toEqual({ canGoBack: false, canGoForward: false });
  });

  it('ignores absurd persisted browser navigation indexes', () => {
    const storage = new Map<string, string>([['__pa_nav_max_idx__', String(Number.MAX_SAFE_INTEGER)]]);
    vi.stubGlobal('window', {
      history: { state: { idx: 0 } },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    expect(readBrowserNavigationState()).toEqual({ canGoBack: false, canGoForward: false });
  });

  it('ignores absurd current browser navigation indexes', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      history: { state: { idx: Number.MAX_SAFE_INTEGER } },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    expect(readBrowserNavigationState()).toEqual({ canGoBack: false, canGoForward: false });
    expect(storage.get('__pa_nav_max_idx__')).toBe('0');
  });

  it('ignores malformed persisted browser navigation indexes', () => {
    const storage = new Map<string, string>([['__pa_nav_max_idx__', '1e3']]);
    vi.stubGlobal('window', {
      history: { state: { idx: 0 } },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    expect(readBrowserNavigationState()).toEqual({ canGoBack: false, canGoForward: false });
  });

  it('keeps desktop navigation chrome visible in Electron shells even when the preload bridge is missing', () => {
    vi.stubGlobal('window', {
      neonPilotDesktop: undefined,
      location: { search: '' },
      sessionStorage: {
        getItem: () => null,
      },
    });
    vi.stubGlobal('document', {
      documentElement: { dataset: {} },
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Electron/31.0.2',
    });

    const html = renderTopBar();

    expect(html).toContain('Go back');
  });

  it('renders a testing badge for command-line desktop launches', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
      launchMode: 'testing',
      launchLabel: 'Testing',
    });

    expect(html).toContain('>Testing<');
    expect(html).toContain('Testing build');
  });

  it('renders a testing badge for dev builds', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
      launchMode: 'dev',
      launchLabel: 'Dev',
    });

    expect(html).toContain('>Testing<');
  });

  it('renders an RC badge for release candidate builds', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
      launchMode: 'rc',
      launchLabel: 'RC',
    });

    expect(html).toContain('>RC<');
    expect(html).toContain('Release candidate build');
  });

  it('hides the environment badge for stable release builds', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
      launchMode: 'stable',
    });

    expect(html).not.toContain('ui-desktop-top-bar__mode-badge');
    expect(html).not.toContain('>Local<');
  });

  it('keeps the panel toggles on the outside edges of the top bar controls', () => {
    const html = renderTopBar(
      {
        isElectron: true,
        activeHostId: 'local',
        activeHostLabel: 'Local',
        activeHostKind: 'local',
        activeHostSummary: 'Local runtime is healthy.',
        launchMode: 'stable',
        launchLabel: null,
      },
      { showRailToggle: true, railOpen: true },
    );

    expect(html.indexOf('Hide sidebar')).toBeLessThan(html.indexOf('Go back'));
    expect(html.indexOf('Go back')).toBeLessThan(html.indexOf('Go forward'));
    expect(html.indexOf('Go forward')).toBeLessThan(html.indexOf('Collapse right sidebar'));
  });

  it('keeps the right sidebar toggle disabled when no right sidebar is available', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
    });

    expect(html).toContain('Right sidebar unavailable');
    expect(html).toContain('disabled=""');
  });

  it('does not render the old compact/workbench mode switcher', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
      launchMode: 'stable',
      launchLabel: null,
    });

    expect(html).not.toContain('aria-label="Workbench"');
    expect(html).not.toContain('aria-label="Compact"');
    expect(html).not.toContain('aria-label="View mode"');
  });

  it('can relabel the primary collapse control for workbench mode', () => {
    const html = renderTopBar(
      {
        isElectron: true,
        activeHostId: 'local',
        activeHostLabel: 'Local',
        activeHostKind: 'local',
        activeHostSummary: 'Local runtime is healthy.',
      },
      {
        sidebarOpen: true,
        sidebarToggleLabel: { open: 'Hide workbench', closed: 'Show workbench' },
      },
    );

    expect(html).toContain('aria-label="Hide workbench"');
    expect(html).not.toContain('aria-label="Hide sidebar"');
  });

  it('does not render desktop chrome outside the desktop shell', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Safari/605.1.15',
    });

    const html = renderTopBar();

    expect(html).not.toContain('Go back');
  });
});
