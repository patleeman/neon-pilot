import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { QuietLoadingState, WindowedLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, type ReactNode, Suspense } from 'react';

const LazySkillsPage = lazy(async () => ({ default: (await import('./SkillsPage.js')).SkillsPage }));

function loadingFallback(props: ExtensionSurfaceProps, label: string): ReactNode {
  if (props.context?.shellPresentation === 'windowed') {
    return <WindowedLoadingState label={label} />;
  }
  return <QuietLoadingState label={label} />;
}

export function SkillsPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading skills page')}>
      <LazySkillsPage {...props} />
    </Suspense>
  );
}
