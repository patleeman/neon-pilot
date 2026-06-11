import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAvailableModels = vi.fn();
const runModelDiscovery = vi.fn();
const normalizeSavedModelPreferences = vi.fn();
const readSavedModelRef = vi.fn();
const getSupportedServiceTiersForModel = vi.fn();
const modelSupportsServiceTier = vi.fn();
const invalidateAppTopics = vi.fn();

vi.mock('../conversations/liveSessions.js', () => ({ getAvailableModels }));
vi.mock('./modelDiscovery.js', () => ({ runModelDiscovery }));
vi.mock('./modelPreferences.js', () => ({ normalizeSavedModelPreferences, readSavedModelRef }));
vi.mock('./modelServiceTiers.js', () => ({ getSupportedServiceTiersForModel, modelSupportsServiceTier }));
vi.mock('../shared/appEvents.js', () => ({ invalidateAppTopics }));

const { invalidateModelDefinitionsCache, listModelDefinitions, readModelState } = await import('./modelState.js');

describe('modelState', () => {
  beforeEach(() => {
    getAvailableModels.mockReset();
    runModelDiscovery.mockReset().mockResolvedValue([]);
    normalizeSavedModelPreferences
      .mockReset()
      .mockReturnValue({ currentModel: '', currentVisionModel: '', currentThinkingLevel: 'medium', currentServiceTier: '' });
    readSavedModelRef.mockReset().mockReturnValue('');
    getSupportedServiceTiersForModel.mockReset().mockReturnValue(['auto']);
    modelSupportsServiceTier.mockReset().mockReturnValue(false);
    invalidateAppTopics.mockReset();
    invalidateModelDefinitionsCache();
  });

  it('returns no model definitions when the live registry fails', async () => {
    getAvailableModels.mockRejectedValue(new Error('registry unavailable'));

    const models = await listModelDefinitions();

    expect(models).toEqual([]);
    expect(runModelDiscovery).not.toHaveBeenCalled();
  });

  it('does not reuse an empty cold-start cache when models become available', async () => {
    getAvailableModels
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'ready', provider: 'local', name: 'Ready', contextWindow: 42, input: ['text'] }]);

    await expect(listModelDefinitions()).resolves.toEqual([]);
    await expect(listModelDefinitions()).resolves.toMatchObject([{ id: 'ready', provider: 'local' }]);
    expect(getAvailableModels).toHaveBeenCalledTimes(2);
  });

  it('awaits registry models on cold cache so first model picker load is populated', async () => {
    getAvailableModels.mockResolvedValue([
      { id: 'vision', provider: 'p', name: 'Vision', contextWindow: 42, input: ['text', 'image'], reasoning: true },
      { id: 'legacy-context', provider: 'p', name: 'Legacy', context: 99, input: ['audio'], reasoning: 'yes' },
      { id: 'default-context', provider: 'p', name: 'Default' },
    ]);

    const models = await listModelDefinitions();

    expect(models.map((model) => model.id)).toEqual(['vision', 'legacy-context', 'default-context']);
    expect(models[0]).toMatchObject({ input: ['text', 'image'], reasoning: true, context: 42 });
    expect(models[1]).toMatchObject({ input: ['text'], reasoning: undefined, context: 99 });
    expect(getAvailableModels).toHaveBeenCalledTimes(1);
  });

  it('returns registry models first and merges discovered models in the background', async () => {
    getAvailableModels.mockResolvedValue([{ id: 'same', provider: 'local', name: 'Registry', contextWindow: 100, input: ['text'] }]);
    runModelDiscovery.mockResolvedValue([
      {
        provider: 'local',
        baseUrl: 'http://localhost',
        api: 'openai',
        apiKey: 'x',
        models: [
          { id: 'same', name: 'Discovered Duplicate', contextWindow: 200, input: ['text'], reasoning: false },
          { id: 'new', name: 'Discovered', contextWindow: 300, input: ['text', 'image'], reasoning: true },
        ],
      },
    ]);

    const models = await listModelDefinitions();

    expect(models.map((model) => `${model.provider}/${model.id}`)).toEqual(['local/same']);
    expect(getAvailableModels).toHaveBeenCalledTimes(1);
    await vi.waitFor(async () => {
      await expect(listModelDefinitions()).resolves.toMatchObject([
        { id: 'same', provider: 'local' },
        { id: 'new', provider: 'local' },
      ]);
    });
    expect(invalidateAppTopics).toHaveBeenCalledWith('models');
  });

  it('ignores model discovery failures during the background refresh', async () => {
    getAvailableModels.mockResolvedValue([{ id: 'registry', provider: 'p', name: 'Registry', contextWindow: 100, input: ['text'] }]);
    runModelDiscovery.mockRejectedValue(new Error('discovery failed'));

    await expect(listModelDefinitions()).resolves.toMatchObject([{ id: 'registry', provider: 'p' }]);
  });

  it('reads saved preferences and clears stale model or unsupported service tier selections', async () => {
    getAvailableModels.mockResolvedValue([{ id: 'available', provider: 'p', name: 'Available', contextWindow: 100, input: ['text'] }]);
    normalizeSavedModelPreferences.mockReturnValue({
      currentModel: 'missing',
      currentVisionModel: 'vision',
      currentThinkingLevel: 'high',
      currentServiceTier: 'priority',
    });
    modelSupportsServiceTier.mockReturnValue(false);

    const state = await readModelState('/settings.json');

    expect(state).toMatchObject({
      currentModel: 'available',
      currentVisionModel: 'vision',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
    });
    expect(state.models).toMatchObject([{ id: 'available', provider: 'p' }]);
    expect(normalizeSavedModelPreferences).toHaveBeenCalledWith('/settings.json', expect.any(Array));
  });

  it('preserves current model and service tier when both are valid', async () => {
    getAvailableModels.mockResolvedValue([{ id: 'available', provider: 'p', name: 'Available', contextWindow: 100, input: ['text'] }]);
    normalizeSavedModelPreferences.mockReturnValue({
      currentModel: 'available',
      currentVisionModel: '',
      currentThinkingLevel: 'low',
      currentServiceTier: 'flex',
    });
    modelSupportsServiceTier.mockReturnValue(true);

    await expect(readModelState('/settings.json')).resolves.toMatchObject({ currentModel: 'available', currentServiceTier: 'flex' });
  });

  it('returns provider-qualified current model refs after discovery when model ids collide', async () => {
    getAvailableModels.mockResolvedValue([
      {
        id: 'deepseek-v4-flash',
        provider: 'opencode-go',
        name: 'DeepSeek V4 Flash',
        contextWindow: 128_000,
        input: ['text'],
        reasoning: true,
      },
    ]);
    runModelDiscovery.mockResolvedValue([
      {
        provider: 'ds4',
        baseUrl: 'http://127.0.0.1:4444',
        api: 'openai',
        apiKey: 'x',
        models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', contextWindow: 128_000, input: ['text'], reasoning: true }],
      },
    ]);
    readSavedModelRef.mockReturnValue('ds4/deepseek-v4-flash');

    await listModelDefinitions();
    await vi.waitFor(async () => {
      await expect(listModelDefinitions()).resolves.toHaveLength(2);
    });

    const state = await readModelState('/settings.json');

    expect(state.currentModel).toBe('ds4/deepseek-v4-flash');
  });
});
