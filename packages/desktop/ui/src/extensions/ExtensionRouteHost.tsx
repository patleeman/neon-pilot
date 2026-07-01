import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';

import { QuietLoadingState } from '../components/ui';
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
    <Suspense fallback={<QuietExtensionRouteLoading />}>
      <ExtensionPage key={routeKey} />
    </Suspense>
  );
}

export function QuietExtensionRouteLoading() {
  return <QuietLoadingState label="Loading extension page" />;
}
