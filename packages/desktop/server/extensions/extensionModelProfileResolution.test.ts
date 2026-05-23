import { describe, expect, it } from 'vitest';

import { globMatches, resolveExtensionModelProfileFromRegistrations } from './extensionModelProfileResolution';

describe('extensionModelProfileResolution', () => {
  it('matches globs case-insensitively while escaping regex characters', () => {
    expect(globMatches('openai/gpt-*', 'OpenAI/GPT-5')).toBe(true);
    expect(globMatches('openai/gpt-5.1', 'openai/gpt-5x1')).toBe(false);
  });

  it('resolves highest-priority matching model profile', () => {
    const profiles = [
      { extensionId: 'b', match: ['openai/*'], priority: 1, id: 'b' },
      { extensionId: 'a', match: ['openai/gpt-*'], priority: 2, id: 'a' },
    ];
    expect(resolveExtensionModelProfileFromRegistrations({ provider: 'openai', model: 'gpt-5', profiles })).toEqual({
      kind: 'resolved',
      profile: profiles[1],
    });
  });

  it('reports none or ambiguous matches', () => {
    expect(resolveExtensionModelProfileFromRegistrations({ provider: 'anthropic', model: 'claude', profiles: [] })).toEqual({
      kind: 'none',
    });
    const profiles = [
      { extensionId: 'b', match: ['openai/*'], priority: 1, id: 'b' },
      { extensionId: 'a', match: ['openai/gpt-*'], priority: 1, id: 'a' },
    ];
    expect(resolveExtensionModelProfileFromRegistrations({ provider: 'openai', model: 'gpt-5', profiles })).toEqual({
      kind: 'ambiguous',
      profiles: [profiles[1], profiles[0]],
    });
  });
});
