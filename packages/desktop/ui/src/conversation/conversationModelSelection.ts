import { buildConversationServiceTierPreferenceInput } from './conversationInitialState';

export function selectComposerModel<TModel extends { id: string }>(
  models: TModel[],
  currentModel: string,
  defaultModel: string,
): TModel | null {
  return models.find((model) => model.id === (currentModel || defaultModel)) ?? null;
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
