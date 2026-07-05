import { WindowedStateBlock } from '@neon-pilot/windowed-os-ui';
import { type ReactNode, useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { addNotification } from '../components/notifications/notificationStore';
import { ButtonLink, CenteredMessage, ErrorState, QuietLoadingState } from '../components/ui';
import { ActivityPage } from '../pages/ActivityPage';
import { NativeExtensionSurfaceHost } from './NativeExtensionSurfaceHost';
import { isNativeExtensionPageSurface, type NativeExtensionViewSummary } from './types';
import { type ExtensionRegistryEntry, useExtensionRegistry } from './useExtensionRegistry';

const STALE_EXTENSION_ROUTES = new Set<string>();
const CORE_WINDOWED_PLACEHOLDER_PAGES = new Map<
  string,
  {
    body: string;
    title: string;
  }
>([
  [
    '/documents',
    {
      title: 'Documents store pending',
      body: 'Shared app collections will appear here after the documents store lands.',
    },
  ],
  [
    '/inbox',
    {
      title: 'Inbox pending',
      body: 'Worker results, persona messages, and questions will arrive here after Inbox is wired to the documents store.',
    },
  ],
]);

const CORE_WINDOWED_FEATURE_PAGES = new Map<string, () => JSX.Element>([['/activity', () => <ActivityPage />]]);
const CRITICAL_SYSTEM_EXTENSION_PAGES: NativeExtensionViewSummary[] = [
  {
    id: 'extensions-page',
    title: 'App Manager',
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
  {
    id: 'app-manager-page',
    title: 'App Manager',
    location: 'main',
    route: '/apps',
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

export function ExtensionPage({ shellPresentation = 'windowed' }: { shellPresentation?: 'stable' | 'windowed' }) {
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
  const placeholderPage = CORE_WINDOWED_PLACEHOLDER_PAGES.get(location.pathname);
  const featurePage = CORE_WINDOWED_FEATURE_PAGES.get(location.pathname);

  useEffect(() => {
    if (registry.error) {
      addNotification({ type: 'error', message: `Extension registry error: ${registry.error}`, source: 'core' });
    }
  }, [registry.error]);

  if (nativeSurface) {
    return (
      <NativeExtensionSurfaceHost
        key={extensionSurfaceRouteKey(nativeSurface, location.pathname, location.search, location.hash)}
        surface={nativeSurface}
        pathname={location.pathname}
        search={location.search}
        hash={location.hash}
        shellPresentation={shellPresentation}
      />
    );
  }

  if (featurePage) {
    return featurePage();
  }

  if (registry.loading && !nativeSurface) {
    return <ExtensionPageLoading shellPresentation={shellPresentation} />;
  }

  if (registry.error && !nativeSurface) {
    if (shellPresentation === 'windowed') {
      return (
        <WindowedExtensionPageState tone="danger" title="Apps unavailable">
          {registry.error}
        </WindowedExtensionPageState>
      );
    }
    return <ErrorState message={`Apps unavailable: ${registry.error}`} />;
  }

  if (placeholderPage) {
    if (shellPresentation === 'windowed') {
      return <WindowedExtensionPageState title={placeholderPage.title}>{placeholderPage.body}</WindowedExtensionPageState>;
    }
    return <CenteredMessage eyebrow="Core app pending" title={placeholderPage.title} body={placeholderPage.body} />;
  }

  if (staleExtensionRoute) {
    return <Navigate to="/conversations/new" replace />;
  }

  if (shellPresentation === 'windowed') {
    return (
      <WindowedExtensionPageState title="No page is registered here">
        This address does not match a conversation, setting, or installed app page.
      </WindowedExtensionPageState>
    );
  }

  return (
    <CenteredMessage
      eyebrow="Route unavailable"
      title="No page is registered here"
      body="This address does not match a conversation, setting, or installed app page."
      actions={
        <ButtonLink href="/conversations/new" variant="action">
          Go to Chat
        </ButtonLink>
      }
    />
  );
}

function ExtensionPageLoading({ shellPresentation }: { shellPresentation: 'stable' | 'windowed' }) {
  if (shellPresentation === 'windowed') {
    return <WindowedExtensionPageState title="Loading app page">Preparing the window contents.</WindowedExtensionPageState>;
  }
  return <QuietLoadingState label="Loading app page" />;
}

function WindowedExtensionPageState({
  children,
  title,
  tone,
}: {
  children: ReactNode;
  title: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}) {
  return (
    <div className="wos-window-route-loading" role="status" aria-live="polite" aria-label={title}>
      <WindowedStateBlock title={title} tone={tone}>
        {children}
      </WindowedStateBlock>
    </div>
  );
}
