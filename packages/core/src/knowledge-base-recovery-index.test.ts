import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { appendKnowledgeBaseRecoveryIndex, readKnowledgeBaseRecoveryIndex } from './knowledge-base-recovery-index';

describe('knowledge-base-recovery-index', () => {
  it('reads valid string recovery entries and ignores malformed entries', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'pa-kb-recovery-')), 'recovery-index.json');
    writeFileSync(path, JSON.stringify({ entries: ['one', '', 2, 'two'] }));

    expect(readKnowledgeBaseRecoveryIndex(path)).toEqual(['one', 'two']);
  });

  it('returns an empty index for missing or malformed files', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-recovery-'));
    expect(readKnowledgeBaseRecoveryIndex(join(root, 'missing.json'))).toEqual([]);
    const malformed = join(root, 'malformed.json');
    writeFileSync(malformed, '{bad');
    expect(readKnowledgeBaseRecoveryIndex(malformed)).toEqual([]);
  });

  it('appends entries and returns the new count', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'pa-kb-recovery-')), 'nested', 'recovery-index.json');
    const ensureParentDirectory = (target: string) => mkdirSync(dirname(target), { recursive: true });

    expect(appendKnowledgeBaseRecoveryIndex(path, 'one', ensureParentDirectory)).toBe(1);
    expect(appendKnowledgeBaseRecoveryIndex(path, 'two', ensureParentDirectory)).toBe(2);
    expect(readKnowledgeBaseRecoveryIndex(path)).toEqual(['one', 'two']);
  });
});
