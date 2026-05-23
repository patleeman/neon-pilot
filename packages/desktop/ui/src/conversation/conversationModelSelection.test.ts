import { describe, expect, it } from 'vitest';

import { buildLiveSessionPreferenceInput, selectComposerModel } from './conversationModelSelection';

describe('conversationModelSelection', () => {
  it('selects the current model or falls back to default', () => {
    const models = [{ id: 'default' }, { id: 'current' }];
    expect(selectComposerModel(models, 'current', 'default')).toBe(models[1]);
    expect(selectComposerModel(models, '', 'default')).toBe(models[0]);
    expect(selectComposerModel(models, 'missing', 'default')).toBeNull();
  });

  it('builds live session preference input from explicit values', () => {
    expect(
      buildLiveSessionPreferenceInput({
        resolvedCurrentModelId: 'model-1',
        currentThinkingLevel: 'high',
        currentServiceTier: 'flex',
        hasExplicitServiceTier: true,
      }),
    ).toEqual({ model: 'model-1', thinkingLevel: 'high', serviceTier: 'flex' });
    expect(
      buildLiveSessionPreferenceInput({
        resolvedCurrentModelId: null,
        currentThinkingLevel: '',
        currentServiceTier: 'flex',
        hasExplicitServiceTier: false,
      }),
    ).toEqual({});
  });
});
