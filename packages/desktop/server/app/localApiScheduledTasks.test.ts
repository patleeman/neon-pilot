import { describe, expect, it } from 'vitest';

import { normalizeDesktopScheduledTaskCreateInput } from './localApiScheduledTasks';

describe('localApiScheduledTasks', () => {
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
});
