import { describe, expect, it, vi } from 'vitest';

vi.mock('./modelProviders.js', () => ({
  readModelProvidersState: vi.fn(),
  upsertModelProvider: vi.fn(),
  removeModelProvider: vi.fn(),
  upsertModelProviderModel: vi.fn(),
  removeModelProviderModel: vi.fn(),
}));

vi.mock('./providerAuth.js', () => ({
  readProviderAuthState: vi.fn(),
  setProviderApiKey: vi.fn(),
  removeProviderCredential: vi.fn(),
  startProviderOAuthLogin: vi.fn(),
  getProviderOAuthLoginState: vi.fn(),
  submitProviderOAuthLoginInput: vi.fn(),
  cancelProviderOAuthLogin: vi.fn(),
}));

vi.mock('./modelRegistry.js', () => ({
  createModelRegistryForAuthFile: vi.fn(),
}));

vi.mock('../middleware/index.js', () => ({
  refreshAllLiveSessionModelRegistries: vi.fn(),
  reloadAllLiveSessionAuth: vi.fn(),
}));

import * as middleware from '../middleware/index.js';
import * as modelProviders from './modelProviders.js';
import * as providerAuth from './providerAuth.js';
import * as modelRegistry from './modelRegistry.js';
import {
  cancelProviderOAuthLoginCapability,
  deleteModelProviderCapability,
  deleteModelProviderModelCapability,
  type ProviderDesktopCapabilityContext,
  ProviderDesktopCapabilityInputError,
  readModelProvidersCapability,
  readProviderAuthCapability,
  readProviderOAuthLoginCapability,
  removeProviderCredentialCapability,
  saveModelProviderCapability,
  saveModelProviderModelCapability,
  setProviderApiKeyCapability,
  startProviderOAuthLoginCapability,
  submitProviderOAuthLoginInputCapability,
} from './providerDesktopCapability.js';

function createContext(overrides?: Partial<ProviderDesktopCapabilityContext>): ProviderDesktopCapabilityContext {
  return {
    getRuntimeScope: () => 'test-profile',
    materializeWebRuntimeConfig: vi.fn(),
    getAuthFile: () => '/tmp/test-auth.json',
    getStateRoot: () => '/tmp/test-state',
    ...overrides,
  };
}

describe('readModelProvidersCapability', () => {
  it('returns provider state for the current profile', () => {
    vi.mocked(modelProviders.readModelProvidersState).mockReturnValue({ providers: {} } as never);
    const context = createContext();
    const result = readModelProvidersCapability(context);
    expect(modelProviders.readModelProvidersState).toHaveBeenCalledWith('test-profile');
    expect(result).toEqual({ providers: {} });
  });
});

describe('saveModelProviderCapability', () => {
  it('does not auto-populate when no API key is provided', () => {
    const state = { providers: { openai: { models: [] } } } as never;
    vi.mocked(modelProviders.upsertModelProvider).mockReturnValue(state);

    const context = createContext();
    void saveModelProviderCapability(context, { provider: ' openai ' });

    expect(modelRegistry.createModelRegistryForAuthFile).not.toHaveBeenCalled();
    expect(modelProviders.upsertModelProviderModel).not.toHaveBeenCalled();
  });

  it('saves a provider and refreshes registries', () => {
    vi.mocked(modelProviders.upsertModelProvider).mockReturnValue({ providers: { openai: { models: [] } } } as never);
    const context = createContext();
    const result = saveModelProviderCapability(context, { provider: ' openai ' });
    expect(modelProviders.upsertModelProvider).toHaveBeenCalledWith('test-profile', 'openai', expect.any(Object));
    expect(middleware.refreshAllLiveSessionModelRegistries).toHaveBeenCalled();
    expect(context.materializeWebRuntimeConfig as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('test-profile');
    expect(result).toEqual({ providers: { openai: { models: [] } } });
  });

  it('auto-populates model rows for providers with registered defaults when API key is provided', () => {
    vi.mocked(modelProviders.upsertModelProvider).mockReturnValue({
      filePath: '/tmp/providers.json',
      providers: [{ id: 'opencode-go', authHeader: true, models: [] }],
    } as never);
    vi.mocked(modelProviders.upsertModelProviderModel).mockReturnValue({
      filePath: '/tmp/providers.json',
      providers: [{ id: 'opencode-go', authHeader: true, models: [{ id: 'model-a' }] }],
    } as never);
    vi.mocked(modelRegistry.createModelRegistryForAuthFile).mockReturnValue({
      getAll: () => [
        {
          provider: 'opencode-go',
          id: 'model-a',
          reasoning: false,
        },
      ],
    } as never);

    const context = createContext();
    const result = saveModelProviderCapability(context, { provider: ' opencode-go ', apiKey: 'abc' });

    expect(modelProviders.upsertModelProvider).toHaveBeenCalledWith('test-profile', 'opencode-go', expect.any(Object));
    expect(modelRegistry.createModelRegistryForAuthFile).toHaveBeenCalledWith('/tmp/test-auth.json');
    expect(modelProviders.upsertModelProviderModel).toHaveBeenCalledWith(
      'test-profile',
      'opencode-go',
      'model-a',
      expect.objectContaining({
        name: 'model-a',
      }),
    );
    expect(result).toEqual({
      filePath: '/tmp/providers.json',
      providers: [{ id: 'opencode-go', authHeader: true, models: [{ id: 'model-a' }] }],
    });
  });

  it('throws on empty provider', () => {
    expect(() => saveModelProviderCapability(createContext(), { provider: '' })).toThrow(ProviderDesktopCapabilityInputError);
  });
});

describe('deleteModelProviderCapability', () => {
  it('removes a provider and refreshes registries', () => {
    vi.mocked(modelProviders.removeModelProvider).mockReturnValue({ state: { providers: {} } } as never);
    const context = createContext();
    deleteModelProviderCapability(context, ' openai ');
    expect(modelProviders.removeModelProvider).toHaveBeenCalledWith('test-profile', 'openai');
    expect(middleware.refreshAllLiveSessionModelRegistries).toHaveBeenCalled();
  });

  it('throws on empty provider', () => {
    expect(() => deleteModelProviderCapability(createContext(), '')).toThrow(ProviderDesktopCapabilityInputError);
  });
});

describe('saveModelProviderModelCapability', () => {
  it('saves a model under a provider', () => {
    vi.mocked(modelProviders.upsertModelProviderModel).mockReturnValue({ providers: { openai: { models: {} } } } as never);
    const context = createContext();
    const result = saveModelProviderModelCapability(context, { provider: 'openai', modelId: 'gpt-4' });
    expect(modelProviders.upsertModelProviderModel).toHaveBeenCalledWith('test-profile', 'openai', 'gpt-4', expect.any(Object));
    expect(result).toEqual({ providers: { openai: { models: {} } } });
  });

  it('throws on empty provider', () => {
    expect(() => saveModelProviderModelCapability(createContext(), { provider: '', modelId: 'gpt-4' })).toThrow(
      ProviderDesktopCapabilityInputError,
    );
  });

  it('throws on empty modelId', () => {
    expect(() => saveModelProviderModelCapability(createContext(), { provider: 'openai', modelId: '' })).toThrow(
      ProviderDesktopCapabilityInputError,
    );
  });
});

describe('deleteModelProviderModelCapability', () => {
  it('removes a model from a provider', () => {
    vi.mocked(modelProviders.removeModelProviderModel).mockReturnValue({ state: { providers: {} } } as never);
    const context = createContext();
    deleteModelProviderModelCapability(context, ' openai ', ' gpt-4 ');
    expect(modelProviders.removeModelProviderModel).toHaveBeenCalledWith('test-profile', 'openai', 'gpt-4');
  });
});

describe('readProviderAuthCapability', () => {
  it('reads auth state', async () => {
    vi.mocked(providerAuth.readProviderAuthState).mockReturnValue({ providers: {} } as never);
    const context = createContext();
    const result = await readProviderAuthCapability(context);
    expect(providerAuth.readProviderAuthState).toHaveBeenCalledWith('/tmp/test-auth.json', '/tmp/test-state');
    expect(result).toEqual({ providers: {} });
  });

  it('auto-populates empty known providers when a credential already exists', async () => {
    vi.mocked(providerAuth.readProviderAuthState).mockReturnValue({
      authFile: '/tmp/test-auth.json',
      providers: [
        {
          id: 'opencode-go',
          modelCount: 1,
          authType: 'api_key',
          hasStoredCredential: true,
          apiKeySupported: true,
          oauthSupported: false,
          oauthProviderName: '',
          oauthUsesCallbackServer: false,
        },
      ],
    } as never);
    vi.mocked(modelProviders.readModelProvidersState).mockReturnValue({
      filePath: '/tmp/providers.json',
      providers: [{ id: 'opencode-go', models: [] }],
    } as never);
    vi.mocked(modelRegistry.createModelRegistryForAuthFile).mockReturnValue({
      getAll: () => [{ provider: 'opencode-go', id: 'kimi-k2.6', name: 'Kimi K2.6' }],
    } as never);
    vi.mocked(modelProviders.upsertModelProviderModel).mockReturnValue({
      filePath: '/tmp/providers.json',
      providers: [{ id: 'opencode-go', models: [{ id: 'kimi-k2.6' }] }],
    } as never);

    const context = createContext();
    await readProviderAuthCapability(context);

    expect(modelProviders.upsertModelProviderModel).toHaveBeenCalledWith(
      'test-profile',
      'opencode-go',
      'kimi-k2.6',
      expect.objectContaining({ name: 'Kimi K2.6' }),
    );
    expect(context.materializeWebRuntimeConfig as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('test-profile');
    expect(middleware.refreshAllLiveSessionModelRegistries).toHaveBeenCalled();
  });
});

describe('setProviderApiKeyCapability', () => {
  it('sets an api key and reloads auth', async () => {
    vi.mocked(providerAuth.setProviderApiKey).mockReturnValue({ providers: { openai: {} } } as never);
    vi.mocked(modelProviders.readModelProvidersState).mockReturnValue({ providers: [] } as never);
    vi.mocked(modelRegistry.createModelRegistryForAuthFile).mockReturnValue({
      getAll: () => [],
    } as never);

    const context = createContext();
    const result = await setProviderApiKeyCapability(context, ' openai ', ' sk-123 ');
    expect(providerAuth.setProviderApiKey).toHaveBeenCalledWith('/tmp/test-auth.json', 'openai', 'sk-123', '/tmp/test-state');
    expect(modelProviders.readModelProvidersState).toHaveBeenCalledWith('test-profile');
    expect(modelRegistry.createModelRegistryForAuthFile).toHaveBeenCalledWith('/tmp/test-auth.json');
    expect(middleware.reloadAllLiveSessionAuth).toHaveBeenCalled();
    expect(result).toEqual({ providers: { openai: {} } });
  });

  it('auto-populates provider model rows when an API key is added for a known provider', async () => {
    vi.mocked(providerAuth.setProviderApiKey).mockReturnValue({ providers: { 'opencode-go': {} } } as never);
    vi.mocked(modelProviders.readModelProvidersState).mockReturnValue({ providers: [] } as never);
    vi.mocked(modelRegistry.createModelRegistryForAuthFile).mockReturnValue({
      getAll: () => [
        {
          provider: 'opencode-go',
          id: 'model-a',
          reasoning: false,
        },
      ],
    } as never);
    vi.mocked(modelProviders.upsertModelProvider).mockReturnValue({
      filePath: '/tmp/providers.json',
      providers: [{ id: 'opencode-go', authHeader: true, models: [] }],
    } as never);
    vi.mocked(modelProviders.upsertModelProviderModel).mockReturnValue({
      filePath: '/tmp/providers.json',
      providers: [{ id: 'opencode-go', authHeader: true, models: [{ id: 'model-a' }] }],
    } as never);

    const context = createContext();
    const result = await setProviderApiKeyCapability(context, ' opencode-go ', ' sk-123 ');

    expect(providerAuth.setProviderApiKey).toHaveBeenCalledWith('/tmp/test-auth.json', 'opencode-go', 'sk-123', '/tmp/test-state');
    expect(modelProviders.readModelProvidersState).toHaveBeenCalledWith('test-profile');
    expect(modelRegistry.createModelRegistryForAuthFile).toHaveBeenCalledWith('/tmp/test-auth.json');
    expect(modelProviders.upsertModelProvider).toHaveBeenCalledWith('test-profile', 'opencode-go', {});
    expect(modelProviders.upsertModelProviderModel).toHaveBeenCalledWith(
      'test-profile',
      'opencode-go',
      'model-a',
      expect.objectContaining({
        name: 'model-a',
      }),
    );
    expect(middleware.refreshAllLiveSessionModelRegistries).toHaveBeenCalled();
    expect(context.materializeWebRuntimeConfig as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('test-profile');
    expect(middleware.reloadAllLiveSessionAuth).toHaveBeenCalled();
    expect(result).toEqual({ providers: { 'opencode-go': {} } });
  });

  it('throws on empty provider', async () => {
    await expect(setProviderApiKeyCapability(createContext(), '', 'key')).rejects.toThrow(ProviderDesktopCapabilityInputError);
  });

  it('throws on empty apiKey', async () => {
    await expect(setProviderApiKeyCapability(createContext(), 'openai', '')).rejects.toThrow(ProviderDesktopCapabilityInputError);
  });
});

describe('removeProviderCredentialCapability', () => {
  it('removes a credential and reloads auth', () => {
    vi.mocked(providerAuth.removeProviderCredential).mockReturnValue({ providers: {} } as never);
    const context = createContext();
    removeProviderCredentialCapability(context, ' openai ');
    expect(providerAuth.removeProviderCredential).toHaveBeenCalledWith('/tmp/test-auth.json', 'openai', '/tmp/test-state');
    expect(middleware.reloadAllLiveSessionAuth).toHaveBeenCalled();
  });
});

describe('OAuth login capabilities', () => {
  it('startProviderOAuthLoginCapability delegates', () => {
    vi.mocked(providerAuth.startProviderOAuthLogin).mockReturnValue({ loginId: 'abc' } as never);
    const context = createContext();
    const result = startProviderOAuthLoginCapability(context, 'github');
    expect(providerAuth.startProviderOAuthLogin).toHaveBeenCalledWith('/tmp/test-auth.json', 'github');
    expect(result).toEqual({ loginId: 'abc' });
  });

  it('readProviderOAuthLoginCapability delegates', () => {
    vi.mocked(providerAuth.getProviderOAuthLoginState).mockReturnValue({ status: 'pending' } as never);
    const result = readProviderOAuthLoginCapability('login-1');
    expect(providerAuth.getProviderOAuthLoginState).toHaveBeenCalledWith('login-1');
    expect(result).toEqual({ status: 'pending' });
  });

  it('submitProviderOAuthLoginInputCapability delegates', () => {
    vi.mocked(providerAuth.submitProviderOAuthLoginInput).mockReturnValue({ status: 'completed' } as never);
    const result = submitProviderOAuthLoginInputCapability('login-1', 'code123');
    expect(providerAuth.submitProviderOAuthLoginInput).toHaveBeenCalledWith('login-1', 'code123');
    expect(result).toEqual({ status: 'completed' });
  });

  it('cancelProviderOAuthLoginCapability delegates', () => {
    vi.mocked(providerAuth.cancelProviderOAuthLogin).mockReturnValue({ status: 'cancelled' } as never);
    const result = cancelProviderOAuthLoginCapability('login-1');
    expect(providerAuth.cancelProviderOAuthLogin).toHaveBeenCalledWith('login-1');
    expect(result).toEqual({ status: 'cancelled' });
  });
});
