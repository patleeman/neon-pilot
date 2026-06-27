import { describe, expect, it } from 'vitest';

import { buildDesktopConversationWorkspaceResponse } from './localApiConversationWorkspacePresentation';

describe('localApiConversationWorkspacePresentation', () => {
  it('maps saved UI preferences to the desktop conversation workspace response', () => {
    expect(
      buildDesktopConversationWorkspaceResponse({
        openConversationIds: ['a'],
        pinnedConversationIds: ['b'],
        archivedConversationIds: ['c'],
        lockedConversationIds: [],
        activeConversationId: 'a',
        workspacePaths: ['/tmp'],
        remoteControlledConversationIds: ['d'],
        conversationWorkspaceRevision: 3,
        conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
        conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
      }),
    ).toEqual({
      sessionIds: ['a'],
      pinnedSessionIds: ['b'],
      archivedSessionIds: ['c'],
      lockedConversationIds: [],
      conversationPlacements: {
        a: 'open',
        b: 'pinned',
        c: 'archived',
      },
      activeConversationId: 'a',
      workspacePaths: ['/tmp'],
      remoteControlledConversationIds: ['d'],
      conversationWorkspaceRevision: 3,
      conversationWorkspaceUpdatedAt: '2026-04-01T00:00:00.000Z',
      conversationWorkspaceMigratedAt: '2026-04-01T00:00:00.000Z',
    });
  });

  it('normalizes missing active conversation to null', () => {
    expect(
      buildDesktopConversationWorkspaceResponse({
        openConversationIds: [],
        pinnedConversationIds: [],
        archivedConversationIds: [],
        lockedConversationIds: [],
        workspacePaths: [],
        remoteControlledConversationIds: [],
        conversationWorkspaceRevision: 0,
        conversationWorkspaceUpdatedAt: null,
        conversationWorkspaceMigratedAt: null,
      }).activeConversationId,
    ).toBeNull();
  });
});
