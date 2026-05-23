import { describe, expect, it } from 'vitest';

import { validateKnowledgeBaseSyncResult } from './knowledge-base-sync-validation';

describe('knowledge-base-sync-validation', () => {
  it('allows empty base snapshots', () => {
    expect(validateKnowledgeBaseSyncResult({ baseFileCount: 0, resultFileCount: 0, minFileRatio: 0.75 })).toEqual({ valid: true });
  });

  it('rejects deleting all files from a non-empty base', () => {
    expect(validateKnowledgeBaseSyncResult({ baseFileCount: 4, resultFileCount: 0, minFileRatio: 0.75 })).toEqual({
      valid: false,
      reason: 'Sync would produce an empty working tree (0 files) from a base with 4 files. Aborting sync to prevent data loss.',
    });
  });

  it('rejects results below the minimum retained file ratio', () => {
    expect(validateKnowledgeBaseSyncResult({ baseFileCount: 10, resultFileCount: 7, minFileRatio: 0.75 })).toEqual({
      valid: false,
      reason: 'Sync would drop 3 of 10 files (ratio 0.700 < minimum 0.75). Aborting sync to prevent data loss.',
    });
  });

  it('allows results at or above the minimum retained file ratio', () => {
    expect(validateKnowledgeBaseSyncResult({ baseFileCount: 10, resultFileCount: 8, minFileRatio: 0.75 })).toEqual({ valid: true });
  });
});
