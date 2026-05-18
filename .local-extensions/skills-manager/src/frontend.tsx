import type { ExtensionSurfaceProps } from '@personal-agent/extensions';
import React, { lazy, Suspense } from 'react';

const LazySkillsManagerPage = lazy(async () => ({ default: (await import('./panels.js')).SkillsManagerPage }));
const fallback = <div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Loading skills…</div>;

export function SkillsManagerPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazySkillsManagerPage {...props} />
    </Suspense>
  );
}
