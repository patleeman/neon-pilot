import { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { addNotification } from '../components/notifications/notificationStore';
import { ErrorState, LoadingState } from '../components/ui';
import { NativeExtensionSurfaceHost } from './NativeExtensionSurfaceHost';
import { type NativeExtensionViewSummary, isNativeExtensionPageSurface } from './types';
import { useExtensionRegistry } from './useExtensionRegistry';

const STALE_EXTENSION_ROUTES = new Set(['/gateways', '/local-models']);
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

export function ExtensionPage() {
  const location = useLocation();
  const registry = useExtensionRegistry();
  const nativeSurface = useMemo(
    () =>
      registry.surfaces.find((candidate) => isNativeExtensionPageSurface(candidate) && routeMatches(candidate.route, location.pathname)) ??
      CRITICAL_SYSTEM_EXTENSION_PAGES.find((candidate) => routeMatches(candidate.route ?? '', location.pathname)),
    [location.pathname, registry.surfaces],
  );
  const staleExtensionRoute = STALE_EXTENSION_ROUTES.has(location.pathname);

  useEffect(() => {
    if (registry.error) {
      addNotification({ type: 'error', message: `Extension registry error: ${registry.error}`, source: 'core' });
    }
  }, [registry.error]);

  useEffect(() => {
    if (!registry.loading && !registry.error && !nativeSurface && !staleExtensionRoute) {
      addNotification({ type: 'warning', message: `No extension registered for route: ${location.pathname}`, source: 'core' });
    }
  }, [location.pathname, nativeSurface, registry.loading, registry.error, staleExtensionRoute]);

  if (registry.loading && !nativeSurface) {
    return <LoadingState label="Loading extension…" />;
  }

  if (registry.error && !nativeSurface) {
    return <ErrorState message={`Extensions unavailable: ${registry.error}`} />;
  }

  if (nativeSurface) {
    return (
      <NativeExtensionSurfaceHost surface={nativeSurface} pathname={location.pathname} search={location.search} hash={location.hash} />
    );
  }

  if (staleExtensionRoute) {
    return <Navigate to="/conversations/new" replace />;
  }

  return <ErrorState message="Extension surface unavailable: no native extension page is registered for this route." />;
}
