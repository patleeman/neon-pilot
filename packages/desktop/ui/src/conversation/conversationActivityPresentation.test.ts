import { describe, expect, it } from 'vitest';

import {
  activityDeferredResumes,
  activityExecutions,
  activityQueuedPrompts,
  activityScheduledTasks,
} from './conversationActivityPresentation';

describe('conversation activity presentation adapters', () => {
  it('selects shelf payloads by activity kind', () => {
    const items = [
      {
        id: 'execution:run-1',
        kind: 'execution',
        title: 'Run',
        status: 'running',
        active: true,
        visibility: 'primary',
        conversationId: 'conv-1',
        source: { type: 'execution', id: 'run-1' },
        actions: [],
        payload: { id: 'run-1', kind: 'subagent', visibility: 'primary', title: 'Run', status: 'running', capabilities: {} },
      },
      {
        id: 'deferred-resume:resume-1',
        kind: 'deferred-resume',
        title: 'Resume',
        status: 'scheduled',
        active: true,
        visibility: 'system',
        conversationId: 'conv-1',
        source: { type: 'deferred-resume', id: 'resume-1' },
        actions: [],
        payload: { id: 'resume-1', sessionFile: '/session.jsonl', prompt: 'Continue', dueAt: '2026-06-11T00:00:00.000Z', createdAt: '2026-06-10T00:00:00.000Z', attempts: 0, status: 'scheduled' },
      },
      {
        id: 'scheduled-task:task-1',
        kind: 'scheduled-task',
        title: 'Task',
        status: 'scheduled',
        active: true,
        visibility: 'system',
        conversationId: 'conv-1',
        source: { type: 'scheduled-task', id: 'task-1' },
        actions: [],
        payload: { id: 'task-1', title: 'Task', scheduleType: 'cron', running: false, enabled: true, prompt: 'Run', threadMode: 'existing' },
      },
      {
        id: 'queued-prompt:followUp:queue-1',
        kind: 'queued-prompt',
        title: 'Queued',
        status: 'queued',
        active: true,
        visibility: 'primary',
        conversationId: 'conv-1',
        source: { type: 'queued-prompt', id: 'queue-1' },
        actions: [],
        payload: { id: 'queue-1', text: 'Next', imageCount: 1, type: 'followUp', queueIndex: 2, restorable: false },
      },
    ] as const;

    expect(activityExecutions(items).map((item) => item.id)).toEqual(['run-1']);
    expect(activityDeferredResumes(items).map((item) => item.id)).toEqual(['resume-1']);
    expect(activityScheduledTasks(items).map((item) => item.id)).toEqual(['task-1']);
    expect(activityQueuedPrompts(items)).toEqual([
      { id: 'queue-1', text: 'Next', imageCount: 1, restorable: false, type: 'followUp', queueIndex: 2 },
    ]);
  });
});
