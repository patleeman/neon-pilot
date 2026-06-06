import { lazy, Suspense } from 'react';

import { PanelMessage } from '@neon-pilot/extensions/ui';

type AskProps = Parameters<typeof import('./panels.js').AskUserQuestionTranscriptRenderer>[0];
type TerminalProps = Parameters<typeof import('./panels.js').TerminalBashTranscriptRenderer>[0];
const LazyAskUserQuestionTranscriptRenderer = lazy(async () => ({
  default: (await import('./panels.js')).AskUserQuestionTranscriptRenderer,
}));
const LazyTerminalBashTranscriptRenderer = lazy(async () => ({ default: (await import('./panels.js')).TerminalBashTranscriptRenderer }));
const fallback = <PanelMessage className="px-3 py-2">Loading tool output...</PanelMessage>;

export function AskUserQuestionTranscriptRenderer(props: AskProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyAskUserQuestionTranscriptRenderer {...props} />
    </Suspense>
  );
}
export function TerminalBashTranscriptRenderer(props: TerminalProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyTerminalBashTranscriptRenderer {...props} />
    </Suspense>
  );
}
