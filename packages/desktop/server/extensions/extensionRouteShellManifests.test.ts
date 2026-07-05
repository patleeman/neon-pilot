import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type ManifestView = {
  id: string;
  location?: string;
  placement?: string;
  scope?: string;
  route?: string;
};

type ManifestNav = {
  id: string;
  route: string;
  sidebarView?: string;
  rightSidebarView?: string;
  pageType?: string;
};

type ExtensionManifest = {
  contributes?: {
    nav?: ManifestNav[];
    views?: ManifestView[];
  };
};

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

function readManifest(extensionId: string): ExtensionManifest {
  const path = resolve(REPO_ROOT, 'extensions', extensionId, 'extension.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as ExtensionManifest;
}

function routeNav(manifest: ExtensionManifest, route: string): ManifestNav {
  const nav = manifest.contributes?.nav?.find((item) => item.route === route);
  expect(nav, `Expected nav route ${route}`).toBeDefined();
  return nav as ManifestNav;
}

function viewById(manifest: ExtensionManifest, id: string): ManifestView {
  const view = manifest.contributes?.views?.find((item) => item.id === id);
  expect(view, `Expected view ${id}`).toBeDefined();
  return view as ManifestView;
}

describe('first-party extension route shell manifests', () => {
  it('annotates bundled route pages with the pending page-type inventory', () => {
    const routes = [
      ['system-automations', '/automations', 'table'],
      ['system-gateways', '/gateways', 'setup'],
      ['system-model-arena', '/model-arena', 'dashboard'],
      ['system-routines', '/routines', 'editor'],
      ['system-dynamic-workflows', '/workflows', 'editor'],
      ['system-telemetry', '/telemetry', 'dashboard'],
      ['system-skills', '/skills', 'table'],
      ['system-extension-manager', '/extensions', 'table'],
      ['system-settings', '/settings', 'settings'],
    ] as const;

    for (const [extensionId, route, pageType] of routes) {
      const manifest = readManifest(extensionId);
      const nav = routeNav(manifest, route);
      expect(nav.pageType, `${extensionId} ${route} should declare its pending inventory page type`).toBe(pageType);
    }
  });

  it('keeps main-only routes free of contextual-left and right-sidebar declarations', () => {
    const routes = [
      ['system-automations', '/automations'],
      ['system-gateways', '/gateways'],
      ['system-model-arena', '/model-arena'],
      ['system-telemetry', '/telemetry'],
      ['system-skills', '/skills'],
    ] as const;

    for (const [extensionId, route] of routes) {
      const manifest = readManifest(extensionId);
      const nav = routeNav(manifest, route);
      expect(nav.sidebarView, `${extensionId} should leave the contextual-left area blank`).toBeUndefined();
      expect(nav.rightSidebarView, `${extensionId} should hide the right-sidebar toggle`).toBeUndefined();
      expect(manifest.contributes?.views).toContainEqual(expect.objectContaining({ location: 'main', route }));
    }
  });

  it('keeps non-chat route pages that do not own contextual navigation blank on the left', () => {
    const routes = [
      ['system-automations', '/automations'],
      ['system-gateways', '/gateways'],
      ['system-model-arena', '/model-arena'],
      ['system-telemetry', '/telemetry'],
      ['system-skills', '/skills'],
      ['system-extension-manager', '/extensions'],
    ] as const;

    for (const [extensionId, route] of routes) {
      const manifest = readManifest(extensionId);
      const nav = routeNav(manifest, route);
      expect(nav.sidebarView, `${extensionId} ${route} should leave the contextual-left area blank`).toBeUndefined();
    }
  });

  it('keeps main route views free of side-region placement and scope fields', () => {
    const extensionIds = [
      'system-automations',
      'system-gateways',
      'system-model-arena',
      'system-routines',
      'system-dynamic-workflows',
      'system-telemetry',
      'system-skills',
      'system-extension-manager',
      'system-settings',
    ];

    for (const extensionId of extensionIds) {
      const manifest = readManifest(extensionId);
      const mainViews = manifest.contributes?.views?.filter((view) => view.location === 'main') ?? [];
      expect(mainViews.length, `${extensionId} should declare at least one main route view`).toBeGreaterThan(0);
      for (const view of mainViews) {
        expect(view.placement, `${extensionId}:${view.id} should not declare side-region placement on a main view`).toBeUndefined();
        expect(view.scope, `${extensionId}:${view.id} should not declare side-region scope on a main view`).toBeUndefined();
      }
    }
  });

  it('keeps routes with contextual navigation bound to sidebar views', () => {
    const routes = [
      ['system-routines', '/routines', 'routines-sidebar'],
      ['system-dynamic-workflows', '/workflows', 'workflows-sidebar'],
      ['system-settings', '/settings', 'settings-sidebar'],
    ] as const;

    for (const [extensionId, route, sidebarView] of routes) {
      const manifest = readManifest(extensionId);
      const nav = routeNav(manifest, route);
      expect(nav.sidebarView).toBe(sidebarView);
      expect(viewById(manifest, sidebarView)).toMatchObject({ location: 'sidebar' });
    }
  });

  it('keeps every first-party sidebar view bound from a nav route', () => {
    const extensionIds = [
      'system-automations',
      'system-gateways',
      'system-model-arena',
      'system-routines',
      'system-dynamic-workflows',
      'system-telemetry',
      'system-skills',
      'system-extension-manager',
      'system-settings',
    ];

    for (const extensionId of extensionIds) {
      const manifest = readManifest(extensionId);
      const navSidebarViews = new Set((manifest.contributes?.nav ?? []).map((item) => item.sidebarView).filter(Boolean));
      const sidebarViews = manifest.contributes?.views?.filter((view) => view.location === 'sidebar') ?? [];

      for (const view of sidebarViews) {
        expect(navSidebarViews.has(view.id), `${extensionId}:${view.id} should be bound by nav[].sidebarView`).toBe(true);
      }
    }
  });

  it('keeps route-owned context rails declared as primary rightRail views', () => {
    const routes = [['system-routines', '/routines', 'routines-context-rail']] as const;

    for (const [extensionId, route, rightSidebarView] of routes) {
      const manifest = readManifest(extensionId);
      const nav = routeNav(manifest, route);
      expect(nav.rightSidebarView).toBe(rightSidebarView);
      expect(viewById(manifest, rightSidebarView)).toMatchObject({ location: 'rightRail', placement: 'primary' });
    }
  });

  it('keeps App Manager main-only so details use the route-owned dialog flow', () => {
    const routes = [
      ['system-extension-manager', '/extensions'],
      ['system-gateways', '/gateways'],
      ['system-model-arena', '/model-arena'],
      ['system-skills', '/skills'],
    ] as const;

    for (const [extensionId, route] of routes) {
      const manifest = readManifest(extensionId);
      const nav = routeNav(manifest, route);
      expect(nav.rightSidebarView).toBeUndefined();
      expect(manifest.contributes?.views?.some((view) => view.location === 'rightRail' && view.route === route)).toBe(false);
    }
  });

  it('keeps every first-party primary right sidebar view bound from a nav route', () => {
    const extensionIds = [
      'system-automations',
      'system-gateways',
      'system-model-arena',
      'system-routines',
      'system-dynamic-workflows',
      'system-telemetry',
      'system-skills',
      'system-extension-manager',
      'system-settings',
    ];

    for (const extensionId of extensionIds) {
      const manifest = readManifest(extensionId);
      const navRightSidebarViews = new Set((manifest.contributes?.nav ?? []).map((item) => item.rightSidebarView).filter(Boolean));
      const primaryRightSidebarViews =
        manifest.contributes?.views?.filter((view) => view.location === 'rightRail' && view.placement === 'primary') ?? [];

      for (const view of primaryRightSidebarViews) {
        expect(navRightSidebarViews.has(view.id), `${extensionId}:${view.id} should be bound by nav[].rightSidebarView`).toBe(true);
      }
    }
  });
});
