import { describe, expect, it } from 'vitest';

import type { ExecutionRecord, ScheduledTaskSummary } from '../shared/types';
import {
  buildScheduledTaskIndicatorText,
  isConversationExecutionActive,
  selectConversationScheduledTasks,
} from './conversationExecutionActivity';

function task(overrides: Partial<ScheduledTaskSummary> & Pick<ScheduledTaskSummary, 'id'>): ScheduledTaskSummary {
  return {
    id: overrides.id,
    title: overrides.title,
    scheduleType: 'cron',
    running: false,
    enabled: true,
    cron: '*/15 * * * *',
    prompt: 'continue',
    threadMode: 'existing',
    threadConversationId: 'conv-1',
    ...overrides,
  };
}

describe('conversation scheduled task activity', () => {
  it('treats terminal background executions as inactive', () => {
    const execution = (status: ExecutionRecord['status']) =>
      ({
        id: `run-${status}`,
        kind: 'background-command',
        visibility: 'primary',
        conversationId: 'conv-1',
        title: status,
        status,
        capabilities: { canCancel: false, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
      }) as ExecutionRecord;

    expect(['queued', 'waiting', 'running', 'recovering'].map((status) => isConversationExecutionActive(execution(status)))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(['completed', 'failed', 'cancelled', 'interrupted'].map((status) => isConversationExecutionActive(execution(status)))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('summarizes linked scheduled tasks for the shelf', () => {
    expect(buildScheduledTaskIndicatorText([task({ id: 'task-1', title: 'Continue hardening' })])).toBe('enabled · Continue hardening');
    expect(buildScheduledTaskIndicatorText([task({ id: 'task-1', running: true }), task({ id: 'task-2', enabled: false })])).toBe(
      '1 running · 1 enabled',
    );
  });

  it('selects thread-owned tasks from the task store when the activity route is unavailable', () => {
    expect(
      selectConversationScheduledTasks({
        conversationId: 'conv-1',
        activityTasks: [],
        tasks: [task({ id: 'task-1', title: 'Store task' }), task({ id: 'task-2', threadConversationId: 'conv-2' })],
      }),
    ).toEqual([expect.objectContaining({ id: 'task-1', title: 'Store task' })]);
  });

  it('dedupes task-store and activity-route records by task id', () => {
    expect(
      selectConversationScheduledTasks({
        conversationId: 'conv-1',
        activityTasks: [task({ id: 'task-1', title: 'Activity title' })],
        tasks: [task({ id: 'task-1', title: 'Fresh store title' })],
      }),
    ).toEqual([expect.objectContaining({ id: 'task-1', title: 'Fresh store title' })]);
  });
});
