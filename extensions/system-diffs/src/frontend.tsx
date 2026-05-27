import React, { lazy, Suspense } from 'react';

const BaseCheckpointTranscriptRenderer = lazy(() =>
  import('./panels.js').then((module) => ({ default: module.CheckpointTranscriptRenderer })),
);

type CheckpointTranscriptRendererProps = {
  block: {
    status?: string;
    running?: boolean;
    error?: boolean | string;
    input?: unknown;
    output?: string;
  };
  context: {
    onOpenCheckpoint?: (checkpointId: string) => void;
    activeCheckpointId?: string | null;
  };
};

export function CheckpointTranscriptRenderer(props: CheckpointTranscriptRendererProps) {
  return (
    <Suspense fallback={null}>
      <BaseCheckpointTranscriptRenderer {...props} />
    </Suspense>
  );
}
