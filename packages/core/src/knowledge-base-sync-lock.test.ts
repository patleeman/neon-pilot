import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readKnowledgeBaseSyncLockMetadata } from './knowledge-base-sync-lock';

describe('knowledge-base-sync-lock', () => {
  it('reads valid lock metadata and trims timestamps', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'pa-kb-lock-')), 'metadata.json');
    writeFileSync(path, JSON.stringify({ pid: 123, acquiredAt: ' 2026-05-23T00:00:00.000Z ' }));

    expect(readKnowledgeBaseSyncLockMetadata(path)).toEqual({ pid: 123, acquiredAt: '2026-05-23T00:00:00.000Z' });
  });

  it('returns null for missing, malformed, or invalid lock metadata', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-lock-'));
    expect(readKnowledgeBaseSyncLockMetadata(join(root, 'missing.json'))).toBeNull();

    const malformed = join(root, 'malformed.json');
    writeFileSync(malformed, '{bad');
    expect(readKnowledgeBaseSyncLockMetadata(malformed)).toBeNull();

    const invalidPid = join(root, 'invalid-pid.json');
    writeFileSync(invalidPid, JSON.stringify({ pid: 1.5, acquiredAt: '2026-05-23T00:00:00.000Z' }));
    expect(readKnowledgeBaseSyncLockMetadata(invalidPid)).toBeNull();

    const invalidTimestamp = join(root, 'invalid-timestamp.json');
    writeFileSync(invalidTimestamp, JSON.stringify({ pid: 123, acquiredAt: ' ' }));
    expect(readKnowledgeBaseSyncLockMetadata(invalidTimestamp)).toBeNull();
  });
});
