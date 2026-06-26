import { beforeEach, describe, expect, it, vi } from 'vitest';

const title = vi.hoisted(() => ({
  buildFallbackTitleFromContent: vi.fn(() => 'Fallback Title'),
  isPlaceholderConversationTitle: vi.fn(() => true),
}));
vi.mock('./liveSessionTitle.js', () => title);

import {
  appendDetachedLiveSessionBashExecution,
  appendDetachedLiveSessionUserMessage,
  appendParallelImportedLiveSessionMessage,
  appendVisibleLiveSessionCustomMessage,
  queueLiveSessionPromptContext,
  updateVisibleLiveSessionCustomMessage,
} from './liveSessionMessageAppend.js';

describe('live session message append operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00.000Z'));
  });

  function entry(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: 's1',
      title: 'New chat',
      session: {
        isStreaming: false,
        sessionName: '',
        state: { messages: [] as unknown[] },
        sessionManager: { appendMessage: vi.fn() },
        sendCustomMessage: vi.fn(async () => undefined),
      },
      ...overrides,
    };
  }

  it('queues prompt context once, trimming content and using nextTurn while streaming', async () => {
    const e = entry({ session: { ...entry().session, isStreaming: true } });

    await queueLiveSessionPromptContext(e as never, 'related_conversation_pointers', ' context ');
    await queueLiveSessionPromptContext(e as never, 'related_conversation_pointers', ' context ');
    await queueLiveSessionPromptContext(e as never, 'other_context', '   ');

    expect(e.session.sendCustomMessage).toHaveBeenCalledTimes(2);
    expect(e.session.sendCustomMessage).toHaveBeenNthCalledWith(
      1,
      { customType: 'related_conversation_pointers', content: 'context', display: false, details: undefined },
      { deliverAs: 'nextTurn' },
    );
  });

  it('skips duplicate related conversation prompt context already in session messages', async () => {
    const e = entry({
      session: { ...entry().session, state: { messages: [{ role: 'custom', customType: 'related_conversation_pointers' }] } },
    });
    await queueLiveSessionPromptContext(e as never, 'related_conversation_pointers', 'context');
    expect(e.session.sendCustomMessage).not.toHaveBeenCalled();
  });

  it('appends detached user messages and derives fallback titles for placeholder conversations', async () => {
    const e = entry();
    const callbacks = { broadcastTitle: vi.fn(), publishSessionMetaChanged: vi.fn() };

    await appendDetachedLiveSessionUserMessage(e as never, ' hello world ', callbacks);

    expect(e.session.state.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'hello world' }], timestamp: Date.now() }]);
    expect(e.session.sessionManager.appendMessage).toHaveBeenCalledWith(e.session.state.messages[0]);
    expect(e.title).toBe('Fallback Title');
    expect(callbacks.broadcastTitle).toHaveBeenCalledWith(e);
    expect(callbacks.publishSessionMetaChanged).toHaveBeenCalledWith('s1');

    await appendDetachedLiveSessionUserMessage(e as never, '   ', callbacks);
    expect(e.session.sessionManager.appendMessage).toHaveBeenCalledTimes(1);
  });

  it('appends detached bash executions for abortable direct shell runs', () => {
    const e = entry();

    appendDetachedLiveSessionBashExecution(
      e as never,
      ' git status --short ',
      {
        output: ' M packages/desktop/server/conversations/liveSessions.ts\n',
        exitCode: 0,
        truncated: true,
        fullOutputPath: '/tmp/neon-pilot-bash-output.log',
      },
      { excludeFromContext: true },
    );

    expect(e.session.state.messages).toEqual([
      {
        role: 'bashExecution',
        command: 'git status --short',
        output: ' M packages/desktop/server/conversations/liveSessions.ts\n',
        timestamp: Date.now(),
        exitCode: 0,
        truncated: true,
        fullOutputPath: '/tmp/neon-pilot-bash-output.log',
        excludeFromContext: true,
      },
    ]);
    expect(e.session.sessionManager.appendMessage).toHaveBeenCalledWith(e.session.state.messages[0]);
  });

  it('bounds oversized detached bash execution output before persistence', () => {
    const e = entry();
    const output = `head\n${'x'.repeat(90_000)}\ntail`;

    appendDetachedLiveSessionBashExecution(e as never, 'cat huge.log', { output, exitCode: 0 });

    expect(e.session.state.messages).toHaveLength(1);
    const message = e.session.state.messages[0] as {
      output: string;
      truncated?: boolean;
      details?: { contextHardening?: { truncated?: boolean; originalChars?: number; maxChars?: number } };
    };
    expect(message.output.length).toBeLessThanOrEqual(64 * 1024);
    expect(message.output).toContain('head');
    expect(message.output).toContain('tail');
    expect(message.output).toContain('Neon Pilot truncated oversized tool output');
    expect(message.truncated).toBe(true);
    expect(message.details?.contextHardening).toMatchObject({
      truncated: true,
      originalChars: output.length,
      maxChars: 64 * 1024,
    });
    expect(e.session.sessionManager.appendMessage).toHaveBeenCalledWith(message);
  });

  it('blocks detached and visible appends while streaming', async () => {
    const e = entry({ session: { ...entry().session, isStreaming: true } });
    await expect(
      appendDetachedLiveSessionUserMessage(e as never, 'hello', { broadcastTitle: vi.fn(), publishSessionMetaChanged: vi.fn() }),
    ).rejects.toThrow('Session s1 is currently streaming');
    expect(() => appendDetachedLiveSessionBashExecution(e as never, 'echo hello', { output: 'hello\n', exitCode: 0 })).toThrow(
      'Session s1 is currently streaming',
    );
    await expect(
      appendVisibleLiveSessionCustomMessage(
        e as never,
        'type',
        'content',
        {},
        { broadcastSnapshot: vi.fn(), publishSessionMetaChanged: vi.fn() },
      ),
    ).rejects.toThrow('Session s1 is currently streaming');
    expect(() =>
      updateVisibleLiveSessionCustomMessage(
        e as never,
        'block',
        'type',
        'content',
        {},
        { broadcastSnapshot: vi.fn(), publishSessionMetaChanged: vi.fn() },
      ),
    ).toThrow('Session s1 is currently streaming');
  });

  it('appends visible custom messages with generated or explicit block ids', async () => {
    const e = entry();
    const callbacks = { broadcastSnapshot: vi.fn(), publishSessionMetaChanged: vi.fn() };

    await expect(appendVisibleLiveSessionCustomMessage(e as never, 'note', ' content ', 'details', callbacks)).resolves.toBe(
      'note:1779451200000',
    );
    await expect(
      appendVisibleLiveSessionCustomMessage(e as never, 'note', ' more ', { ok: true }, callbacks, { blockId: 'block-1' }),
    ).resolves.toBe('block-1');
    await expect(appendVisibleLiveSessionCustomMessage(e as never, 'note', '   ', {}, callbacks)).resolves.toBeNull();

    expect(e.session.sendCustomMessage).toHaveBeenNthCalledWith(1, {
      customType: 'note',
      content: 'content',
      display: true,
      details: { value: 'details', extensionBlockId: 'note:1779451200000' },
    });
    expect(e.session.sendCustomMessage).toHaveBeenNthCalledWith(2, {
      customType: 'note',
      content: 'more',
      display: true,
      details: { ok: true, extensionBlockId: 'block-1' },
    });
    expect(callbacks.broadcastSnapshot).toHaveBeenCalledTimes(2);
    expect(callbacks.publishSessionMetaChanged).toHaveBeenCalledTimes(2);
  });

  it('updates visible custom messages by block id and broadcasts only when updated', () => {
    const e = entry({
      session: {
        ...entry().session,
        state: {
          messages: [
            { role: 'custom', customType: 'note', content: 'old', details: { extensionBlockId: 'block-1' } },
            { role: 'custom', customType: 'other', content: 'old', details: { extensionBlockId: 'block-1' } },
          ],
        },
      },
    });
    const callbacks = { broadcastSnapshot: vi.fn(), publishSessionMetaChanged: vi.fn() };

    expect(updateVisibleLiveSessionCustomMessage(e as never, 'block-1', 'note', ' new ', { updated: true }, callbacks)).toBe(true);
    expect(e.session.state.messages[0]).toMatchObject({
      content: 'new',
      details: { updated: true, extensionBlockId: 'block-1' },
      timestamp: Date.now(),
    });
    expect(callbacks.broadcastSnapshot).toHaveBeenCalledWith(e);
    expect(updateVisibleLiveSessionCustomMessage(e as never, 'missing', 'note', 'new', {}, callbacks)).toBe(false);
    expect(updateVisibleLiveSessionCustomMessage(e as never, 'block-1', 'note', '   ', {}, callbacks)).toBe(false);
  });

  it('imports parallel messages as detached user content plus a visible parallel result block', async () => {
    const e = entry();
    const callbacks = {
      appendDetachedUserMessage: vi.fn(async () => undefined),
      broadcastSnapshot: vi.fn(),
      publishSessionMetaChanged: vi.fn(),
    };

    await appendParallelImportedLiveSessionMessage(
      e as never,
      'child answer',
      { childConversationId: 'child-1', status: 'complete' },
      callbacks,
    );

    expect(callbacks.appendDetachedUserMessage).toHaveBeenCalledWith(e, 'child answer');
    expect(e.session.sendCustomMessage).toHaveBeenCalledWith({
      customType: 'parallel_result',
      content: 'Imported parallel response from child-1.',
      display: true,
      details: { childConversationId: 'child-1', status: 'complete' },
    });
    expect(callbacks.broadcastSnapshot).toHaveBeenCalledWith(e);
    expect(callbacks.publishSessionMetaChanged).toHaveBeenCalledWith('s1');
  });
});
