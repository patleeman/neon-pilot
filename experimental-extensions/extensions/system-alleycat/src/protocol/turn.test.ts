import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanupTurnSubscriptions, turn, turnSubscriptions } from './turn.js';

function makeContext() {
  let conversationHandler: ((event: unknown) => void) | null = null;
  const ctx = {
    storage: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue({ ok: true }),
    },
    conversations: {
      subscribe: vi.fn((_threadId: string, handler: (event: unknown) => void) => {
        conversationHandler = handler;
        return vi.fn();
      }),
      ensureLive: vi.fn().mockResolvedValue({ id: 'thread-1', conversationId: 'thread-1' }),
      getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: [], pinnedConversationIds: [] }),
      updateWorkspace: vi
        .fn()
        .mockResolvedValue({ openConversationIds: ['thread-1'], pinnedConversationIds: [], activeConversationId: 'thread-1' }),
      appendVisibleCustomMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendMessage: vi.fn().mockResolvedValue({ accepted: true }),
      getBlocks: vi.fn().mockResolvedValue({ detail: { blocks: [] } }),
    },
    emitConversationEvent(event: unknown) {
      conversationHandler?.(event);
    },
  };
  return ctx;
}

function makeConn() {
  return { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };
}

async function flushAsyncTurnStart() {
  await Promise.resolve();
}

afterEach(() => {
  turnSubscriptions.clear();
});

describe('system-alleycat turn protocol', () => {
  it('passes data-url image inputs through to PA conversations', async () => {
    const ctx = makeContext();

    await turn.start(
      {
        threadId: 'thread-1',
        input: [
          { type: 'text', text: 'what do you see?' },
          { type: 'image', url: 'data:image/png;base64,aGVsbG8=', name: 'shot.png' },
        ],
      },
      ctx as never,
      makeConn(),
      vi.fn(),
    );

    await flushAsyncTurnStart();

    expect(ctx.conversations.ensureLive).toHaveBeenCalledWith('thread-1', undefined);
    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith('thread-1', 'what do you see?', {
      images: [{ data: 'aGVsbG8=', mimeType: 'image/png', name: 'shot.png' }],
    });
  });

  it('passes local image path inputs through to PA conversations', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pa-alleycat-turn-'));
    const imagePath = join(dir, 'photo.jpg');
    writeFileSync(imagePath, Buffer.from('pixels'));
    const ctx = makeContext();

    await turn.start(
      {
        threadId: 'thread-1',
        input: [
          { type: 'text', text: 'inspect this' },
          { type: 'input_image', url: imagePath },
        ],
      },
      ctx as never,
      makeConn(),
      vi.fn(),
    );

    await flushAsyncTurnStart();

    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith('thread-1', 'inspect this', {
      images: [{ data: Buffer.from('pixels').toString('base64'), mimeType: 'image/jpeg', name: 'photo.jpg' }],
    });
  });

  it('allows image-only turns', async () => {
    const ctx = makeContext();

    await turn.start(
      { threadId: 'thread-1', input: [{ type: 'image', dataBase64: 'aGVsbG8=', mimeType: 'image/png' }] },
      ctx as never,
      makeConn(),
      vi.fn(),
    );

    await flushAsyncTurnStart();

    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith('thread-1', '', {
      images: [{ data: 'aGVsbG8=', mimeType: 'image/png' }],
    });
  });

  it('resumes persisted threads before subscribing and sending follow-up messages', async () => {
    const ctx = makeContext();
    const order: string[] = [];
    ctx.conversations.ensureLive.mockImplementation(async () => {
      order.push('ensureLive');
      return { id: 'thread-1', conversationId: 'thread-1' };
    });
    ctx.conversations.subscribe.mockImplementation((_threadId: string, handler: (event: unknown) => void) => {
      order.push('subscribe');
      ctx.emitConversationEvent = handler;
      return vi.fn();
    });
    ctx.conversations.sendMessage.mockImplementation(async () => {
      order.push('sendMessage');
      return { accepted: true };
    });

    await turn.start({ threadId: 'thread-1', cwd: '/repo', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), vi.fn());

    expect(ctx.conversations.ensureLive).toHaveBeenCalledWith('thread-1', { cwd: '/repo' });
    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith('thread-1', 'Hi', undefined);
    expect(order).toEqual(['ensureLive', 'subscribe', 'sendMessage']);
  });

  it('forwards PA response events to Kitty before returning the turn/start response', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    ctx.conversations.sendMessage.mockImplementation(async () => {
      ctx.emitConversationEvent({ type: 'agent_start' });
      ctx.emitConversationEvent({ type: 'text_delta', delta: 'Hello back' });
      ctx.emitConversationEvent({ type: 'agent_end' });
      ctx.emitConversationEvent({ type: 'turn_end' });
      return { accepted: true };
    });

    const result = (await turn.start(
      { threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] },
      ctx as never,
      makeConn(),
      notify,
    )) as { turn: { status: string } };

    expect(notify).toHaveBeenCalledWith('item/agentMessage/delta', expect.objectContaining({ delta: 'Hello back' }));
    expect(notify).toHaveBeenCalledWith('turn/completed', expect.objectContaining({ threadId: 'thread-1' }));
    expect(result.turn.status).toBe('completed');
  });

  it('opens and focuses the desktop workspace when Kitty starts a turn', async () => {
    const ctx = makeContext();

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), vi.fn());
    await flushAsyncTurnStart();

    expect(ctx.conversations.updateWorkspace).toHaveBeenCalledWith({
      openConversationIds: ['thread-1'],
      activeConversationId: 'thread-1',
    });
    expect(ctx.conversations.appendVisibleCustomMessage).toHaveBeenCalledWith(
      'thread-1',
      'remote_control',
      'Controlled remotely from Kitty Litter.',
      { source: 'kitty-litter' },
    );
  });

  it('does not duplicate open ids or remote-control markers', async () => {
    const ctx = makeContext();
    ctx.storage.get.mockResolvedValue({ source: 'kitty-litter' });
    ctx.conversations.getWorkspace.mockResolvedValue({ openConversationIds: ['thread-1'], pinnedConversationIds: [] });

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Again' }] }, ctx as never, makeConn(), vi.fn());
    await flushAsyncTurnStart();

    expect(ctx.conversations.updateWorkspace).toHaveBeenCalledWith({ activeConversationId: 'thread-1' });
    expect(ctx.conversations.appendVisibleCustomMessage).not.toHaveBeenCalled();
  });

  it('falls back to the persisted transcript when live response events are unavailable', async () => {
    const ctx = makeContext();
    ctx.conversations.sendMessage.mockResolvedValue({ accepted: true });
    ctx.conversations.getBlocks.mockResolvedValue({
      detail: {
        blocks: [
          { type: 'user', id: 'u1', text: 'Hi' },
          { type: 'text', id: 'a1', text: 'Hi Patrick — I’m here.' },
        ],
      },
    });
    const notify = vi.fn();

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), notify);

    expect(notify).toHaveBeenCalledWith('item/agentMessage/delta', expect.objectContaining({ delta: 'Hi Patrick — I’m here.' }));
    expect(notify).toHaveBeenCalledWith('turn/completed', expect.objectContaining({ threadId: 'thread-1' }));
  });

  it('tolerates conversation subscriptions that do not return an unsubscribe function', async () => {
    const ctx = makeContext();
    ctx.conversations.subscribe.mockReturnValue(undefined);

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), vi.fn());
    await flushAsyncTurnStart();

    expect(() => cleanupTurnSubscriptions('thread-1')).not.toThrow();
    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith('thread-1', 'Hi', undefined);
  });

  it('ignores stale non-function cleanup entries defensively', () => {
    turnSubscriptions.set('thread-1', new Set([undefined as unknown as () => void]));

    expect(() => cleanupTurnSubscriptions('thread-1')).not.toThrow();
    expect(turnSubscriptions.has('thread-1')).toBe(false);
  });
});
