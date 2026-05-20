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
      getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: [], pinnedConversationIds: [], remoteControlledConversationIds: [] }),
      updateWorkspace: vi
        .fn()
        .mockResolvedValue({ openConversationIds: ['thread-1'], pinnedConversationIds: [], activeConversationId: 'thread-1' }),
      appendVisibleCustomMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendMessage: vi.fn().mockResolvedValue({ accepted: true }),
      getBlocks: vi.fn().mockResolvedValue({ detail: { blocks: [] } }),
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
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function waitForExpectation(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw lastError;
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
    writeFileSync(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
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
        images: [{ data: Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString('base64'), mimeType: 'image/jpeg', name: 'photo.jpg' }],
      }),
    );
  });

  it('rejects file path image inputs that are not real images', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pa-alleycat-turn-'));
    const imagePath = join(dir, 'secret.txt');
    writeFileSync(imagePath, Buffer.from('not actually an image'));
    const ctx = makeContext();

    await expect(
      turn.start(
        { threadId: 'thread-1', input: [{ type: 'image', url: imagePath, mimeType: 'image/png' }] },
        ctx as never,
        makeConn(),
        vi.fn(),
      ),
    ).rejects.toThrow('input must contain at least one text or image item');
    expect(ctx.conversations.runTurn).not.toHaveBeenCalled();
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
    await flushAsyncTurnStart();

    expect(ctx.conversations.ensureLive).toHaveBeenCalledWith('thread-1', { cwd: '/repo' });
    expect(ctx.conversations.runTurn).toHaveBeenCalledWith('thread-1', 'Hi', expect.objectContaining({ cwd: '/repo' }));
    expect(order).toEqual(['ensureLive', 'runTurn']);
  });

  it('returns the active turn id when Kitty steers an in-flight turn', async () => {
    const ctx = makeContext();
    const releases: Array<() => void> = [];
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        await new Promise<void>((resolve) =>
          releases.push(() => {
            options?.onEvent?.({ type: 'turn_end' });
            resolve();
          }),
        );
        return { accepted: true };
      },
    );
    const notify = vi.fn();

    const started = (await turn.start(
      { threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] },
      ctx as never,
      makeConn(),
      notify,
    )) as {
      turn: { id: string };
    };
    await flushAsyncTurnStart();

    const steered = await turn.steer(
      { threadId: 'thread-1', input: [{ type: 'text', text: 'Actually...' }] },
      ctx as never,
      makeConn(),
      notify,
    );

    expect(steered).toEqual({ threadId: 'thread-1', turnId: started.turn.id });
    expect(ctx.conversations.sendMessage).toHaveBeenLastCalledWith('thread-1', 'Actually...', { steer: true });

    releases[0]?.();
    await flushAsyncTurnStart();
  });

  it('returns turn/start immediately and streams PA response events asynchronously', async () => {
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

    expect(result.turn.status).toBe('inProgress');
    await flushAsyncTurnStart();

    expect(notify).toHaveBeenCalledWith('item/agentMessage/delta', expect.objectContaining({ delta: 'Hello back' }));
    expect(notify).toHaveBeenCalledWith('turn/completed', expect.objectContaining({ threadId: 'thread-1' }));
  });

  it('opens and focuses the desktop workspace when Kitty starts a turn', async () => {
    const ctx = makeContext();

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), vi.fn());
    await flushAsyncTurnStart();

    expect(ctx.conversations.updateWorkspace).toHaveBeenCalledWith({
      openConversationIds: ['thread-1'],
      remoteControlledConversationIds: ['thread-1'],
      activeConversationId: 'thread-1',
    });
    expect(ctx.conversations.appendVisibleCustomMessage).not.toHaveBeenCalled();
  });

  it('does not duplicate open ids or remote-control markers', async () => {
    const ctx = makeContext();
    ctx.storage.get.mockResolvedValue({ source: 'kitty-litter' });
    ctx.conversations.getWorkspace.mockResolvedValue({
      openConversationIds: ['thread-1'],
      pinnedConversationIds: [],
      remoteControlledConversationIds: ['thread-1'],
    });

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Again' }] }, ctx as never, makeConn(), vi.fn());
    await flushAsyncTurnStart();

    expect(ctx.conversations.updateWorkspace).toHaveBeenCalledWith({ activeConversationId: 'thread-1' });
    expect(ctx.conversations.appendVisibleCustomMessage).not.toHaveBeenCalled();
  });

  it('streams and completes assistant text that arrives after tool events without agent_end', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        options?.onEvent?.({ type: 'agent_start' });
        options?.onEvent?.({ type: 'tool_start', toolCallId: 'tool-1', toolName: 'read', input: { path: 'README.md' } });
        options?.onEvent?.({ type: 'tool_end', toolCallId: 'tool-1', toolName: 'read', output: 'ok' });
        options?.onEvent?.({ type: 'text_delta', delta: 'Tools work.' });
        options?.onEvent?.({ type: 'turn_end' });
        return { accepted: true };
      },
    );

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Test your tools' }] }, ctx as never, makeConn(), notify);
    await waitForExpectation(() => {
      expect(notify).toHaveBeenCalledWith('item/agentMessage/delta', expect.objectContaining({ delta: 'Tools work.' }));
    });
    const deltaCallIndex = notify.mock.calls.findIndex(([method]) => method === 'item/agentMessage/delta');
    const agentCompletedIndex = notify.mock.calls.findIndex(
      ([method, payload]) => method === 'item/completed' && payload.item?.type === 'agentMessage',
    );
    const turnCompletedIndex = notify.mock.calls.findIndex(([method]) => method === 'turn/completed');
    expect(deltaCallIndex).toBeGreaterThan(-1);
    expect(agentCompletedIndex).toBeGreaterThan(deltaCallIndex);
    expect(turnCompletedIndex).toBeGreaterThan(agentCompletedIndex);
    expect(ctx.conversations.getBlocks).not.toHaveBeenCalled();
  });

  it('streams reasoning deltas as a dedicated item before agent_start', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        options?.onEvent?.({ type: 'thinking_delta', delta: 'Thinking' });
        options?.onEvent?.({ type: 'agent_start' });
        options?.onEvent?.({ type: 'text_delta', delta: 'Done' });
        options?.onEvent?.({ type: 'agent_end' });
        options?.onEvent?.({ type: 'turn_end' });
        return { accepted: true };
      },
    );

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Think' }] }, ctx as never, makeConn(), notify);
    await flushAsyncTurnStart();

    const reasoningStartedIndex = notify.mock.calls.findIndex(
      ([method, payload]) => method === 'item/started' && payload.item?.type === 'reasoning',
    );
    const reasoningDeltaIndex = notify.mock.calls.findIndex(([method]) => method === 'item/reasoning/delta');
    const reasoningCompletedIndex = notify.mock.calls.findIndex(
      ([method, payload]) => method === 'item/completed' && payload.item?.type === 'reasoning',
    );
    expect(reasoningStartedIndex).toBeGreaterThan(-1);
    expect(reasoningDeltaIndex).toBeGreaterThan(reasoningStartedIndex);
    expect(reasoningCompletedIndex).toBeGreaterThan(reasoningDeltaIndex);
  });

  it('matches anonymous tool start and end events to the same item id', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        options?.onEvent?.({ type: 'tool_start', toolName: 'read', input: { path: 'README.md' } });
        options?.onEvent?.({ type: 'tool_end', toolName: 'read', output: 'ok' });
        options?.onEvent?.({ type: 'turn_end' });
        return { accepted: true };
      },
    );

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Use a tool' }] }, ctx as never, makeConn(), notify);
    await flushAsyncTurnStart();

    const toolStarted = notify.mock.calls.find(
      ([method, payload]) => method === 'item/started' && payload.item?.type === 'dynamicToolCall',
    );
    const toolCompleted = notify.mock.calls.find(
      ([method, payload]) => method === 'item/completed' && payload.item?.type === 'dynamicToolCall',
    );
    expect(toolStarted?.[1].item.id).toBeTruthy();
    expect(toolCompleted?.[1].item.id).toBe(toolStarted?.[1].item.id);
  });

  it('does not orphan an implicit assistant item when text arrives before agent_start', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        options?.onEvent?.({ type: 'text_delta', delta: 'Early ' });
        options?.onEvent?.({ type: 'agent_start' });
        options?.onEvent?.({ type: 'text_delta', delta: 'text' });
        options?.onEvent?.({ type: 'agent_end' });
        options?.onEvent?.({ type: 'turn_end' });
        return { accepted: true };
      },
    );

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), notify);
    await flushAsyncTurnStart();

    const agentStarts = notify.mock.calls.filter(([method, payload]) => method === 'item/started' && payload.item?.type === 'agentMessage');
    const agentCompletes = notify.mock.calls.filter(
      ([method, payload]) => method === 'item/completed' && payload.item?.type === 'agentMessage',
    );
    expect(agentStarts).toHaveLength(1);
    expect(agentCompletes).toHaveLength(1);
    expect(agentCompletes[0][1].item.text).toBe('Early text');
  });

  it('suppresses late turn completion after interrupt even after a new turn starts', async () => {
    const ctx = makeContext();
    const notify = vi.fn();
    const releases: Array<() => void> = [];
    ctx.conversations.runTurn.mockImplementation(
      async (_threadId: string, _text: string, options?: { onEvent?: (event: unknown) => void }) => {
        await new Promise<void>((resolve) => {
          releases.push(() => {
            options?.onEvent?.({ type: 'turn_end' });
            resolve();
          });
        });
        return { accepted: true };
      },
    );
    const conn = makeConn();

    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, conn, notify);
    await flushAsyncTurnStart();
    await turn.interrupt({ threadId: 'thread-1', turnId: 'turn-1' }, ctx as never, conn, notify);
    await turn.start({ threadId: 'thread-1', input: [{ type: 'text', text: 'New turn' }] }, ctx as never, conn, notify);
    await flushAsyncTurnStart();
    releases[0]?.();
    await flushAsyncTurnStart();

    expect(notify.mock.calls.filter(([method]) => method === 'turn/interrupted')).toHaveLength(1);
    expect(notify.mock.calls.filter(([method]) => method === 'turn/completed')).toHaveLength(0);

    releases[1]?.();
    await flushAsyncTurnStart();
    expect(notify.mock.calls.filter(([method]) => method === 'turn/completed')).toHaveLength(1);
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

    expect(result.turn.status).toBe('inProgress');
    await flushAsyncTurnStart();

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
