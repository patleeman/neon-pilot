import { describe, expect, it } from 'vitest';

import { buildAppendOnlySessionDetailResponse, normalizeKnownBlockId } from './sessionAppendOnly';

describe('sessionAppendOnly', () => {
  const detail = {
    meta: { id: 's1' },
    blocks: [{ id: 'b0' }, { id: 'b1' }, { id: 'b2' }],
    blockOffset: 0,
    totalBlocks: 3,
    contextUsage: { total: 1 },
    signature: 'sig',
  };

  it('normalizes known block ids', () => {
    expect(normalizeKnownBlockId(' b1 ')).toBe('b1');
    expect(normalizeKnownBlockId('   ')).toBeNull();
    expect(normalizeKnownBlockId(undefined)).toBeNull();
  });

  it('returns null when known counters are invalid or not behind', () => {
    expect(buildAppendOnlySessionDetailResponse({ detail })).toBeNull();
    expect(buildAppendOnlySessionDetailResponse({ detail, knownBlockOffset: 0, knownTotalBlocks: 3, knownLastBlockId: 'b2' })).toBeNull();
    expect(buildAppendOnlySessionDetailResponse({ detail, knownBlockOffset: 2, knownTotalBlocks: 1, knownLastBlockId: 'b0' })).toBeNull();
  });

  it('returns appended blocks after validating the known last visible block', () => {
    expect(buildAppendOnlySessionDetailResponse({ detail, knownBlockOffset: 0, knownTotalBlocks: 2, knownLastBlockId: 'b1' })).toEqual({
      appendOnly: true,
      meta: { id: 's1' },
      blocks: [{ id: 'b2' }],
      blockOffset: 0,
      totalBlocks: 3,
      contextUsage: { total: 1 },
      signature: 'sig',
    });
    expect(
      buildAppendOnlySessionDetailResponse({ detail, knownBlockOffset: 0, knownTotalBlocks: 2, knownLastBlockId: 'wrong' }),
    ).toBeNull();
  });

  it('allows append-only response when known total is before current tail window', () => {
    expect(
      buildAppendOnlySessionDetailResponse({
        detail: { ...detail, blocks: [{ id: 'b10' }, { id: 'b11' }], blockOffset: 10, totalBlocks: 12, signature: undefined },
        knownBlockOffset: 0,
        knownTotalBlocks: 9,
      }),
    ).toEqual({
      appendOnly: true,
      meta: { id: 's1' },
      blocks: [{ id: 'b10' }, { id: 'b11' }],
      blockOffset: 10,
      totalBlocks: 12,
      contextUsage: { total: 1 },
      signature: null,
    });
  });
});
