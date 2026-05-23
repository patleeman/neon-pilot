import { describe, expect, it } from 'vitest';

import { shouldRefreshDesktopConversationStateForAppEvent } from './localApiConversationEvents';

describe('localApiConversationEvents', () => {
  it('refreshes conversation state for relevant invalidation topics', () => {
    expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type: 'invalidate', topics: ['sessions'] })).toBe(true);
    expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type: 'invalidate', topics: ['sessionFiles'] })).toBe(true);
    expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type: 'invalidate', topics: ['tasks'] })).toBe(false);
    expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type: 'invalidate', topics: 'sessions' })).toBe(false);
  });

  it('refreshes only matching session-scoped app events', () => {
    for (const type of ['live_title', 'session_meta_changed', 'session_file_changed']) {
      expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type, sessionId: 'one' })).toBe(true);
      expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type, sessionId: 'two' })).toBe(false);
    }
  });

  it('ignores unknown or malformed events', () => {
    expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type: 'other', sessionId: 'one' })).toBe(false);
    expect(shouldRefreshDesktopConversationStateForAppEvent('one', { type: 'live_title', sessionId: null })).toBe(false);
  });
});
