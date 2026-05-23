import { describe, expect, it } from 'vitest';

import { rebaseDisplayBlockIds, rewriteIndexedBlockId } from './sessionBlockIds';

describe('sessionBlockIds', () => {
  it('rewrites trailing indexed ids for a block kind', () => {
    expect(rewriteIndexedBlockId('abc-x12', 'x', 20)).toBe('abc-x20');
    expect(rewriteIndexedBlockId('abc-t12', 'x', 20)).toBe('abc-t12');
  });

  it('rebases indexed ids by block offset for rebasable block types', () => {
    const blocks = [
      { type: 'context', id: 'm-m0' },
      { type: 'thinking', id: 'm-t1' },
      { type: 'text', id: 'm-x2' },
      { type: 'tool_use', id: 'm-c3' },
      { type: 'error', id: 'm-e4' },
      { type: 'image', id: 'm-i5', alt: 'Injected context image' },
      { type: 'image', id: 'keep-i6', alt: 'User image' },
      { type: 'summary', id: 'keep' },
    ];

    expect(rebaseDisplayBlockIds(blocks, 10).map((block) => block.id)).toEqual([
      'm-m10',
      'm-t11',
      'm-x12',
      'm-c13',
      'm-e14',
      'm-i15',
      'keep-i6',
      'keep',
    ]);
  });

  it('returns the original block array when offset is not positive', () => {
    const blocks = [{ type: 'text', id: 'm-x0' }];
    expect(rebaseDisplayBlockIds(blocks, 0)).toBe(blocks);
  });
});
