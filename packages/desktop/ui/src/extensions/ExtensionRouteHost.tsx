import { WindowedStateBlock } from '@neon-pilot/windowed-os-ui';
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
    <Suspense fallback={<ExtensionRouteLoading />}>
      <ExtensionPage key={routeKey} />
    </Suspense>
  );
}

function ExtensionRouteLoading() {
  return (
    <div className="wos-window-route-loading" role="status" aria-live="polite" aria-label="Loading app page">
      <WindowedStateBlock title="Loading app page">Preparing the window contents.</WindowedStateBlock>
    </div>
  );
}
