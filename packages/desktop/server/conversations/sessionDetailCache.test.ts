import { describe, expect, it } from 'vitest';

import { buildSessionDetailCacheKey, normalizeTailBlockRequest, trimSessionDetailCache } from './sessionDetailCache';

describe('sessionDetailCache', () => {
  it('normalizes tail block requests', () => {
    expect(normalizeTailBlockRequest({ tailBlocks: undefined, maxTailBlocks: 100 })).toBeUndefined();
    expect(normalizeTailBlockRequest({ tailBlocks: 0, maxTailBlocks: 100 })).toBeUndefined();
    expect(normalizeTailBlockRequest({ tailBlocks: 25.5, maxTailBlocks: 100 })).toBeUndefined();
    expect(normalizeTailBlockRequest({ tailBlocks: 25, maxTailBlocks: 100 })).toBe(25);
    expect(normalizeTailBlockRequest({ tailBlocks: 250, maxTailBlocks: 100 })).toBe(100);
  });

  it('builds cache keys', () => {
    expect(buildSessionDetailCacheKey('/sessions/a.jsonl')).toBe('/sessions/a.jsonl::all');
    expect(buildSessionDetailCacheKey('/sessions/a.jsonl', 50)).toBe('/sessions/a.jsonl::50');
  });

  it('trims oldest cache entries', () => {
    const cache = new Map<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);

    trimSessionDetailCache(cache, 2);
    expect([...cache.entries()]).toEqual([
      ['b', 2],
      ['c', 3],
    ]);
  });
});
