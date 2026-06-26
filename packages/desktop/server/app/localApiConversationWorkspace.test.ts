import { describe, expect, it } from 'vitest';

import {
  applyDesktopConversationWorkspaceOperation,
  desktopConversationWorkspaceInvalidationTopics,
  filterDesktopConversationWorkspaceLayoutBySessionIds,
  validateDesktopConversationWorkspaceOperation,
  validateDesktopConversationWorkspaceUpdate,
} from './localApiConversationWorkspace';

describe('localApiConversationWorkspace', () => {
  it('accepts partial valid updates', () => {
    expect(() =>
      validateDesktopConversationWorkspaceUpdate({
        sessionIds: ['one'],
        pinnedSessionIds: [],
        archivedSessionIds: ['old'],
        lockedConversationIds: ['one'],
        activeConversationId: null,
        workspacePaths: ['/repo'],
        remoteControlledConversationIds: ['one'],
        conversationWorkspaceMigrated: true,
      }),
    ).not.toThrow();
  });

  it('rejects invalid field shapes and empty updates', () => {
    expect(() => validateDesktopConversationWorkspaceUpdate({ sessionIds: 'bad' as unknown as string[] })).toThrow(
      'sessionIds must be an array when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({ pinnedSessionIds: 'bad' as unknown as string[] })).toThrow(
      'pinnedSessionIds must be an array when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({ archivedSessionIds: 'bad' as unknown as string[] })).toThrow(
      'archivedSessionIds must be an array when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({ lockedConversationIds: 'bad' as unknown as string[] })).toThrow(
      'lockedConversationIds must be an array when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({ activeConversationId: 1 as unknown as string })).toThrow(
      'activeConversationId must be a string or null when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({ workspacePaths: 'bad' as unknown as string[] })).toThrow(
      'workspacePaths must be an array when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({ remoteControlledConversationIds: 'bad' as unknown as string[] })).toThrow(
      'remoteControlledConversationIds must be an array when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({ conversationWorkspaceMigrated: 'bad' as unknown as boolean })).toThrow(
      'conversationWorkspaceMigrated must be a boolean when provided',
    );
    expect(() => validateDesktopConversationWorkspaceUpdate({})).toThrow(
      'sessionIds, pinnedSessionIds, archivedSessionIds, lockedConversationIds, activeConversationId, workspacePaths, remoteControlledConversationIds, or conversationWorkspaceMigrated required',
    );
  });

  it('plans invalidation topics for changed session and workspace fields', () => {
    expect(desktopConversationWorkspaceInvalidationTopics({ sessionIds: [] })).toEqual(['sessions']);
    expect(desktopConversationWorkspaceInvalidationTopics({ activeConversationId: null, workspacePaths: ['/repo'] })).toEqual([
      'sessions',
      'workspace',
    ]);
    expect(desktopConversationWorkspaceInvalidationTopics({ workspacePaths: [] })).toEqual(['workspace']);
    expect(desktopConversationWorkspaceInvalidationTopics({ remoteControlledConversationIds: ['remote-a'] })).toEqual(['sessions']);
  });

  it('filters stale workspace ids before returning a backend-backed layout', () => {
    expect(
      filterDesktopConversationWorkspaceLayoutBySessionIds(
        {
          sessionIds: ['open-a', 'stale-open', 'pinned-a'],
          pinnedSessionIds: ['pinned-a', 'stale-pinned'],
          archivedSessionIds: ['archived-a', 'stale-archived', 'open-a'],
          lockedConversationIds: ['open-a', 'archived-a', 'stale-open'],
          activeConversationId: 'stale-open',
        },
        new Set(['open-a', 'pinned-a', 'archived-a']),
      ),
    ).toEqual({
      sessionIds: ['open-a'],
      pinnedSessionIds: ['pinned-a'],
      archivedSessionIds: ['archived-a'],
      lockedConversationIds: ['open-a', 'archived-a'],
      activeConversationId: null,
    });
  });

  it('applies a multi-action workspace operation flow on the backend layout', () => {
    let layout = {
      sessionIds: ['open-a', 'open-b'],
      pinnedSessionIds: [],
      archivedSessionIds: [],
      lockedConversationIds: [],
      activeConversationId: 'open-a',
    };

    layout = applyDesktopConversationWorkspaceOperation(layout, { operation: 'open', sessionId: 'open-c' });
    layout = applyDesktopConversationWorkspaceOperation(layout, { operation: 'pin', sessionId: 'open-b' });
    layout = applyDesktopConversationWorkspaceOperation(layout, { operation: 'archive', sessionId: 'open-a' });
    layout = applyDesktopConversationWorkspaceOperation(layout, { operation: 'restore', sessionId: 'open-a' });
    layout = applyDesktopConversationWorkspaceOperation(layout, {
      operation: 'move',
      sessionId: 'open-a',
      targetSection: 'open',
      targetSessionId: 'open-c',
      position: 'before',
    });
    layout = applyDesktopConversationWorkspaceOperation(layout, { operation: 'lock', sessionId: 'open-a' });
    layout = applyDesktopConversationWorkspaceOperation(layout, { operation: 'close', sessionId: 'open-c' });
    layout = applyDesktopConversationWorkspaceOperation(layout, { operation: 'unlock', sessionId: 'open-a' });

    expect(layout).toEqual({
      sessionIds: ['open-a'],
      pinnedSessionIds: ['open-b'],
      archivedSessionIds: ['open-c'],
      lockedConversationIds: [],
      activeConversationId: null,
    });
  });

  it('validates workspace operation payloads', () => {
    expect(() => validateDesktopConversationWorkspaceOperation({ operation: 'open', sessionId: 'one' })).not.toThrow();
    expect(() =>
      validateDesktopConversationWorkspaceOperation({ operation: 'move', sessionId: 'one', targetSection: 'pinned' }),
    ).not.toThrow();
    expect(() => validateDesktopConversationWorkspaceOperation({ operation: 'lock', sessionId: 'one' })).not.toThrow();
    expect(() => validateDesktopConversationWorkspaceOperation({ operation: 'move', sessionId: 'one', targetSection: 'bad' })).toThrow(
      'targetSection must be open or pinned',
    );
    expect(() => validateDesktopConversationWorkspaceOperation({ operation: 'open', sessionId: '' })).toThrow('sessionId is required');
    expect(() => validateDesktopConversationWorkspaceOperation({ operation: 'bad', sessionId: 'one' })).toThrow(
      'operation must be a supported conversation workspace operation',
    );
  });
});
