import { timeAgo } from '@neon-pilot/extensions/data';
import {
  CardMeta,
  CardTitle,
  CheckpointInlineDiff,
  cx,
  InlineMeta,
  Pill,
  RowButton,
  Spinner,
  SurfacePanel,
} from '@neon-pilot/extensions/ui';
import React, { memo, useState } from 'react';

type CheckpointPresentation = {
  conversationId?: string;
  checkpointId: string;
  shortSha: string;
  subject: string;
  fileCount?: number;
  linesAdded?: number;
  linesDeleted?: number;
  updatedAt?: string;
};

function stripAnsiForTranscript(value: string): string {
  const escape = String.fromCharCode(27);
  const bell = String.fromCharCode(7);
  const oscPattern = new RegExp(`${escape}\\][^${bell}${escape}]*(?:${bell}|${escape}\\\\)`, 'gu');
  const csiPattern = new RegExp(`${escape}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'gu');

  return value.replace(oscPattern, '').replace(csiPattern, '');
}

const CheckpointToolBlock = memo(function CheckpointToolBlock({
  block,
  checkpoint,
}: {
  block: { status?: string; running?: boolean; error?: boolean | string; output?: string };
  checkpoint: CheckpointPresentation;
  onOpenCheckpoint?: (checkpointId: string) => void;
  activeCheckpointId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const isRunning = block.status === 'running' || !!block.running;
  const output = stripAnsiForTranscript(block.output ?? '');
  const isError =
    block.status === 'error' ||
    !!block.error ||
    /\b(refusing to checkpoint|failed to push|rejected|non-fast-forward|error:)\b/i.test(output);
  const commentCount = (checkpoint as { commentCount?: number }).commentCount;

  return (
    <SurfacePanel
      muted
      className={cx('px-3 py-2.5 text-[12px] transition-colors', isError ? 'ui-surface-danger-soft' : 'ui-surface-success-soft')}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-[13px] text-success">✓</span>
        <div className="min-w-0 flex-1">
          <RowButton
            type="button"
            compact
            className="group -mx-1 w-[calc(100%+0.5rem)] items-start justify-between gap-3 px-1 py-1"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <CardTitle as="span" className="truncate">
                  {checkpoint.subject}
                </CardTitle>
                <Pill tone={isError ? 'danger' : 'success'} mono>
                  {checkpoint.shortSha}
                </Pill>
                {typeof checkpoint.fileCount === 'number' ? <CardMeta as="span">{checkpoint.fileCount} files</CardMeta> : null}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
                {typeof checkpoint.linesAdded === 'number' && typeof checkpoint.linesDeleted === 'number' ? (
                  <span className="font-mono tabular-nums text-secondary">
                    <span className="text-success">+{checkpoint.linesAdded}</span>{' '}
                    <span className="text-danger">-{checkpoint.linesDeleted}</span>
                  </span>
                ) : null}
                {typeof commentCount === 'number' && commentCount > 0 ? (
                  <InlineMeta>
                    {commentCount} comment{commentCount === 1 ? '' : 's'}
                  </InlineMeta>
                ) : null}
                {checkpoint.updatedAt && <InlineMeta>updated {timeAgo(checkpoint.updatedAt)}</InlineMeta>}
              </span>
            </span>
            <span className={cx('mt-0.5 text-dim transition-transform', collapsed && '-rotate-90')} aria-hidden="true">
              ▾
            </span>
          </RowButton>
          {!collapsed && isError && output && <p className="mt-2 text-[12px] leading-relaxed text-danger/85">{output}</p>}
          {!collapsed && isRunning ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <InlineMeta>
                <Spinner />
                saving checkpoint…
              </InlineMeta>
            </div>
          ) : !collapsed && !isError && checkpoint.conversationId ? (
            <CheckpointInlineDiff conversationId={checkpoint.conversationId} checkpointId={checkpoint.checkpointId} />
          ) : null}
        </div>
      </div>
    </SurfacePanel>
  );
});

export { CheckpointToolBlock };
