import { beforeEach, describe, expect, it, vi } from 'vitest';

const readModelState = vi.fn();
const invalidateModelDefinitionsCache = vi.fn();
const getPiAgentRuntimeDir = vi.fn(() => '/runtime/pi-agent');
const getStateRoot = vi.fn(() => '/state');
const invalidateAppTopics = vi.fn();
const saveModelProviderCapability = vi.fn();
const saveModelProviderModelCapability = vi.fn();
const deleteModelProviderCapability = vi.fn();
const deleteModelProviderModelCapability = vi.fn();

vi.mock('../models/modelState.js', () => ({ readModelState, invalidateModelDefinitionsCache }));
vi.mock('@neon-pilot/core', () => ({ getPiAgentRuntimeDir, getStateRoot }));
vi.mock('../shared/appEvents.js', () => ({ invalidateAppTopics }));
vi.mock('../models/providerDesktopCapability.js', () => ({
  saveModelProviderCapability,
  saveModelProviderModelCapability,
  deleteModelProviderCapability,
  deleteModelProviderModelCapability,
}));

const { createExtensionModelsCapability } = await import('./extensionModels.js');

describe('extensionModels', () => {
  beforeEach(() => {
    readModelState.mockReset();
    invalidateModelDefinitionsCache.mockReset();
    getPiAgentRuntimeDir.mockReset().mockReturnValue('/runtime/pi-agent');
    getStateRoot.mockReset().mockReturnValue('/state');
    invalidateAppTopics.mockReset();
    saveModelProviderCapability.mockReset().mockReturnValue({ providers: [] });
    saveModelProviderModelCapability.mockReset().mockReturnValue({ providers: [] });
    deleteModelProviderCapability.mockReset().mockReturnValue({ providers: [] });
    deleteModelProviderModelCapability.mockReset().mockReturnValue({ providers: [] });
  });

  it('lists normalized model capabilities from the runtime settings file', async () => {
    readModelState.mockResolvedValue({
      models: [
        { id: 'm1', name: 'Model One', provider: 'provider', contextWindow: 123, reasoning: true, input: ['text', 'image'] },
        { id: 'm2' },
      ],
    });

    await expect(createExtensionModelsCapability().list()).resolves.toEqual([
      { id: 'm1', name: 'Model One', provider: 'provider', contextWindow: 123, reasoning: true, input: ['text', 'image'] },
      { id: 'm2', name: 'm2', provider: '', contextWindow: 0, reasoning: false, input: ['text'] },
    ]);
    expect(readModelState).toHaveBeenCalledWith('/runtime/pi-agent/settings.json');
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

  it('requires a route context for model provider writes', async () => {
    await expect(createExtensionModelsCapability().saveProvider({ provider: 'ds4' })).rejects.toThrow(
      'Model provider writes require a host route context.',
    );
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
