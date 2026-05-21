import React from 'react';

import { CheckpointTranscriptRenderer as BaseCheckpointTranscriptRenderer } from './panels.js';

type CheckpointTranscriptRendererProps = Parameters<typeof BaseCheckpointTranscriptRenderer>[0];

export function CheckpointTranscriptRenderer(props: CheckpointTranscriptRendererProps) {
  return <BaseCheckpointTranscriptRenderer {...props} />;
}
