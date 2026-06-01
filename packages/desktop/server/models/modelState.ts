import { getAvailableModels } from '../conversations/liveSessions.js';
import { runModelDiscovery } from './modelDiscovery.js';
import { normalizeSavedModelPreferences, readSavedModelRef } from './modelPreferences.js';
import { getSupportedServiceTiersForModel, modelSupportsServiceTier } from './modelServiceTiers.js';

const MODEL_DEFINITIONS_CACHE_TTL_MS = 60_000;

export interface ModelDefinition {
  id: string;
  provider: string;
  name: string;
  context: number;
  input: readonly ('text' | 'image')[];
  reasoning?: boolean;
  supportedServiceTiers: string[];
}

type ModelDefinitionsCacheEntry = {
  expiresAt: number;
  models: readonly ModelDefinition[];
};

let modelDefinitionsCache: ModelDefinitionsCacheEntry | null = null;
let modelDefinitionsInFlight: Promise<readonly ModelDefinition[]> | null = null;

export function invalidateModelDefinitionsCache() {
  modelDefinitionsCache = null;
  modelDefinitionsInFlight = null;
}

function readModelInput(model: unknown): Array<'text' | 'image'> {
  const input = (model as { input?: unknown } | undefined)?.input;
  if (!Array.isArray(input)) {
    return ['text'];
  }
  return input.includes('image') ? ['text', 'image'] : ['text'];
}

function readModelReasoning(model: unknown): boolean | undefined {
  const reasoning = (model as { reasoning?: unknown } | undefined)?.reasoning;
  return typeof reasoning === 'boolean' ? reasoning : undefined;
}

function refreshModelDefinitionsInBackground() {
  if (modelDefinitionsInFlight) {
    return modelDefinitionsInFlight;
  }

  if (!modelDefinitionsCache) {
    modelDefinitionsCache = { models: [], expiresAt: Date.now() + MODEL_DEFINITIONS_CACHE_TTL_MS };
  }

  const request = loadModelDefinitions().then((models) => {
    modelDefinitionsCache = { models, expiresAt: Date.now() + MODEL_DEFINITIONS_CACHE_TTL_MS };
    return models;
  });

  modelDefinitionsInFlight = request.finally(() => {
    modelDefinitionsInFlight = null;
  });
  return modelDefinitionsInFlight;
}

async function loadModelDefinitions(): Promise<readonly ModelDefinition[]> {
  let registryModels: Awaited<ReturnType<typeof getAvailableModels>>;
  try {
    registryModels = await getAvailableModels();
  } catch {
    // No built-in model definitions: if the live registry cannot be materialized,
    // keep the picker empty rather than presenting unavailable providers.
    return [];
  }

  const base = registryModels.map((model) => ({
    id: model.id,
    provider: model.provider,
    name: model.name,
    context: model.contextWindow ?? model.context ?? 128_000,
    input: readModelInput(model),
    reasoning: readModelReasoning(model),
    supportedServiceTiers: getSupportedServiceTiersForModel(model),
  }));

  // Merge in models discovered from extensions (e.g. local MLX/GGUF runtimes).
  // Discovery is best-effort — failures are swallowed so a broken extension
  // never prevents the picker from loading.
  let discovered: Awaited<ReturnType<typeof runModelDiscovery>> = [];
  try {
    discovered = await runModelDiscovery();
  } catch {
    // ignore
  }

  const discoveredModels = discovered.flatMap((p) =>
    p.models.map((m) => ({
      id: m.id,
      provider: p.provider,
      name: m.name,
      context: m.contextWindow,
      input: m.input,
      reasoning: m.reasoning,
      supportedServiceTiers: getSupportedServiceTiersForModel({ provider: p.provider } as never),
    })),
  );

  // Discovered models are appended; registry models take precedence on id collisions.
  const registryIds = new Set(base.map((m) => `${m.provider}:${m.id}`));
  return [...base, ...discoveredModels.filter((m) => !registryIds.has(`${m.provider}:${m.id}`))];
}

export interface ModelState {
  currentModel: string;
  currentVisionModel: string;
  currentThinkingLevel: string;
  currentServiceTier: string;
  models: readonly ModelDefinition[];
}

export function prewarmModelDefinitions() {
  void refreshModelDefinitionsInBackground();
}

function modelIdHasMultipleProviders(models: readonly ModelDefinition[], modelId: string): boolean {
  return models.filter((model) => model.id === modelId).length > 1;
}

function resolveModelDefinition(modelRef: string, models: readonly ModelDefinition[]): ModelDefinition | null {
  if (!modelRef) {
    return null;
  }

  const exactMatch = models.find((model) => model.id === modelRef);
  if (exactMatch) {
    return exactMatch;
  }

  const slashIndex = modelRef.indexOf('/');
  if (slashIndex > 0 && slashIndex < modelRef.length - 1) {
    const provider = modelRef.slice(0, slashIndex);
    const id = modelRef.slice(slashIndex + 1);
    return models.find((model) => model.provider === provider && model.id === id) ?? null;
  }

  return null;
}

function formatModelStateRef(model: ModelDefinition | null | undefined, models: readonly ModelDefinition[]): string {
  if (!model) {
    return '';
  }

  return modelIdHasMultipleProviders(models, model.id) ? `${model.provider}/${model.id}` : model.id;
}

export async function listModelDefinitions(): Promise<readonly ModelDefinition[]> {
  const now = Date.now();
  if (modelDefinitionsCache && modelDefinitionsCache.expiresAt > now) {
    return modelDefinitionsCache.models;
  }

  if (modelDefinitionsCache && modelDefinitionsCache.models.length > 0) {
    void refreshModelDefinitionsInBackground();
    return modelDefinitionsCache.models;
  }

  if (modelDefinitionsInFlight) {
    return modelDefinitionsInFlight;
  }

  refreshModelDefinitionsInBackground();
  return modelDefinitionsCache?.models ?? [];
}

export async function readModelState(settingsFile: string): Promise<ModelState> {
  const models = await listModelDefinitions();
  const saved = normalizeSavedModelPreferences(settingsFile, models);
  const savedModelRef = readSavedModelRef(settingsFile, models) || saved.currentModel;
  const selectedModel = resolveModelDefinition(savedModelRef, models) ?? models[0] ?? null;
  const currentModel = formatModelStateRef(selectedModel, models);

  return {
    currentModel,
    currentVisionModel: saved.currentVisionModel ?? '',
    currentThinkingLevel: saved.currentThinkingLevel,
    currentServiceTier: modelSupportsServiceTier(selectedModel, saved.currentServiceTier) ? saved.currentServiceTier : '',
    models,
  };
}
