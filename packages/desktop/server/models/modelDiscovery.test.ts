import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeExtensionAction = vi.fn();
const listEnabledExtensionEntries = vi.fn();

vi.mock('../extensions/extensionBackend.js', () => ({ invokeExtensionAction }));
vi.mock('../extensions/extensionRegistry.js', () => ({ listEnabledExtensionEntries }));

const { runModelDiscovery } = await import('./modelDiscovery.js');

describe('runModelDiscovery', () => {
  beforeEach(() => {
    invokeExtensionAction.mockReset();
    listEnabledExtensionEntries.mockReset();
  });

  it('returns an empty list when no enabled extension contributes model discovery', async () => {
    listEnabledExtensionEntries.mockReturnValue([
      { manifest: { id: 'no-contrib' } },
      { manifest: { id: 'bad-contrib', contributes: { modelDiscovery: { action: 123 } } } },
    ]);

    await expect(runModelDiscovery()).resolves.toEqual([]);
    expect(invokeExtensionAction).not.toHaveBeenCalled();
  });

  it('invokes all discovery actions and returns valid live providers', async () => {
    listEnabledExtensionEntries.mockReturnValue([
      { manifest: { id: 'local-a', contributes: { modelDiscovery: { action: 'discover' } } } },
      { manifest: { id: 'local-b', contributes: { modelDiscovery: { action: 'scan' } } } },
    ]);
    invokeExtensionAction
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
    expect(invokeExtensionAction).toHaveBeenNthCalledWith(1, 'local-a', 'discover', null);
    expect(invokeExtensionAction).toHaveBeenNthCalledWith(2, 'local-b', 'scan', null);
  });

  it('swallows rejected discovery actions and filters malformed provider results', async () => {
    listEnabledExtensionEntries.mockReturnValue([
      { manifest: { id: 'throws', contributes: { modelDiscovery: { action: 'discover' } } } },
      { manifest: { id: 'nullish', contributes: { modelDiscovery: { action: 'discover' } } } },
      { manifest: { id: 'missing-base-url', contributes: { modelDiscovery: { action: 'discover' } } } },
      { manifest: { id: 'missing-models', contributes: { modelDiscovery: { action: 'discover' } } } },
    ]);
    invokeExtensionAction
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, result: null })
      .mockResolvedValueOnce({ ok: true, result: { provider: 'bad', models: [] } })
      .mockResolvedValueOnce({ ok: true, result: { provider: 'bad', baseUrl: 'http://localhost' } });

    await expect(runModelDiscovery()).resolves.toEqual([]);
  });
});
