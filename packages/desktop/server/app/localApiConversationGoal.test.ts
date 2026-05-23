import { describe, expect, it } from 'vitest';

import { buildDesktopConversationGoalState, validateDesktopConversationGoalInput } from './localApiConversationGoal';

describe('localApiConversationGoal', () => {
  it('validates conversation id and objective shape', () => {
    expect(validateDesktopConversationGoalInput({ conversationId: ' conversation-1 ', objective: 'ship it' })).toBe('conversation-1');
    expect(() => validateDesktopConversationGoalInput({ conversationId: ' ' })).toThrow('conversationId required');
    expect(() => validateDesktopConversationGoalInput({ conversationId: 'one', objective: 123 as unknown as string })).toThrow(
      'objective must be a string',
    );
  });

  it('builds an active goal state from a non-empty objective', () => {
    expect(buildDesktopConversationGoalState({ objective: '  Ship it  ', now: new Date('2026-05-23T12:00:00.000Z') })).toEqual({
      objective: 'Ship it',
      status: 'active',
      tasks: [],
      stopReason: null,
      updatedAt: '2026-05-23T12:00:00.000Z',
      noProgressTurns: 0,
    });
  });

  it('builds a cleared goal state for missing or blank objectives', () => {
    expect(buildDesktopConversationGoalState({ objective: ' ', now: new Date('2026-05-23T12:00:00.000Z') })).toEqual({
      objective: '',
      status: 'complete',
      tasks: [],
      stopReason: 'cleared',
      updatedAt: '2026-05-23T12:00:00.000Z',
      noProgressTurns: 0,
    });
    expect(buildDesktopConversationGoalState({ now: new Date('2026-05-23T12:00:00.000Z') }).status).toBe('complete');
  });
});
