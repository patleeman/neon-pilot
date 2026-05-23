import { describe, expect, it } from 'vitest';

import { resolveConversationComposerMenuState } from './conversationComposerMenuState';

describe('conversationComposerMenuState', () => {
  it('resolves slash menu state', () => {
    const state = resolveConversationComposerMenuState('/help');
    expect(state.showSlash).toBe(true);
    expect(state.showModelPicker).toBe(false);
    expect(state.slashQuery).toBe('/help');
  });

  it('resolves model picker state', () => {
    const state = resolveConversationComposerMenuState('/model gpt');
    expect(state.showSlash).toBe(false);
    expect(state.showModelPicker).toBe(true);
    expect(state.modelQuery).toBe('gpt');
  });

  it('resolves mention menu state', () => {
    const state = resolveConversationComposerMenuState('check @docs/readme');
    expect(state.showMention).toBe(true);
    expect(state.mentionQuery).toBe('@docs/readme');
  });
});
