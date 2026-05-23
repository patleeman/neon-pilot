import { describe, expect, it } from 'vitest';

import { normalizeDesktopConversationModelPreferenceUpdate } from './localApiConversationModelPreferences';

describe('localApiConversationModelPreferences', () => {
  it('trims conversation id and preserves provided preference fields', () => {
    expect(
      normalizeDesktopConversationModelPreferenceUpdate({
        conversationId: ' conversation-1 ',
        model: 'gpt',
        thinkingLevel: null,
        serviceTier: 'priority',
      }),
    ).toEqual({
      conversationId: 'conversation-1',
      preferences: { model: 'gpt', thinkingLevel: null, serviceTier: 'priority' },
    });
  });

  it('rejects missing conversation ids and empty preference updates', () => {
    expect(() => normalizeDesktopConversationModelPreferenceUpdate({ conversationId: ' ', model: 'gpt' })).toThrow(
      'conversationId required',
    );
    expect(() => normalizeDesktopConversationModelPreferenceUpdate({ conversationId: 'one' })).toThrow(
      'model, thinkingLevel, or serviceTier required',
    );
  });

  it('rejects non-string non-null preference values', () => {
    expect(() => normalizeDesktopConversationModelPreferenceUpdate({ conversationId: 'one', model: 1 as unknown as string })).toThrow(
      'model, thinkingLevel, and serviceTier must be strings or null',
    );
    expect(() =>
      normalizeDesktopConversationModelPreferenceUpdate({ conversationId: 'one', thinkingLevel: false as unknown as string }),
    ).toThrow('model, thinkingLevel, and serviceTier must be strings or null');
  });
});
