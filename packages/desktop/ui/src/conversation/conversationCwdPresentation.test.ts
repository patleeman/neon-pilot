import { describe, expect, it } from 'vitest';

import { formatConversationCwdLabel, hasDraftConversationCwd } from './conversationCwdPresentation';

describe('conversationCwdPresentation', () => {
  it('formats current cwd labels', () => {
    expect(formatConversationCwdLabel(null)).toBe('');
    expect(formatConversationCwdLabel(undefined)).toBe('');
    expect(formatConversationCwdLabel('/Users/patrick/workingdir/personal-agent')).toContain('personal-agent');
  });

  it('detects draft cwd presence', () => {
    expect(hasDraftConversationCwd('')).toBe(false);
    expect(hasDraftConversationCwd('/repo')).toBe(true);
  });
});
