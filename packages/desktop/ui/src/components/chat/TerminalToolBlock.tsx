import { memo, useState } from 'react';

import type { MessageBlock } from '../../shared/types';
import { timeAgo } from '../../shared/utils';
import { useAllRuns } from '../../store';
import { readTerminalBashToolPresentation } from '../../transcript/terminalBashBlock';
import { Button, cx, Pill } from '../ui';
import { InlineTraceRunCard } from './InlineTraceRunCard.js';
import { buildInlineRunExpansionKey } from './linkedRunPolling.js';
import { readMentionedLinkedRunsFromText } from './linkedRuns.js';
import { MessageActions } from './MessageActions.js';

const TerminalToolBlock = memo(function TerminalToolBlock({
  block,
  onHydrateMessage,
  hydratingMessageBlockIds,
}: {
  block: Extract<MessageBlock, { type: 'tool_use' }>;
  onHydrateMessage?: (blockId: string) => Promise<void> | void;
  hydratingMessageBlockIds?: ReadonlySet<string>;
}) {
  const presentation = readTerminalBashToolPresentation(block);
  if (!presentation) {
    return null;
  }

  const isRunning = block.status === 'running' || !!block.running;
  const isError = block.status === 'error' || !!block.error || ((presentation.exitCode ?? 0) !== 0 && presentation.exitCode !== undefined);
  const blockId = typeof block.id === 'string' ? block.id.trim() : '';
  const outputDeferred = Boolean(block.outputDeferred && blockId && onHydrateMessage);
  const hydratingDeferredOutput = Boolean(blockId && hydratingMessageBlockIds?.has(blockId));
  const prefetchDeferredOutput = () => {
    if (!outputDeferred || !blockId || hydratingDeferredOutput) {
      return;
    }

    void onHydrateMessage?.(blockId);
  };
  const hasBody = isRunning || block.output || outputDeferred;
  const copyText = block.output ? `$ ${presentation.command}\n${block.output}` : `$ ${presentation.command}`;
  const footerBits: string[] = [];
  const runs = useAllRuns();
  const knownRunIds = new Set((runs?.runs ?? []).map((run) => run.runId));
  const linkedRuns = block.output ? readMentionedLinkedRunsFromText(block.output).filter((run) => knownRunIds.has(run.runId)) : [];
  const [expandedRunKeys, setExpandedRunKeys] = useState<Set<string>>(() => new Set());

  if (presentation.cancelled) {
    footerBits.push('cancelled');
  } else if (presentation.exitCode !== undefined) {
    footerBits.push(`exit ${presentation.exitCode}`);
  } else if (isRunning) {
    footerBits.push('running');
  }

  if (presentation.truncated) {
    footerBits.push('truncated');
  }

  if (block.durationMs && !isRunning) {
    footerBits.push(`${(block.durationMs / 1000).toFixed(1)}s`);
  }

  return (
    <div className="group space-y-1.5" onMouseEnter={prefetchDeferredOutput} onFocus={prefetchDeferredOutput}>
      <div className={cx('ui-terminal-block', isError ? 'border-danger/35' : null)}>
        <div className="ui-terminal-block__chrome flex items-center gap-2 border-b px-3 py-2 text-[11px]">
          <span className="ui-terminal-block__command min-w-0 flex-1 break-all">{presentation.command}</span>
          {presentation.executionWrappers.map((wrapper) => (
            <Pill key={wrapper.id} tone="accent" mono>
              {wrapper.label ?? wrapper.id}
            </Pill>
          ))}
          {presentation.excludeFromContext && (
            <Pill tone="warning" mono>
              no context
            </Pill>
          )}
        </div>

        {hasBody && (
          <div className="px-3 py-2.5 max-h-96 overflow-y-auto">
            {block.output ? (
              <pre
                className={cx(
                  'whitespace-pre-wrap break-all text-[11px] leading-relaxed',
                  isError ? 'text-danger/85' : 'ui-terminal-block__output',
                )}
              >
                {block.output}
              </pre>
            ) : isRunning ? (
              <p className="ui-terminal-block__muted text-[11px] italic leading-relaxed">Waiting for output…</p>
            ) : outputDeferred ? (
              <p className="ui-terminal-block__muted text-[11px] italic leading-relaxed">Older terminal output is available on demand.</p>
            ) : null}
          </div>
        )}

        <div className="ui-terminal-block__chrome ui-terminal-block__muted flex flex-wrap items-center gap-2 border-t px-3 py-2 text-[10px]">
          {footerBits.map((bit) => (
            <span key={bit}>{bit}</span>
          ))}
          {presentation.fullOutputPath && <span className="min-w-0 break-all opacity-80">{presentation.fullOutputPath}</span>}
          {outputDeferred && blockId && (
            <Button
              variant="action"
              onClick={() => {
                void onHydrateMessage?.(blockId);
              }}
              disabled={hydratingDeferredOutput}
              className="text-[10px]"
            >
              {hydratingDeferredOutput ? 'Loading full output…' : 'Load full output'}
            </Button>
          )}
          <span className="ml-auto">{timeAgo(block.ts)}</span>
        </div>
      </div>

      {linkedRuns.length > 0 && (
        <div className="space-y-1.5">
          {linkedRuns.map((run) => {
            const inlineRunKey = buildInlineRunExpansionKey(0, `${blockId ?? 'terminal'}:${run.runId}`);
            const expanded = expandedRunKeys.has(inlineRunKey);
            return (
              <InlineTraceRunCard
                key={inlineRunKey}
                run={run}
                expanded={expanded}
                onToggle={() =>
                  setExpandedRunKeys((current) => {
                    const next = new Set(current);
                    if (next.has(inlineRunKey)) {
                      next.delete(inlineRunKey);
                    } else {
                      next.add(inlineRunKey);
                    }
                    return next;
                  })
                }
              />
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="flex-1" />
        <MessageActions blockText={block.output ?? ''} blockId={blockId} copyText={copyText} />
      </div>
    </div>
  );
});

export { TerminalToolBlock };
