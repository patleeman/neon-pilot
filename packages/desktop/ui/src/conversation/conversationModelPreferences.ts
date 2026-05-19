type DraftPreferenceStorageAction = { kind: 'clear' } | { kind: 'persist'; value: string };

export interface DraftModelPreferenceUpdate {
  storage: DraftPreferenceStorageAction;
  currentModel: string;
}

export interface DraftThinkingPreferenceUpdate {
  storage: DraftPreferenceStorageAction;
  currentThinkingLevel: string;
}

export function resolveDraftModelPreferenceUpdate(input: { modelId: string; defaultModel: string }): DraftModelPreferenceUpdate {
  return {
    storage: input.modelId === input.defaultModel ? { kind: 'clear' } : { kind: 'persist', value: input.modelId },
    currentModel: input.modelId,
  };
}

export function resolveDraftThinkingPreferenceUpdate(input: {
  thinkingLevel: string;
  defaultThinkingLevel: string;
}): DraftThinkingPreferenceUpdate {
  const currentThinkingLevel = input.thinkingLevel || input.defaultThinkingLevel;

  return {
    storage:
      !input.thinkingLevel || input.thinkingLevel === input.defaultThinkingLevel
        ? { kind: 'clear' }
        : { kind: 'persist', value: input.thinkingLevel },
    currentThinkingLevel,
  };
}
