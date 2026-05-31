import { describe, expect, it } from 'vitest';

import {
  resolveSelectedModelNotice,
  shouldClearComposerForModelSelection,
  shouldEnsureControlForPreferenceSave,
  shouldSkipModelPreferenceSave,
  shouldSkipThinkingPreferenceSave,
} from './conversationPreferenceSaving';

describe('conversationPreferenceSaving', () => {
  it('detects skipped preference saves', () => {
    expect(shouldSkipModelPreferenceSave({ modelId: '', currentModel: 'a', savingPreference: null })).toBe(true);
    expect(shouldSkipModelPreferenceSave({ modelId: 'a', currentModel: 'a', savingPreference: null })).toBe(true);
    expect(shouldSkipModelPreferenceSave({ modelId: 'b', currentModel: 'a', savingPreference: 'model' })).toBe(true);
    expect(shouldSkipModelPreferenceSave({ modelId: 'b', currentModel: 'a', savingPreference: null })).toBe(false);
    expect(shouldSkipThinkingPreferenceSave({ thinkingLevel: 'low', currentThinkingLevel: 'low', savingPreference: null })).toBe(true);
    expect(shouldSkipThinkingPreferenceSave({ thinkingLevel: 'high', currentThinkingLevel: 'low', savingPreference: null })).toBe(false);
  });

  it('resolves control and selection affordances', () => {
    expect(shouldEnsureControlForPreferenceSave({ isLiveSession: true, conversationId: 'conv' })).toBe(true);
    expect(shouldEnsureControlForPreferenceSave({ isLiveSession: false, conversationId: 'conv' })).toBe(false);
    expect(resolveSelectedModelNotice([{ id: 'gpt', name: 'GPT' }], 'gpt')).toBe('Model set to GPT for this conversation.');
    expect(resolveSelectedModelNotice([{ id: 'gpt', name: 'GPT' }], 'missing')).toBeNull();
    expect(shouldClearComposerForModelSelection(true)).toBe(true);
  });

  it('compares and reports provider-qualified model selections', () => {
    const models = [
      { id: 'deepseek-v4-flash', provider: 'opencode-go', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-flash', provider: 'ds4', name: 'DeepSeek V4 Flash (ds4.c local)' },
    ];

    expect(
      shouldSkipModelPreferenceSave({
        modelId: 'ds4/deepseek-v4-flash',
        currentModel: 'ds4/deepseek-v4-flash',
        savingPreference: null,
        models,
      }),
    ).toBe(true);
    expect(
      shouldSkipModelPreferenceSave({
        modelId: 'opencode-go/deepseek-v4-flash',
        currentModel: 'ds4/deepseek-v4-flash',
        savingPreference: null,
        models,
      }),
    ).toBe(false);
    expect(resolveSelectedModelNotice(models, 'ds4/deepseek-v4-flash')).toBe(
      'Model set to DeepSeek V4 Flash (ds4.c local) for this conversation.',
    );
  });
});
