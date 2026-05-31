import { buildConversationServiceTierPreferenceInput } from './conversationInitialState';
import { resolveSelectableModel } from '../model/modelPreferences';

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
