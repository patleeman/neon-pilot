import { describe, expect, it } from 'vitest';

import { buildWorkspaceChangeContent, resolveWorkspaceChangeLabels } from './sessionWorkspaceChangeEntry';

describe('sessionWorkspaceChangeEntry', () => {
  it('uses Chats labels for null workspace roots', () => {
    expect(resolveWorkspaceChangeLabels({ previousWorkspaceCwd: null, workspaceCwd: null })).toEqual({
      previousLabel: 'Chats',
      nextLabel: 'Chats',
    });
  });

  it('prefers concrete cwd labels over workspace labels and fallbacks', () => {
    expect(
      resolveWorkspaceChangeLabels({
        previousCwd: ' /old ',
        previousWorkspaceCwd: '/workspace-old',
        cwd: ' /new ',
        workspaceCwd: '/workspace-new',
      }),
    ).toEqual({ previousLabel: '/old', nextLabel: '/new' });
    expect(resolveWorkspaceChangeLabels({})).toEqual({ previousLabel: 'previous workspace', nextLabel: 'new workspace' });
  });

  it('formats the visible workspace change content', () => {
    expect(buildWorkspaceChangeContent({ previousLabel: 'A', nextLabel: 'B' })).toBe('Working directory changed from A to B.');
  });
});
