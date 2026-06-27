import { describe, expect, it } from 'vitest';

import { buildDesktopSidebarConversationSnapshot } from './localApiSidebarConversations.js';

function session(id: string) {
  return {
    id,
    file: `/sessions/${id}.jsonl`,
    timestamp: '2026-06-19T12:00:00.000Z',
    cwd: '/repo',
    cwdSlug: 'repo',
    model: 'model',
    title: id,
    messageCount: 1,
  };
}

describe('localApiSidebarConversations', () => {
  it('filters workspace ids to backend-confirmed sessions', () => {
    const snapshot = buildDesktopSidebarConversationSnapshot({
      saved: {
        openConversationIds: ['open-a', 'missing-open', 'pinned-a'],
        pinnedConversationIds: ['pinned-a', 'missing-pinned'],
        archivedConversationIds: ['archived-a', 'open-a', 'missing-archived'],
        lockedConversationIds: ['open-a', 'missing-locked', 'archived-a'],
        activeConversationId: 'missing-open',
        workspacePaths: ['/repo'],
        remoteControlledConversationIds: ['remote-a'],
        conversationWorkspaceRevision: 7,
        conversationWorkspaceUpdatedAt: '2026-06-19T12:01:00.000Z',
        conversationWorkspaceMigratedAt: '2026-06-19T12:00:00.000Z',
      },
      sessions: [session('open-a'), session('pinned-a'), session('archived-a')],
    });

    expect(snapshot).toMatchObject({
      sessionIds: ['open-a'],
      pinnedSessionIds: ['pinned-a'],
      archivedSessionIds: ['archived-a'],
      lockedConversationIds: ['open-a', 'archived-a'],
      conversationPlacements: {
        'archived-a': 'archived',
        'open-a': 'open',
        'pinned-a': 'pinned',
      },
      activeConversationId: null,
      workspacePaths: ['/repo'],
      remoteControlledConversationIds: ['remote-a'],
      conversationWorkspaceRevision: 7,
    });
    expect(snapshot.sessions.map((item) => item.id)).toEqual(['open-a', 'pinned-a', 'archived-a']);
  });
});
