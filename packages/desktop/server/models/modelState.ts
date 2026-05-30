import { getAvailableModels } from '../conversations/liveSessions.js';
import { runModelDiscovery } from './modelDiscovery.js';
import { normalizeSavedModelPreferences } from './modelPreferences.js';
import { getSupportedServiceTiersForModel, modelSupportsServiceTier } from './modelServiceTiers.js';

const MODEL_DEFINITIONS_CACHE_TTL_MS = 60_000;

const BUILT_IN_MODELS = [
  { id: 'claude-opus-4-6', provider: 'anthropic', name: 'Claude Opus 4.6', context: 200_000, input: ['text', 'image'] },
  { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', context: 200_000, input: ['text', 'image'] },
  { id: 'claude-haiku-4-6', provider: 'anthropic', name: 'Claude Haiku 4.6', context: 200_000, input: ['text', 'image'] },
  { id: 'gpt-5.5', provider: 'openai-codex', name: 'GPT-5.5', context: 400_000, input: ['text', 'image'] },
  { id: 'gpt-5.4', provider: 'openai-codex', name: 'GPT-5.4', context: 128_000, input: ['text', 'image'] },
  { id: 'gpt-5.4-mini', provider: 'openai-codex', name: 'GPT-5.4 Mini', context: 128_000, input: ['text', 'image'] },
  { id: 'gpt-5.2', provider: 'openai-codex', name: 'GPT-5.2', context: 128_000, input: ['text', 'image'] },
  { id: 'gpt-5.1-codex-mini', provider: 'openai-codex', name: 'GPT-5.1 Codex Mini', context: 128_000, input: ['text'] },
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', context: 128_000, input: ['text', 'image'] },
  { id: 'gemini-2.5-pro', provider: 'google', name: 'Gemini 2.5 Pro', context: 1_000_000, input: ['text', 'image'] },
  { id: 'gemini-3.1-pro-high', provider: 'google', name: 'Gemini 3.1 Pro High', context: 1_000_000, input: ['text', 'image'] },
] as const;

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
    const builtinModels = BUILT_IN_MODELS.map((model) => ({
      ...model,
      supportedServiceTiers: getSupportedServiceTiersForModel(model),
    }));
    modelDefinitionsCache = { models: builtinModels, expiresAt: Date.now() + MODEL_DEFINITIONS_CACHE_TTL_MS };
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
    // Fall back to built-ins only when the live registry cannot be materialized.
    return BUILT_IN_MODELS.map((model) => ({
      ...model,
      supportedServiceTiers: getSupportedServiceTiersForModel(model),
    }));
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
  const modelIds = new Set(models.map((model) => model.id));
  const currentModel = saved.currentModel && modelIds.has(saved.currentModel) ? saved.currentModel : models[0]?.id || '';
  const selectedModel = models.find((model) => model.id === currentModel) ?? null;

  return {
    currentModel,
    currentVisionModel: saved.currentVisionModel ?? '',
    currentThinkingLevel: saved.currentThinkingLevel,
    currentServiceTier: modelSupportsServiceTier(selectedModel, saved.currentServiceTier) ? saved.currentServiceTier : '',
    models,
  };
}
