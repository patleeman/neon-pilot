import { describe, expect, it } from 'vitest';

import {
  buildActiveConversationWorkspacePaths,
  buildAvailableDraftWorkspacePaths,
  resolveConversationCurrentCwd,
} from './conversationWorkspaceState';

describe('conversationWorkspaceState', () => {
  it('resolves current cwd for draft and live conversations', () => {
    expect(resolveConversationCurrentCwd({ draft: true, draftCwdValue: '/draft', liveSessionCwd: '/live', sessionCwd: '/session' })).toBe(
      '/draft',
    );
    expect(resolveConversationCurrentCwd({ draft: true, draftCwdValue: '', liveSessionCwd: '/live', sessionCwd: '/session' })).toBeNull();
    expect(resolveConversationCurrentCwd({ draft: false, draftCwdValue: '/draft', liveSessionCwd: '/live', sessionCwd: '/session' })).toBe(
      '/live',
    );
    expect(resolveConversationCurrentCwd({ draft: false, draftCwdValue: '/draft', liveSessionCwd: null, sessionCwd: '/session' })).toBe(
      '/session',
    );
  });

  it('prepends draft cwd to saved workspace paths and normalizes duplicates', () => {
    expect(buildAvailableDraftWorkspacePaths({ draftCwdValue: '/repo', savedWorkspacePaths: ['/other', '/repo'] })).toEqual([
      '/repo',
      '/other',
    ]);
    expect(buildAvailableDraftWorkspacePaths({ draftCwdValue: '', savedWorkspacePaths: ['/other'] })).toEqual(['/other']);
  });

  it('builds active conversation workspace paths from the current conversation and sessions', () => {
    expect(
      buildActiveConversationWorkspacePaths({
        currentCwd: '/repo/current',
        sessions: [
          { cwd: '/repo/other' },
          { cwd: '/repo/current' },
          { cwd: '/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared' },
        ],
      }),
    ).toEqual(['/repo/current', '/repo/other']);

    expect(
      buildActiveConversationWorkspacePaths({
        currentCwd: '/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared',
        sessions: [{ cwd: '/repo/other' }],
      }),
    ).toEqual(['/repo/other']);
  });
});
