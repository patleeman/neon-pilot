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
      runTurn: vi.fn(async (_threadId: string, runText: string, options?: { images?: unknown[]; onEvent?: (event: unknown) => void }) => {
        await ctx.conversations.sendMessage('thread-1', runText, options?.images ? { images: options.images } : undefined);
        options?.onEvent?.({ type: 'turn_end' });
        return { accepted: true };
      }),
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
    expect(ctx.conversations.runTurn).toHaveBeenCalledWith(
      'thread-1',
      'what do you see?',
      expect.objectContaining({
        images: [{ data: 'aGVsbG8=', mimeType: 'image/png', name: 'shot.png' }],
      }),
    );
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

    expect(ctx.conversations.runTurn).toHaveBeenCalledWith(
      'thread-1',
      'inspect this',
      expect.objectContaining({
        images: [{ data: Buffer.from('pixels').toString('base64'), mimeType: 'image/jpeg', name: 'photo.jpg' }],
      }),
    );
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

    expect(ctx.conversations.runTurn).toHaveBeenCalledWith(
      'thread-1',
      '',
      expect.objectContaining({
        images: [{ data: 'aGVsbG8=', mimeType: 'image/png' }],
      }),
    );
  });

  it('resumes persisted threads before subscribing and sending follow-up messages', async () => {
    const ctx = makeContext();
    const order: string[] = [];
    ctx.conversations.ensureLive.mockImplementation(async () => {
      order.push('ensureLive');
      return { id: 'thread-1', conversationId: 'thread-1' };
    });
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        order.push('runTurn');
        options?.onEvent?.({ type: 'turn_end' });
        return { accepted: true };
      },
    );

    await turn.start({ threadId: 'thread-1', cwd: '/repo', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), vi.fn());

    expect(ctx.conversations.ensureLive).toHaveBeenCalledWith('thread-1', { cwd: '/repo' });
    expect(ctx.conversations.runTurn).toHaveBeenCalledWith('thread-1', 'Hi', expect.objectContaining({ cwd: '/repo' }));
    expect(order).toEqual(['ensureLive', 'runTurn']);
  });

  it('forwards PA response events to Kitty before returning the turn/start response', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        options?.onEvent?.({ type: 'agent_start' });
        options?.onEvent?.({ type: 'text_delta', delta: 'Hello back' });
        options?.onEvent?.({ type: 'agent_end' });
        options?.onEvent?.({ type: 'turn_end' });
        return { accepted: true };
      },
    );

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
      'referenced_context',
      'Controlled remotely from Kitty Litter.',
      { source: 'kitty-litter', markerType: 'remote_control' },
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

  it('fails the Codex turn when the atomic PA turn runner fails', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    ctx.conversations.runTurn.mockRejectedValue(new Error('boom'));

    const result = (await turn.start(
      { threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] },
      ctx as never,
      makeConn(),
      notify,
    )) as { turn: { status: string; error: string | null } };

    expect(result.turn.status).toBe('failed');
    expect(notify).toHaveBeenCalledWith(
      'turn/completed',
      expect.objectContaining({ turn: expect.objectContaining({ status: 'failed', error: 'boom' }) }),
    );
  });

  it('ignores stale non-function cleanup entries defensively', () => {
    turnSubscriptions.set('thread-1', new Set([undefined as unknown as () => void]));

    expect(() => cleanupTurnSubscriptions('thread-1')).not.toThrow();
    expect(turnSubscriptions.has('thread-1')).toBe(false);
  });
});
