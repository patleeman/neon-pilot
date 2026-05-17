import { describe, expect, it, vi } from 'vitest';

import { workspace } from './workspace.js';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    conversations: {
      getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['a'], pinnedConversationIds: [], activeConversationId: 'a' }),
      updateWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['b'], pinnedConversationIds: [], activeConversationId: 'b' }),
      ...overrides,
    },
  };
}

const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };

describe('system-alleycat workspace protocol', () => {
  it('reads the shared conversation workspace', async () => {
    const ctx = makeContext();
    await expect(workspace.read({}, ctx as never, conn, vi.fn())).resolves.toEqual({
      workspace: { openConversationIds: ['a'], pinnedConversationIds: [], activeConversationId: 'a' },
    });
  });

  it('updates sanitized shared conversation workspace state', async () => {
    const updateWorkspace = vi.fn().mockResolvedValue({ openConversationIds: ['b'], activeConversationId: 'b' });
    const ctx = makeContext({ updateWorkspace });

    await expect(
      workspace.update(
        {
          openConversationIds: [' b ', '', null],
          pinnedConversationIds: ['c'],
          archivedConversationIds: ['d'],
          activeConversationId: 'b',
          remoteControlledConversationIds: ['e'],
        },
        ctx as never,
        conn,
        vi.fn(),
      ),
    ).resolves.toEqual({ ok: true, workspace: { openConversationIds: ['b'], activeConversationId: 'b' } });
    expect(updateWorkspace).toHaveBeenCalledWith({
      openConversationIds: ['b'],
      pinnedConversationIds: ['c'],
      archivedConversationIds: ['d'],
      remoteControlledConversationIds: ['e'],
      activeConversationId: 'b',
    });
  });
});
