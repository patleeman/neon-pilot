import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import React, { lazy, Suspense } from 'react';

const LazyExtensionManagerPage = lazy(async () => ({ default: (await import('./panels.js')).ExtensionManagerPage }));
const fallback = <div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Loading extensions…</div>;

export function ExtensionManagerPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyExtensionManagerPage {...props} />
    </Suspense>
  );
}
