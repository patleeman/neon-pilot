import { describe, expect, it, vi } from 'vitest';

import { thread } from './thread.js';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    runtime: { getRepoRoot: () => '/repo' },
    storage: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue({ ok: true }),
      delete: vi.fn().mockResolvedValue({ ok: true, deleted: true }),
    },
    conversations: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'thread-1' }),
      getMeta: vi.fn().mockResolvedValue({ id: 'thread-1', title: 'Test thread', cwd: '/repo', updatedAt: 1_700_000_001_000 }),
      subscribe: vi.fn(() => undefined),
      getBlocks: vi.fn().mockResolvedValue({
        detail: {
          blocks: [
            { type: 'user', id: 'u1', ts: '2026-05-15T10:00:00.000Z', text: 'hello' },
            { type: 'thinking', id: 'r1', ts: '2026-05-15T10:00:01.000Z', text: 'thinking' },
            {
              type: 'tool_use',
              id: 't1',
              toolCallId: 'call-read-1',
              ts: '2026-05-15T10:00:02.000Z',
              tool: 'read',
              input: { path: 'README.md' },
              output: 'contents',
            },
            { type: 'text', id: 'a1', ts: '2026-05-15T10:00:03.000Z', text: 'done' },
            { type: 'user', id: 'u2', ts: '2026-05-15T10:01:00.000Z', text: 'next' },
            { type: 'error', id: 'e1', ts: '2026-05-15T10:01:01.000Z', message: 'boom' },
          ],
        },
      }),
      ...overrides,
    },
  };
}

describe('system-alleycat thread protocol', () => {
  it('hydrates thread/read turns from PA transcript blocks', async () => {
    const ctx = makeContext();
    const result = (await thread.read(
      { threadId: 'thread-1', includeTurns: true },
      ctx as never,
      { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set() },
      vi.fn(),
    )) as { thread: { turns: Array<{ items: Array<Record<string, unknown>> }> } };

    expect(result.thread.turns).toHaveLength(2);
    expect(result.thread.turns[0].items).toMatchObject([
      { type: 'userMessage', content: [{ type: 'text', text: 'hello' }] },
      { type: 'reasoning', content: ['thinking'] },
      {
        id: 'call-read-1',
        type: 'dynamicToolCall',
        namespace: 'neon-pilot',
        tool: 'read',
        arguments: { path: 'README.md' },
        contentItems: [{ type: 'text', text: 'contents' }],
      },
      { type: 'agentMessage', text: 'done' },
    ]);
    expect(result.thread.turns[1].items).toMatchObject([
      { type: 'userMessage', content: [{ type: 'text', text: 'next' }] },
      {
        type: 'dynamicToolCall',
        namespace: 'neon-pilot',
        tool: 'error',
        success: false,
        contentItems: [{ type: 'text', text: 'boom' }],
      },
    ]);
  });

  it('hydrates thread/resume with existing turns so Kitty does not render a blank reopened thread', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    const result = (await thread.resume(
      { threadId: 'thread-1' },
      ctx as never,
      { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set() },
      notify,
    )) as { thread: { turns: Array<{ items: Array<Record<string, unknown>> }> } };

    expect(result.thread.turns).toHaveLength(2);
    expect(result.thread.turns[0].items[0]).toMatchObject({ type: 'userMessage', content: [{ type: 'text', text: 'hello' }] });
    expect(notify).toHaveBeenCalledWith(
      'thread/started',
      expect.objectContaining({ thread: expect.objectContaining({ turns: expect.arrayContaining([expect.any(Object)]) }) }),
    );
  });

  it('hydrates thread/start response after create so prompt-created threads have renderable items', async () => {
    const ctx = makeContext();
    const result = (await thread.start(
      { cwd: '/repo', prompt: 'hello' },
      ctx as never,
      { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set() },
      vi.fn(),
    )) as { thread: { turns: Array<{ items: Array<Record<string, unknown>> }> } };

    expect(ctx.conversations.create).toHaveBeenCalledWith({ cwd: '/repo', model: undefined, prompt: 'hello' });
    expect(result.thread.turns).toHaveLength(2);
  });

  it('hydrates thread/read turns by default for Kitty clients', async () => {
    const ctx = makeContext();
    const result = (await thread.read(
      { threadId: 'thread-1' },
      ctx as never,
      { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set() },
      vi.fn(),
    )) as { thread: { turns: Array<{ items: Array<Record<string, unknown>> }> } };

    expect(result.thread.turns).toHaveLength(2);
    expect(ctx.conversations.getBlocks).toHaveBeenCalledWith('thread-1');
  });

  it('returns metadata even when transcript block capability is unavailable', async () => {
    const ctx = makeContext({ getBlocks: undefined });
    const result = (await thread.read(
      { threadId: 'thread-1' },
      ctx as never,
      { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set() },
      vi.fn(),
    )) as { thread: { turns: unknown[]; id: string } };

    expect(result.thread.id).toBe('thread-1');
    expect(result.thread.turns).toEqual([]);
  });

  it('can skip thread/read turns when requested', async () => {
    const ctx = makeContext();
    const result = (await thread.read(
      { threadId: 'thread-1', includeTurns: false },
      ctx as never,
      { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set() },
      vi.fn(),
    )) as { thread: { turns: unknown[] } };

    expect(result.thread.turns).toEqual([]);
    expect(ctx.conversations.getBlocks).not.toHaveBeenCalled();
  });

  it('filters and sorts thread/list by cwd, search term, and updated time', async () => {
    const ctx = makeContext({
      list: vi.fn().mockResolvedValue([
        { id: 'a', title: 'Alpha', cwd: '/repo/a', lastActivityAt: '2026-01-01T00:00:10.000Z' },
        { id: 'b', title: 'Beta needle', cwd: '/repo/b', lastActivityAt: '2026-01-01T00:00:30.000Z', isLive: true },
        { id: 'c', title: 'Gamma needle', cwd: '/repo/b', timestamp: '2026-01-01T00:00:20.000Z' },
      ]),
    });

    const result = (await thread.list(
      { cwd: '/repo/b', searchTerm: 'needle', sortKey: 'updated_at', sortDirection: 'desc', limit: 10 },
      ctx as never,
      { initialized: true, subscribedThreads: new Set(), activeTurnThreads: new Set() },
      vi.fn(),
    )) as { data: Array<{ id: string; status: { type: string } }> };

    expect(result.data.map((item) => item.id)).toEqual(['b', 'c']);
    expect(result.data[0].status.type).toBe('idle');
    expect(result.data[1].status.type).toBe('idle');
    expect(result.data[0].path).toBe('/repo/b');
  });

  it('treats Kitty mobile /root cwd as global and reports workspace-open loaded threads', async () => {
    const ctx = makeContext({
      list: vi.fn().mockResolvedValue([
        { id: 'a', title: 'Alpha', cwd: '/repo/a', updatedAt: 10, isLive: true },
        { id: 'b', title: 'Beta', cwd: '/repo/b', updatedAt: 30 },
      ]),
      getWorkspace: vi.fn().mockResolvedValue({ pinnedConversationIds: ['b'], openConversationIds: ['a', 'b'] }),
    });
    const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };

    const listed = (await thread.list({ cwd: '/root', limit: 10 }, ctx as never, conn, vi.fn())) as { data: Array<{ id: string }> };
    expect(listed.data.map((item) => item.id)).toEqual(['b', 'a']);

    const loaded = (await thread.loadedList({}, ctx as never, conn, vi.fn())) as { data: string[] };
    expect(loaded.data).toEqual(['b', 'a']);
  });

  it('falls back to live loaded threads when workspace state is unavailable', async () => {
    const ctx = makeContext({
      list: vi.fn().mockResolvedValue([
        { id: 'a', title: 'Alpha', cwd: '/repo/a', updatedAt: 10, isLive: true },
        { id: 'b', title: 'Beta', cwd: '/repo/b', updatedAt: 30 },
      ]),
      getWorkspace: vi.fn().mockRejectedValue(new Error('no workspace')),
    });
    const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };

    const loaded = (await thread.loadedList({}, ctx as never, conn, vi.fn())) as { data: string[] };
    expect(loaded.data).toEqual(['a']);
  });

  it('archives and unarchives threads through shared workspace state', async () => {
    const updateWorkspace = vi
      .fn()
      .mockResolvedValueOnce({ archivedConversationIds: ['b'], openConversationIds: ['a'], pinnedConversationIds: [] })
      .mockResolvedValueOnce({ archivedConversationIds: [], openConversationIds: ['a'], pinnedConversationIds: [] });
    const ctx = makeContext({
      getWorkspace: vi.fn().mockResolvedValue({
        openConversationIds: ['a', 'b'],
        pinnedConversationIds: ['b'],
        archivedConversationIds: [],
        remoteControlledConversationIds: ['b'],
        activeConversationId: 'b',
      }),
      updateWorkspace,
    });
    const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };

    const archived = await thread.archive({ threadId: 'b' }, ctx as never, conn, vi.fn());
    expect(archived).toEqual({
      ok: true,
      workspace: { archivedConversationIds: ['b'], openConversationIds: ['a'], pinnedConversationIds: [] },
    });
    expect(updateWorkspace).toHaveBeenCalledWith({
      openConversationIds: ['a'],
      pinnedConversationIds: [],
      archivedConversationIds: ['b'],
      remoteControlledConversationIds: [],
      activeConversationId: null,
    });

    await thread.unarchive({ threadId: 'b' }, ctx as never, conn, vi.fn());
    expect(updateWorkspace).toHaveBeenLastCalledWith({ archivedConversationIds: [] });
  });

  it('starts compaction without synthetic idle status and rejects ignored custom instructions', async () => {
    const compact = vi.fn().mockResolvedValue({ ok: true });
    const ctx = makeContext({ compact });
    const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };
    const notify = vi.fn();

    await expect(thread.compactStart({ threadId: 'thread-1' }, ctx as never, conn, notify)).resolves.toEqual({});
    expect(compact).toHaveBeenCalledWith('thread-1');
    expect(notify).not.toHaveBeenCalledWith('thread/status/changed', expect.anything());

    await expect(
      thread.compactStart({ threadId: 'thread-1', options: { customInstructions: 'summarize this way' } }, ctx as never, conn, notify),
    ).rejects.toThrow('customInstructions are unsupported');
  });

  it('opens and closes threads in the shared workspace without archiving', async () => {
    const updateWorkspace = vi
      .fn()
      .mockResolvedValueOnce({ openConversationIds: ['a', 'b'], pinnedConversationIds: [] })
      .mockResolvedValueOnce({ openConversationIds: ['a'], pinnedConversationIds: [] });
    const ctx = makeContext({
      getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['a'], pinnedConversationIds: [] }),
      updateWorkspace,
    });
    const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };

    await thread.open({ threadId: 'b' }, ctx as never, conn, vi.fn());
    expect(updateWorkspace).toHaveBeenCalledWith({ openConversationIds: ['a', 'b'], activeConversationId: 'b' });

    await thread.close({ threadId: 'b' }, ctx as never, conn, vi.fn());
    expect(updateWorkspace).toHaveBeenLastCalledWith({ openConversationIds: ['a'], pinnedConversationIds: [], activeConversationId: null });
  });
});
