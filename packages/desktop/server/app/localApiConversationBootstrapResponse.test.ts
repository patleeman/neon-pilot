import { describe, expect, it } from 'vitest';

import { assertConversationBootstrapFound } from './localApiConversationBootstrapResponse';

describe('localApiConversationBootstrapResponse', () => {
  it('throws when bootstrap state is missing', () => {
    expect(() => assertConversationBootstrapFound(true)).toThrow('Conversation not found');
  });

  it('does not throw when bootstrap state exists', () => {
    expect(() => assertConversationBootstrapFound(false)).not.toThrow();
  });
});
