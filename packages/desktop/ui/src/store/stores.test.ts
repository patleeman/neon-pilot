import { afterEach, describe, expect, it } from 'vitest';

import type { ScheduledTaskSummary } from '../shared/types';
import { executionStore, presenceStore, resetAllStores, sessionStore, taskStore } from './stores';

function session(id: string, isRunning = false) {
  return {
    id,
    title: id,
    cwd: '/repo',
    file: `${id}.jsonl`,
    timestamp: '2026-01-01T00:00:00.000Z',
    isRunning,
  };
}

describe('presenceStore', () => {
  afterEach(() => {
    resetAllStores();
  });

  it('does not mark unrelated conversations as having pending runs', () => {
    sessionStore.replaceAll([session('conv-1'), session('conv-2')]);
    executionStore.replaceAll([
      {
        id: 'run-1',
        kind: 'background_bash',
        conversationId: 'conv-1',
        title: 'npm test',
        status: 'running',
        visibility: 'normal',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(presenceStore.get('conv-1')).toBe('hasRuns');
    expect(presenceStore.get('conv-2')).toBe('idle');
  });

  it('marks only the task-bound conversation as automation running', () => {
    sessionStore.replaceAll([session('conv-1'), session('conv-2')]);
    const task: ScheduledTaskSummary = {
      id: 'task-1',
      title: 'Daily',
      enabled: true,
      running: true,
      scheduleType: 'cron',
      prompt: 'Run daily',
      threadMode: 'existing',
      threadConversationId: 'conv-2',
    };
    taskStore.replaceAll([task]);

    expect(presenceStore.get('conv-1')).toBe('idle');
    expect(presenceStore.get('conv-2')).toBe('automation');
  });
});
