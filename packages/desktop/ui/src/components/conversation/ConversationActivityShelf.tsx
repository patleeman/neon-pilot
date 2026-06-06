import { describeDeferredResumeStatus, formatDeferredResumeWhen } from '../../deferred-resume/deferredResumeIndicator';
import type { DeferredResumeSummary, ExecutionRecord, ScheduledTaskSummary } from '../../shared/types';
import { timeAgo } from '../../shared/utils';
import { cx, MetaLabel, ShelfHeader, ShelfSection, Spinner, TextButton } from '../ui';

function formatScheduledTaskSchedule(task: ScheduledTaskSummary): string {
  if (task.scheduleType === 'cron' && task.cron) return task.cron;
  if (task.at) return `at ${task.at}`;
  return task.scheduleType;
}

function formatScheduledTaskStatus(task: ScheduledTaskSummary): string {
  if (task.running) return 'running';
  if (!task.enabled) return 'disabled';
  if (task.lastStatus === 'failed') return 'failed';
  return 'enabled';
}

function formatExecutionStatusLabel(status: string | undefined): string {
  if (status === 'queued') return 'queued';
  if (status === 'waiting') return 'waiting';
  if (status === 'recovering') return 'recovering';
  return status ?? 'running';
}

function isExecutionCommand(execution: ExecutionRecord): boolean {
  return execution.kind === 'background-command';
}

function formatDeferredResumeDeliveryLabel(resume: DeferredResumeSummary): string {
  if (resume.delivery?.requireAck || resume.delivery?.mode === 'isolated') return 'Isolated attention';
  if (resume.delivery?.mode === 'sequential' || resume.behavior === 'followUp') return 'Sequential follow-up';
  if (resume.kind === 'task-callback') return 'Task callback';
  return 'Batchable wakeup';
}

export function ConversationActivityShelf({
  backgroundExecutions,
  backgroundExecutionIndicatorText,
  showBackgroundRunDetails,
  cancellingBackgroundRunIds,
  onToggleBackgroundRunDetails,
  onCancelBackgroundRun,
  onOpenBackgroundRun,
  deferredResumes,
  deferredResumeIndicatorText,
  deferredResumeNowMs,
  hasReadyDeferredResumes,
  isLiveSession,
  deferredResumesBusy,
  showDeferredResumeDetails,
  onContinueDeferredResumesNow,
  onToggleDeferredResumeDetails,
  onFireDeferredResumeNow,
  onCancelDeferredResume,
  scheduledTasks = [],
  scheduledTaskIndicatorText = 'No automations',
  showScheduledTaskDetails,
  onToggleScheduledTaskDetails,
  onRunScheduledTaskNow,
  onOpenScheduledTask,
}: {
  backgroundExecutions: ExecutionRecord[];
  backgroundExecutionIndicatorText: string;
  showBackgroundRunDetails: boolean;
  cancellingBackgroundRunIds?: Set<string>;
  onToggleBackgroundRunDetails: () => void;
  onCancelBackgroundRun?: (runId: string) => void;
  onOpenBackgroundRun?: (runId: string) => void;
  deferredResumes: DeferredResumeSummary[];
  deferredResumeIndicatorText: string;
  deferredResumeNowMs: number;
  hasReadyDeferredResumes: boolean;
  isLiveSession: boolean;
  deferredResumesBusy: boolean;
  showDeferredResumeDetails: boolean;
  onContinueDeferredResumesNow: () => void;
  onToggleDeferredResumeDetails: () => void;
  onFireDeferredResumeNow: (resumeId: string) => void;
  onCancelDeferredResume: (resumeId: string) => void;
  scheduledTasks?: ScheduledTaskSummary[];
  scheduledTaskIndicatorText?: string;
  showScheduledTaskDetails?: boolean;
  onToggleScheduledTaskDetails?: () => void;
  onRunScheduledTaskNow?: (taskId: string) => void;
  onOpenScheduledTask?: (taskId: string) => void;
}) {
  return (
    <>
      {scheduledTasks.length > 0 && (
        <ShelfSection
          header={
            <ShelfHeader
              leading={<span className="text-accent">↻</span>}
              title="Automations"
              detail={scheduledTaskIndicatorText}
              actions={
                onToggleScheduledTaskDetails ? (
                  <TextButton type="button" onClick={onToggleScheduledTaskDetails}>
                    {showScheduledTaskDetails ? 'hide' : 'details'}
                  </TextButton>
                ) : null
              }
            />
          }
        >
          {showScheduledTaskDetails ? (
            <>
              {scheduledTasks.map((task) => {
                const status = formatScheduledTaskStatus(task);
                return (
                  <div key={task.id} className="flex items-start gap-3 text-[12px]">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cx(
                            'shrink-0 font-medium',
                            status === 'failed' ? 'text-danger' : task.running ? 'text-accent' : 'text-secondary',
                          )}
                        >
                          {status}
                        </span>
                        <span className="truncate text-primary">{task.title || task.id}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-dim">
                        {formatScheduledTaskSchedule(task)}
                        {task.lastRunAt ? ` · last run ${timeAgo(task.lastRunAt)}` : ''}
                        {task.lastStatus ? ` · ${task.lastStatus}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {onRunScheduledTaskNow && task.enabled && !task.running && (
                        <TextButton type="button" onClick={() => onRunScheduledTaskNow(task.id)} tone="accent" className="text-[11px]">
                          run now
                        </TextButton>
                      )}
                      {onOpenScheduledTask && (
                        <TextButton type="button" onClick={() => onOpenScheduledTask(task.id)} className="text-[11px]">
                          open
                        </TextButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
        </ShelfSection>
      )}

      {backgroundExecutions.length > 0 && (
        <ShelfSection
          header={
            <ShelfHeader
              leading={
                <span className="inline-flex h-3 w-3 items-center justify-center text-accent" aria-hidden="true">
                  <Spinner size="xs" />
                </span>
              }
              title="Background Work"
              detail={backgroundExecutionIndicatorText}
              actions={
                <TextButton type="button" onClick={onToggleBackgroundRunDetails}>
                  {showBackgroundRunDetails ? 'hide' : 'details'}
                </TextButton>
              }
            />
          }
        >
          {showBackgroundRunDetails ? (
            <>
              {backgroundExecutions.map((execution) => {
                const statusLabel = formatExecutionStatusLabel(execution.status);
                const statusClass =
                  execution.status === 'recovering'
                    ? 'text-warning'
                    : execution.status === 'queued' || execution.status === 'waiting'
                      ? 'text-dim'
                      : 'text-accent';
                const cancelling = cancellingBackgroundRunIds?.has(execution.id) ?? false;
                const command = isExecutionCommand(execution);
                const summary = execution.command ?? execution.prompt ?? `Execution ${execution.id}`;

                return (
                  <div key={execution.id} className="flex items-start gap-2 text-[12px]">
                    <span className={cx('mt-1 shrink-0 font-mono text-[10px]', command ? 'text-accent/60' : 'text-accent')}>
                      {command ? '$' : '✦'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenBackgroundRun?.(execution.id);
                      }}
                      className="min-w-0 flex-1 text-left transition-colors hover:text-primary disabled:pointer-events-none"
                      disabled={!onOpenBackgroundRun}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cx('shrink-0 font-medium', statusClass)}>{statusLabel}</span>
                        <span className="truncate text-primary">{execution.title}</span>
                        <MetaLabel tone="muted">{command ? 'Bash' : 'Agent'}</MetaLabel>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-dim">{summary}</div>
                    </button>
                    {onOpenBackgroundRun && (
                      <TextButton
                        type="button"
                        onClick={() => {
                          onOpenBackgroundRun(execution.id);
                        }}
                        tone="accent"
                        className="shrink-0 text-[11px]"
                      >
                        open
                      </TextButton>
                    )}
                    {onCancelBackgroundRun && execution.capabilities.canCancel && (
                      <TextButton
                        type="button"
                        onClick={() => {
                          onCancelBackgroundRun(execution.id);
                        }}
                        className="shrink-0 text-[11px] text-dim hover:text-danger disabled:opacity-40"
                        disabled={cancelling}
                      >
                        {cancelling ? 'cancelling…' : 'cancel'}
                      </TextButton>
                    )}
                  </div>
                );
              })}
            </>
          ) : null}
        </ShelfSection>
      )}

      {deferredResumes.length > 0 && (
        <ShelfSection
          header={
            <ShelfHeader
              leading={<span className={cx(hasReadyDeferredResumes ? 'text-warning' : 'text-dim')}>⏰</span>}
              title="Attention"
              detail={deferredResumeIndicatorText}
              actions={
                <>
                  {hasReadyDeferredResumes && !isLiveSession && (
                    <TextButton type="button" onClick={onContinueDeferredResumesNow} tone="accent">
                      continue now
                    </TextButton>
                  )}
                  {deferredResumesBusy && <span className="text-dim">updating…</span>}
                  <TextButton type="button" onClick={onToggleDeferredResumeDetails}>
                    {showDeferredResumeDetails ? 'hide' : 'details'}
                  </TextButton>
                </>
              }
            />
          }
        >
          {showDeferredResumeDetails ? (
            <>
              {deferredResumes.map((resume) => (
                <div key={resume.id} className="flex items-start gap-3 text-[12px]">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cx('shrink-0 font-medium', resume.status === 'ready' ? 'text-warning' : 'text-secondary')}>
                        {describeDeferredResumeStatus(resume, deferredResumeNowMs)}
                      </span>
                      <span className="truncate text-primary">{resume.title ?? resume.prompt}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-dim">
                      {formatDeferredResumeDeliveryLabel(resume)} · {resume.status === 'ready' ? 'Ready' : 'Due'}{' '}
                      {formatDeferredResumeWhen(resume)}
                      {resume.attempts > 0 ? ` · retries ${resume.attempts}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {resume.status === 'scheduled' && (
                      <TextButton
                        type="button"
                        onClick={() => {
                          onFireDeferredResumeNow(resume.id);
                        }}
                        tone="accent"
                        className="text-[11px] disabled:opacity-40"
                        disabled={deferredResumesBusy}
                      >
                        fire now
                      </TextButton>
                    )}
                    <TextButton
                      type="button"
                      onClick={() => {
                        onCancelDeferredResume(resume.id);
                      }}
                      className="text-[11px] text-dim hover:text-danger disabled:opacity-40"
                      disabled={deferredResumesBusy}
                    >
                      cancel
                    </TextButton>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </ShelfSection>
      )}
    </>
  );
}
