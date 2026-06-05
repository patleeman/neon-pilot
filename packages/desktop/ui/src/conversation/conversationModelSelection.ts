import { buildConversationServiceTierPreferenceInput } from './conversationInitialState';
import { resolveSelectableModel, resolveSelectableModelId } from '../model/modelPreferences';

export function selectComposerModel<TModel extends { id: string; provider?: string }>(
  models: TModel[],
  currentModel: string,
  defaultModel: string,
): TModel | null {
  return resolveSelectableModel(models, currentModel || defaultModel);
}

export function buildLiveSessionPreferenceInput(input: {
  resolvedCurrentModelId: string | null | undefined;
  currentThinkingLevel: string;
  currentServiceTier: string;
  hasExplicitServiceTier: boolean;
}): { model?: string; thinkingLevel?: string; serviceTier?: string } {
  return {
    ...(input.resolvedCurrentModelId ? { model: input.resolvedCurrentModelId } : {}),
    ...(input.currentThinkingLevel ? { thinkingLevel: input.currentThinkingLevel } : {}),
    ...buildConversationServiceTierPreferenceInput({
      currentServiceTier: input.currentServiceTier,
      hasExplicitServiceTier: input.hasExplicitServiceTier,
    }),
  };
}

export function resolveDraftComposerModelId<TModel extends { id: string; provider?: string }>(input: {
  storedDraftModel: string;
  defaultModel: string;
  models: TModel[];
}): string {
  const storedDraftModel = input.storedDraftModel.trim();
  if (input.models.length === 0) {
    return storedDraftModel || input.defaultModel.trim();
  }

  return resolveSelectableModelId({
    requestedModel: storedDraftModel,
    defaultModel: input.defaultModel,
    models: input.models,
  });
}
