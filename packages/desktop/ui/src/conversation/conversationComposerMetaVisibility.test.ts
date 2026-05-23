import { describe, expect, it } from 'vitest';

import { shouldShowConversationComposerMeta } from './conversationComposerMetaVisibility';

const base = {
  draft: false,
  draftCwdValue: '',
  sessionTokens: null,
  currentCwd: null,
  conversationCwdEditorOpen: false,
  conversationCwdError: null,
  branchLabel: null,
  hasGitSummary: false,
};

describe('conversationComposerMetaVisibility', () => {
  it('shows draft composer meta only when draft cwd is set', () => {
    expect(shouldShowConversationComposerMeta({ ...base, draft: true })).toBe(false);
    expect(shouldShowConversationComposerMeta({ ...base, draft: true, draftCwdValue: '/repo' })).toBe(true);
  });

  it('shows live composer meta for tokens, cwd state, branch, or git summary', () => {
    expect(shouldShowConversationComposerMeta(base)).toBe(false);
    expect(shouldShowConversationComposerMeta({ ...base, sessionTokens: { used: 1 } })).toBe(true);
    expect(shouldShowConversationComposerMeta({ ...base, currentCwd: '/repo' })).toBe(true);
    expect(shouldShowConversationComposerMeta({ ...base, conversationCwdEditorOpen: true })).toBe(true);
    expect(shouldShowConversationComposerMeta({ ...base, conversationCwdError: 'bad cwd' })).toBe(true);
    expect(shouldShowConversationComposerMeta({ ...base, branchLabel: 'main' })).toBe(true);
    expect(shouldShowConversationComposerMeta({ ...base, hasGitSummary: true })).toBe(true);
  });
});
