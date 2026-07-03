import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { QuietLoadingState, WindowedLoadingState } from '@neon-pilot/extensions/ui';
import { lazy, type ReactNode, Suspense } from 'react';

const LazyArtifactsPanel = lazy(async () => ({ default: (await import('./panels.js')).ArtifactsPanel }));
const LazyArtifactDetailPanel = lazy(async () => ({ default: (await import('./panels.js')).ArtifactDetailPanel }));
const LazyArtifactTranscriptRenderer = lazy(async () => ({ default: (await import('./panels.js')).ArtifactTranscriptRenderer }));
const fallback = <QuietLoadingState label="Loading artifacts surface" />;

function loadingFallback(props: ExtensionSurfaceProps, label: string): ReactNode {
  if (props.context?.shellPresentation === 'windowed') {
    return <WindowedLoadingState label={label} />;
  }
  return <QuietLoadingState label={label} />;
}

export function ArtifactTranscriptRenderer(props: never) {
  return (
    <Suspense fallback={fallback}>
      <LazyArtifactTranscriptRenderer {...props} />
    </Suspense>
  );
}
export function ArtifactsPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading artifacts surface')}>
      <LazyArtifactsPanel {...props} />
    </Suspense>
  );
}
export function ArtifactDetailPanel(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback(props, 'Loading artifacts surface')}>
      <LazyArtifactDetailPanel {...props} />
    </Suspense>
  );
}
