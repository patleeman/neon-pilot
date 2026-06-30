import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import React, { lazy, Suspense } from 'react';

const LazyRoutinesPage = lazy(async () => ({ default: (await import('./RoutinesPage.js')).RoutinesPage }));
const LazyRoutinesSidebar = lazy(async () => ({ default: (await import('./RoutinesPage.js')).RoutinesSidebar }));
const fallback = <div role="status" aria-label="Loading routines" />;

export function RoutinesPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyRoutinesPage {...props} />
    </Suspense>
  );
}

export function RoutinesSidebar(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyRoutinesSidebar {...props} />
    </Suspense>
  );
}
