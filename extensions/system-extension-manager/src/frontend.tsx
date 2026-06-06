import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { CenteredLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, Suspense } from 'react';

const LazyExtensionManagerPage = lazy(async () => ({ default: (await import('./panels.js')).ExtensionManagerPage }));
const LazyExtensionRepositoriesSettingsPanel = lazy(async () => ({
  default: (await import('./panels.js')).ExtensionRepositoriesSettingsPanel,
}));
const fallback = <CenteredLoadingState label="Loading extensions..." />;

export function ExtensionManagerPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyExtensionManagerPage {...props} />
    </Suspense>
  );
}

export function ExtensionRepositoriesSettingsPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={<div className="py-2 text-[12px] text-dim">Loading extension repositories…</div>}>
      <LazyExtensionRepositoriesSettingsPanel {...props} />
    </Suspense>
  );
}
