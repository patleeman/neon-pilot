// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NativeExtensionSurfaceHost } from './NativeExtensionSurfaceHost';
import type { NativeExtensionViewSummary } from './types';

const apiMocks = vi.hoisted(() => ({
  automations: {
    list: vi.fn(async () => []),
    readSchedulerHealth: vi.fn(async () => ({
      status: 'healthy',
      staleAfterSeconds: 60,
      lastEvaluatedAt: '2026-05-08T00:00:00.000Z',
    })),
  },
  invokeExtensionAction: vi.fn(async (_extensionId: string, actionId: string, input?: unknown) => {
    if (actionId === 'eventBus' && typeof input === 'object' && input !== null && 'action' in input) {
      const action = (input as { action?: unknown }).action;
      if (action === 'list') return { ok: true, result: { events: [] } };
      if (action === 'list_subscriptions') return { ok: true, result: { subscriptions: [] } };
    }
    return { ok: true, result: null };
  }),
  extensionManifest: vi.fn(),
  extensionSurfacesForExtension: vi.fn(),
  startExtensionRun: vi.fn(),
  durableRun: vi.fn(),
  runs: vi.fn(),
  durableRunLog: vi.fn(),
  cancelDurableRun: vi.fn(),
  sessions: vi.fn(async () => []),
  models: vi.fn(async () => []),
  conversations: {
    list: vi.fn(async () => []),
  },
  extensionState: vi.fn(),
  putExtensionState: vi.fn(),
  deleteExtensionState: vi.fn(),
  extensionStateList: vi.fn(),
}));

vi.mock('../client/api', () => ({ api: apiMocks }));
vi.mock('./systemExtensionModules', () => ({
  systemExtensionModules: new Map([
    [
      'system-automations',
      async () => ({
        AutomationsPage: ({
          pa,
          context,
        }: {
          pa: { automations: { list: () => Promise<unknown> } };
          context: { shellPresentation?: 'windowed' };
        }) => {
          React.useEffect(() => {
            void pa.automations.list();
          }, [pa]);
          const shellLabel = context.shellPresentation === 'windowed' ? 'desktop' : (context.shellPresentation ?? 'unset');
          return <div>Automations loaded in {shellLabel} shell</div>;
        },
      }),
    ],
    [
      'system-broken-extension',
      async () => ({
        OtherExport: () => <div>Wrong component</div>,
      }),
    ],
  ]),
}));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];

afterEach(() => {
  for (const root of mountedRoots) {
    act(() => root.unmount());
  }
  mountedRoots.length = 0;
  vi.clearAllMocks();
});

describe('NativeExtensionSurfaceHost', () => {
  it('uses transparent chrome for sidebar extension surfaces', async () => {
    const surface: NativeExtensionViewSummary = {
      extensionId: 'system-automations',
      id: 'sidebar',
      title: 'Automations Sidebar',
      location: 'sidebar',
      component: 'AutomationsPage',
      frontend: { entry: 'dist/frontend.js' },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(<NativeExtensionSurfaceHost surface={surface} pathname="/automations" search="" hash="" />);
    });

    const host = container.querySelector('[data-extension-surface-id="sidebar"]');
    expect(host?.className).toContain('bg-transparent');
    expect(host?.className).not.toContain('bg-base');
  });

  it('uses transparent chrome for right rail extension surfaces', async () => {
    const surface: NativeExtensionViewSummary = {
      extensionId: 'system-automations',
      id: 'automations-context-rail',
      title: 'Automations Context',
      location: 'rightRail',
      component: 'AutomationsContextRail',
      frontend: { entry: 'dist/frontend.js' },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(<NativeExtensionSurfaceHost surface={surface} pathname="/automations" search="" hash="" />);
    });

    const host = container.querySelector('[data-extension-surface-id="automations-context-rail"]');
    expect(host?.className).toContain('bg-transparent');
    expect(host?.className).not.toContain('bg-base');
  });

  it('lazy-loads a native system extension component with windowed PA props by default', async () => {
    const surface: NativeExtensionViewSummary = {
      extensionId: 'system-automations',
      id: 'page',
      title: 'Automations',
      location: 'main',
      route: '/automations',
      component: 'AutomationsPage',
      frontend: { entry: 'dist/frontend.js' },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(<NativeExtensionSurfaceHost surface={surface} pathname="/automations" search="" hash="" />);
    });

    await vi.waitFor(() => expect(container.textContent).toContain('Automations'));
    expect(container.textContent).toContain('Automations loaded');
    expect(container.textContent).toContain('desktop shell');
    expect(apiMocks.automations.list).toHaveBeenCalled();
  });

  it('passes desktop shell presentation to native extension surfaces', async () => {
    const surface: NativeExtensionViewSummary = {
      extensionId: 'system-automations',
      id: 'page',
      title: 'Automations',
      location: 'main',
      route: '/automations',
      component: 'AutomationsPage',
      frontend: { entry: 'dist/frontend.js' },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(<NativeExtensionSurfaceHost surface={surface} pathname="/automations" search="" hash="" />);
    });

    await vi.waitFor(() => expect(container.textContent).toContain('desktop shell'));
    const host = container.querySelector('[data-extension-surface-id="page"]');
    expect(host?.getAttribute('data-shell-presentation')).toBe('windowed');
    expect(host?.className).toContain('wos-native-extension-surface');
    expect(host?.className).toContain('wos-native-extension-surface--windowed');
    expect(host?.className).toContain('bg-transparent');
    expect(host?.className).not.toContain('bg-base');
  });

  it('shows a safe message when an extension surface fails to load', async () => {
    const surface: NativeExtensionViewSummary = {
      extensionId: 'system-broken-extension',
      id: 'page',
      title: 'Broken',
      location: 'main',
      route: '/broken',
      component: 'MissingExport',
      frontend: { entry: '/Users/patrick/private-extension/dist/frontend.js' },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(<NativeExtensionSurfaceHost surface={surface} pathname="/broken" search="" hash="" />);
    });

    await vi.waitFor(() => expect(container.textContent).toContain('This app page could not be loaded.'));
    expect(container.textContent).not.toContain('MissingExport');
    expect(container.textContent).not.toContain('/Users/patrick');
    expect(container.textContent).not.toContain('dist/frontend.js');
  });

  it('shows windowed error chrome when a windowed extension surface fails to load', async () => {
    const surface: NativeExtensionViewSummary = {
      extensionId: 'system-broken-extension',
      id: 'page',
      title: 'Broken',
      location: 'main',
      route: '/broken',
      component: 'MissingExport',
      frontend: { entry: '/Users/patrick/private-extension/dist/frontend.js' },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    await act(async () => {
      root.render(<NativeExtensionSurfaceHost surface={surface} pathname="/broken" search="" hash="" />);
    });

    await vi.waitFor(() => expect(container.textContent).toContain('App page failed to load'));
    expect(container.querySelector('.wos-window-route-loading')).toBeTruthy();
    expect(container.querySelector('.wos-state-block[data-tone="danger"]')).toBeTruthy();
    expect(container.textContent).toContain('This app page could not be loaded.');
    expect(container.querySelector('.ui-error-state')).toBeNull();
    expect(container.textContent).not.toContain('MissingExport');
    expect(container.textContent).not.toContain('/Users/patrick');
    expect(container.textContent).not.toContain('dist/frontend.js');
  });
});
