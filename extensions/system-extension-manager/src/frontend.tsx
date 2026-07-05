import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { QuietLoadingState, WindowedLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, type ReactNode, Suspense } from 'react';

const LazyExtensionManagerPage = lazy(async () => ({ default: (await import('./panels.js')).ExtensionManagerPage }));
const LazyExtensionDetailsRail = lazy(async () => ({ default: (await import('./panels.js')).ExtensionDetailsRail }));
const LazyExtensionRepositoriesSettingsPanel = lazy(async () => ({
  default: (await import('./panels.js')).ExtensionRepositoriesSettingsPanel,
}));

function loadingFallback(props: ExtensionSurfaceProps, label: string): ReactNode {
  if (props.context?.shellPresentation === 'windowed') {
    return <WindowedLoadingState label={label} />;
  }
  return <QuietLoadingState label={label} />;
}

export function ExtensionManagerPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading App Manager')}>
      <LazyExtensionManagerPage {...props} />
    </Suspense>
  );
}

export function ExtensionDetailsRail(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading app package details')}>
      <LazyExtensionDetailsRail {...props} />
    </Suspense>
  );
}

export function ExtensionRepositoriesSettingsPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading app repository settings')}>
      <LazyExtensionRepositoriesSettingsPanel {...props} />
    </Suspense>
  );
}
