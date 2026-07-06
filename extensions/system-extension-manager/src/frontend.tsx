import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { WindowedLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, type ReactNode, Suspense } from 'react';

const LazyExtensionManagerPage = lazy(async () => ({ default: (await import('./panels.js')).ExtensionManagerPage }));
const LazyExtensionRepositoriesSettingsPanel = lazy(async () => ({
  default: (await import('./panels.js')).ExtensionRepositoriesSettingsPanel,
}));

function loadingFallback(label: string): ReactNode {
  return <WindowedLoadingState label={label} />;
}

export function ExtensionManagerPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback('Loading App Manager')}>
      <LazyExtensionManagerPage {...props} />
    </Suspense>
  );
}

export function ExtensionRepositoriesSettingsPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback('Loading app repository settings')}>
      <LazyExtensionRepositoriesSettingsPanel {...props} />
    </Suspense>
  );
}
