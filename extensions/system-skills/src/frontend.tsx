import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import React, { lazy, Suspense } from 'react';

const LazySkillsPage = lazy(async () => ({ default: (await import('./SkillsPage.js')).SkillsPage }));
const fallback = <div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Loading skills…</div>;

export function SkillsPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazySkillsPage {...props} />
    </Suspense>
  );
}
