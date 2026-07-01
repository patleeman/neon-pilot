import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { QuietLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, Suspense } from 'react';

const LazyExtensionManagerPage = lazy(async () => ({ default: (await import('./panels.js')).ExtensionManagerPage }));
const LazyExtensionDetailsRail = lazy(async () => ({ default: (await import('./panels.js')).ExtensionDetailsRail }));
const LazyExtensionRepositoriesSettingsPanel = lazy(async () => ({
  default: (await import('./panels.js')).ExtensionRepositoriesSettingsPanel,
}));

export function ExtensionManagerPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={<QuietLoadingState label="Loading extensions page" />}>
      <LazyExtensionManagerPage {...props} />
    </Suspense>
  );
}

export function ExtensionDetailsRail(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={<QuietLoadingState label="Loading extension details" />}>
      <LazyExtensionDetailsRail {...props} />
    </Suspense>
  );
}

export function ExtensionRepositoriesSettingsPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={<QuietLoadingState label="Loading extension repository settings" />}>
      <LazyExtensionRepositoriesSettingsPanel {...props} />
    </Suspense>
  );
}
