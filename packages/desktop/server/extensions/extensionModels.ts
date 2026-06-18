import { readModelState } from '../models/modelState.js';
import { invalidateModelDefinitionsCache } from '../models/modelState.js';
import { getRuntimeSettingsFilePath } from '../ui/settingsPersistence.js';
import type { ExtensionBackendServerContext } from './extensionBackend.js';
import { assertExtensionPermission } from './extensionPermissions.js';

type ProviderDesktopCapabilityModule = typeof import('../models/providerDesktopCapability.js');

type ProviderDesktopCapabilityContext = {
  getRuntimeScope: () => string;
  materializeWebRuntimeConfig: (profile: string) => void;
  getAuthFile: () => string;
  getStateRoot?: () => string;
};

async function importProviderDesktopCapability(): Promise<ProviderDesktopCapabilityModule> {
  return import('../models/providerDesktopCapability.js');
}

function providerCapabilityContext(serverContext?: ExtensionBackendServerContext): ProviderDesktopCapabilityContext {
  if (!serverContext?.getRuntimeScope || !serverContext.materializeWebRuntimeConfig || !serverContext.getAuthFile) {
    throw new Error('Model provider writes require a host route context.');
  }
  return {
    getRuntimeScope: serverContext.getRuntimeScope,
    materializeWebRuntimeConfig: serverContext.materializeWebRuntimeConfig,
    getAuthFile: serverContext.getAuthFile,
    ...(serverContext.getStateRoot ? { getStateRoot: serverContext.getStateRoot } : {}),
  };
}

async function afterProviderWrite(): Promise<void> {
  invalidateModelDefinitionsCache();
  const { invalidateAppTopics } = await import('../shared/appEvents.js');
  invalidateAppTopics('models');
}

/**
 * Models capability for extensions.
 */
export function createExtensionModelsCapability(serverContext?: ExtensionBackendServerContext, extensionId?: string) {
  const assertPermission = (permission: 'models:read' | 'models:write', capability: string) => {
    if (extensionId) assertExtensionPermission(extensionId, permission, capability);
  };
  return {
    /**
     * List available models and their capabilities.
     */
    async list(): Promise<unknown[]> {
      assertPermission('models:read', 'models.list');
      try {
        const settingsFile = serverContext?.getSettingsFile?.() ?? getRuntimeSettingsFilePath(serverContext?.getStateRoot?.());
        if (!settingsFile) return [];

        const state = await readModelState(settingsFile);
        return (state.models ?? []).map(
          (m: {
            id?: string;
            name?: string;
            provider?: string;
            contextWindow?: number;
            reasoning?: boolean;
            input?: readonly string[];
          }) => ({
            id: m.id ?? '',
            name: m.name ?? m.id ?? '',
            provider: m.provider ?? '',
            contextWindow: m.contextWindow ?? 0,
            reasoning: m.reasoning ?? false,
            input: m.input ?? ['text'],
          }),
        );
      } catch {
        return [];
      }
    },
    async saveProvider(input: Parameters<ProviderDesktopCapabilityModule['saveModelProviderCapability']>[1]) {
      assertPermission('models:write', 'models.saveProvider');
      const module = await importProviderDesktopCapability();
      const result = module.saveModelProviderCapability(providerCapabilityContext(serverContext), input);
      await afterProviderWrite();
      return result;
    },
    async saveProviderModel(input: Parameters<ProviderDesktopCapabilityModule['saveModelProviderModelCapability']>[1]) {
      assertPermission('models:write', 'models.saveProviderModel');
      const module = await importProviderDesktopCapability();
      const result = module.saveModelProviderModelCapability(providerCapabilityContext(serverContext), input);
      await afterProviderWrite();
      return result;
    },
    async deleteProvider(provider: string) {
      assertPermission('models:write', 'models.deleteProvider');
      const module = await importProviderDesktopCapability();
      const result = module.deleteModelProviderCapability(providerCapabilityContext(serverContext), provider);
      await afterProviderWrite();
      return result;
    },
    async deleteProviderModel(input: { provider: string; modelId: string }) {
      assertPermission('models:write', 'models.deleteProviderModel');
      const module = await importProviderDesktopCapability();
      const result = module.deleteModelProviderModelCapability(providerCapabilityContext(serverContext), input.provider, input.modelId);
      await afterProviderWrite();
      return result;
    },
  };
}
