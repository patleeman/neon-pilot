import { describe, expect, it } from 'vitest';

import { didSessionIndexJsonChange, shouldPersistSessionIndex } from './sessionIndexPersistenceDecision';

describe('sessionIndexPersistenceDecision', () => {
  it('persists only when the session cache is dirty', () => {
    expect(shouldPersistSessionIndex({ sessionCacheDirty: true })).toBe(true);
    expect(shouldPersistSessionIndex({ sessionCacheDirty: false })).toBe(false);
  });

  it('detects serialized index changes', () => {
    expect(didSessionIndexJsonChange({ nextJson: 'a', persistedIndexJson: null })).toBe(true);
    expect(didSessionIndexJsonChange({ nextJson: 'a', persistedIndexJson: 'b' })).toBe(true);
    expect(didSessionIndexJsonChange({ nextJson: 'a', persistedIndexJson: 'a' })).toBe(false);
  });
});
