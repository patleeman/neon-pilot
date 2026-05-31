import { refreshAllLiveSessionModelRegistries, reloadAllLiveSessionAuth } from '../middleware/index.js';
import { createModelRegistryForAuthFile } from './modelRegistry.js';
import type { ModelProviderApi, ModelProviderModelConfig, ModelProviderState } from './modelProviders.js';
import {
  readModelProvidersState,
  removeModelProvider,
  removeModelProviderModel,
  upsertModelProvider,
  upsertModelProviderModel,
} from './modelProviders.js';
import type { ProviderAuthState, ProviderOAuthLoginState } from './providerAuth.js';
import {
  cancelProviderOAuthLogin,
  getProviderOAuthLoginState,
  readProviderAuthState,
  removeProviderCredential,
  setProviderApiKey,
  startProviderOAuthLogin,
  submitProviderOAuthLoginInput,
} from './providerAuth.js';

export interface ProviderDesktopCapabilityContext {
  getRuntimeScope: () => string;
  materializeWebRuntimeConfig: (profile: string) => void;
  getAuthFile: () => string;
  getStateRoot?: () => string;
}

class ProviderDesktopCapabilityInputError extends Error {}

function runtimeScope(context: ProviderDesktopCapabilityContext): string {
  return context.getRuntimeScope();
}

function materialize(context: ProviderDesktopCapabilityContext): void {
  context.materializeWebRuntimeConfig(runtimeScope(context));
}

const MAX_MODEL_TOKEN_LIMIT = 10_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_MODEL_TOKEN_LIMIT ? value : undefined;
}

function readOptionalNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER && value >= 0 ? value : undefined;
}

function readOptionalStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => typeof entryValue === 'string')
    .map(([key, entryValue]) => [key, (entryValue as string).trim()] as const)
    .filter(([, entryValue]) => entryValue.length > 0);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function readOptionalObject(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.keys(value).length > 0 ? value : undefined;
}

function readModelInputs(value: unknown): Array<'text' | 'image'> {
  if (!Array.isArray(value)) {
    return ['text'];
  }

  const inputs = value.filter((entry): entry is 'text' | 'image' => entry === 'text' || entry === 'image');
  if (inputs.length === 0) {
    return ['text'];
  }

  return inputs.includes('image') ? ['text', 'image'] : ['text'];
}

function readCost(value: unknown): ModelProviderModelConfig['cost'] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const input = readOptionalNonNegativeNumber(value.input);
  const output = readOptionalNonNegativeNumber(value.output);
  const cacheRead = readOptionalNonNegativeNumber(value.cacheRead);
  const cacheWrite = readOptionalNonNegativeNumber(value.cacheWrite);

  if (input === undefined && output === undefined && cacheRead === undefined && cacheWrite === undefined) {
    return undefined;
  }

  return {
    input: input ?? 0,
    output: output ?? 0,
    cacheRead: cacheRead ?? 0,
    cacheWrite: cacheWrite ?? 0,
  };
}

function readModelApi(value: unknown): ModelProviderApi | undefined {
  const api = readOptionalString(value);
  if (!api) {
    return undefined;
  }

  if (
    api === 'openai-completions' ||
    api === 'openai-responses' ||
    api === 'anthropic-messages' ||
    api === 'google-generative-ai'
  ) {
    return api;
  }

  return undefined;
}

function buildProviderDefaultModels(authFile: string, providerId: string): ModelProviderModelConfig[] {
  const registry = createModelRegistryForAuthFile(authFile);
  const providerModels = new Map<string, ModelProviderModelConfig>();

  for (const model of registry.getAll()) {
    if (model.provider !== providerId) {
      continue;
    }

    const modelId = readOptionalString(model.id);
    if (!modelId) {
      continue;
    }

    providerModels.set(modelId, {
      id: modelId,
      name: readOptionalString(model.name) ?? modelId,
      api: readModelApi(model.api),
      baseUrl: readOptionalString(model.baseUrl),
      reasoning: model.reasoning === true,
      input: readModelInputs(model.input),
      contextWindow: readOptionalPositiveInteger(model.contextWindow),
      maxTokens: readOptionalPositiveInteger(model.maxTokens),
      headers: readOptionalStringRecord(model.headers),
      cost: readCost((model as { cost?: unknown }).cost),
      compat: readOptionalObject((model as { compat?: unknown }).compat),
    });
  }

  return [...providerModels.values()];
}

function seedProviderDefaults(
  scope: string,
  providerId: string,
  authFile: string,
  state: ModelProviderState,
): ModelProviderState {
  const defaults = buildProviderDefaultModels(authFile, providerId);
  if (defaults.length === 0) {
    return state;
  }

  let next = state;
  for (const model of defaults) {
    const { id, ...update } = model;
    next = upsertModelProviderModel(scope, providerId, id, {
      name: update.name,
      api: update.api,
      baseUrl: update.baseUrl,
      reasoning: update.reasoning,
      input: update.input,
      contextWindow: update.contextWindow,
      maxTokens: update.maxTokens,
      headers: update.headers,
      cost: update.cost,
      compat: update.compat,
    });
  }

  return next;
}

function autoSeedProviderModelsForApiKey(scope: string, provider: string, authFile: string): boolean {
  const providersState = readModelProvidersState(scope);
  const providerState = providersState.providers.find((candidate) => candidate.id === provider);

  if (providerState && providerState.models.length > 0) {
    return false;
  }

  const defaults = buildProviderDefaultModels(authFile, provider);
  if (defaults.length === 0) {
    return false;
  }

  const stateWithProvider = providerState ? providersState : upsertModelProvider(scope, provider, {});
  const nextState = seedProviderDefaults(scope, provider, authFile, stateWithProvider);
  return nextState.providers.find((candidate) => candidate.id === provider)?.models.length !== 0;
}

export function readModelProvidersCapability(context: ProviderDesktopCapabilityContext): ModelProviderState {
  return readModelProvidersState(runtimeScope(context));
}

export function saveModelProviderCapability(
  context: ProviderDesktopCapabilityContext,
  input: {
    provider: string;
    baseUrl?: string;
    api?: string;
    apiKey?: string;
    authHeader?: boolean;
    headers?: Record<string, string>;
    compat?: Record<string, unknown>;
    modelOverrides?: Record<string, unknown>;
  },
): ModelProviderState {
  const provider = input.provider.trim();
  if (!provider) {
    throw new ProviderDesktopCapabilityInputError('provider required');
  }

  const state = upsertModelProvider(runtimeScope(context), provider, {
    baseUrl: input.baseUrl,
    api: input.api as Parameters<typeof upsertModelProvider>[2]['api'],
    apiKey: input.apiKey,
    authHeader: input.authHeader,
    headers: input.headers,
    compat: input.compat,
    modelOverrides: input.modelOverrides,
  });
  const shouldAutoPopulateModels =
    Boolean(input.apiKey && input.apiKey.trim().length > 0) &&
    state.providers.find((candidate) => candidate.id === provider)?.models.length === 0;
  const stateWithModels = shouldAutoPopulateModels
    ? seedProviderDefaults(runtimeScope(context), provider, context.getAuthFile(), state)
    : state;

  materialize(context);
  refreshAllLiveSessionModelRegistries();
  return stateWithModels;
}

export function deleteModelProviderCapability(context: ProviderDesktopCapabilityContext, providerInput: string): ModelProviderState {
  const provider = providerInput.trim();
  if (!provider) {
    throw new ProviderDesktopCapabilityInputError('provider required');
  }

  const result = removeModelProvider(runtimeScope(context), provider);
  materialize(context);
  refreshAllLiveSessionModelRegistries();
  return result.state;
}

export function saveModelProviderModelCapability(
  context: ProviderDesktopCapabilityContext,
  input: {
    provider: string;
    modelId: string;
    name?: string;
    api?: string;
    baseUrl?: string;
    reasoning?: boolean;
    input?: Array<'text' | 'image'>;
    contextWindow?: number;
    maxTokens?: number;
    headers?: Record<string, string>;
    cost?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
    };
    compat?: Record<string, unknown>;
  },
): ModelProviderState {
  const provider = input.provider.trim();
  if (!provider) {
    throw new ProviderDesktopCapabilityInputError('provider required');
  }

  const modelId = input.modelId.trim();
  if (!modelId) {
    throw new ProviderDesktopCapabilityInputError('modelId required');
  }

  const state = upsertModelProviderModel(runtimeScope(context), provider, modelId, {
    name: input.name,
    api: input.api as Parameters<typeof upsertModelProviderModel>[3]['api'],
    baseUrl: input.baseUrl,
    reasoning: input.reasoning,
    input: input.input,
    contextWindow: input.contextWindow,
    maxTokens: input.maxTokens,
    headers: input.headers,
    cost: input.cost,
    compat: input.compat,
  });
  materialize(context);
  refreshAllLiveSessionModelRegistries();
  return state;
}

export function deleteModelProviderModelCapability(
  context: ProviderDesktopCapabilityContext,
  providerInput: string,
  modelIdInput: string,
): ModelProviderState {
  const provider = providerInput.trim();
  if (!provider) {
    throw new ProviderDesktopCapabilityInputError('provider required');
  }

  const modelId = modelIdInput.trim();
  if (!modelId) {
    throw new ProviderDesktopCapabilityInputError('modelId required');
  }

  const result = removeModelProviderModel(runtimeScope(context), provider, modelId);
  materialize(context);
  refreshAllLiveSessionModelRegistries();
  return result.state;
}

export async function readProviderAuthCapability(context: ProviderDesktopCapabilityContext): Promise<ProviderAuthState> {
  return readProviderAuthState(context.getAuthFile(), context.getStateRoot?.());
}

export async function setProviderApiKeyCapability(
  context: ProviderDesktopCapabilityContext,
  providerInput: string,
  apiKeyInput: string,
): Promise<ProviderAuthState> {
  const provider = providerInput.trim();
  if (!provider) {
    throw new ProviderDesktopCapabilityInputError('provider required');
  }

  const apiKey = apiKeyInput.trim();
  if (!apiKey) {
    throw new ProviderDesktopCapabilityInputError('apiKey required');
  }

  const state = await setProviderApiKey(context.getAuthFile(), provider, apiKey, context.getStateRoot?.());
  const didSeedDefaults = autoSeedProviderModelsForApiKey(runtimeScope(context), provider, context.getAuthFile());

  if (didSeedDefaults) {
    materialize(context);
    refreshAllLiveSessionModelRegistries();
  }

  reloadAllLiveSessionAuth();
  return state;
}

export async function removeProviderCredentialCapability(
  context: ProviderDesktopCapabilityContext,
  providerInput: string,
): Promise<ProviderAuthState> {
  const provider = providerInput.trim();
  if (!provider) {
    throw new ProviderDesktopCapabilityInputError('provider required');
  }

  const state = await removeProviderCredential(context.getAuthFile(), provider, context.getStateRoot?.());
  reloadAllLiveSessionAuth();
  return state;
}

export function startProviderOAuthLoginCapability(
  context: ProviderDesktopCapabilityContext,
  providerInput: string,
): ProviderOAuthLoginState {
  return startProviderOAuthLogin(context.getAuthFile(), providerInput);
}

export function readProviderOAuthLoginCapability(loginId: string): ProviderOAuthLoginState | null {
  return getProviderOAuthLoginState(loginId);
}

export function submitProviderOAuthLoginInputCapability(loginId: string, value: string): ProviderOAuthLoginState {
  return submitProviderOAuthLoginInput(loginId, value);
}

export function cancelProviderOAuthLoginCapability(loginId: string): ProviderOAuthLoginState {
  return cancelProviderOAuthLogin(loginId);
}
