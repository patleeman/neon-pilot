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
  it('projects qualified applications and cross-extension navigation deterministically', () => {
    const owner = extension('system-agent', true);
    owner.manifest.contributes = {
      applications: [
        {
          id: 'agent',
          title: 'Agent',
          startRoute: '/conversations/new',
          instancePolicy: 'singleton',
          defaultPinned: true,
          navigationSlots: [
            { id: 'primary', order: 0 },
            { id: 'work', label: 'Work', order: 10 },
          ],
        },
      ],
    };
    const automations = extension('system-automations', true);
    automations.manifest.contributes = {
      views: [
        {
          id: 'page',
          title: 'Automations',
          location: 'main',
          route: '/automations',
          component: 'Page',
          applicationId: 'system-agent:agent',
        },
      ],
      nav: [
        {
          id: 'overview',
          label: 'Overview',
          route: '/overview',
          applicationId: 'system-agent:agent',
          slot: 'primary',
          order: 99,
        },
        {
          id: 'nav',
          label: 'Automations',
          route: '/automations',
          applicationId: 'system-agent:agent',
          slot: 'work',
          order: 10,
        },
      ],
    };

    const state = normalizeExtensionRegistryState([automations, owner], [], [], {});
    expect(state.applications).toEqual([
      expect.objectContaining({
        id: 'system-agent:agent',
        title: 'Agent',
        defaultPinned: true,
        implicit: false,
        routes: ['/conversations/new', '/automations'],
      }),
    ]);
    expect(state.applicationNavigation).toEqual([
      expect.objectContaining({ label: 'Overview', slot: 'primary', slotOrder: 0 }),
      expect.objectContaining({
        applicationId: 'system-agent:agent',
        label: 'Automations',
        slot: 'work',
        slotLabel: 'Work',
        slotOrder: 10,
      }),
    ]);
  });

  it('diagnoses and suppresses navigation with unknown application or slot targets', () => {
    const owner = extension('owner', true);
    owner.manifest.contributes = {
      applications: [
        {
          id: 'app',
          title: 'App',
          startRoute: '/app',
          navigationSlots: [{ id: 'primary' }],
        },
      ],
    };
    const contributor = extension('contributor', true);
    contributor.manifest.contributes = {
      nav: [
        { id: 'unknown-app', label: 'Unknown', route: '/unknown', applicationId: 'missing:app' },
        { id: 'unknown-slot', label: 'Wrong slot', route: '/wrong-slot', applicationId: 'owner:app', slot: 'tools' },
      ],
    };

    const state = normalizeExtensionRegistryState([owner, contributor], [], [], {});
    expect(state.applicationNavigation).toEqual([]);
    expect(state.extensions.find((item) => item.id === 'contributor')?.diagnostics).toEqual([
      expect.stringContaining('unknown application'),
      expect.stringContaining('undeclared navigation slot'),
    ]);
  });

  it('keeps disabled applications in the catalog as unavailable recovery targets', () => {
    const owner = extension('disabled-app', false);
    owner.manifest.contributes = {
      applications: [{ id: 'main', title: 'Disabled app', startRoute: '/disabled' }],
      views: [
        {
          id: 'report',
          title: 'Report',
          location: 'main',
          route: '/disabled-report',
          component: 'Report',
          applicationId: 'disabled-app:main',
        },
      ],
    };
    const state = normalizeExtensionRegistryState([owner], [], [], {});
    expect(state.applications).toEqual([
      expect.objectContaining({ id: 'disabled-app:main', available: false, routes: ['/disabled', '/disabled-report'] }),
    ]);
  });

  it('creates one implicit application for a legacy extension main page', () => {
    const legacy = extension('legacy-page', true);
    legacy.manifest.contributes = {
      views: [{ id: 'page', title: 'Legacy', location: 'main', route: '/legacy', component: 'Page' }],
      nav: [{ id: 'nav', label: 'Legacy', route: '/legacy' }],
    };
    const state = normalizeExtensionRegistryState([legacy], [], [], {});
    expect(state.applications).toEqual([expect.objectContaining({ id: 'legacy-page:default', startRoute: '/legacy', implicit: true })]);
  });

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
