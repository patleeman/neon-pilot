import { describe, expect, it } from 'vitest';

import { buildAvailableDraftWorkspacePaths, resolveConversationCurrentCwd } from './conversationWorkspaceState';

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
});
