import { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { addNotification } from '../components/notifications/notificationStore';
import { ButtonLink, CenteredMessage, ErrorState, QuietLoadingState } from '../components/ui';
import { NativeExtensionSurfaceHost } from './NativeExtensionSurfaceHost';
import { isNativeExtensionPageSurface, type NativeExtensionViewSummary } from './types';
import { type ExtensionRegistryEntry, useExtensionRegistry } from './useExtensionRegistry';

const STALE_EXTENSION_ROUTES = new Set(['/gateways']);
const CRITICAL_SYSTEM_EXTENSION_PAGES: NativeExtensionViewSummary[] = [
  {
    id: 'extensions-page',
    title: 'Extensions',
    location: 'main',
    route: '/extensions',
    component: 'ExtensionManagerPage',
    placement: 'primary',
    scope: 'global',
    activation: 'on-route',
    extensionId: 'system-extension-manager',
    packageType: 'system',
    frontend: { entry: 'dist/frontend.js' },
  },
];

function routeMatches(route: string, pathname: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function compareRouteMatch(left: { route: string }, right: { route: string }, pathname: string): number {
  const leftExact = left.route === pathname;
  const rightExact = right.route === pathname;
  if (leftExact !== rightExact) return leftExact ? -1 : 1;
  return right.route.length - left.route.length;
}

function findMainViewRoute(
  extensions: ExtensionRegistryEntry[],
  pathname: string,
): (NativeExtensionViewSummary & { route: string; location: 'main' }) | undefined {
  const matches: Array<NativeExtensionViewSummary & { route: string; location: 'main' }> = [];
  for (const extension of extensions) {
    if (!extension.enabled) continue;
    for (const view of extension.contributes?.views ?? []) {
      if (view.location !== 'main' || typeof view.route !== 'string' || !routeMatches(view.route, pathname)) continue;
      matches.push({
        ...view,
        extensionId: extension.id,
        packageType: extension.packageType ?? 'user',
        frontend: extension.frontend,
        location: 'main',
        route: view.route,
      });
    }
  }
  return matches.sort((left, right) => compareRouteMatch(left, right, pathname))[0];
}

function extensionSurfaceRouteKey(surface: NativeExtensionViewSummary, pathname: string, search: string, hash: string): string {
  return `${surface.extensionId}:${surface.id}:${surface.route ?? ''}:${pathname}${search}${hash}`;
}

export function ExtensionPage() {
  const location = useLocation();
  const registry = useExtensionRegistry();
  const nativeSurface = useMemo(() => {
    const surfaceMatches = registry.surfaces
      .filter((candidate): candidate is NativeExtensionViewSummary & { route: string; location: 'main' } =>
        isNativeExtensionPageSurface(candidate),
      )
      .filter((candidate) => routeMatches(candidate.route, location.pathname))
      .sort((left, right) => compareRouteMatch(left, right, location.pathname));
    return (
      surfaceMatches[0] ??
      findMainViewRoute(registry.extensions, location.pathname) ??
      CRITICAL_SYSTEM_EXTENSION_PAGES.find((candidate) => routeMatches(candidate.route ?? '', location.pathname))
    );
  }, [location.pathname, registry.extensions, registry.surfaces]);
  const staleExtensionRoute = STALE_EXTENSION_ROUTES.has(location.pathname);

  useEffect(() => {
    if (registry.error) {
      addNotification({ type: 'error', message: `Extension registry error: ${registry.error}`, source: 'core' });
    }
  }, [registry.error]);

  if (registry.loading && !nativeSurface) {
    return <QuietExtensionPageLoading />;
  }

  if (registry.error && !nativeSurface) {
    return <ErrorState message={`Extensions unavailable: ${registry.error}`} />;
  }

  if (nativeSurface) {
    return (
      <NativeExtensionSurfaceHost
        key={extensionSurfaceRouteKey(nativeSurface, location.pathname, location.search, location.hash)}
        surface={nativeSurface}
        pathname={location.pathname}
        search={location.search}
        hash={location.hash}
      />
    );
  }

  if (staleExtensionRoute) {
    return <Navigate to="/conversations/new" replace />;
  }

  return (
    <CenteredMessage
      eyebrow="Route unavailable"
      title="No page is registered here"
      body="This address does not match a conversation, setting, or installed extension page."
      actions={
        <ButtonLink href="/conversations/new" variant="action">
          Go to Chat
        </ButtonLink>
      }
    />
  );
}

function QuietExtensionPageLoading() {
  return <QuietLoadingState label="Loading extension page" />;
}
