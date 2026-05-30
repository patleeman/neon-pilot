import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAvailableModels = vi.fn();
const runModelDiscovery = vi.fn();
const normalizeSavedModelPreferences = vi.fn();
const getSupportedServiceTiersForModel = vi.fn();
const modelSupportsServiceTier = vi.fn();

vi.mock('../conversations/liveSessions.js', () => ({ getAvailableModels }));
vi.mock('./modelDiscovery.js', () => ({ runModelDiscovery }));
vi.mock('./modelPreferences.js', () => ({ normalizeSavedModelPreferences }));
vi.mock('./modelServiceTiers.js', () => ({ getSupportedServiceTiersForModel, modelSupportsServiceTier }));

const { invalidateModelDefinitionsCache, listModelDefinitions, readModelState } = await import('./modelState.js');

describe('modelState', () => {
  beforeEach(() => {
    getAvailableModels.mockReset();
    runModelDiscovery.mockReset().mockResolvedValue([]);
    normalizeSavedModelPreferences
      .mockReset()
      .mockReturnValue({ currentModel: '', currentVisionModel: '', currentThinkingLevel: 'medium', currentServiceTier: '' });
    getSupportedServiceTiersForModel.mockReset().mockReturnValue(['auto']);
    modelSupportsServiceTier.mockReset().mockReturnValue(false);
    invalidateModelDefinitionsCache();
  });

  it('falls back to built-in model definitions when the live registry fails', async () => {
    getAvailableModels.mockRejectedValue(new Error('registry unavailable'));

    const models = await listModelDefinitions();

    expect(models.map((model) => model.id)).toContain('claude-opus-4-6');
    expect(models.map((model) => model.id)).toContain('gpt-5.5');
    expect(models[0]).toMatchObject({ provider: 'anthropic', input: ['text', 'image'], supportedServiceTiers: ['auto'] });
    expect(runModelDiscovery).not.toHaveBeenCalled();
  });

  it('normalizes registry models and defaults malformed inputs to text only', async () => {
    getAvailableModels.mockResolvedValue([
      { id: 'vision', provider: 'p', name: 'Vision', contextWindow: 42, input: ['text', 'image'], reasoning: true },
      { id: 'legacy-context', provider: 'p', name: 'Legacy', context: 99, input: ['audio'], reasoning: 'yes' },
      { id: 'default-context', provider: 'p', name: 'Default' },
    ]);

    await expect(listModelDefinitions()).resolves.toEqual([
      {
        id: 'vision',
        provider: 'p',
        name: 'Vision',
        context: 42,
        input: ['text', 'image'],
        reasoning: true,
        supportedServiceTiers: ['auto'],
      },
      {
        id: 'legacy-context',
        provider: 'p',
        name: 'Legacy',
        context: 99,
        input: ['text'],
        reasoning: undefined,
        supportedServiceTiers: ['auto'],
      },
      {
        id: 'default-context',
        provider: 'p',
        name: 'Default',
        context: 128000,
        input: ['text'],
        reasoning: undefined,
        supportedServiceTiers: ['auto'],
      },
    ]);
  });

  it('appends discovered extension models and keeps registry models on provider/id collisions', async () => {
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

    expect(models.map((model) => model.name)).toEqual(['Registry', 'Discovered']);
    expect(models[1]).toMatchObject({ id: 'new', provider: 'local', context: 300, input: ['text', 'image'], reasoning: true });
  });

  it('ignores model discovery failures after registry models load', async () => {
    getAvailableModels.mockResolvedValue([{ id: 'registry', provider: 'p', name: 'Registry', contextWindow: 100, input: ['text'] }]);
    runModelDiscovery.mockRejectedValue(new Error('discovery failed'));

    await expect(listModelDefinitions()).resolves.toHaveLength(1);
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

    await expect(readModelState('/settings.json')).resolves.toMatchObject({
      currentModel: 'available',
      currentVisionModel: 'vision',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
      models: [{ id: 'available' }],
    });
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
});
