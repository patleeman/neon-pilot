import { dirname, join } from 'node:path';

import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir } from '@neon-pilot/core';

import { resolveProviderApiKey } from '../secrets/secretStore.js';
import { normalizeModelContextWindow } from './modelContextWindows.js';

type RegistryModel = ReturnType<ModelRegistry['getAvailable']>[number];

function applyNeonPilotModelMetadataOverrides(model: RegistryModel): RegistryModel {
  const contextWindow = normalizeModelContextWindow(model.id, model.contextWindow, 128_000);

  // Fix: kimi-k2.6 under opencode-go uses "string-thinking" format which sends
  // `thinking: "high"` (a string), but the API expects `thinking` as an object
  // (e.g., `{ type: "enabled" }`). Switch to "deepseek" format which sends the
  // correct object shape. Also map "high" in thinkingLevelMap so selected levels
  // don't fall through to raw strings.
  if (model.provider === 'opencode-go' && model.id === 'kimi-k2.6' && model.compat) {
    const compat = { ...model.compat, thinkingFormat: 'deepseek' as const };
    const thinkingLevelMap = model.thinkingLevelMap ? { ...model.thinkingLevelMap, high: 'high' } : { off: 'none', high: 'high' };
    return { ...model, compat, thinkingLevelMap, contextWindow };
  }

  if (contextWindow !== model.contextWindow) {
    return { ...model, contextWindow };
  }

  return model;
}

function applyNeonPilotRegistryOverrides(registry: ModelRegistry, authStorage: AuthStorage): ModelRegistry {
  if (typeof authStorage.setFallbackResolver === 'function') {
    authStorage.setFallbackResolver((provider) => resolveProviderApiKey(provider));
  }

  const originalGetAll = registry.getAll.bind(registry);
  const originalGetAvailable = registry.getAvailable.bind(registry);
  const originalFind = registry.find.bind(registry);
  const originalGetApiKeyAndHeaders = registry.getApiKeyAndHeaders.bind(registry);

  registry.getAll = () => originalGetAll().map(applyNeonPilotModelMetadataOverrides);
  registry.getAvailable = () => originalGetAvailable().map(applyNeonPilotModelMetadataOverrides);
  registry.find = (provider: string, modelId: string) => {
    const model = originalFind(provider, modelId);
    return model ? applyNeonPilotModelMetadataOverrides(model) : undefined;
  };
  registry.getApiKeyAndHeaders = async (model) => {
    const result = await originalGetApiKeyAndHeaders(model);
    const apiKey = resolveProviderApiKey(model.provider);
    if (!apiKey || (result.ok === false && !result.error.includes('No API key found'))) return result;
    return { ...result, ok: true, apiKey };
  };

  return registry;
}

export function createRuntimeModelRegistry(authStorage: AuthStorage): ModelRegistry {
  return applyNeonPilotRegistryOverrides(
    ModelRegistry.create(authStorage, join(getPiAgentRuntimeDir(), 'models.json')),
    authStorage,
  );
}

export function createModelRegistryForAuthFile(authFile: string): ModelRegistry {
  const authStorage = AuthStorage.create(authFile);
  return applyNeonPilotRegistryOverrides(ModelRegistry.create(authStorage, join(dirname(authFile), 'models.json')), authStorage);
}
