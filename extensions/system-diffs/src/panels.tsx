import { cx, Pill, SurfacePanel } from '@neon-pilot/extensions/ui';
import { readCheckpointPresentation } from '@neon-pilot/extensions/workbench-diffs';
import React from 'react';

import { CheckpointToolBlock } from './CheckpointToolBlock.js';

type CheckpointTranscriptBlock = {
  status?: string;
  running?: boolean;
  error?: boolean | string;
  input?: unknown;
  output?: string;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stripAnsiForTranscript(value: string): string {
  const escape = String.fromCharCode(27);
  const bell = String.fromCharCode(7);
  const oscPattern = new RegExp(`${escape}\\][^${bell}${escape}]*(?:${bell}|${escape}\\\\)`, 'gu');
  const csiPattern = new RegExp(`${escape}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'gu');

  return value.replace(oscPattern, '').replace(csiPattern, '');
}

function isCheckpointFailureOutput(output: unknown): boolean {
  return (
    typeof output === 'string' &&
    /\b(refusing to checkpoint|failed to push|rejected|non-fast-forward|error:)\b/i.test(stripAnsiForTranscript(output))
  );
}

function CheckpointFallbackToolBlock({ block }: { block: CheckpointTranscriptBlock }) {
  const isRunning = block.status === 'running' || !!block.running;
  const isError = block.status === 'error' || !!block.error || isCheckpointFailureOutput(block.output);
  const input = readRecord(block.input);
  const action = readString(input.action) ?? 'checkpoint';
  const message = readString(input.message);
  const output = stripAnsiForTranscript(block.output ?? '');
  const paths = Array.isArray(input.paths)
    ? input.paths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    : [];
  const title = isRunning
    ? 'Checkpoint running'
    : isError
      ? 'Checkpoint failed'
      : action === 'list'
        ? 'Listed checkpoints'
        : action === 'get'
          ? 'Loaded checkpoint'
          : 'Checkpoint';

  return (
    <SurfacePanel
      muted
      className={cx('px-3.5 py-3 text-[12px]', isError ? 'border-danger/30 bg-danger/5' : 'border-success/20 bg-success/5')}
    >
      <div className="flex items-start gap-3">
        <div className="ui-chat-avatar mt-0.5">
          <span className="ui-chat-avatar-mark">✓</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-medium text-primary">{title}</span>
            <Pill tone={isError ? 'danger' : 'success'} mono>
              {action}
            </Pill>
            {isRunning ? <span className="text-[10px] text-dim">running…</span> : null}
          </div>
          {message || paths.length > 0 ? (
            <p className="mt-2 text-[11px] leading-relaxed text-secondary">{message ?? paths.join(', ')}</p>
          ) : null}
          {output ? (
            <pre
              className={cx('mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed', isError ? 'text-danger/85' : 'text-dim')}
            >
              {output}
            </pre>
          ) : null}
        </div>
      </div>
    </SurfacePanel>
  );
}

export function CheckpointTranscriptRenderer({
  block,
  context,
}: {
  block: CheckpointTranscriptBlock;
  context: { onOpenCheckpoint?: (checkpointId: string) => void; activeCheckpointId?: string | null };
}) {
  const checkpoint = readCheckpointPresentation(block as never);
  if (!checkpoint) return <CheckpointFallbackToolBlock block={block} />;
  return (
    <CheckpointToolBlock
      block={block}
      checkpoint={checkpoint}
      onOpenCheckpoint={context.onOpenCheckpoint}
      activeCheckpointId={context.activeCheckpointId}
    />
  );
}
