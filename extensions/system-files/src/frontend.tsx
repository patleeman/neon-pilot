import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { CenteredLoadingState } from '@neon-pilot/extensions/ui';
import { lazy, Suspense } from 'react';

const LazyWorkspaceFilesPanel = lazy(async () => ({ default: (await import('./panels.js')).WorkspaceFilesPanel }));
const LazyWorkspaceFileDetailPanel = lazy(async () => ({ default: (await import('./panels.js')).WorkspaceFileDetailPanel }));

const fallback = <CenteredLoadingState label="Loading workspace..." />;

export function WorkspaceFilesPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyWorkspaceFilesPanel {...props} />
    </Suspense>
  );
}

export function WorkspaceFileDetailPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyWorkspaceFileDetailPanel {...props} />
    </Suspense>
  );
}
