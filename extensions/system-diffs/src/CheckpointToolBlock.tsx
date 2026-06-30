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

type RoutineActivityStep = {
  routineId: string;
  routineName: string;
  status: 'passed' | 'warned' | 'blocked' | 'failed' | 'skipped';
  outcome?: string;
  message?: string;
  fallbackUsed?: boolean;
  provider?: string;
};

type RoutineActivityRun = {
  id: string;
  hookId: string;
  position: 'before' | 'after';
  status: RoutineActivityStep['status'];
  steps: RoutineActivityStep[];
};

type CheckpointPresentation = {
  conversationId?: string;
  checkpointId: string;
  shortSha: string;
  subject: string;
  fileCount?: number;
  linesAdded?: number;
  linesDeleted?: number;
  updatedAt?: string;
  routineHooks?: RoutineActivityRun[];
};

function stripAnsiForTranscript(value: string): string {
  const escape = String.fromCharCode(27);
  const bell = String.fromCharCode(7);
  const oscPattern = new RegExp(`${escape}\\][^${bell}${escape}]*(?:${bell}|${escape}\\\\)`, 'gu');
  const csiPattern = new RegExp(`${escape}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'gu');

  return value.replace(oscPattern, '').replace(csiPattern, '');
}

function formatHookLabel(hookId: string): string {
  if (hookId === 'checkpoint') return 'checkpoint';
  return hookId
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function routineActivityTitle(run: RoutineActivityRun): string {
  const position = run.position === 'before' ? 'Before' : 'After';
  const hook = formatHookLabel(run.hookId);
  return hook ? `${position} ${hook}` : `${position} hook`;
}

function statusTone(status: RoutineActivityStep['status'] | RoutineActivityRun['status']): string {
  switch (status) {
    case 'passed':
      return 'text-success';
    case 'warned':
      return 'text-warning';
    case 'blocked':
    case 'failed':
      return 'text-danger';
    default:
      return 'text-dim';
  }
}

function stepSummary(step: RoutineActivityStep): string {
  if (step.outcome) return step.outcome;
  if (step.message) return step.message;
  if (step.fallbackUsed && step.provider) return `fallback ${step.provider}`;
  if (step.fallbackUsed) return 'fallback model';
  return step.status;
}

function RoutineActivityBlock({ run }: { run: RoutineActivityRun }) {
  return (
    <div className="bg-black/5 px-3 py-2 text-[12px]">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[10px] uppercase tracking-[0.08em] text-dim">Routine activity</span>
        <span className="font-medium text-secondary">{routineActivityTitle(run)}</span>
        <span className={cx('text-[11px]', statusTone(run.status))}>{run.status}</span>
      </div>
      <div className="space-y-1">
        {run.steps.map((step, index) => (
          <div key={`${run.id}:${step.routineId}:${index}`} className="grid grid-cols-[1.35rem_minmax(0,1fr)_auto] items-start gap-2">
            <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-[10px] leading-4 tabular-nums text-secondary">{index + 1}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium leading-4 text-primary">{step.routineName}</span>
              {step.message && step.outcome ? (
                <span className="block truncate text-[11px] leading-4 text-secondary">{step.message}</span>
              ) : null}
            </span>
            <span className={cx('max-w-[11rem] truncate text-right text-[11px] leading-4', statusTone(step.status))}>
              {stepSummary(step)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
  const routineHooks = checkpoint.routineHooks ?? [];
  const beforeRoutineHooks = routineHooks.filter((run) => run.position === 'before');
  const afterRoutineHooks = routineHooks.filter((run) => run.position === 'after');
  const hasRoutineActivity = beforeRoutineHooks.length > 0 || afterRoutineHooks.length > 0;

  return (
    <SurfacePanel
      muted
      className={cx(
        'text-[12px] transition-colors',
        hasRoutineActivity ? 'overflow-hidden p-0' : 'px-3 py-2.5',
        isError ? 'ui-surface-danger-soft' : 'ui-surface-success-soft',
      )}
    >
      {beforeRoutineHooks.map((run) => (
        <RoutineActivityBlock key={run.id} run={run} />
      ))}
      <div className={cx('flex items-start gap-2.5', hasRoutineActivity && 'px-3 py-2.5')}>
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
      {afterRoutineHooks.map((run) => (
        <RoutineActivityBlock key={run.id} run={run} />
      ))}
    </SurfacePanel>
  );
});

export { CheckpointToolBlock };
