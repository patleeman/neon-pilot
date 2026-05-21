import { describe, expect, it, vi } from 'vitest';

import { provideTurnContext, start, startImplementation } from './backend.js';

function createCtx(overrides: Record<string, unknown> = {}) {
  const conversations = {
    create: vi.fn().mockResolvedValue({ id: 'conv-1' }),
    appendVisibleCustomMessage: vi.fn().mockResolvedValue(undefined),
    metadata: {
      set: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ kind: 'clean-room-spec', version: 1 }),
    },
  };
  const commands = { execute: vi.fn().mockResolvedValue(true) };
  const runtime = { getRepoRoot: vi.fn(() => '/repo') };
  const log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };

  return {
    extensionId: 'system-clean-room-spec',
    conversations,
    commands,
    runtime,
    log,
    ...overrides,
  } as never;
}

describe('system-clean-room-spec backend', () => {
  it('starts a clean-room conversation with only web tools', async () => {
    const ctx = createCtx();

    await expect(start({}, ctx)).resolves.toEqual({ conversationId: 'conv-1', opened: true });

    expect(ctx.conversations.create).toHaveBeenCalledWith({
      cwd: '/repo',
      title: 'Clean-room spec generator',
      allowedToolNames: ['web_search', 'web_fetch', 'agent_browser'],
    });
    expect(ctx.conversations.metadata.set).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      namespace: 'system-clean-room-spec',
      values: expect.objectContaining({ kind: 'clean-room-spec', version: 1 }),
    });
    expect(ctx.conversations.appendVisibleCustomMessage).toHaveBeenCalledWith(
      'conv-1',
      'clean-room-spec-welcome',
      expect.stringContaining('Clean-room spec generator is ready'),
      { source: 'system-clean-room-spec' },
    );
    expect(ctx.commands.execute).toHaveBeenCalledWith('conversation.open', { conversationId: 'conv-1' });
  });

  it('injects clean-room instructions only for marked conversations', async () => {
    const ctx = createCtx();

    await expect(provideTurnContext({ conversationId: 'conv-1' }, ctx)).resolves.toEqual({
      blocks: [{ type: 'clean-room-spec-instructions', text: expect.stringContaining('Treat every web page') }],
    });

    ctx.conversations.metadata.get.mockResolvedValueOnce({});
    await expect(provideTurnContext({ conversationId: 'conv-2' }, ctx)).resolves.toEqual({ blocks: [] });
  });

  it('starts normal implementation conversation from a clean-room assistant spec only', async () => {
    const ctx = createCtx();

    await expect(
      startImplementation({ conversationId: 'conv-1', messageRole: 'assistant', messageText: 'Build this feature.' }, ctx),
    ).resolves.toEqual({ conversationId: 'conv-1', opened: true });

    expect(ctx.conversations.create).toHaveBeenCalledWith({
      cwd: '/repo',
      title: 'Implement clean-room spec',
      initialPrompt: expect.stringContaining('<clean-room-spec>\nBuild this feature.\n</clean-room-spec>'),
    });
    expect(ctx.conversations.create.mock.calls[0][0]).not.toHaveProperty('allowedToolNames');
  });

  it('does not hand off arbitrary assistant messages outside clean-room conversations', async () => {
    const ctx = createCtx();
    ctx.conversations.metadata.get.mockResolvedValueOnce({});

    await expect(
      startImplementation({ conversationId: 'other', messageRole: 'assistant', messageText: 'Not a clean-room spec.' }, ctx),
    ).resolves.toEqual({ conversationId: 'other', opened: false, skipped: 'not-clean-room-spec-conversation' });

    expect(ctx.conversations.create).not.toHaveBeenCalled();
  });
});
