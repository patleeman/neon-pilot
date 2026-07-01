import { type ExtensionRegistryEntry } from '../../extensions/extensionRegistryProjection';
import {
  type ExtensionSurfaceSummary,
  getExtensionViewPlacement,
  isNativeExtensionRightRailSurface,
  isNativeExtensionSidebarSurface,
  type NativeExtensionViewSummary,
} from '../../extensions/types';
import { routeMatchesPrefix } from '../../navigation/routeRegistry';

export interface RouteShellNavItem {
  extensionId?: string;
  route: string;
  sidebarView?: string;
  rightSidebarView?: string;
}

export function isChatShellRoute(pathname: string): boolean {
  return routeMatchesPrefix(pathname, '/conversations');
}

export function buildRouteShellNavItems(extensions: ExtensionRegistryEntry[]): RouteShellNavItem[] {
  return extensions.flatMap((extension) => {
    if (!extension.enabled) return [];
    return (extension.contributes?.nav ?? []).map((item) => ({
      extensionId: extension.id,
      route: item.route,
      sidebarView: item.sidebarView,
      rightSidebarView: item.rightSidebarView,
    }));
  });
}

export function resolveActiveRouteShellNavItem(pathname: string, navItems: readonly RouteShellNavItem[]): RouteShellNavItem | null {
  const matching = navItems
    .filter((item) => routeMatchesPrefix(pathname, item.route))
    .sort((left, right) => right.route.length - left.route.length);
  return matching[0] ?? null;
}

export function resolveRouteSidebarSurface(input: {
  pathname: string;
  navItems: readonly RouteShellNavItem[];
  surfaces: readonly ExtensionSurfaceSummary[];
}): (NativeExtensionViewSummary & { location: 'sidebar' }) | null {
  const navItem = resolveActiveRouteShellNavItem(input.pathname, input.navItems);
  if (!navItem?.extensionId || !navItem.sidebarView) return null;
  return (
    input.surfaces.find(
      (surface) =>
        surface.extensionId === navItem.extensionId && surface.id === navItem.sidebarView && isNativeExtensionSidebarSurface(surface),
    ) ?? null
  );
}

export function resolveRouteRightSidebarSurface(input: {
  pathname: string;
  navItems: readonly RouteShellNavItem[];
  surfaces: readonly ExtensionSurfaceSummary[];
}): (NativeExtensionViewSummary & { location: 'rightRail' }) | null {
  const navItem = resolveActiveRouteShellNavItem(input.pathname, input.navItems);
  if (!navItem?.extensionId || !navItem.rightSidebarView) return null;
  return (
    input.surfaces.find(
      (surface) =>
        surface.extensionId === navItem.extensionId &&
        surface.id === navItem.rightSidebarView &&
        isNativeExtensionRightRailSurface(surface) &&
        getExtensionViewPlacement(surface) === 'primary',
    ) ?? null
  );
}
