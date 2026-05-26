import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';

import { lazyRouteWithRecovery } from '../navigation/lazyRouteRecovery';

const ExtensionPage = lazyRouteWithRecovery('extension-page', () =>
  import('./ExtensionPage').then((module) => ({ default: module.ExtensionPage })),
);

export function buildExtensionRouteKey(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export function ExtensionRouteHost() {
  const location = useLocation();
  const routeKey = buildExtensionRouteKey(location.pathname, location.search);

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center px-6 text-[12px] text-dim">Loading…</div>}>
      <ExtensionPage key={routeKey} />
    </Suspense>
  );
}
