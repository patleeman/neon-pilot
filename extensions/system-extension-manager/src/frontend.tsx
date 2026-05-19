import type { ExtensionSurfaceProps, NativeExtensionClient } from '@personal-agent/extensions';
import React, { lazy, Suspense } from 'react';

const LazyExtensionManagerPage = lazy(async () => ({ default: (await import('./panels.js')).ExtensionManagerPage }));
const LazyExtensionManagerSettingsPanel = lazy(async () => ({ default: (await import('./panels.js')).ExtensionManagerSettingsPanel }));
const LazySkillsPage = lazy(async () => ({ default: (await import('./skillsPage.js')).SkillsPage }));
const fallback = <div className="flex h-full items-center justify-center px-4 text-[12px] text-dim">Loading extensions…</div>;

export function ExtensionManagerPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyExtensionManagerPage {...props} />
    </Suspense>
  );
}

export function ExtensionManagerSettingsPanel(props: { pa: NativeExtensionClient }) {
  return (
    <Suspense fallback={fallback}>
      <LazyExtensionManagerSettingsPanel {...props} />
    </Suspense>
  );
}

export function SkillsPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazySkillsPage {...props} />
    </Suspense>
  );
}
