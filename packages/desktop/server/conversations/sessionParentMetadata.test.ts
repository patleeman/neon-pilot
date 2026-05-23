import { describe, expect, it } from 'vitest';

import { mergeResolvedParentSessionMetadata } from './sessionParentMetadata';

describe('sessionParentMetadata', () => {
  it('returns the original meta when parent metadata is unchanged', () => {
    const meta = { id: 's1', parentSessionFile: '/parent.jsonl', parentSessionId: 'parent' };
    expect(mergeResolvedParentSessionMetadata(meta, { parentSessionFile: '/parent.jsonl', parentSessionId: 'parent' })).toBe(meta);
  });

  it('adds resolved parent metadata when present', () => {
    expect(mergeResolvedParentSessionMetadata({ id: 's1' }, { parentSessionFile: '/parent.jsonl', parentSessionId: 'parent' })).toEqual({
      id: 's1',
      parentSessionFile: '/parent.jsonl',
      parentSessionId: 'parent',
    });
  });

  it('does not overwrite with empty parent metadata', () => {
    expect(mergeResolvedParentSessionMetadata({ id: 's1', parentSessionFile: '/old.jsonl', parentSessionId: 'old' }, {})).toEqual({
      id: 's1',
      parentSessionFile: '/old.jsonl',
      parentSessionId: 'old',
    });
  });
});
