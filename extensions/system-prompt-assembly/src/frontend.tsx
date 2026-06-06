import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { CenteredLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, Suspense } from 'react';

const LazyPromptAssemblyPage = lazy(async () => ({ default: (await import('./page.js')).PromptAssemblyPage }));
const fallback = <CenteredLoadingState label="Loading prompt assembly..." />;

export function PromptAssemblyPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyPromptAssemblyPage {...props} />
    </Suspense>
  );
}
