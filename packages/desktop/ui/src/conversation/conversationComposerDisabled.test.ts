import { describe, expect, it } from 'vitest';

import {
  isConversationComposerDisabled,
  shouldClearDraftPendingPrompt,
  shouldClearPendingAssistantStatus,
} from './conversationComposerDisabled';

describe('conversationComposerDisabled', () => {
  it('disables composer for takeover, related context prep, or whole-line bash', () => {
    const base = { conversationNeedsTakeover: false, preparingRelatedThreadContext: false, wholeLineBashRunning: false };
    expect(isConversationComposerDisabled(base)).toBe(false);
    expect(isConversationComposerDisabled({ ...base, conversationNeedsTakeover: true })).toBe(true);
    expect(isConversationComposerDisabled({ ...base, preparingRelatedThreadContext: true })).toBe(true);
    expect(isConversationComposerDisabled({ ...base, wholeLineBashRunning: true })).toBe(true);
  });

  it('resolves simple composer cleanup predicates', () => {
    expect(shouldClearDraftPendingPrompt(false)).toBe(true);
    expect(shouldClearDraftPendingPrompt(true)).toBe(false);
    expect(shouldClearPendingAssistantStatus(true)).toBe(true);
    expect(shouldClearPendingAssistantStatus(false)).toBe(false);
  });
});
