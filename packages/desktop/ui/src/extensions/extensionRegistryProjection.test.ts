import { describe, expect, it } from 'vitest';

import { normalizeExtensionRegistryState } from './extensionRegistryProjection';
import type { ExtensionInstallSummary, ExtensionRouteSummary, ExtensionSurfaceSummary } from './types';

function extension(id: string, enabled: boolean): ExtensionInstallSummary {
  return {
    id,
    name: id,
    enabled,
    manifest: {
      schemaVersion: 2,
      id,
      name: id,
      frontend: { entry: `/extensions/${id}/index.js` },
      contributes: {
        toolbarActions: [{ id: 'action', title: 'Action', icon: 'sparkle', action: `${id}.action` }],
      },
    },
    routes: [],
    surfaces: [],
  };
}

describe('extensionRegistryProjection', () => {
  it('projects only enabled extension routes, surfaces, and contributions', () => {
    const routes: ExtensionRouteSummary[] = [
      { route: '/enabled', extensionId: 'enabled-extension', surfaceId: 'enabled-surface' },
      { route: '/disabled', extensionId: 'disabled-extension', surfaceId: 'disabled-surface' },
    ];
    const surfaces: ExtensionSurfaceSummary[] = [
      {
        id: 'enabled-surface',
        extensionId: 'enabled-extension',
        placement: 'left',
        kind: 'navItem',
        label: 'Enabled',
        route: '/enabled',
      },
      {
        id: 'disabled-surface',
        extensionId: 'disabled-extension',
        placement: 'left',
        kind: 'navItem',
        label: 'Disabled',
        route: '/disabled',
      },
    ];

    const state = normalizeExtensionRegistryState(
      [extension('enabled-extension', true), extension('disabled-extension', false)],
      routes,
      surfaces,
      {},
    );

    expect(state.extensions.map((item) => item.id)).toEqual(['enabled-extension', 'disabled-extension']);
    expect(state.routes.map((route) => route.route)).toEqual(['/enabled']);
    expect(state.surfaces.map((surface) => surface.id)).toEqual(['enabled-surface']);
    expect(state.toolbarActions.map((action) => action.action)).toEqual(['enabled-extension.action']);
  });

  it('collects widgets from enabled extensions sorted by order', () => {
    const state = normalizeExtensionRegistryState(
      [
        { ...extension('ext-a', true), manifest: { ...extension('ext-a', true).manifest, id: 'ext-a', name: 'ext-a' } },
        { ...extension('ext-b', true), manifest: { ...extension('ext-b', true).manifest, id: 'ext-b', name: 'ext-b' } },
      ],
      [],
      [],
      {},
    );

    expect(state.widgets).toHaveLength(0);
  });

  it('projects widgets from enabled extensions sorted by order', () => {
    const extA: ExtensionInstallSummary = {
      ...extension('ext-a', true),
      manifest: {
        schemaVersion: 2,
        id: 'ext-a',
        name: 'ext-a',
        frontend: { entry: '/extensions/ext-a/index.js' },
        contributes: {
          widgets: [
            { id: 'widget-2', title: 'Widget 2', component: 'WidgetTwo', order: 2 },
            { id: 'widget-1', title: 'Widget 1', component: 'WidgetOne', order: 1 },
          ],
        },
      },
    };

    const extB: ExtensionInstallSummary = {
      ...extension('ext-b', true),
      manifest: {
        schemaVersion: 2,
        id: 'ext-b',
        name: 'ext-b',
        frontend: { entry: '/extensions/ext-b/index.js' },
        contributes: {
          widgets: [{ id: 'widget-3', title: 'Widget 3', component: 'WidgetThree', order: 0 }],
        },
      },
    };

    const state = normalizeExtensionRegistryState([extA, extB], [], [], {});

    expect(state.widgets).toHaveLength(3);
    // Sorted by order asc
    expect(state.widgets[0].id).toBe('widget-3'); // order 0
    expect(state.widgets[1].id).toBe('widget-1'); // order 1
    expect(state.widgets[2].id).toBe('widget-2'); // order 2
    expect(state.widgets[0].extensionId).toBe('ext-b');
    expect(state.widgets[1].extensionId).toBe('ext-a');
    expect(state.widgets[2].extensionId).toBe('ext-a');
  });

  it('excludes widgets from disabled extensions', () => {
    const enabledExt = {
      ...extension('enabled-ext', true),
      manifest: {
        schemaVersion: 2,
        id: 'enabled-ext',
        name: 'enabled-ext',
        frontend: { entry: '/extensions/enabled-ext/index.js' },
        contributes: {
          widgets: [{ id: 'active-widget', title: 'Active', component: 'ActiveWidget' }],
        },
      },
    };

    const disabledExt = {
      ...extension('disabled-ext', false),
      manifest: {
        schemaVersion: 2,
        id: 'disabled-ext',
        name: 'disabled-ext',
        frontend: { entry: '/extensions/disabled-ext/index.js' },
        contributes: {
          widgets: [{ id: 'inactive-widget', title: 'Inactive', component: 'InactiveWidget' }],
        },
      },
    };

    const state = normalizeExtensionRegistryState([enabledExt, disabledExt], [], [], {});

    expect(state.widgets).toHaveLength(1);
    expect(state.widgets[0].id).toBe('active-widget');
    expect(state.widgets[0].extensionId).toBe('enabled-ext');
  });

  it('includes frontend entry in widget registration', () => {
    const ext = {
      ...extension('ext', true),
      manifest: {
        schemaVersion: 2,
        id: 'ext',
        name: 'ext',
        frontend: { entry: '/extensions/ext/dist/frontend.js' },
        contributes: {
          widgets: [{ id: 'my-widget', title: 'My Widget', component: 'MyWidget' }],
        },
      },
    };

    const state = normalizeExtensionRegistryState([ext], [], [], {});

    expect(state.widgets[0].frontendEntry).toBe('/extensions/ext/dist/frontend.js');
    expect(state.widgets[0].component).toBe('MyWidget');
  });

  it('supports host component reference for widget component', () => {
    const ext = {
      ...extension('ext', true),
      manifest: {
        schemaVersion: 2,
        id: 'ext',
        name: 'ext',
        frontend: { entry: '/extensions/ext/index.js' },
        contributes: {
          widgets: [{ id: 'hosted-widget', title: 'Hosted', component: { host: 'conversation.page' } }],
        },
      },
    };

    const state = normalizeExtensionRegistryState([ext], [], [], {});

    expect(state.widgets[0].component).toBe('conversation.page');
  });
});
