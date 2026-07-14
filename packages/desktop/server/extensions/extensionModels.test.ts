import { beforeEach, describe, expect, it, vi } from 'vitest';

const readModelState = vi.fn();
const invalidateModelDefinitionsCache = vi.fn();
const getPiAgentRuntimeDir = vi.fn(() => '/runtime/pi-agent');
const getRepoRoot = vi.fn(() => '/repo');
const getStateRoot = vi.fn(() => '/state');
const invalidateAppTopics = vi.fn();
const saveModelProviderCapability = vi.fn();
const saveModelProviderModelCapability = vi.fn();
const deleteModelProviderCapability = vi.fn();
const deleteModelProviderModelCapability = vi.fn();
const createModelRegistryForAuthFile = vi.fn();
const readProviderAuthState = vi.fn();
const materializeRuntimeResources = vi.fn();
const createRuntimeState = vi.fn(() => ({ materializeRuntimeResources }));

vi.mock('../models/modelState.js', () => ({ readModelState, invalidateModelDefinitionsCache }));
vi.mock('@neon-pilot/core', () => ({ getPiAgentRuntimeDir, getRepoRoot, getStateRoot }));
vi.mock('../shared/appEvents.js', () => ({ invalidateAppTopics }));
vi.mock('../models/providerDesktopCapability.js', () => ({
  saveModelProviderCapability,
  saveModelProviderModelCapability,
  deleteModelProviderCapability,
  deleteModelProviderModelCapability,
}));
vi.mock('../models/modelRegistry.js', () => ({ createModelRegistryForAuthFile }));
vi.mock('../models/providerAuth.js', () => ({ readProviderAuthState }));
vi.mock('../app/runtimeState.js', () => ({ createRuntimeState }));

const { createExtensionModelsCapability } = await import('./extensionModels.js');

describe('extensionModels', () => {
  beforeEach(() => {
    readModelState.mockReset();
    invalidateModelDefinitionsCache.mockReset();
    getPiAgentRuntimeDir.mockReset().mockReturnValue('/runtime/pi-agent');
    getRepoRoot.mockReset().mockReturnValue('/repo');
    getStateRoot.mockReset().mockReturnValue('/state');
    invalidateAppTopics.mockReset();
    saveModelProviderCapability.mockReset().mockReturnValue({ providers: [] });
    saveModelProviderModelCapability.mockReset().mockReturnValue({ providers: [] });
    deleteModelProviderCapability.mockReset().mockReturnValue({ providers: [] });
    deleteModelProviderModelCapability.mockReset().mockReturnValue({ providers: [] });
    createModelRegistryForAuthFile.mockReset().mockReturnValue({ getAll: () => [], getAvailable: () => [], getApiKeyAndHeaders: vi.fn() });
    readProviderAuthState.mockReset().mockReturnValue({ providers: [] });
    materializeRuntimeResources.mockReset();
    createRuntimeState.mockClear();
  });

  it('lists normalized model capabilities from the runtime settings file', async () => {
    readModelState.mockResolvedValue({
      models: [
        { id: 'm1', name: 'Model One', provider: 'provider', contextWindow: 123, reasoning: true, input: ['text', 'image'] },
        { id: 'm2' },
      ],
    });

    await expect(createExtensionModelsCapability().list()).resolves.toEqual([
      {
        id: 'm1',
        name: 'Model One',
        provider: 'provider',
        contextWindow: 123,
        reasoning: true,
        input: ['text', 'image'],
        authConfigured: true,
      },
      { id: 'm2', name: 'm2', provider: '', contextWindow: 0, reasoning: false, input: ['text'], authConfigured: true },
    ]);
    expect(readModelState).toHaveBeenCalledWith('/runtime/pi-agent/settings.json');
  });

  it('marks models without configured provider auth as unavailable to extensions', async () => {
    readModelState.mockResolvedValue({
      models: [
        { id: 'ready-model', name: 'Ready Model', provider: 'ready-provider' },
        { id: 'missing-key-model', name: 'Missing Key Model', provider: 'missing-provider' },
      ],
    });
    createModelRegistryForAuthFile.mockReturnValue({
      getAll: () => [
        { id: 'ready-model', provider: 'ready-provider' },
        { id: 'missing-key-model', provider: 'missing-provider' },
      ],
      getAvailable: () => [{ id: 'ready-model', provider: 'ready-provider' }],
      getApiKeyAndHeaders: async (model: { provider: string }) =>
        model.provider === 'ready-provider' ? { ok: true } : { ok: false, error: 'No API key' },
    });
    readProviderAuthState.mockReturnValue({ providers: [] });

    await expect(
      createExtensionModelsCapability({
        getSettingsFile: () => '/runtime/settings.json',
        getAuthFile: () => '/runtime/auth.json',
      }).list(),
    ).resolves.toEqual([
      {
        id: 'ready-model',
        name: 'Ready Model',
        provider: 'ready-provider',
        contextWindow: 0,
        reasoning: false,
        input: ['text'],
        authConfigured: true,
      },
      {
        id: 'missing-key-model',
        name: 'Missing Key Model',
        provider: 'missing-provider',
        contextWindow: 0,
        reasoning: false,
        input: ['text'],
        authConfigured: false,
      },
    ]);
    expect(createModelRegistryForAuthFile).toHaveBeenCalledWith('/runtime/auth.json');
  });

  it('uses live registry availability for built-in and custom no-auth providers', async () => {
    const localModel = { id: 'google/gemma-4-12b', provider: 'lm-studio' };
    const builtInModel = { id: 'deepseek-v4-flash', provider: 'opencode-go' };
    readModelState.mockResolvedValue({ models: [localModel, builtInModel] });
    createModelRegistryForAuthFile.mockReturnValue({
      getAll: () => [localModel, builtInModel],
      getAvailable: () => [localModel],
      getApiKeyAndHeaders: async () => ({ ok: true }),
    });

    await expect(
      createExtensionModelsCapability({
        getSettingsFile: () => '/runtime/settings.json',
        getAuthFile: () => '/runtime/auth.json',
      }).list(),
    ).resolves.toMatchObject([
      { id: 'google/gemma-4-12b', provider: 'lm-studio', authConfigured: true },
      { id: 'deepseek-v4-flash', provider: 'opencode-go', authConfigured: false },
    ]);
  });

  it('requires stored credentials for credential-backed providers', async () => {
    readModelState.mockResolvedValue({
      models: [
        { id: 'gpt-5', name: 'GPT-5', provider: 'openai' },
        { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic' },
      ],
    });
    createModelRegistryForAuthFile.mockReturnValue({
      getAll: () => [
        { id: 'gpt-5', provider: 'openai' },
        { id: 'claude-sonnet', provider: 'anthropic' },
      ],
      getAvailable: () => [{ id: 'claude-sonnet', provider: 'anthropic' }],
      getApiKeyAndHeaders: async () => ({ ok: true, apiKey: 'resolved-key' }),
    });
    readProviderAuthState.mockReturnValue({
      providers: [{ id: 'anthropic', hasStoredCredential: true, authType: 'api_key' }],
    });

    await expect(
      createExtensionModelsCapability({
        getSettingsFile: () => '/runtime/settings.json',
        getAuthFile: () => '/runtime/auth.json',
      }).list(),
    ).resolves.toMatchObject([
      { id: 'gpt-5', provider: 'openai', authConfigured: false },
      { id: 'claude-sonnet', provider: 'anthropic', authConfigured: true },
    ]);
  });

  it('does not expose openai-codex models for OAuth-only auth', async () => {
    readModelState.mockResolvedValue({
      models: [{ id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', provider: 'openai-codex' }],
    });
    createModelRegistryForAuthFile.mockReturnValue({
      getAll: () => [{ id: 'gpt-5.3-codex-spark', provider: 'openai-codex' }],
      getAvailable: () => [],
      getApiKeyAndHeaders: async () => ({ ok: true, headers: { authorization: 'Bearer oauth-token' } }),
    });
    readProviderAuthState.mockReturnValue({
      providers: [{ id: 'openai-codex', hasStoredCredential: true, authType: 'oauth' }],
    });

    await expect(
      createExtensionModelsCapability({
        getSettingsFile: () => '/runtime/settings.json',
        getAuthFile: () => '/runtime/auth.json',
      }).list(),
    ).resolves.toMatchObject([{ id: 'gpt-5.3-codex-spark', provider: 'openai-codex', authConfigured: false }]);
  });

  it('returns an empty list when model state loading fails', async () => {
    readModelState.mockRejectedValue(new Error('no models'));

    await expect(createExtensionModelsCapability().list()).resolves.toEqual([]);
  });

  it('writes model providers through the host capability context', async () => {
    const materializeWebRuntimeConfig = vi.fn();
    const capability = createExtensionModelsCapability({
      getRuntimeScope: () => 'shared',
      materializeWebRuntimeConfig,
      getAuthFile: () => '/runtime/auth.json',
      getStateRoot: () => '/state',
    });

    await expect(capability.saveProvider({ provider: 'ds4', baseUrl: 'http://127.0.0.1:8000/v1' })).resolves.toEqual({
      providers: [],
    });

    expect(saveModelProviderCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        getRuntimeScope: expect.any(Function),
        materializeWebRuntimeConfig,
        getAuthFile: expect.any(Function),
        getStateRoot: expect.any(Function),
      }),
      { provider: 'ds4', baseUrl: 'http://127.0.0.1:8000/v1' },
    );
    expect(invalidateModelDefinitionsCache).toHaveBeenCalled();
    expect(invalidateAppTopics).toHaveBeenCalledWith('models');
  });

  it('writes model providers through the canonical shared runtime when no route context exists', async () => {
    await expect(createExtensionModelsCapability().saveProvider({ provider: 'lm-studio' })).resolves.toEqual({ providers: [] });

    expect(createRuntimeState).toHaveBeenCalledWith(
      expect.objectContaining({
        repoRoot: '/repo',
        stateRoot: '/state',
        agentDir: '/runtime/pi-agent',
        settingsFile: '/runtime/pi-agent/settings.json',
      }),
    );
    expect(saveModelProviderCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        getRuntimeScope: expect.any(Function),
        materializeWebRuntimeConfig: expect.any(Function),
        getAuthFile: expect.any(Function),
        getStateRoot: expect.any(Function),
      }),
      { provider: 'lm-studio' },
    );
  });

  it('preserves partial isolated host boundaries for standalone provider writes', async () => {
    getPiAgentRuntimeDir.mockImplementation((stateRoot?: string) =>
      stateRoot === '/isolated' ? '/isolated/runtime' : '/runtime/pi-agent',
    );
    const capability = createExtensionModelsCapability({
      getRepoRoot: () => '/isolated-repo',
      getStateRoot: () => '/isolated',
    });

    await capability.saveProvider({ provider: 'lm-studio' });

    expect(getStateRoot).not.toHaveBeenCalled();
    expect(getRepoRoot).not.toHaveBeenCalled();
    expect(createRuntimeState).toHaveBeenCalledWith(
      expect.objectContaining({
        repoRoot: '/isolated-repo',
        stateRoot: '/isolated',
        agentDir: '/isolated/runtime',
        settingsFile: '/isolated/runtime/settings.json',
      }),
    );
    expect(saveModelProviderCapability).toHaveBeenCalledWith(
      expect.objectContaining({ getAuthFile: expect.any(Function), getStateRoot: expect.any(Function) }),
      { provider: 'lm-studio' },
    );
    const [context] = saveModelProviderCapability.mock.calls[0] as [{ getAuthFile: () => string }];
    expect(context.getAuthFile()).toBe('/isolated/runtime/auth.json');
  });

  it('requires model permissions when bound to an extension id', async () => {
    await expect(createExtensionModelsCapability(undefined, 'model-helper-ext').list()).rejects.toThrow(
      'Extension "model-helper-ext" requires permission models:read to use models.list.',
    );
    await expect(createExtensionModelsCapability(undefined, 'model-helper-ext').saveProvider({ provider: 'ds4' })).rejects.toThrow(
      'Extension "model-helper-ext" requires permission models:write to use models.saveProvider.',
    );
  });
});
