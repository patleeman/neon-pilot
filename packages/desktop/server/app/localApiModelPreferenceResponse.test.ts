import { describe, expect, it } from 'vitest';

import { buildDesktopMutationOkResponse, buildSavedModelPreferencePatch } from './localApiModelPreferenceResponse';

describe('localApiModelPreferenceResponse', () => {
  it('builds a standard ok mutation response', () => {
    expect(buildDesktopMutationOkResponse()).toEqual({ ok: true });
  });

  it('builds the saved model preference patch preserving explicit nulls and undefineds', () => {
    expect(buildSavedModelPreferencePatch({ model: 'm1', visionModel: null })).toEqual({
      model: 'm1',
      visionModel: null,
      thinkingLevel: undefined,
      serviceTier: undefined,
    });
  });
});
