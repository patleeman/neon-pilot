import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { QuietLoadingState, WindowedLoadingState } from '@neon-pilot/extensions/ui';
import { lazy, type ReactNode, Suspense } from 'react';

const LazyWorkspaceFilesPanel = lazy(async () => ({ default: (await import('./panels.js')).WorkspaceFilesPanel }));
const LazyWorkspaceFileDetailPanel = lazy(async () => ({ default: (await import('./panels.js')).WorkspaceFileDetailPanel }));

function loadingFallback(props: ExtensionSurfaceProps, label: string): ReactNode {
  if (props.context?.shellPresentation === 'windowed') {
    return <WindowedLoadingState label={label} />;
  }
  return <QuietLoadingState label={label} />;
}

export function WorkspaceFilesPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading workspace surface')}>
      <LazyWorkspaceFilesPanel {...props} />
    </Suspense>
  );
}

export function WorkspaceFileDetailPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading workspace surface')}>
      <LazyWorkspaceFileDetailPanel {...props} />
    </Suspense>
  );
}
