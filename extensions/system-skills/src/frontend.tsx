import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { QuietLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, Suspense } from 'react';

const LazySkillsPage = lazy(async () => ({ default: (await import('./SkillsPage.js')).SkillsPage }));
const LazySkillsContextRail = lazy(async () => ({ default: (await import('./SkillsPage.js')).SkillsContextRail }));

export function SkillsPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={<QuietLoadingState label="Loading skills page" />}>
      <LazySkillsPage {...props} />
    </Suspense>
  );
}

export function SkillsContextRail(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={<QuietLoadingState label="Loading skill details" />}>
      <LazySkillsContextRail {...props} />
    </Suspense>
  );
}
