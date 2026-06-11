// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeferredResumeSummary, ExecutionRecord, ScheduledTaskSummary } from '../../shared/types';
import { ConversationActivityShelf } from './ConversationActivityShelf';
import {
  CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT,
  CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT,
  CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT,
  CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT,
} from './conversationActivityCommands';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const execution: ExecutionRecord = {
  id: 'run-1',
  kind: 'subagent',
  visibility: 'primary',
  conversationId: 'conv-1',
  title: 'code-review',
  prompt: 'Review the diff',
  status: 'running',
  capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
};

const resume: DeferredResumeSummary = {
  id: 'resume-1',
  sessionFile: '/tmp/conv-1.jsonl',
  prompt: 'wake me',
  dueAt: '2026-04-01T10:00:00.000Z',
  createdAt: '2026-04-01T09:00:00.000Z',
  attempts: 1,
  status: 'scheduled',
};

const scheduledTask: ScheduledTaskSummary = {
  id: 'task-1',
  title: 'Continue maintainability hardening',
  scheduleType: 'cron',
  running: false,
  enabled: true,
  cron: '*/15 * * * *',
  prompt: 'continue',
  threadMode: 'existing',
  threadConversationId: 'conv-1',
  lastStatus: 'success',
  lastRunAt: '2026-04-01T08:30:00.000Z',
};

describe('ConversationActivityShelf', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    vi.restoreAllMocks();
  });

  it('renders background execution summary and expanded details', () => {
    const html = renderToString(
      <ConversationActivityShelf
        backgroundExecutions={[execution]}
        backgroundExecutionIndicatorText="running · code-review"
        showBackgroundRunDetails
        onToggleBackgroundRunDetails={vi.fn()}
        onCancelBackgroundRun={vi.fn()}
        deferredResumes={[]}
        deferredResumeIndicatorText="none"
        deferredResumeNowMs={Date.parse('2026-04-01T09:00:00.000Z')}
        hasReadyDeferredResumes={false}
        isLiveSession={false}
        deferredResumesBusy={false}
        showDeferredResumeDetails={false}
        onContinueDeferredResumesNow={vi.fn()}
        onToggleDeferredResumeDetails={vi.fn()}
        onFireDeferredResumeNow={vi.fn()}
        onCancelDeferredResume={vi.fn()}
      />,
    );

    expect(html).toContain('Background Work');
    expect(html).toContain('running · code-review');
    expect(html).toContain('code-review');
    expect(html).toContain('cancel');
    expect(html).toContain('hide');
  });

  it('labels command executions as Bash', () => {
    const commandExecution: ExecutionRecord = {
      ...execution,
      kind: 'background-command',
      title: 'tests',
      command: 'npm test',
      prompt: undefined,
      status: 'completed',
      capabilities: { ...execution.capabilities, canCancel: false },
    };

    const html = renderToString(
      <ConversationActivityShelf
        backgroundExecutions={[commandExecution]}
        backgroundExecutionIndicatorText="completed · tests"
        showBackgroundRunDetails
        onToggleBackgroundRunDetails={vi.fn()}
        deferredResumes={[]}
        deferredResumeIndicatorText="none"
        deferredResumeNowMs={Date.parse('2026-04-01T09:00:00.000Z')}
        hasReadyDeferredResumes={false}
        isLiveSession={false}
        deferredResumesBusy={false}
        showDeferredResumeDetails={false}
        onContinueDeferredResumesNow={vi.fn()}
        onToggleDeferredResumeDetails={vi.fn()}
        onFireDeferredResumeNow={vi.fn()}
        onCancelDeferredResume={vi.fn()}
      />,
    );

    expect(html).toContain('Bash');
    expect(html).not.toContain('Shell');
  });

  it('renders deferred resume summary and expanded actions', () => {
    const html = renderToString(
      <ConversationActivityShelf
        backgroundExecutions={[]}
        backgroundExecutionIndicatorText=""
        showBackgroundRunDetails={false}
        onToggleBackgroundRunDetails={vi.fn()}
        deferredResumes={[resume]}
        deferredResumeIndicatorText="1 scheduled · next in 1h 0m"
        deferredResumeNowMs={Date.parse('2026-04-01T09:00:00.000Z')}
        hasReadyDeferredResumes={false}
        isLiveSession={false}
        deferredResumesBusy={false}
        showDeferredResumeDetails
        onContinueDeferredResumesNow={vi.fn()}
        onToggleDeferredResumeDetails={vi.fn()}
        onFireDeferredResumeNow={vi.fn()}
        onCancelDeferredResume={vi.fn()}
      />,
    );

    expect(html).toContain('Attention');
    expect(html).toContain('1 scheduled');
    expect(html).toContain('wake me');
    expect(html).toContain('fire now');
    expect(html).toContain('cancel');
    expect(html).toContain('retries 1');
  });

  it('renders linked scheduled task summary and expanded actions', () => {
    const html = renderToString(
      <ConversationActivityShelf
        backgroundExecutions={[]}
        backgroundExecutionIndicatorText=""
        showBackgroundRunDetails={false}
        onToggleBackgroundRunDetails={vi.fn()}
        scheduledTasks={[scheduledTask]}
        scheduledTaskIndicatorText="enabled · Continue maintainability hardening"
        showScheduledTaskDetails
        onToggleScheduledTaskDetails={vi.fn()}
        onRunScheduledTaskNow={vi.fn()}
        onOpenScheduledTask={vi.fn()}
        deferredResumes={[]}
        deferredResumeIndicatorText="none"
        deferredResumeNowMs={Date.parse('2026-04-01T09:00:00.000Z')}
        hasReadyDeferredResumes={false}
        isLiveSession={false}
        deferredResumesBusy={false}
        showDeferredResumeDetails={false}
        onContinueDeferredResumesNow={vi.fn()}
        onToggleDeferredResumeDetails={vi.fn()}
        onFireDeferredResumeNow={vi.fn()}
        onCancelDeferredResume={vi.fn()}
      />,
    );

    expect(html).toContain('Automations');
    expect(html).toContain('Continue maintainability hardening');
    expect(html).toContain('*/15 * * * *');
    expect(html).toContain('run now');
    expect(html).toContain('open');
  });

  it('handles the shared continue deferred resumes command when ready', () => {
    const onContinueDeferredResumesNow = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ConversationActivityShelf
          backgroundExecutions={[]}
          backgroundExecutionIndicatorText=""
          showBackgroundRunDetails={false}
          onToggleBackgroundRunDetails={vi.fn()}
          deferredResumes={[{ ...resume, status: 'ready' }]}
          deferredResumeIndicatorText="1 ready"
          deferredResumeNowMs={Date.parse('2026-04-01T09:00:00.000Z')}
          hasReadyDeferredResumes
          isLiveSession={false}
          deferredResumesBusy={false}
          showDeferredResumeDetails={false}
          onContinueDeferredResumesNow={onContinueDeferredResumesNow}
          onToggleDeferredResumeDetails={vi.fn()}
          onFireDeferredResumeNow={vi.fn()}
          onCancelDeferredResume={vi.fn()}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT));
    });

    expect(onContinueDeferredResumesNow).toHaveBeenCalledTimes(1);
  });

  it('handles shared activity details toggle commands when sections are available', () => {
    const onToggleBackgroundRunDetails = vi.fn();
    const onToggleDeferredResumeDetails = vi.fn();
    const onToggleScheduledTaskDetails = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ConversationActivityShelf
          backgroundExecutions={[execution]}
          backgroundExecutionIndicatorText="running"
          showBackgroundRunDetails={false}
          onToggleBackgroundRunDetails={onToggleBackgroundRunDetails}
          scheduledTasks={[scheduledTask]}
          scheduledTaskIndicatorText="enabled"
          showScheduledTaskDetails={false}
          onToggleScheduledTaskDetails={onToggleScheduledTaskDetails}
          deferredResumes={[resume]}
          deferredResumeIndicatorText="1 scheduled"
          deferredResumeNowMs={Date.parse('2026-04-01T09:00:00.000Z')}
          hasReadyDeferredResumes={false}
          isLiveSession={false}
          deferredResumesBusy={false}
          showDeferredResumeDetails={false}
          onContinueDeferredResumesNow={vi.fn()}
          onToggleDeferredResumeDetails={onToggleDeferredResumeDetails}
          onFireDeferredResumeNow={vi.fn()}
          onCancelDeferredResume={vi.fn()}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT));
      window.dispatchEvent(new CustomEvent(CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT));
      window.dispatchEvent(new CustomEvent(CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT));
    });

    expect(onToggleBackgroundRunDetails).toHaveBeenCalledTimes(1);
    expect(onToggleDeferredResumeDetails).toHaveBeenCalledTimes(1);
    expect(onToggleScheduledTaskDetails).toHaveBeenCalledTimes(1);
  });

  it('handles shared latest background run commands', () => {
    const onOpenBackgroundRun = vi.fn();
    const onCancelBackgroundRun = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ConversationActivityShelf
          backgroundExecutions={[
            { ...execution, id: 'run-latest', capabilities: { ...execution.capabilities, canCancel: false } },
            { ...execution, id: 'run-cancellable', capabilities: { ...execution.capabilities, canCancel: true } },
          ]}
          backgroundExecutionIndicatorText="running"
          showBackgroundRunDetails={false}
          onToggleBackgroundRunDetails={vi.fn()}
          onOpenBackgroundRun={onOpenBackgroundRun}
          onCancelBackgroundRun={onCancelBackgroundRun}
          deferredResumes={[]}
          deferredResumeIndicatorText="none"
          deferredResumeNowMs={Date.parse('2026-04-01T09:00:00.000Z')}
          hasReadyDeferredResumes={false}
          isLiveSession={false}
          deferredResumesBusy={false}
          showDeferredResumeDetails={false}
          onContinueDeferredResumesNow={vi.fn()}
          onToggleDeferredResumeDetails={vi.fn()}
          onFireDeferredResumeNow={vi.fn()}
          onCancelDeferredResume={vi.fn()}
        />,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT));
      window.dispatchEvent(new CustomEvent(CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT));
    });

    expect(onOpenBackgroundRun).toHaveBeenCalledWith('run-latest');
    expect(onCancelBackgroundRun).toHaveBeenCalledWith('run-cancellable');
  });
});
