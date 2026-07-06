import { createModelRegistryForAuthFile } from '../models/modelRegistry.js';
import { invalidateModelDefinitionsCache, readModelState } from '../models/modelState.js';
import { readProviderAuthState } from '../models/providerAuth.js';
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

const PROVIDERS_REQUIRING_CREDENTIAL = new Set([
  'anthropic',
  'azure-openai-responses',
  'cerebras',
  'google',
  'groq',
  'huggingface',
  'kimi-coding',
  'minimax',
  'minimax-cn',
  'mistral',
  'openai',
  'openai-codex',
  'openrouter',
  'xai',
  'zai',
]);
const PROVIDERS_REQUIRING_API_KEY_AUTH_TYPE = new Set(['openai-codex']);

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

function hasResolvedCredential(result: unknown): boolean {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return false;
  }
  const record = result as { apiKey?: unknown; headers?: unknown };
  if (typeof record.apiKey === 'string' && record.apiKey.trim()) {
    return true;
  }
  if (record.headers && typeof record.headers === 'object' && !Array.isArray(record.headers)) {
    return Object.keys(record.headers).length > 0;
  }
  return false;
}

async function modelAuthConfiguredKeys(serverContext?: ExtensionBackendServerContext): Promise<Set<string> | null> {
  const authFile = serverContext?.getAuthFile?.();
  if (!authFile) {
    return null;
  }

  try {
    const registry = createModelRegistryForAuthFile(authFile);
    const authState = readProviderAuthState(authFile, serverContext?.getStateRoot?.());
    const providerAuthTypes = new Map(
      authState.providers
        .filter((provider) => provider.hasStoredCredential || provider.authType === 'environment')
        .map((provider) => [provider.id, provider.authType]),
    );
    const models = registry.getAll();
    const keys = new Set<string>();
    await Promise.all(
      models.map(async (model) => {
        const provider = typeof model.provider === 'string' ? model.provider : '';
        const id = typeof model.id === 'string' ? model.id : '';
        if (!provider || !id) return;
        const authType = providerAuthTypes.get(provider);
        if (PROVIDERS_REQUIRING_CREDENTIAL.has(provider) && !authType) return;
        if (PROVIDERS_REQUIRING_API_KEY_AUTH_TYPE.has(provider) && authType !== 'api_key') return;
        const result = await registry.getApiKeyAndHeaders(model);
        if (!result.ok) return;
        if (PROVIDERS_REQUIRING_CREDENTIAL.has(provider) && !hasResolvedCredential(result)) return;
        keys.add(`${provider}\0${id}`);
      }),
    );
    return keys;
  } catch {
    return null;
  }
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
        const authConfiguredKeys = await modelAuthConfiguredKeys(serverContext);
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
            authConfigured: authConfiguredKeys ? authConfiguredKeys.has(`${m.provider ?? ''}\0${m.id ?? ''}`) : true,
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
