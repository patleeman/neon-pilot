import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { CenteredLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, Suspense } from 'react';

const LazySkillsPage = lazy(async () => ({ default: (await import('./SkillsPage.js')).SkillsPage }));
const fallback = <CenteredLoadingState label="Loading skills..." />;

export function SkillsPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazySkillsPage {...props} />
    </Suspense>
  );
}
