import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { WindowedLoadingState } from '@neon-pilot/extensions/ui';
import { lazy, type ReactNode, Suspense } from 'react';

const LazyWorkspaceFilesPanel = lazy(async () => ({ default: (await import('./panels.js')).WorkspaceFilesPanel }));
const LazyWorkspaceFileDetailPanel = lazy(async () => ({ default: (await import('./panels.js')).WorkspaceFileDetailPanel }));

function loadingFallback(label: string): ReactNode {
  return <WindowedLoadingState label={label} />;
}

export function WorkspaceFilesPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback('Loading workspace surface')}>
      <LazyWorkspaceFilesPanel {...props} />
    </Suspense>
  );
}

export function WorkspaceFileDetailPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback('Loading workspace surface')}>
      <LazyWorkspaceFileDetailPanel {...props} />
    </Suspense>
  );
}
