import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionHostClient = vi.hoisted(() => ({ invokeAction: vi.fn(), listStaticContributions: vi.fn() }));

vi.mock('../extensions/extensionHostClient.js', () => ({ getExtensionHostClient: () => extensionHostClient }));

const { runModelDiscovery } = await import('./modelDiscovery.js');

describe('runModelDiscovery', () => {
  beforeEach(() => {
    extensionHostClient.invokeAction.mockReset();
    extensionHostClient.listStaticContributions.mockReset();
  });

  it('returns an empty list when no enabled extension contributes model discovery', async () => {
    extensionHostClient.listStaticContributions.mockResolvedValue({ tools: [], skills: [], modelDiscovery: [] });

    await expect(runModelDiscovery()).resolves.toEqual([]);
    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
  });

  it('invokes all discovery actions and returns valid live providers', async () => {
    extensionHostClient.listStaticContributions.mockResolvedValue({
      tools: [],
      skills: [],
      modelDiscovery: [
        { extensionId: 'local-a', action: 'discover' },
        { extensionId: 'local-b', action: 'scan' },
      ],
    });
    extensionHostClient.invokeAction
      .mockResolvedValueOnce({
        ok: true,
        result: {
          provider: 'local-a',
          baseUrl: 'http://127.0.0.1:8080',
          api: 'openai-chat-completions',
          apiKey: 'unused',
          models: [{ id: 'mlx', name: 'MLX', reasoning: false, input: ['text'], contextWindow: 8192 }],
        },
      })
      .mockResolvedValueOnce({ ok: false, result: { provider: 'ignored', baseUrl: 'x', models: [] } });

    await expect(runModelDiscovery()).resolves.toEqual([
      {
        provider: 'local-a',
        baseUrl: 'http://127.0.0.1:8080',
        api: 'openai-chat-completions',
        apiKey: 'unused',
        models: [{ id: 'mlx', name: 'MLX', reasoning: false, input: ['text'], contextWindow: 8192 }],
      },
    ]);
    expect(extensionHostClient.invokeAction).toHaveBeenNthCalledWith(1, { extensionId: 'local-a', actionId: 'discover', input: null });
    expect(extensionHostClient.invokeAction).toHaveBeenNthCalledWith(2, { extensionId: 'local-b', actionId: 'scan', input: null });
  });

  it('swallows rejected discovery actions and filters malformed provider results', async () => {
    extensionHostClient.listStaticContributions.mockResolvedValue({
      tools: [],
      skills: [],
      modelDiscovery: [
        { extensionId: 'throws', action: 'discover' },
        { extensionId: 'nullish', action: 'discover' },
        { extensionId: 'missing-base-url', action: 'discover' },
        { extensionId: 'missing-models', action: 'discover' },
      ],
    });
    extensionHostClient.invokeAction
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, result: null })
      .mockResolvedValueOnce({ ok: true, result: { provider: 'bad', models: [] } })
      .mockResolvedValueOnce({ ok: true, result: { provider: 'bad', baseUrl: 'http://localhost' } });

    await expect(runModelDiscovery()).resolves.toEqual([]);
  });
});
