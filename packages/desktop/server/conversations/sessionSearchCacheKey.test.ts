import { describe, expect, it } from 'vitest';

import { buildSessionSearchTextCacheKey, normalizeSessionSearchMaxCharacters } from './sessionSearchCacheKey';

describe('sessionSearchCacheKey', () => {
  it('normalizes max character counts to non-negative values', () => {
    expect(normalizeSessionSearchMaxCharacters(120)).toBe(120);
    expect(normalizeSessionSearchMaxCharacters(-1)).toBe(0);
  });

  it('builds cache keys with normalized max character counts', () => {
    expect(buildSessionSearchTextCacheKey('/tmp/session.jsonl', 12)).toBe('/tmp/session.jsonl:12');
    expect(buildSessionSearchTextCacheKey('/tmp/session.jsonl', -12)).toBe('/tmp/session.jsonl:0');
  });
});
