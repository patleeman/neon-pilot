import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadBackend(home: string) {
  vi.resetModules();
  vi.stubEnv('HOME', home);
  return import('./backend.js');
}

function registerTool(createVideoProbeAgentExtension: () => (pi: { registerTool(tool: Tool): void }) => void) {
  let tool: Tool | undefined;
  createVideoProbeAgentExtension()({ registerTool: (registered) => (tool = registered) });
  if (!tool) throw new Error('tool was not registered');
  return tool;
}

type Tool = {
  execute: (
    toolCallId: string,
    params: { path: string; question: string },
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: ToolCtx,
  ) => Promise<ToolResult>;
};
type ToolCtx = { modelRegistry: { find: ReturnType<typeof vi.fn>; getApiKeyAndHeaders: ReturnType<typeof vi.fn> } };
type ToolResult = { text: string; content: Array<{ type: 'text'; text: string }>; isError?: boolean; details?: Record<string, unknown> };

describe('system-video-probe agent tool', () => {
  const home = join(tmpdir(), `video-probe-agent-${process.pid}`);
  const videoPath = join(home, 'clip.mp4');

  beforeEach(() => {
    rmSync(home, { recursive: true, force: true });
    mkdirSync(home, { recursive: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function ctx(): ToolCtx {
    return {
      modelRegistry: {
        find: vi.fn().mockReturnValue({ provider: 'openrouter', id: 'google/gemini-2.5-flash' }),
        getApiKeyAndHeaders: vi.fn().mockResolvedValue({ ok: true, apiKey: 'key', headers: { 'x-extra': 'yes' } }),
      },
    };
  }

  it('rejects missing and unsupported video paths before contacting model providers', async () => {
    const { createVideoProbeAgentExtension } = await loadBackend(home);
    const tool = registerTool(createVideoProbeAgentExtension);
    const context = ctx();

    await expect(
      tool.execute('call-1', { path: join(home, 'missing.mp4'), question: 'What happens?' }, undefined, undefined, context),
    ).rejects.toThrow(`Video file not found: ${join(home, 'missing.mp4')}`);
    writeFileSync(join(home, 'notes.txt'), 'not a video');
    await expect(
      tool.execute('call-1', { path: join(home, 'notes.txt'), question: 'What happens?' }, undefined, undefined, context),
    ).rejects.toThrow('Unsupported video format: .txt.');
    expect(context.modelRegistry.find).not.toHaveBeenCalled();
  });

  it('calls OpenRouter chat completions with video data and provider headers', async () => {
    writeFileSync(videoPath, Buffer.from('video bytes'));
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: ' A dog runs. ' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const { createVideoProbeAgentExtension } = await loadBackend(home);
    const tool = registerTool(createVideoProbeAgentExtension);

    await expect(tool.execute('call-1', { path: videoPath, question: ' Describe it ' }, undefined, undefined, ctx())).resolves.toEqual({
      text: 'A dog runs.',
      content: [{ type: 'text', text: 'A dog runs.' }],
      details: { backend: 'openrouter', model: 'google/gemini-2.5-flash', filePath: videoPath },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer key', 'x-extra': 'yes', 'Content-Type': 'application/json' }),
        body: expect.stringContaining(`data:video/mp4;base64,${Buffer.from('video bytes').toString('base64')}`),
      }),
    );
  });

  it('returns helpful OpenRouter configuration and auth errors', async () => {
    writeFileSync(videoPath, Buffer.from('video bytes'));
    const { createVideoProbeAgentExtension } = await loadBackend(home);
    const tool = registerTool(createVideoProbeAgentExtension);
    const missingModel = ctx();
    missingModel.modelRegistry.find.mockReturnValue(null);

    await expect(tool.execute('call-1', { path: videoPath, question: 'What?' }, undefined, undefined, missingModel)).resolves.toMatchObject(
      {
        isError: true,
        text: expect.stringContaining('OpenRouter model "google/gemini-2.5-flash" is not configured'),
      },
    );

    const unauthenticated = ctx();
    unauthenticated.modelRegistry.getApiKeyAndHeaders.mockResolvedValue({ ok: false });
    await expect(
      tool.execute('call-1', { path: videoPath, question: 'What?' }, undefined, undefined, unauthenticated),
    ).resolves.toMatchObject({
      isError: true,
      text: 'OpenRouter is not authenticated. Configure it via Settings → Providers.',
    });
  });

  it('surfaces model API errors and empty responses', async () => {
    writeFileSync(videoPath, Buffer.from('video bytes'));
    const { createVideoProbeAgentExtension } = await loadBackend(home);
    const tool = registerTool(createVideoProbeAgentExtension);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => JSON.stringify({ error: { message: 'rate limited' } }) }),
    );
    await expect(tool.execute('call-1', { path: videoPath, question: 'What?' }, undefined, undefined, ctx())).rejects.toThrow(
      'rate limited',
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: '   ' } }] }) }),
    );
    await expect(tool.execute('call-1', { path: videoPath, question: 'What?' }, undefined, undefined, ctx())).rejects.toThrow(
      'Model returned an empty response.',
    );
  });
});
