import { readModelState } from '../models/modelState.js';
import { invalidateModelDefinitionsCache } from '../models/modelState.js';
import type { ExtensionBackendServerContext } from './extensionBackend.js';

const DEFAULT_RUNTIME_SETTINGS_FILE = process.env.NEON_PILOT_SETTINGS_FILE || '';

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
export function createExtensionModelsCapability(serverContext?: ExtensionBackendServerContext) {
  return {
    /**
     * List available models and their capabilities.
     */
    async list(): Promise<unknown[]> {
      try {
        const settingsFile =
          DEFAULT_RUNTIME_SETTINGS_FILE ||
          (await (async () => {
            // Lazy default — look for the settings file in the agent dir
            const { getPiAgentRuntimeDir } = await import('@neon-pilot/core');
            return `${getPiAgentRuntimeDir()}/settings.json`;
          })().catch(() => ''));
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
      const module = await importProviderDesktopCapability();
      const result = module.saveModelProviderCapability(providerCapabilityContext(serverContext), input);
      await afterProviderWrite();
      return result;
    },
    async saveProviderModel(input: Parameters<ProviderDesktopCapabilityModule['saveModelProviderModelCapability']>[1]) {
      const module = await importProviderDesktopCapability();
      const result = module.saveModelProviderModelCapability(providerCapabilityContext(serverContext), input);
      await afterProviderWrite();
      return result;
    },
    async deleteProvider(provider: string) {
      const module = await importProviderDesktopCapability();
      const result = module.deleteModelProviderCapability(providerCapabilityContext(serverContext), provider);
      await afterProviderWrite();
      return result;
    },
    async deleteProviderModel(input: { provider: string; modelId: string }) {
      const module = await importProviderDesktopCapability();
      const result = module.deleteModelProviderModelCapability(providerCapabilityContext(serverContext), input.provider, input.modelId);
      await afterProviderWrite();
      return result;
    },
  };
}
