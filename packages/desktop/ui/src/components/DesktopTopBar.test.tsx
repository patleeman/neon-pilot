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
        applications={[]}
        applicationWorkspace={{ pinnedApplicationIds: [], pinsInitialized: false, openViews: [], activeViewId: null }}
        activeApplicationId={null}
        onActivateApplication={() => {}}
        onCloseApplication={() => {}}
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

  it('keeps global navigation together without application panel toggles', () => {
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
      { onOpenHome: () => {} },
    );

    expect(html).toContain('Open Home');
    expect(html).toContain('Open Neon Pilot');
    expect(html.indexOf('Go back')).toBeLessThan(html.indexOf('Go forward'));
    expect(html.indexOf('Go forward')).toBeLessThan(html.indexOf('Open Home'));
    expect(html.indexOf('Open Home')).toBeLessThan(html.indexOf('Open Neon Pilot'));
    expect(html).not.toContain('Hide sidebar');
    expect(html).not.toContain('Hide right sidebar');
  });

  it('places the environment badge in the trailing controls before extension chrome', () => {
    const html = renderTopBar(
      {
        isElectron: true,
        activeHostId: 'local',
        activeHostLabel: 'Local',
        activeHostKind: 'local',
        activeHostSummary: 'Local runtime is healthy.',
        launchMode: 'testing',
        launchLabel: 'Testing',
      },
      { trailingExtra: <span>Trailing marker</span> },
    );

    expect(html.indexOf('>Testing<')).toBeLessThan(html.indexOf('Trailing marker'));
  });

  it('keeps the top bar chrome draggable except for interactive controls', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
      launchMode: 'stable',
      launchLabel: null,
    });

    expect(html).toContain('class="ui-desktop-top-bar" style="-webkit-app-region:drag"');
    expect(html).toContain('class="ui-desktop-top-bar__controls" style="-webkit-app-region:no-drag"');
    expect(html).toContain('class="ui-desktop-top-bar__center" style="-webkit-app-region:drag"');
    expect(html).toContain('ui-desktop-top-bar__launcher');
    expect(html).not.toContain('ui-desktop-top-bar__brand');
    expect(html).not.toContain('ui-desktop-top-bar__brand-label');
  });

  it('hides the right sidebar toggle when no right sidebar is available', () => {
    const html = renderTopBar({
      isElectron: true,
      activeHostId: 'local',
      activeHostLabel: 'Local',
      activeHostKind: 'local',
      activeHostSummary: 'Local runtime is healthy.',
    });

    expect(html).not.toContain('Workbench unavailable');
    expect(html).not.toContain('Show right sidebar');
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

  it('does not render desktop chrome outside the desktop shell', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Safari/605.1.15',
    });

    const html = renderTopBar();

    expect(html).not.toContain('Go back');
  });
});
