import { describe, expect, it } from 'vitest';

import { desktopOpenConversationTabsInvalidationTopics, validateDesktopOpenConversationTabsUpdate } from './localApiOpenTabs';

describe('localApiOpenTabs', () => {
  it('accepts partial valid updates', () => {
    expect(() =>
      validateDesktopOpenConversationTabsUpdate({
        sessionIds: ['one'],
        pinnedSessionIds: [],
        archivedSessionIds: ['old'],
        activeConversationId: null,
        workspacePaths: ['/repo'],
      }),
    ).not.toThrow();
  });

  it('rejects invalid field shapes and empty updates', () => {
    expect(() => validateDesktopOpenConversationTabsUpdate({ sessionIds: 'bad' as unknown as string[] })).toThrow(
      'sessionIds must be an array when provided',
    );
    expect(() => validateDesktopOpenConversationTabsUpdate({ pinnedSessionIds: 'bad' as unknown as string[] })).toThrow(
      'pinnedSessionIds must be an array when provided',
    );
    expect(() => validateDesktopOpenConversationTabsUpdate({ archivedSessionIds: 'bad' as unknown as string[] })).toThrow(
      'archivedSessionIds must be an array when provided',
    );
    expect(() => validateDesktopOpenConversationTabsUpdate({ activeConversationId: 1 as unknown as string })).toThrow(
      'activeConversationId must be a string or null when provided',
    );
    expect(() => validateDesktopOpenConversationTabsUpdate({ workspacePaths: 'bad' as unknown as string[] })).toThrow(
      'workspacePaths must be an array when provided',
    );
    expect(() => validateDesktopOpenConversationTabsUpdate({})).toThrow(
      'sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId, or workspacePaths required',
    );
  });

  it('plans invalidation topics for changed session and workspace fields', () => {
    expect(desktopOpenConversationTabsInvalidationTopics({ sessionIds: [] })).toEqual(['sessions']);
    expect(desktopOpenConversationTabsInvalidationTopics({ activeConversationId: null, workspacePaths: ['/repo'] })).toEqual([
      'sessions',
      'workspace',
    ]);
    expect(desktopOpenConversationTabsInvalidationTopics({ workspacePaths: [] })).toEqual(['workspace']);
  });
});
