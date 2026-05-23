import { describe, expect, it } from 'vitest';

import { validateDesktopModelPreferenceUpdate } from './localApiModelPreferences';

describe('localApiModelPreferences', () => {
  it('accepts any string preference field', () => {
    expect(() => validateDesktopModelPreferenceUpdate({ model: 'gpt' })).not.toThrow();
    expect(() => validateDesktopModelPreferenceUpdate({ visionModel: 'vision' })).not.toThrow();
    expect(() => validateDesktopModelPreferenceUpdate({ thinkingLevel: 'low' })).not.toThrow();
    expect(() => validateDesktopModelPreferenceUpdate({ serviceTier: 'priority' })).not.toThrow();
  });

  it('rejects updates without a string preference field', () => {
    expect(() => validateDesktopModelPreferenceUpdate({})).toThrow('model, visionModel, thinkingLevel, or serviceTier required');
    expect(() => validateDesktopModelPreferenceUpdate({ model: null, thinkingLevel: null })).toThrow(
      'model, visionModel, thinkingLevel, or serviceTier required',
    );
  });
});
