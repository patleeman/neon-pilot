import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { DeferredResumeSummary, ExecutionRecord, ScheduledTaskSummary } from '../../shared/types';
import { ConversationActivityShelf } from './ConversationActivityShelf';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

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
});
