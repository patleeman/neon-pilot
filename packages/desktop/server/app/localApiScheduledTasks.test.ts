import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateAppTopicsMock } = vi.hoisted(() => ({
  invalidateAppTopicsMock: vi.fn(),
}));

vi.mock('../shared/appEvents.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
}));

import {
  DESKTOP_SCHEDULED_TASK_MUTATION_TOPICS,
  DESKTOP_SCHEDULED_TASK_RUN_TOPICS,
  normalizeDesktopScheduledTaskCreateInput,
  withDesktopScheduledTaskMutationInvalidation,
} from './localApiScheduledTasks';

describe('localApiScheduledTasks', () => {
  beforeEach(() => {
    invalidateAppTopicsMock.mockReset();
  });

  it('defaults missing title and prompt for task creation', () => {
    expect(normalizeDesktopScheduledTaskCreateInput({ enabled: true, cron: '* * * * *' })).toEqual({
      enabled: true,
      cron: '* * * * *',
      title: '',
      prompt: '',
    });
  });

  it('preserves provided task fields', () => {
    expect(
      normalizeDesktopScheduledTaskCreateInput({
        title: 'Daily review',
        prompt: 'Summarize today',
        targetType: 'conversation',
        conversationBehavior: 'followUp',
        threadMode: 'existing',
        threadConversationId: 'conversation-1',
        notifyOnFailure: 'passive',
      }),
    ).toEqual({
      title: 'Daily review',
      prompt: 'Summarize today',
      targetType: 'conversation',
      conversationBehavior: 'followUp',
      threadMode: 'existing',
      threadConversationId: 'conversation-1',
      notifyOnFailure: 'passive',
    });
  });

  it('invalidates task, session, and workspace shelves after a successful mutation', async () => {
    await expect(withDesktopScheduledTaskMutationInvalidation(async () => ({ ok: true }))).resolves.toEqual({ ok: true });

    expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
    expect(invalidateAppTopicsMock).toHaveBeenCalledWith(...DESKTOP_SCHEDULED_TASK_MUTATION_TOPICS);
  });

  it('includes runs when invalidating a run-now mutation', async () => {
    await withDesktopScheduledTaskMutationInvalidation(async () => ({ ok: true }), { includeRuns: true });

    expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
    expect(invalidateAppTopicsMock).toHaveBeenCalledWith(...DESKTOP_SCHEDULED_TASK_RUN_TOPICS);
  });

  it('does not invalidate when a mutation fails', async () => {
    await expect(
      withDesktopScheduledTaskMutationInvalidation(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(invalidateAppTopicsMock).not.toHaveBeenCalled();
  });
});
