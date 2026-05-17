import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { turn } from './turn.js';

function makeContext() {
  return {
    conversations: {
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      ensureLive: vi.fn().mockResolvedValue({ id: 'thread-1', conversationId: 'thread-1' }),
      sendMessage: vi.fn().mockResolvedValue({ accepted: true }),
    },
  };
}

function makeConn() {
  return { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };
}

async function flushAsyncTurnStart() {
  await new Promise((resolve) => setImmediate(resolve));
}

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

  it('resumes persisted threads before sending follow-up messages', async () => {
    const ctx = makeContext();

    await turn.start({ threadId: 'thread-1', cwd: '/repo', input: [{ type: 'text', text: 'Hi' }] }, ctx as never, makeConn(), vi.fn());
    await flushAsyncTurnStart();

    expect(ctx.conversations.ensureLive).toHaveBeenCalledWith('thread-1', { cwd: '/repo' });
    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith('thread-1', 'Hi', undefined);
  });
});
