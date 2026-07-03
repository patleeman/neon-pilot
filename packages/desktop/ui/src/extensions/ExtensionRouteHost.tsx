import { WindowedStateBlock } from '@neon-pilot/windowed-os-ui';
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

export function ExtensionRouteHost({ shellPresentation = 'stable' }: { shellPresentation?: 'stable' | 'windowed' }) {
  const location = useLocation();
  const routeKey = buildExtensionRouteKey(location.pathname, location.search);

  return (
    <Suspense fallback={<ExtensionRouteLoading shellPresentation={shellPresentation} />}>
      <ExtensionPage key={routeKey} shellPresentation={shellPresentation} />
    </Suspense>
  );
}

export function QuietExtensionRouteLoading() {
  return <QuietLoadingState label="Loading extension page" />;
}

function ExtensionRouteLoading({ shellPresentation }: { shellPresentation: 'stable' | 'windowed' }) {
  if (shellPresentation !== 'windowed') {
    return <QuietExtensionRouteLoading />;
  }
  return (
    <div className="wos-window-route-loading" role="status" aria-live="polite" aria-label="Loading extension page">
      <WindowedStateBlock title="Loading extension page">Preparing the window contents.</WindowedStateBlock>
    </div>
  );
}
