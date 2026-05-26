import { describe, expect, it } from 'vitest';

import { formatConversationCwdLabel, hasDraftConversationCwd, isNeutralChatCwdPath } from './conversationCwdPresentation';

describe('conversationCwdPresentation', () => {
  it('formats current cwd labels', () => {
    expect(formatConversationCwdLabel(null)).toBe('');
    expect(formatConversationCwdLabel(undefined)).toBe('');
    expect(formatConversationCwdLabel('/Users/patrick/workingdir/personal-agent')).toContain('personal-agent');
    expect(formatConversationCwdLabel('/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared')).toBe('Chat');
  });

  it('detects neutral chat workspace paths', () => {
    expect(isNeutralChatCwdPath('/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared')).toBe(true);
    expect(isNeutralChatCwdPath('/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces')).toBe(true);
    expect(isNeutralChatCwdPath('/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/')).toBe(true);
    expect(isNeutralChatCwdPath('/Users/patrick/workingdir/personal-agent')).toBe(false);
  });

  it('detects draft cwd presence', () => {
    expect(hasDraftConversationCwd('')).toBe(false);
    expect(hasDraftConversationCwd('/repo')).toBe(true);
  });
});
