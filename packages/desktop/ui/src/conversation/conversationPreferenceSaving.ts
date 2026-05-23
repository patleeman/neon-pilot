export function shouldSkipModelPreferenceSave(input: { modelId: string; currentModel: string; savingPreference: string | null }): boolean {
  return !input.modelId || input.modelId === input.currentModel || input.savingPreference !== null;
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

export function resolveSelectedModelNotice<TModel extends { id: string; name: string }>(models: TModel[], modelId: string): string | null {
  const selectedModel = models.find((candidate) => candidate.id === modelId);
  return selectedModel ? `Model set to ${selectedModel.name} for this conversation.` : null;
}

export function shouldClearComposerForModelSelection(showModelPicker: boolean): boolean {
  return showModelPicker;
}
