import { dirname, join } from 'node:path';

import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir } from '@neon-pilot/core';

import { normalizeModelContextWindow } from './modelContextWindows.js';

type RegistryModel = ReturnType<ModelRegistry['getAvailable']>[number];

function applyNeonPilotModelMetadataOverrides(model: RegistryModel): RegistryModel {
  const contextWindow = normalizeModelContextWindow(model.id, model.contextWindow, 128_000);
  if (contextWindow !== model.contextWindow) {
    return { ...model, contextWindow };
  }

  return model;
}

function applyNeonPilotRegistryOverrides(registry: ModelRegistry): ModelRegistry {
  const originalGetAll = registry.getAll.bind(registry);
  const originalGetAvailable = registry.getAvailable.bind(registry);
  const originalFind = registry.find.bind(registry);

  registry.getAll = () => originalGetAll().map(applyNeonPilotModelMetadataOverrides);
  registry.getAvailable = () => originalGetAvailable().map(applyNeonPilotModelMetadataOverrides);
  registry.find = (provider: string, modelId: string) => {
    const model = originalFind(provider, modelId);
    return model ? applyNeonPilotModelMetadataOverrides(model) : undefined;
  };

  return registry;
}

export function createRuntimeModelRegistry(authStorage: AuthStorage): ModelRegistry {
  return applyNeonPilotRegistryOverrides(ModelRegistry.create(authStorage, join(getPiAgentRuntimeDir(), 'models.json')));
}

export function createModelRegistryForAuthFile(authFile: string): ModelRegistry {
  return applyNeonPilotRegistryOverrides(ModelRegistry.create(AuthStorage.create(authFile), join(dirname(authFile), 'models.json')));
}
