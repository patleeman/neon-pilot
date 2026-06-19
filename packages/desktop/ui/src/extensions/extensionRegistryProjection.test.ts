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
});
