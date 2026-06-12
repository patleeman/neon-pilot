import { useEffect } from 'react';

import { describeDeferredResumeStatus, formatDeferredResumeWhen } from '../../deferred-resume/deferredResumeIndicator';
import { setExtensionCommandContext } from '../../extensions/commands';
import type { DeferredResumeSummary, ExecutionRecord, ScheduledTaskSummary } from '../../shared/types';
import { timeAgo } from '../../shared/utils';
import { cx, MetaLabel, RowButton, ShelfHeader, ShelfSection, Spinner, TextButton } from '../ui';
import {
  CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT,
  CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT,
  CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT,
  CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT,
  CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT,
  CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT,
} from './conversationActivityCommands';

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
  const canContinueDeferredResumes = hasReadyDeferredResumes && !isLiveSession && !deferredResumesBusy;
  const canToggleBackgroundRunDetails = backgroundExecutions.length > 0;
  const canToggleDeferredResumeDetails = deferredResumes.length > 0;
  const canToggleScheduledTaskDetails = scheduledTasks.length > 0 && Boolean(onToggleScheduledTaskDetails);
  const latestBackgroundRun = backgroundExecutions[0] ?? null;
  const latestCancellableBackgroundRun =
    backgroundExecutions.find((execution) => execution.capabilities.canCancel && !(cancellingBackgroundRunIds?.has(execution.id) ?? false)) ?? null;
  const firstRunnableScheduledTask = scheduledTasks.find((task) => task.enabled && !task.running) ?? null;
  const firstOpenableScheduledTask = scheduledTasks[0] ?? null;
  const firstFireableDeferredResume = deferredResumes.find((resume) => resume.status === 'scheduled') ?? null;
  const firstCancellableDeferredResume = deferredResumes[0] ?? null;
  const canOpenLatestBackgroundRun = Boolean(latestBackgroundRun && onOpenBackgroundRun);
  const canCancelLatestBackgroundRun = Boolean(latestCancellableBackgroundRun && onCancelBackgroundRun);
  const canRunFirstScheduledTask = Boolean(firstRunnableScheduledTask && onRunScheduledTaskNow);
  const canOpenFirstScheduledTask = Boolean(firstOpenableScheduledTask && onOpenScheduledTask);
  const canFireFirstDeferredResume = Boolean(firstFireableDeferredResume && !deferredResumesBusy);
  const canCancelFirstDeferredResume = Boolean(firstCancellableDeferredResume && !deferredResumesBusy);

  useEffect(() => {
    setExtensionCommandContext('conversation.canContinueDeferredResumes', canContinueDeferredResumes);
    setExtensionCommandContext('conversation.hasBackgroundRuns', canToggleBackgroundRunDetails);
    setExtensionCommandContext('conversation.hasDeferredResumes', canToggleDeferredResumeDetails);
    setExtensionCommandContext('conversation.hasScheduledTasks', canToggleScheduledTaskDetails);
    setExtensionCommandContext('conversation.canOpenLatestBackgroundRun', canOpenLatestBackgroundRun);
    setExtensionCommandContext('conversation.canCancelLatestBackgroundRun', canCancelLatestBackgroundRun);
    setExtensionCommandContext('conversation.canRunFirstScheduledTask', canRunFirstScheduledTask);
    setExtensionCommandContext('conversation.canOpenFirstScheduledTask', canOpenFirstScheduledTask);
    setExtensionCommandContext('conversation.canFireFirstDeferredResume', canFireFirstDeferredResume);
    setExtensionCommandContext('conversation.canCancelFirstDeferredResume', canCancelFirstDeferredResume);
    return () => {
      setExtensionCommandContext('conversation.canContinueDeferredResumes', null);
      setExtensionCommandContext('conversation.hasBackgroundRuns', null);
      setExtensionCommandContext('conversation.hasDeferredResumes', null);
      setExtensionCommandContext('conversation.hasScheduledTasks', null);
      setExtensionCommandContext('conversation.canOpenLatestBackgroundRun', null);
      setExtensionCommandContext('conversation.canCancelLatestBackgroundRun', null);
      setExtensionCommandContext('conversation.canRunFirstScheduledTask', null);
      setExtensionCommandContext('conversation.canOpenFirstScheduledTask', null);
      setExtensionCommandContext('conversation.canFireFirstDeferredResume', null);
      setExtensionCommandContext('conversation.canCancelFirstDeferredResume', null);
    };
  }, [
    canCancelLatestBackgroundRun,
    canCancelFirstDeferredResume,
    canContinueDeferredResumes,
    canFireFirstDeferredResume,
    canOpenLatestBackgroundRun,
    canOpenFirstScheduledTask,
    canRunFirstScheduledTask,
    canToggleBackgroundRunDetails,
    canToggleDeferredResumeDetails,
    canToggleScheduledTaskDetails,
  ]);

  useEffect(() => {
    if (!canContinueDeferredResumes) return;
    function handleContinueDeferredResumesCommand() {
      onContinueDeferredResumesNow();
    }
    window.addEventListener(CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT, handleContinueDeferredResumesCommand);
    return () => window.removeEventListener(CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT, handleContinueDeferredResumesCommand);
  }, [canContinueDeferredResumes, onContinueDeferredResumesNow]);

  useEffect(() => {
    if (!canToggleBackgroundRunDetails) return;
    window.addEventListener(CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT, onToggleBackgroundRunDetails);
    return () => window.removeEventListener(CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT, onToggleBackgroundRunDetails);
  }, [canToggleBackgroundRunDetails, onToggleBackgroundRunDetails]);

  useEffect(() => {
    if (!canToggleDeferredResumeDetails) return;
    window.addEventListener(CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT, onToggleDeferredResumeDetails);
    return () => window.removeEventListener(CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT, onToggleDeferredResumeDetails);
  }, [canToggleDeferredResumeDetails, onToggleDeferredResumeDetails]);

  useEffect(() => {
    if (!canToggleScheduledTaskDetails || !onToggleScheduledTaskDetails) return;
    window.addEventListener(CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT, onToggleScheduledTaskDetails);
    return () => window.removeEventListener(CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT, onToggleScheduledTaskDetails);
  }, [canToggleScheduledTaskDetails, onToggleScheduledTaskDetails]);

  useEffect(() => {
    if (!latestBackgroundRun || !onOpenBackgroundRun) return;
    function handleOpenLatestBackgroundRunCommand() {
      onOpenBackgroundRun?.(latestBackgroundRun.id);
    }
    window.addEventListener(CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleOpenLatestBackgroundRunCommand);
    return () => window.removeEventListener(CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleOpenLatestBackgroundRunCommand);
  }, [latestBackgroundRun, onOpenBackgroundRun]);

  useEffect(() => {
    if (!latestCancellableBackgroundRun || !onCancelBackgroundRun) return;
    function handleCancelLatestBackgroundRunCommand() {
      onCancelBackgroundRun?.(latestCancellableBackgroundRun.id);
    }
    window.addEventListener(CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleCancelLatestBackgroundRunCommand);
    return () => window.removeEventListener(CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleCancelLatestBackgroundRunCommand);
  }, [latestCancellableBackgroundRun, onCancelBackgroundRun]);

  useEffect(() => {
    if (!firstRunnableScheduledTask || !onRunScheduledTaskNow) return;
    function handleRunFirstScheduledTaskCommand() {
      onRunScheduledTaskNow?.(firstRunnableScheduledTask.id);
    }
    window.addEventListener(CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleRunFirstScheduledTaskCommand);
    return () => window.removeEventListener(CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleRunFirstScheduledTaskCommand);
  }, [firstRunnableScheduledTask, onRunScheduledTaskNow]);

  useEffect(() => {
    if (!firstOpenableScheduledTask || !onOpenScheduledTask) return;
    function handleOpenFirstScheduledTaskCommand() {
      onOpenScheduledTask?.(firstOpenableScheduledTask.id);
    }
    window.addEventListener(CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleOpenFirstScheduledTaskCommand);
    return () => window.removeEventListener(CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleOpenFirstScheduledTaskCommand);
  }, [firstOpenableScheduledTask, onOpenScheduledTask]);

  useEffect(() => {
    if (!firstFireableDeferredResume || deferredResumesBusy) return;
    function handleFireFirstDeferredResumeCommand() {
      onFireDeferredResumeNow(firstFireableDeferredResume.id);
    }
    window.addEventListener(CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleFireFirstDeferredResumeCommand);
    return () => window.removeEventListener(CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleFireFirstDeferredResumeCommand);
  }, [deferredResumesBusy, firstFireableDeferredResume, onFireDeferredResumeNow]);

  useEffect(() => {
    if (!firstCancellableDeferredResume || deferredResumesBusy) return;
    function handleCancelFirstDeferredResumeCommand() {
      onCancelDeferredResume(firstCancellableDeferredResume.id);
    }
    window.addEventListener(CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleCancelFirstDeferredResumeCommand);
    return () => window.removeEventListener(CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleCancelFirstDeferredResumeCommand);
  }, [deferredResumesBusy, firstCancellableDeferredResume, onCancelDeferredResume]);

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
                    <RowButton
                      compact
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
                    </RowButton>
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
