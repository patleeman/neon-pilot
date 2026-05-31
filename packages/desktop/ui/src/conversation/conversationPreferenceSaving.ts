import { getModelSelectionValue, resolveSelectableModel } from '../model/modelPreferences';

export function shouldSkipModelPreferenceSave(input: {
  modelId: string;
  currentModel: string;
  savingPreference: string | null;
  models?: Array<{ id: string; provider?: string }>;
}): boolean {
  if (!input.modelId || input.savingPreference !== null) {
    return true;
  }

  if (input.models) {
    const requestedModel = resolveSelectableModel(input.models, input.modelId);
    const currentModel = resolveSelectableModel(input.models, input.currentModel);
    if (requestedModel && currentModel) {
      return getModelSelectionValue(requestedModel, input.models) === getModelSelectionValue(currentModel, input.models);
    }
  }

  return input.modelId === input.currentModel;
}

export function shouldSkipThinkingPreferenceSave(input: {
  thinkingLevel: string;
  currentThinkingLevel: string;
  savingPreference: string | null;
}): boolean {
  return input.thinkingLevel === input.currentThinkingLevel || input.savingPreference !== null;
}

export function shouldEnsureControlForPreferenceSave(input: { isLiveSession: boolean; conversationId: string | undefined }): boolean {
  return Boolean(input.conversationId && input.isLiveSession);
}

export function resolveSelectedModelNotice<TModel extends { id: string; provider?: string; name: string }>(
  models: TModel[],
  modelId: string,
): string | null {
  const selectedModel = resolveSelectableModel(models, modelId);
  return selectedModel ? `Model set to ${selectedModel.name} for this conversation.` : null;
}

export function shouldClearComposerForModelSelection(showModelPicker: boolean): boolean {
  return showModelPicker;
}
