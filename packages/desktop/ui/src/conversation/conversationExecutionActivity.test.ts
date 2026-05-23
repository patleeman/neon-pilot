import { describe, expect, it } from 'vitest';

import type { ScheduledTaskSummary } from '../shared/types';
import { buildScheduledTaskIndicatorText, selectConversationScheduledTasks } from './conversationExecutionActivity';

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
  it('selects tasks bound to the current conversation', () => {
    expect(
      selectConversationScheduledTasks({
        conversationId: 'conv-1',
        tasks: [
          task({ id: 'disabled', enabled: false, lastRunAt: '2026-05-23T10:00:00.000Z' }),
          task({ id: 'other', threadConversationId: 'conv-2' }),
          task({ id: 'running', running: true, lastRunAt: '2026-05-23T09:00:00.000Z' }),
          task({ id: 'latest', lastRunAt: '2026-05-23T11:00:00.000Z' }),
        ],
      }).map((item) => item.id),
    ).toEqual(['running', 'latest', 'disabled']);
  });

  it('summarizes linked scheduled tasks for the shelf', () => {
    expect(buildScheduledTaskIndicatorText([task({ id: 'task-1', title: 'Continue hardening' })])).toBe('enabled · Continue hardening');
    expect(buildScheduledTaskIndicatorText([task({ id: 'task-1', running: true }), task({ id: 'task-2', enabled: false })])).toBe(
      '1 running · 1 enabled',
    );
  });
});
