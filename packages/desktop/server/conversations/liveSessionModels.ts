import {
  type Api,
  type Context,
  type Model,
  type ProviderStreamOptions,
  type SimpleStreamOptions,
  stream,
  streamSimple,
} from '@earendil-works/pi-ai';
import { type AgentSession, type ModelRegistry, type SessionManager } from '@earendil-works/pi-coding-agent';

import { readSavedModelPreferences } from '../models/modelPreferences.js';
import { modelSupportsServiceTier } from '../models/modelServiceTiers.js';
import {
  type ConversationModelPreferenceState,
  readConversationModelPreferenceSnapshot,
  resolveConversationModelPreferenceState,
} from './conversationModelPreferences.js';

export function resolveConversationPreferenceStateForSession(
  settingsFile: string,
  sessionManager: Pick<SessionManager, 'buildSessionContext' | 'getBranch'>,
  availableModels: Model<Api>[],
): ConversationModelPreferenceState {
  return resolveConversationModelPreferenceState(
    readConversationModelPreferenceSnapshot(sessionManager),
    readSavedModelPreferences(settingsFile, availableModels),
    availableModels,
  );
}

export function buildConversationServiceTierPreferenceInput(
  state: Pick<ConversationModelPreferenceState, 'currentServiceTier' | 'hasExplicitServiceTier'>,
): string | null | undefined {
  if (!state.hasExplicitServiceTier) {
    return undefined;
  }

  return state.currentServiceTier || null;
}

function isOpencodeGoKimiThinkingModel(model: Model<Api>): boolean {
  return model.provider === 'opencode-go' && model.id === 'kimi-k2.6';
}

function removeDuplicateReasoningPayloadFields(payload: unknown, model: Model<Api>): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  if (!('reasoning_effort' in payload)) {
    return payload;
  }

  const payloadRecord = payload as Record<string, unknown>;
  if (isOpencodeGoKimiThinkingModel(model)) {
    const { reasoning_effort: reasoningEffort, ...safePayload } = payloadRecord;
    if (!('thinking' in safePayload)) {
      return { ...safePayload, thinking: { type: reasoningEffort ? 'enabled' : 'disabled' } };
    }
    return safePayload;
  }

  if (!('thinking' in payloadRecord)) {
    return payload;
  }

  const safePayload = { ...payloadRecord };
  delete safePayload.thinking;
  return safePayload;
}

function buildSafeProviderPayloadHook(onPayload: ProviderStreamOptions['onPayload'] | undefined): ProviderStreamOptions['onPayload'] {
  return async (payload, model) => {
    const nextPayload = onPayload ? await onPayload(payload, model) : undefined;
    return removeDuplicateReasoningPayloadFields(nextPayload === undefined ? payload : nextPayload, model);
  };
}

function buildServiceTierAwareStreamFn(modelRegistry: ModelRegistry, serviceTier: string) {
  return async (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => {
    const canonicalModel = modelRegistry.find(model.provider, model.id) ?? model;
    const auth = await modelRegistry.getApiKeyAndHeaders(canonicalModel);
    if (!auth.ok) {
      throw new Error(auth.error);
    }
    await runModelProfileStartupAction(canonicalModel);

    const mergedOptions: ProviderStreamOptions = {
      ...options,
      apiKey: auth.apiKey,
      headers: auth.headers || options?.headers ? { ...auth.headers, ...options?.headers } : undefined,
      onPayload: buildSafeProviderPayloadHook(options?.onPayload),
    };

    if (!serviceTier || !modelSupportsServiceTier(canonicalModel, serviceTier)) {
      return streamSimple(canonicalModel, context, mergedOptions);
    }

    const reasoningEffort =
      typeof (options as { reasoning?: unknown } | undefined)?.reasoning === 'string'
        ? (options as { reasoning: string }).reasoning
        : undefined;
    const streamOptions = { ...mergedOptions } as ProviderStreamOptions & { reasoning?: unknown };
    delete streamOptions.reasoning;

    return stream(canonicalModel, context, {
      ...streamOptions,
      reasoningEffort,
      serviceTier,
    });
  };
}

async function runModelProfileStartupAction(model: Model<Api>): Promise<void> {
  const { getExtensionHostClient } = await import('../extensions/extensionHostClient.js');
  const resolution = await getExtensionHostClient().resolveModelProfile({ provider: model.provider, model: model.id });
  if (resolution.kind !== 'resolved') return;

  const profile = resolution.profile as { extensionId?: unknown; startupAction?: unknown };
  const extensionId = typeof profile.extensionId === 'string' ? profile.extensionId : '';
  const actionId = typeof profile.startupAction === 'string' ? profile.startupAction : '';
  if (!extensionId || !actionId) return;

  const result = await getExtensionHostClient().invokeAction({
    extensionId,
    actionId,
    input: { provider: model.provider, model: model.id },
  });
  if (!result.ok) {
    throw new Error(result.error || `Model runtime startup action failed: ${extensionId}/${actionId}`);
  }
}

export function applyLiveSessionServiceTier(session: AgentSession, serviceTier: string): void {
  session.agent.onPayload = buildSafeProviderPayloadHook(session.agent.onPayload);
  session.agent.streamFn = buildServiceTierAwareStreamFn(session.modelRegistry, serviceTier);
}

export async function repairSessionModelProvider(
  session: Pick<AgentSession, 'setModel' | 'sessionManager' | 'model'>,
  models: ReturnType<ModelRegistry['getAvailable']>,
  modelRegistry?: ModelRegistry,
): Promise<void> {
  const currentId = session.model?.id ?? '';
  const currentProvider = (session.model as { provider?: string } | undefined)?.provider ?? '';
  if (!currentId) {
    return;
  }

  const exactMatch = models.find((candidate) => candidate.id === currentId && candidate.provider === currentProvider);
  if (exactMatch) {
    return;
  }

  const idMatches = models.filter((candidate) => candidate.id === currentId);
  if (idMatches.length !== 1) {
    // Model isn't available (auth may not be ready yet, e.g. OAuth needs refresh).
    // Try to restore the full model capabilities (input, reasoning, etc.) from
    // the full registry so the session doesn't lose vision support on restart.
    if (modelRegistry && typeof modelRegistry.find === 'function') {
      const fullModel = modelRegistry.find(currentProvider, currentId);
      if (fullModel && !('input' in (session.model ?? {}))) {
        // The current model is a partial {provider, modelId} restored from
        // transcript. Replace it with the full registry model to restore
        // capabilities without triggering auth checks.
        try {
          await session.setModel(fullModel);
          session.sessionManager.appendModelChange(fullModel.provider, fullModel.id);
          return;
        } catch {
          // Auth isn't ready yet — setModel would fail. Fall through to leave
          // the partial model in place; the first API call will re-auth.
        }
      }
    }
    return;
  }

  const repairedModel = idMatches[0]!;
  await session.setModel(repairedModel);
  session.sessionManager.appendModelChange(repairedModel.provider, repairedModel.id);
}
