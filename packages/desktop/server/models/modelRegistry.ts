import { dirname, join } from 'node:path';

import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir } from '@neon-pilot/core';

import { resolveIndexedProviderApiKey, resolveProviderApiKeyAsync } from '../secrets/secretStore.js';
import { normalizeModelContextWindow } from './modelContextWindows.js';

type RegistryModel = ReturnType<ModelRegistry['getAvailable']>[number];

function applyNeonPilotModelMetadataOverrides(model: RegistryModel): RegistryModel {
  const contextWindow = normalizeModelContextWindow(model.id, model.contextWindow, 128_000);

  if (contextWindow !== model.contextWindow) {
    return { ...model, contextWindow };
  }

  return model;
}

function applyNeonPilotRegistryOverrides(registry: ModelRegistry, authStorage: AuthStorage): ModelRegistry {
  if (typeof authStorage.setFallbackResolver === 'function') {
    authStorage.setFallbackResolver((provider) => resolveIndexedProviderApiKey(provider));
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
    const apiKey = await resolveProviderApiKeyAsync(model.provider);
    if (!apiKey || (result.ok === false && !result.error.includes('No API key found'))) return result;
    return { ...result, ok: true, apiKey };
  };

  return registry;
}

export function createRuntimeModelRegistry(authStorage: AuthStorage): ModelRegistry {
  return applyNeonPilotRegistryOverrides(ModelRegistry.create(authStorage, join(getPiAgentRuntimeDir(), 'models.json')), authStorage);
}

export function createModelRegistryForAuthFile(authFile: string): ModelRegistry {
  const authStorage = AuthStorage.create(authFile);
  return applyNeonPilotRegistryOverrides(ModelRegistry.create(authStorage, join(dirname(authFile), 'models.json')), authStorage);
}
