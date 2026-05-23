import { describe, expect, it } from 'vitest';

import { buildSessionIndexKey, shouldReloadPersistentSessionIndex } from './sessionIndexKey';

describe('sessionIndexKey', () => {
  it('builds stable persistent index keys', () => {
    expect(buildSessionIndexKey({ sessionsDir: '/sessions', indexFile: '/runtime/session-meta-index.json' })).toBe(
      '/sessions::/runtime/session-meta-index.json',
    );
  });

  it('detects when the persistent index must be reloaded', () => {
    expect(shouldReloadPersistentSessionIndex({ loadedIndexKey: null, nextIndexKey: 'next' })).toBe(true);
    expect(shouldReloadPersistentSessionIndex({ loadedIndexKey: 'old', nextIndexKey: 'next' })).toBe(true);
    expect(shouldReloadPersistentSessionIndex({ loadedIndexKey: 'next', nextIndexKey: 'next' })).toBe(false);
  });
});
