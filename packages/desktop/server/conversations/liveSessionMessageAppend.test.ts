import { beforeEach, describe, expect, it, vi } from 'vitest';

const title = vi.hoisted(() => ({
  buildFallbackTitleFromContent: vi.fn(() => 'Fallback Title'),
  isPlaceholderConversationTitle: vi.fn(() => true),
}));
vi.mock('./liveSessionTitle.js', () => title);

import {
  appendDetachedLiveSessionAssistantError,
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

  it('appends detached assistant errors with the complete assistant message contract', () => {
    const e = entry({
      session: {
        ...entry().session,
        model: { api: 'openai-responses', provider: 'openai', id: 'gpt-5' },
      },
    });
    const callbacks = { broadcastTitle: vi.fn(), publishSessionMetaChanged: vi.fn() };

    appendDetachedLiveSessionAssistantError(e as never, { promptText: ' failed prompt ', errorMessage: ' no key ' }, callbacks);

    expect(e.session.state.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'failed prompt' }], timestamp: Date.now() },
      {
        role: 'assistant',
        content: [],
        api: 'openai-responses',
        provider: 'openai',
        model: 'gpt-5',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'error',
        errorMessage: 'no key',
        timestamp: Date.now(),
      },
    ]);
    expect(e.session.sessionManager.appendMessage).toHaveBeenCalledTimes(2);
    expect(callbacks.publishSessionMetaChanged).toHaveBeenCalledWith('s1');
  });

  it('sanitizes detached assistant errors before persisting them', () => {
    const e = entry();
    const callbacks = { broadcastTitle: vi.fn(), publishSessionMetaChanged: vi.fn() };

    appendDetachedLiveSessionAssistantError(
      e as never,
      {
        promptText: 'failed prompt',
        errorMessage: [
          'No API key found for openai-codex.',
          '',
          'Use /login to log into a provider via OAuth or API key. See:',
          '  /Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/chunks/docs/providers.md',
          '  /Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/chunks/docs/models.md',
        ].join('\n'),
      },
      callbacks,
    );

    expect(e.session.state.messages.at(-1)).toMatchObject({
      role: 'assistant',
      stopReason: 'error',
      errorMessage: 'No API key found for the selected model. Configure a provider in Neon Pilot, then try again.',
    });
  });

  it('sanitizes detached internal module import errors before persisting them', () => {
    const e = entry();
    const callbacks = { broadcastTitle: vi.fn(), publishSessionMetaChanged: vi.fn() };

    appendDetachedLiveSessionAssistantError(
      e as never,
      {
        promptText: 'failed prompt',
        errorMessage:
          "Cannot find module '/Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/chunks/L7MTGEQK.js' imported from /Users/patrick/workingdir/neon-pilot/packages/desktop/server/dist/app/chunks/7ICDLM2C.js",
      },
      callbacks,
    );

    expect(e.session.state.messages.at(-1)).toMatchObject({
      role: 'assistant',
      stopReason: 'error',
      errorMessage: 'The request could not start because part of the app runtime was unavailable. Restart Neon Pilot, then try again.',
    });
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
        cancelled: false,
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

  it('anchors visible custom messages to the visible leaf when hidden custom metadata is current', async () => {
    const branch = vi.fn();
    const e = entry({
      session: {
        ...entry().session,
        sessionManager: {
          appendMessage: vi.fn(),
          branch,
          getLeafEntry: vi.fn(() => ({
            type: 'custom_message',
            id: 'hidden-1',
            parentId: 'assistant-1',
            customType: 'child_conversation_topology',
            display: undefined,
          })),
          getEntry: vi.fn((id: string) =>
            id === 'assistant-1' ? { type: 'message', id: 'assistant-1', parentId: 'user-1', message: { role: 'assistant' } } : undefined,
          ),
        },
      },
    });
    const callbacks = { broadcastSnapshot: vi.fn(), publishSessionMetaChanged: vi.fn() };

    await appendVisibleLiveSessionCustomMessage(e as never, 'model_arena_duel', 'Model Arena duel', {}, callbacks, {
      blockId: 'duel-1',
    });

    expect(branch).toHaveBeenCalledWith('assistant-1');
    expect(e.session.sendCustomMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: 'model_arena_duel',
        display: true,
        details: expect.objectContaining({ extensionBlockId: 'duel-1' }),
      }),
    );
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
