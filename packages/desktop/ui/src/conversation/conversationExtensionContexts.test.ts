import { describe, expect, it } from 'vitest';

import { buildComposerShelfContext, buildNewConversationPanelContext } from './conversationExtensionContexts';

describe('conversationExtensionContexts', () => {
  it('builds composer shelf context with safe conversation id', () => {
    expect(buildComposerShelfContext({ conversationId: 'conv', isStreaming: true, isLive: false })).toEqual({
      conversationId: 'conv',
      isStreaming: true,
      isLive: false,
    });
    expect(buildComposerShelfContext({ conversationId: undefined, isStreaming: false, isLive: true }).conversationId).toBe('');
  });

  it('builds new conversation panel context', () => {
    const suggestedContext = { query: 'abc' };
    expect(buildNewConversationPanelContext({ conversationId: undefined, suggestedContext })).toEqual({
      conversationId: '',
      suggestedContext,
    });
  });
});
