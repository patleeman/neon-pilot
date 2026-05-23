import { describe, expect, it } from 'vitest';

import { assertConversationFound, assertSessionFound } from './localApiConversationNotFound';

describe('localApiConversationNotFound', () => {
  it('asserts conversation presence', () => {
    expect(() => assertConversationFound(true)).not.toThrow();
    expect(() => assertConversationFound(false)).toThrow('Conversation not found');
    expect(() => assertConversationFound(false, 'Conversation not found.')).toThrow('Conversation not found.');
  });

  it('asserts session presence', () => {
    expect(() => assertSessionFound(true)).not.toThrow();
    expect(() => assertSessionFound(false)).toThrow('Session not found');
    expect(() => assertSessionFound(false, 'Session block not found')).toThrow('Session block not found');
  });
});
