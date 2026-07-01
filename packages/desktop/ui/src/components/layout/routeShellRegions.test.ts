import { describe, expect, it } from 'vitest';

import type { ExtensionRegistryEntry } from '../../extensions/extensionRegistryProjection';
import type { ExtensionSurfaceSummary } from '../../extensions/types';
import {
  buildRouteShellNavItems,
  isChatShellRoute,
  resolveActiveRouteShellNavItem,
  resolveRouteRightSidebarSurface,
  resolveRouteSidebarSurface,
} from './routeShellRegions';

function extension(overrides: Partial<ExtensionRegistryEntry>): ExtensionRegistryEntry {
  return {
    id: 'ext',
    name: 'Extension',
    enabled: true,
    packageRoot: '/tmp/ext',
    packageType: 'user',
    schemaVersion: 2,
    ...overrides,
  } as ExtensionRegistryEntry;
}

const surfaces = [
  {
    extensionId: 'ext',
    id: 'left',
    title: 'Left',
    location: 'sidebar',
    component: 'Left',
    frontend: { entry: 'dist/frontend.js' },
  },
  {
    extensionId: 'ext',
    id: 'right',
    title: 'Right',
    location: 'rightRail',
    scope: 'global',
    placement: 'primary',
    component: 'Right',
    frontend: { entry: 'dist/frontend.js' },
  },
] satisfies ExtensionSurfaceSummary[];

describe('route shell regions', () => {
  it('classifies conversation routes as chat shell routes', () => {
    expect(isChatShellRoute('/conversations/new')).toBe(true);
    expect(isChatShellRoute('/conversations/abc')).toBe(true);
    expect(isChatShellRoute('/automations')).toBe(false);
  });

  it('builds route shell nav items from enabled extension nav contributions', () => {
    const items = buildRouteShellNavItems([
      extension({
        contributes: {
          nav: [{ id: 'routines', label: 'Routines', route: '/routines', sidebarView: 'left', rightSidebarView: 'right' }],
        },
      }),
      extension({
        id: 'disabled',
        enabled: false,
        contributes: {
          nav: [{ id: 'disabled', label: 'Disabled', route: '/disabled', sidebarView: 'left' }],
        },
      }),
    ]);

    expect(items).toEqual([{ extensionId: 'ext', route: '/routines', sidebarView: 'left', rightSidebarView: 'right' }]);
  });

  it('uses the most specific matching route declaration', () => {
    const active = resolveActiveRouteShellNavItem('/routines/checkpoint', [
      { extensionId: 'ext', route: '/routines', sidebarView: 'broad' },
      { extensionId: 'ext', route: '/routines/checkpoint', sidebarView: 'specific' },
    ]);

    expect(active?.sidebarView).toBe('specific');
  });

  it('does not match sibling route prefixes', () => {
    expect(resolveActiveRouteShellNavItem('/routines-extra', [{ extensionId: 'ext', route: '/routines', sidebarView: 'left' }])).toBeNull();
  });

  it('resolves declared left and right route surfaces', () => {
    const navItems = [{ extensionId: 'ext', route: '/routines', sidebarView: 'left', rightSidebarView: 'right' }];

    expect(resolveRouteSidebarSurface({ pathname: '/routines', navItems, surfaces })?.id).toBe('left');
    expect(resolveRouteRightSidebarSurface({ pathname: '/routines', navItems, surfaces })?.id).toBe('right');
  });

  it('does not invent a route rail without an explicit rightSidebarView declaration', () => {
    expect(
      resolveRouteRightSidebarSurface({
        pathname: '/routines',
        navItems: [{ extensionId: 'ext', route: '/routines', sidebarView: 'left' }],
        surfaces,
      }),
    ).toBeNull();
  });

  it('does not resolve contextual shell surfaces from another extension', () => {
    const navItems = [{ extensionId: 'other-ext', route: '/routines', sidebarView: 'left', rightSidebarView: 'right' }];

    expect(resolveRouteSidebarSurface({ pathname: '/routines', navItems, surfaces })).toBeNull();
    expect(resolveRouteRightSidebarSurface({ pathname: '/routines', navItems, surfaces })).toBeNull();
  });

  it('requires sidebar declarations to reference sidebar surfaces', () => {
    expect(
      resolveRouteSidebarSurface({
        pathname: '/routines',
        navItems: [{ extensionId: 'ext', route: '/routines', sidebarView: 'right' }],
        surfaces,
      }),
    ).toBeNull();
  });

  it('requires right-sidebar declarations to reference primary rightRail surfaces', () => {
    const workbenchToolRail = {
      extensionId: 'ext',
      id: 'workbench-tool-right',
      title: 'Workbench Tool Right',
      location: 'rightRail',
      scope: 'global',
      placement: 'workbench-tool',
      component: 'WorkbenchToolRight',
      frontend: { entry: 'dist/frontend.js' },
    } satisfies ExtensionSurfaceSummary;

    expect(
      resolveRouteRightSidebarSurface({
        pathname: '/routines',
        navItems: [{ extensionId: 'ext', route: '/routines', rightSidebarView: 'left' }],
        surfaces,
      }),
    ).toBeNull();

    expect(
      resolveRouteRightSidebarSurface({
        pathname: '/routines',
        navItems: [{ extensionId: 'ext', route: '/routines', rightSidebarView: 'workbench-tool-right' }],
        surfaces: [...surfaces, workbenchToolRail],
      }),
    ).toBeNull();
  });

  it('resolves route-owned primary right rails without requiring a scope field', () => {
    const primaryRailWithoutScope = {
      extensionId: 'ext',
      id: 'right-without-scope',
      title: 'Right Without Scope',
      location: 'rightRail',
      placement: 'primary',
      component: 'RightWithoutScope',
      frontend: { entry: 'dist/frontend.js' },
    } satisfies ExtensionSurfaceSummary;

    expect(
      resolveRouteRightSidebarSurface({
        pathname: '/routines',
        navItems: [{ extensionId: 'ext', route: '/routines', rightSidebarView: 'right-without-scope' }],
        surfaces: [...surfaces, primaryRailWithoutScope],
      })?.id,
    ).toBe('right-without-scope');
  });
});
