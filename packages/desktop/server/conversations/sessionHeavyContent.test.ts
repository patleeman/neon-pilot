import { describe, expect, it } from 'vitest';

import { buildDeferredToolOutputPreview, deferHeavyBlockContent, findLastBlockIndex, resolveTailBlockLimit } from './sessionHeavyContent';

describe('sessionHeavyContent', () => {
  it('finds the last matching block index', () => {
    expect(findLastBlockIndex([1, 2, 3, 4], (value) => value % 2 === 0)).toBe(3);
    expect(findLastBlockIndex([1, 3], (value) => value % 2 === 0)).toBe(-1);
  });

  it('resolves tail block limits', () => {
    expect(resolveTailBlockLimit(undefined, 10)).toBeNull();
    expect(resolveTailBlockLimit(0, 10)).toBeNull();
    expect(resolveTailBlockLimit(5, 10)).toBe(5);
    expect(resolveTailBlockLimit(50, 10)).toBe(10);
  });

  it('builds deferred tool output previews', () => {
    expect(buildDeferredToolOutputPreview(' hello ', 10)).toBe('hello');
    expect(buildDeferredToolOutputPreview('abcdef', 4)).toBe('abc…');
  });

  it('defers heavy content outside the recent window', () => {
    const blocks = [
      { type: 'user', images: [{ src: '/image' }, { alt: 'no src' }] },
      { type: 'tool_use', output: 'abcdef' },
      { type: 'image', src: '/block-image' },
      { type: 'tool_use', output: 'recent output should remain long' },
    ];

    expect(
      deferHeavyBlockContent({
        blocks,
        blockOffset: 0,
        totalBlocks: 4,
        recentHeavyContentBlockCount: 1,
        deferredToolOutputPreviewLength: 4,
      }),
    ).toEqual([
      { type: 'user', images: [{ src: undefined, deferred: true }, { alt: 'no src' }] },
      { type: 'tool_use', output: 'abc…', outputDeferred: true },
      { type: 'image', src: undefined, deferred: true },
      { type: 'tool_use', output: 'recent output should remain long' },
    ]);
  });
});
