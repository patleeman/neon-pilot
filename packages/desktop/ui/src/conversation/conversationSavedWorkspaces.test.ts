import { describe, expect, it } from 'vitest';

import { shouldRefetchSavedWorkspacePaths, syncSavedWorkspacePathValues } from './conversationSavedWorkspaces';

describe('conversationSavedWorkspaces', () => {
  it('normalizes saved workspace paths', () => {
    expect(syncSavedWorkspacePathValues(['/repo', ' ', '/other', '/repo'])).toEqual(['/repo', '/other']);
  });

  it('only refetches saved workspace paths for drafts', () => {
    expect(shouldRefetchSavedWorkspacePaths(true)).toBe(true);
    expect(shouldRefetchSavedWorkspacePaths(false)).toBe(false);
  });
});
