import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mutateWorkspace, workspaceList } from './workspaceState.js';

describe('alleycat workspaceState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unique non-empty string ids from workspace list fields', () => {
    expect(workspaceList({ openConversationIds: ['a', '', 'a', 1, 'b'] }, 'openConversationIds')).toEqual(['a', 'b']);
    expect(workspaceList(null, 'openConversationIds')).toEqual([]);
    expect(workspaceList({ openConversationIds: 'bad' }, 'openConversationIds')).toEqual([]);
  });

  it('reads the current workspace, applies a patch, and writes through the conversation capability', async () => {
    const ctx = {
      conversations: {
        getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['a'] }),
        updateWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['a', 'b'] }),
      },
    };

    await expect(
      mutateWorkspace(ctx as never, (workspace) => ({ openConversationIds: [...workspaceList(workspace, 'openConversationIds'), 'b'] })),
    ).resolves.toEqual({ openConversationIds: ['a', 'b'] });

    expect(ctx.conversations.getWorkspace).toHaveBeenCalledOnce();
    expect(ctx.conversations.updateWorkspace).toHaveBeenCalledWith({ openConversationIds: ['a', 'b'] });
  });

  it('falls back to null workspace when reading workspace state fails', async () => {
    const ctx = {
      conversations: {
        getWorkspace: vi.fn().mockRejectedValue(new Error('missing')),
        updateWorkspace: vi.fn().mockResolvedValue({ pinnedConversationIds: ['fallback'] }),
      },
    };

    await expect(
      mutateWorkspace(ctx as never, (workspace) => ({
        pinnedConversationIds: workspaceList(workspace, 'pinnedConversationIds').concat('fallback'),
      })),
    ).resolves.toEqual({
      pinnedConversationIds: ['fallback'],
    });
  });

  it('serializes workspace mutations so later mutations see later reads', async () => {
    let releaseFirst: (() => void) | undefined;
    const ctx = {
      conversations: {
        getWorkspace: vi
          .fn()
          .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = () => resolve({ openConversationIds: ['first'] }))))
          .mockResolvedValueOnce({ openConversationIds: ['second'] }),
        updateWorkspace: vi.fn(async (patch) => patch),
      },
    };

    const first = mutateWorkspace(ctx as never, (workspace) => ({
      openConversationIds: [...workspaceList(workspace, 'openConversationIds'), 'done'],
    }));
    const second = mutateWorkspace(ctx as never, (workspace) => ({
      openConversationIds: [...workspaceList(workspace, 'openConversationIds'), 'done'],
    }));

    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf('function'));
    releaseFirst?.();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { openConversationIds: ['first', 'done'] },
      { openConversationIds: ['second', 'done'] },
    ]);
    expect(ctx.conversations.getWorkspace).toHaveBeenCalledTimes(2);
    expect(ctx.conversations.updateWorkspace).toHaveBeenNthCalledWith(1, { openConversationIds: ['first', 'done'] });
    expect(ctx.conversations.updateWorkspace).toHaveBeenNthCalledWith(2, { openConversationIds: ['second', 'done'] });
  });

  it('throws when workspace updates are unavailable', async () => {
    await expect(mutateWorkspace({ conversations: {} } as never, () => ({}))).rejects.toThrow('Conversation workspace is unavailable.');
  });
});
