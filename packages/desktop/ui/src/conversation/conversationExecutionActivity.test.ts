import { describe, expect, it } from 'vitest';

import type { ScheduledTaskSummary } from '../shared/types';
import { buildScheduledTaskIndicatorText } from './conversationExecutionActivity';

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
  it('summarizes linked scheduled tasks for the shelf', () => {
    expect(buildScheduledTaskIndicatorText([task({ id: 'task-1', title: 'Continue hardening' })])).toBe('enabled · Continue hardening');
    expect(buildScheduledTaskIndicatorText([task({ id: 'task-1', running: true }), task({ id: 'task-2', enabled: false })])).toBe(
      '1 running · 1 enabled',
    );
  });
});
