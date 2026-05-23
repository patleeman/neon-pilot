import { describe, expect, it } from 'vitest';

import { detectSessionModification, shouldComputeSessionPrefixHash } from './sessionModificationDetection';

describe('sessionModificationDetection', () => {
  it('detects truncation and same-size rewrites as modifications', () => {
    expect(detectSessionModification({ oldSize: 10, newSize: 5, oldContentHash: 'a' })).toBe(true);
    expect(detectSessionModification({ oldSize: 10, newSize: 10, oldContentHash: 'a' })).toBe(true);
  });

  it('detects grown files as modified only when prefix hash changes', () => {
    expect(detectSessionModification({ oldSize: 10, newSize: 12, oldContentHash: 'a', prefixHash: 'b' })).toBe(true);
    expect(detectSessionModification({ oldSize: 10, newSize: 12, oldContentHash: 'a', prefixHash: 'a' })).toBe(false);
    expect(detectSessionModification({ oldSize: 10, newSize: 12, oldContentHash: 'a', prefixHash: null })).toBe(false);
  });

  it('ignores unknown sizes and computes prefix hashes only for growth', () => {
    expect(detectSessionModification({ oldSize: null, newSize: 12, oldContentHash: 'a' })).toBe(false);
    expect(shouldComputeSessionPrefixHash({ oldSize: 10, newSize: 12 })).toBe(true);
    expect(shouldComputeSessionPrefixHash({ oldSize: 10, newSize: 10 })).toBe(false);
    expect(shouldComputeSessionPrefixHash({ oldSize: null, newSize: 12 })).toBe(false);
  });
});
