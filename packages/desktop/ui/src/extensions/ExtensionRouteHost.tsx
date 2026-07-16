import { Suspense } from 'react';

import { QuietLoadingState } from '../components/ui';
import { lazyRouteWithRecovery } from '../navigation/lazyRouteRecovery';

const ExtensionPage = lazyRouteWithRecovery('extension-page', () =>
  import('./ExtensionPage').then((module) => ({ default: module.ExtensionPage })),
);

export function ExtensionRouteHost() {
  return (
    <Suspense fallback={<QuietExtensionRouteLoading />}>
      <ExtensionPage />
    </Suspense>
  );
}

export function QuietExtensionRouteLoading() {
  return <QuietLoadingState label="Loading extension page" />;
}
