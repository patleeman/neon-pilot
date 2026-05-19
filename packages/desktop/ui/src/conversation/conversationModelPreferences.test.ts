import { describe, expect, it } from 'vitest';

import { resolveDraftModelPreferenceUpdate, resolveDraftThinkingPreferenceUpdate } from './conversationModelPreferences';

describe('conversationModelPreferences', () => {
  it('clears draft model storage when selecting the default model', () => {
    expect(resolveDraftModelPreferenceUpdate({ modelId: 'default-model', defaultModel: 'default-model' })).toEqual({
      storage: { kind: 'clear' },
      currentModel: 'default-model',
    });
  });

  it('persists draft model storage when selecting a non-default model', () => {
    expect(resolveDraftModelPreferenceUpdate({ modelId: 'claude', defaultModel: 'default-model' })).toEqual({
      storage: { kind: 'persist', value: 'claude' },
      currentModel: 'claude',
    });
  });

  it('normalizes draft thinking level selection against the default', () => {
    expect(resolveDraftThinkingPreferenceUpdate({ thinkingLevel: '', defaultThinkingLevel: 'medium' })).toEqual({
      storage: { kind: 'clear' },
      currentThinkingLevel: 'medium',
    });
    expect(resolveDraftThinkingPreferenceUpdate({ thinkingLevel: 'high', defaultThinkingLevel: 'medium' })).toEqual({
      storage: { kind: 'persist', value: 'high' },
      currentThinkingLevel: 'high',
    });
  });
});
