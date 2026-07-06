import { afterEach, describe, expect, it } from 'vitest';

import type { ExecutionRecord, ScheduledTaskSummary } from '../shared/types';
import {
  conversationActivityStatusStore,
  conversationRuntimeStore,
  executionStore,
  resetAllStores,
  sessionStore,
  taskStore,
} from './stores';

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

function execution(id: string, conversationId: string, status: string): ExecutionRecord {
  return {
    id,
    kind: 'background-command',
    visibility: 'primary',
    conversationId,
    title: id,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    capabilities: { canCancel: false, canRerun: false, canFollowUp: false, hasLog: false, hasResult: false },
  };
}

describe('conversationActivityStatusStore', () => {
  afterEach(() => {
    resetAllStores();
  });

  it('does not mark unrelated conversations as having pending runs', () => {
    sessionStore.replaceAll([session('conv-1'), session('conv-2')]);
    executionStore.replaceAll([execution('run-1', 'conv-1', 'running')]);

    expect(conversationActivityStatusStore.get('conv-1')).toBe('hasRuns');
    expect(conversationActivityStatusStore.get('conv-2')).toBe('idle');
  });

  it.each(['pending', 'queued', 'waiting', 'running', 'recovering'])('marks %s executions as pending background work', (status) => {
    sessionStore.replaceAll([session('conv-1')]);
    executionStore.replaceAll([execution('run-1', 'conv-1', status)]);

    expect(conversationActivityStatusStore.get('conv-1')).toBe('hasRuns');
  });

  it.each(['completed', 'failed', 'cancelled', 'interrupted'])(
    'does not mark terminal %s executions as pending background work',
    (status) => {
      sessionStore.replaceAll([session('conv-1')]);
      executionStore.replaceAll([execution('run-1', 'conv-1', status)]);

      expect(conversationActivityStatusStore.get('conv-1')).toBe('idle');
    },
  );

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

    expect(conversationActivityStatusStore.get('conv-1')).toBe('idle');
    expect(conversationActivityStatusStore.get('conv-2')).toBe('automation');
  });

  it('lets backend running state override stale session snapshots', () => {
    sessionStore.replaceAll([session('conv-1', false)]);

    conversationRuntimeStore.apply({ id: 'conv-1', running: true, revision: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(conversationActivityStatusStore.get('conv-1')).toBe('streaming');

    sessionStore.replaceAll([session('conv-1', false)]);
    expect(conversationActivityStatusStore.get('conv-1')).toBe('streaming');

    conversationRuntimeStore.apply({ id: 'conv-1', running: false, revision: 2, updatedAt: '2026-01-01T00:00:01.000Z' });
    expect(conversationActivityStatusStore.get('conv-1')).toBe('idle');
  });

  it('ignores stale backend running revisions', () => {
    sessionStore.replaceAll([session('conv-1', false)]);

    conversationRuntimeStore.apply({ id: 'conv-1', running: true, revision: 2, updatedAt: '2026-01-01T00:00:02.000Z' });
    conversationRuntimeStore.apply({ id: 'conv-1', running: false, revision: 1, updatedAt: '2026-01-01T00:00:01.000Z' });

    expect(conversationActivityStatusStore.get('conv-1')).toBe('streaming');
  });

  it('preserves parallel worker previews across newer partial runtime events', () => {
    conversationRuntimeStore.apply({
      id: 'conv-1',
      running: true,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      parallelJobs: [
        {
          id: 'parallel-1',
          prompt: 'Review the diff',
          childConversationId: 'child-1',
          status: 'running',
          workerRole: 'worker',
          workerName: 'Focused Reviewer 1a2b3',
          imageCount: 0,
        },
      ],
    });

    conversationRuntimeStore.apply({
      id: 'conv-1',
      running: false,
      revision: 2,
      updatedAt: '2026-01-01T00:00:01.000Z',
    });

    expect(conversationRuntimeStore.get('conv-1')?.parallelJobs).toEqual([
      expect.objectContaining({ id: 'parallel-1', workerName: 'Focused Reviewer 1a2b3' }),
    ]);

    conversationRuntimeStore.apply({
      id: 'conv-1',
      running: false,
      revision: 3,
      updatedAt: '2026-01-01T00:00:02.000Z',
      parallelJobs: [],
    });

    expect(conversationRuntimeStore.get('conv-1')?.parallelJobs).toEqual([]);
  });

  it('lets canonical idle session metadata clear stale backend running state', () => {
    sessionStore.replaceAll([session('conv-1', true)]);
    conversationRuntimeStore.apply({ id: 'conv-1', running: true, revision: 2, updatedAt: '2026-01-01T00:00:02.000Z' });

    conversationRuntimeStore.reconcileIdleFromSessionMeta(session('conv-1', false));

    expect(conversationRuntimeStore.get('conv-1')?.running).toBe(false);
    expect(conversationActivityStatusStore.get('conv-1')).toBe('idle');
  });

  it('does not let running session metadata override an explicit stopped runtime event', () => {
    sessionStore.replaceAll([session('conv-1', true)]);
    conversationRuntimeStore.apply({ id: 'conv-1', running: false, revision: 2, updatedAt: '2026-01-01T00:00:02.000Z' });

    conversationRuntimeStore.reconcileIdleFromSessionMeta(session('conv-1', true));

    expect(conversationRuntimeStore.get('conv-1')?.running).toBe(false);
    expect(conversationActivityStatusStore.get('conv-1')).toBe('idle');
  });

  it('notifies conversation runtime subscribers when backend runtime changes', () => {
    const notifications: Array<boolean | undefined> = [];
    const unsubscribe = conversationRuntimeStore.subscribe('conv-1', () => {
      notifications.push(conversationRuntimeStore.get('conv-1')?.running);
    });

    conversationRuntimeStore.apply({ id: 'conv-1', running: true, revision: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    conversationRuntimeStore.apply({ id: 'conv-1', running: false, revision: 2, updatedAt: '2026-01-01T00:00:01.000Z' });
    conversationRuntimeStore.clear('conv-1');
    unsubscribe();

    expect(notifications).toEqual([true, false, undefined]);
  });
});
