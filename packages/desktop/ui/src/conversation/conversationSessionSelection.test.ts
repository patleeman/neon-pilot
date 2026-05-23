import { describe, expect, it } from 'vitest';

import { findConversationSessionById } from './conversationSessionSelection';

describe('conversationSessionSelection', () => {
  it('finds a session by id when present', () => {
    const sessions = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    expect(findConversationSessionById(sessions, 'b')).toBe(sessions[1]);
  });

  it('returns null without a conversation id or match', () => {
    expect(findConversationSessionById([{ id: 'a' }], undefined)).toBeNull();
    expect(findConversationSessionById([{ id: 'a' }], 'b')).toBeNull();
    expect(findConversationSessionById(undefined, 'a')).toBeNull();
  });
});
