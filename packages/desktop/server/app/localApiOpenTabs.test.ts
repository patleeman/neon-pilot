import { describe, expect, it } from 'vitest';

import {
  applyDesktopOpenConversationOperation,
  desktopOpenConversationTabsInvalidationTopics,
  validateDesktopOpenConversationOperation,
  validateDesktopOpenConversationTabsUpdate,
} from './localApiOpenTabs';

describe('localApiOpenTabs', () => {
  it('accepts partial valid updates', () => {
    expect(() =>
      validateDesktopOpenConversationTabsUpdate({
        sessionIds: ['one'],
        pinnedSessionIds: [],
        archivedSessionIds: ['old'],
        activeConversationId: null,
        workspacePaths: ['/repo'],
        conversationWorkspaceMigrated: true,
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
    expect(() => validateDesktopOpenConversationTabsUpdate({ conversationWorkspaceMigrated: 'bad' as unknown as boolean })).toThrow(
      'conversationWorkspaceMigrated must be a boolean when provided',
    );
    expect(() => validateDesktopOpenConversationTabsUpdate({})).toThrow(
      'sessionIds, pinnedSessionIds, archivedSessionIds, activeConversationId, workspacePaths, or conversationWorkspaceMigrated required',
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

  it('applies a multi-action workspace operation flow on the backend layout', () => {
    let layout = {
      sessionIds: ['open-a', 'open-b'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      activeConversationId: 'open-a',
    };

    layout = applyDesktopOpenConversationOperation(layout, { operation: 'open', sessionId: 'open-c' });
    layout = applyDesktopOpenConversationOperation(layout, { operation: 'pin', sessionId: 'open-b' });
    layout = applyDesktopOpenConversationOperation(layout, { operation: 'archive', sessionId: 'open-a' });
    layout = applyDesktopOpenConversationOperation(layout, { operation: 'restore', sessionId: 'open-a' });
    layout = applyDesktopOpenConversationOperation(layout, {
      operation: 'move',
      sessionId: 'open-a',
      targetSection: 'open',
      targetSessionId: 'open-c',
      position: 'before',
    });
    layout = applyDesktopOpenConversationOperation(layout, { operation: 'close', sessionId: 'open-c' });

    expect(layout).toEqual({
      sessionIds: ['open-a'],
      pinnedSessionIds: ['open-b'],
      archivedSessionIds: ['open-c'],
      activeConversationId: null,
    });
  });

  it('validates workspace operation payloads', () => {
    expect(() => validateDesktopOpenConversationOperation({ operation: 'open', sessionId: 'one' })).not.toThrow();
    expect(() => validateDesktopOpenConversationOperation({ operation: 'move', sessionId: 'one', targetSection: 'pinned' })).not.toThrow();
    expect(() => validateDesktopOpenConversationOperation({ operation: 'move', sessionId: 'one', targetSection: 'bad' })).toThrow(
      'targetSection must be open or pinned',
    );
    expect(() => validateDesktopOpenConversationOperation({ operation: 'open', sessionId: '' })).toThrow('sessionId is required');
    expect(() => validateDesktopOpenConversationOperation({ operation: 'bad', sessionId: 'one' })).toThrow(
      'operation must be a supported conversation workspace operation',
    );
  });
});
