import { describe, expect, it } from 'vitest';

import type { DictationSettings } from './types.js';

describe('local dictation public types', () => {
  it('keeps the settings shape assignable', () => {
    const settings: DictationSettings = { model: 'whisper-tiny' };

    expect(settings).toEqual({ model: 'whisper-tiny' });
  });
});
