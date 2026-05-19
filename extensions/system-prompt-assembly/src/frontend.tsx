import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import React, { lazy, Suspense } from 'react';

const LazyPromptAssemblyPage = lazy(async () => ({ default: (await import('./page.js')).PromptAssemblyPage }));
const fallback = <div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Loading prompt assembly…</div>;

export function PromptAssemblyPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyPromptAssemblyPage {...props} />
    </Suspense>
  );
}
