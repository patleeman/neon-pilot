import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configStubs,
  environmentAdd,
  experimentalFeature,
  memoryReset,
  modelProvider,
  plugin,
  processStubs,
  remoteControlStatusChanged,
  reviewStart,
  threadMemoryMode,
  threadRealtime,
  toolRequestUserInput,
} from './stubs.js';

describe('alleycat protocol stubs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores realtime and memory mode state and forwards realtime text to conversations', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_123);
    const ctx = {
      storage: { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) },
      conversations: { sendMessage: vi.fn().mockResolvedValue({ accepted: true }) },
    };

    const start = await threadRealtime.start({ threadId: 'thread-1' }, ctx as never, undefined as never, vi.fn());
    expect(start).toMatchObject({ realtimeSessionId: expect.stringMatching(/^realtime-/), status: 'disabled' });
    expect(ctx.storage.put).toHaveBeenCalledWith(
      'compat:thread/realtime:thread-1',
      expect.objectContaining({ threadId: 'thread-1', status: 'disabled', startedAt: 1_700_000_000 }),
    );

    await expect(
      threadRealtime.appendText({ threadId: 'thread-1', text: 'hello' }, ctx as never, undefined as never, vi.fn()),
    ).resolves.toEqual({ ok: true, accepted: true });
    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith('thread-1', 'hello');

    await expect(threadRealtime.stop({ threadId: 'thread-1' }, ctx as never, undefined as never, vi.fn())).resolves.toEqual({
      ok: true,
      status: 'stopped',
    });
    expect(ctx.storage.delete).toHaveBeenCalledWith('compat:thread/realtime:thread-1');

    await expect(
      threadMemoryMode.set({ threadId: 'thread-1', mode: 'summary' }, ctx as never, undefined as never, vi.fn()),
    ).resolves.toEqual({ threadId: 'thread-1', mode: 'summary' });
    expect(ctx.storage.put).toHaveBeenCalledWith('compat:thread/memoryMode:thread-1', expect.objectContaining({ mode: 'summary' }));
  });

  it('spawns shell processes, publishes output notifications, and kills tracked processes', async () => {
    const notify = vi.fn();
    const kill = vi.fn();
    const ctx = {
      shell: {
        spawn: vi.fn(async ({ onStdout, onStderr, onExit }) => {
          onStdout('out');
          onStderr('err');
          onExit({ code: 0 });
          return { pid: 123, kill, executionWrappers: ['wrapper'] };
        }),
      },
    };

    const result = (await processStubs.spawn(
      { command: 'echo', args: ['hi', 1], cwd: '/repo', env: { A: 'B' } },
      ctx as never,
      undefined as never,
      notify,
    )) as { processId: string; pid: number; executionWrappers: string[] };

    expect(result).toMatchObject({ pid: 123, executionWrappers: ['wrapper'] });
    expect(ctx.shell.spawn).toHaveBeenCalledWith(expect.objectContaining({ command: 'echo', args: ['hi'], cwd: '/repo', env: { A: 'B' } }));
    expect(notify).toHaveBeenCalledWith('process/outputDelta', {
      processId: result.processId,
      stream: 'stdout',
      dataBase64: Buffer.from('out').toString('base64'),
    });
    expect(notify).toHaveBeenCalledWith('process/outputDelta', {
      processId: result.processId,
      stream: 'stderr',
      dataBase64: Buffer.from('err').toString('base64'),
    });
    expect(notify).toHaveBeenCalledWith('process/exited', { processId: result.processId, code: 0 });

    await expect(processStubs.kill({ processId: result.processId }, undefined as never, undefined as never, vi.fn())).resolves.toEqual({
      ok: true,
      killed: true,
    });
    expect(kill).toHaveBeenCalledOnce();
  });

  it('implements provider, feature, config, plugin, environment, and memory helpers through storage', async () => {
    const ctx = {
      storage: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ id: 'plugin-1' }),
        list: vi.fn().mockResolvedValue([{ value: { id: 'plugin-1' } }]),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };

    await expect(modelProvider.capabilitiesRead({}, ctx as never, undefined as never, vi.fn())).resolves.toMatchObject({
      modelProvider: 'neon-pilot',
    });
    await expect(
      experimentalFeature.enablementSet({ feature: 'f1', enabled: true }, ctx as never, undefined as never, vi.fn()),
    ).resolves.toEqual({ feature: 'f1', enabled: true });
    await expect(configStubs.valueWrite({ key: 'theme', value: 'dark' }, ctx as never, undefined as never, vi.fn())).resolves.toEqual({
      ok: true,
      key: 'theme',
    });
    await expect(
      configStubs.batchWrite(
        {
          entries: [
            { key: 'a', value: 1 },
            { path: 'b', value: 2 },
          ],
        },
        ctx as never,
        undefined as never,
        vi.fn(),
      ),
    ).resolves.toEqual({ ok: true, count: 2 });
    await expect(plugin.list({}, ctx as never, undefined as never, vi.fn())).resolves.toEqual({
      data: [{ id: 'plugin-1' }],
      nextCursor: null,
    });
    await expect(plugin.read({ id: 'plugin-1' }, ctx as never, undefined as never, vi.fn())).resolves.toEqual({
      plugin: { id: 'plugin-1' },
    });
    await expect(environmentAdd({ name: 'dev' }, ctx as never, undefined as never, vi.fn())).resolves.toMatchObject({
      environment: { id: 'dev', name: 'dev' },
    });
    await expect(memoryReset({ threadId: 'thread-1' }, ctx as never, undefined as never, vi.fn())).resolves.toEqual({
      ok: true,
      threadId: 'thread-1',
      reset: true,
    });
  });

  it('records review and user-input requests into conversations when thread ids are provided', async () => {
    const ctx = {
      conversations: {
        sendMessage: vi.fn().mockResolvedValue({ accepted: true }),
        appendTranscriptBlock: vi.fn().mockResolvedValue({ ok: true }),
      },
    };

    await expect(reviewStart({ threadId: 'thread-1' }, ctx as never, undefined as never, vi.fn())).resolves.toMatchObject({
      threadId: 'thread-1',
      started: true,
    });
    expect(ctx.conversations.sendMessage).toHaveBeenCalledWith(
      'thread-1',
      'Please review the current changes and call out concrete issues.',
    );

    await expect(
      toolRequestUserInput({ threadId: 'thread-1', prompt: 'Pick one' }, ctx as never, undefined as never, vi.fn()),
    ).resolves.toMatchObject({ status: 'recorded', threadId: 'thread-1' });
    expect(ctx.conversations.appendTranscriptBlock).toHaveBeenCalledWith({
      conversationId: 'thread-1',
      type: 'context',
      content: 'Pick one',
    });
  });

  it('throws stable unsupported errors for unsupported protocol methods', async () => {
    await expect(threadRealtime.appendAudio({}, undefined as never, undefined as never, vi.fn())).rejects.toThrow(
      'thread/realtime/appendAudio is unsupported by Neon Pilot Kitty Litter bridge',
    );
    await expect(remoteControlStatusChanged({}, undefined as never, undefined as never, vi.fn())).resolves.toEqual({
      ok: true,
      status: 'disabled',
    });
  });
});
