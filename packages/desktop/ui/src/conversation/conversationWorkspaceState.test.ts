import { describe, expect, it } from 'vitest';

import { buildAvailableDraftWorkspacePaths, buildWorkspacePickerPaths, resolveConversationCurrentCwd } from './conversationWorkspaceState';

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

  it('builds workspace picker paths from the current cwd and curated workspace sources', () => {
    expect(
      buildWorkspacePickerPaths({
        currentCwd: '/repo/current',
        pinnedWorkspacePaths: ['/repo/pinned'],
        savedWorkspacePaths: ['/repo/saved', '/repo/current'],
        openWorkspacePaths: ['/repo/open', '/repo/saved'],
      }),
    ).toEqual(['/repo/current', '/repo/pinned', '/repo/saved', '/repo/open']);

    expect(
      buildWorkspacePickerPaths({
        currentCwd: '/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared',
        savedWorkspacePaths: ['/repo/other'],
      }),
    ).toEqual(['/repo/other']);
  });
});
