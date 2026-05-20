import { describe, expect, it } from 'vitest';

import { buildConversationGroupLabels, getConversationGroupLabel, groupConversationItemsByCwd } from './conversationCwdGroups.js';

describe('conversationCwdGroups', () => {
  it('merges cwd groups that only differ by trailing slashes', () => {
    const groups = groupConversationItemsByCwd(
      [
        { id: 'alpha-a', cwd: '/tmp/alpha-worktree' },
        { id: 'alpha-b', cwd: '/tmp/alpha-worktree/' },
      ],
      (item) => item.cwd,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('/tmp/alpha-worktree');
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['alpha-a', 'alpha-b']);
  });

  it('disambiguates workspaces that share the same basename', () => {
    const labelsByCwd = buildConversationGroupLabels(['/home/user/personal/neon-pilot', '/home/user/documents/neon-pilot']);

    expect(getConversationGroupLabel('/home/user/personal/neon-pilot', { labelsByCwd })).toBe('personal/neon-pilot');
    expect(getConversationGroupLabel('/home/user/documents/neon-pilot', { labelsByCwd })).toBe('documents/neon-pilot');
  });
});
