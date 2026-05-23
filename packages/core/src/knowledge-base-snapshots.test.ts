import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { hasRecentLocalChanges, readLocalPathTimestampMs, snapshotsEqual } from './knowledge-base-snapshots';

describe('knowledge-base-snapshots', () => {
  it('compares snapshot entries by presence and blob hash', () => {
    expect(snapshotsEqual(undefined, undefined)).toBe(true);
    expect(snapshotsEqual({ blobHash: 'a' }, undefined)).toBe(false);
    expect(snapshotsEqual(undefined, { blobHash: 'a' })).toBe(false);
    expect(snapshotsEqual({ blobHash: 'a' }, { blobHash: 'a' })).toBe(true);
    expect(snapshotsEqual({ blobHash: 'a' }, { blobHash: 'b' })).toBe(false);
  });

  it('reads local timestamps and falls back to now for missing paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-snapshot-'));
    writeFileSync(join(root, 'a.md'), 'hello');

    expect(readLocalPathTimestampMs(root, 'a.md', true, 123)).toBeGreaterThan(0);
    expect(readLocalPathTimestampMs(root, 'missing.md', false, 123)).toBe(123);
    expect(readLocalPathTimestampMs(root, 'missing.md', true, 123)).toBe(123);
  });

  it('detects changed paths newer than the quiet window', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-snapshot-'));
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'changed.md'), 'hello');
    const nowMs = Date.now();

    expect(
      hasRecentLocalChanges({
        root,
        baseSnapshot: { 'changed.md': { blobHash: 'old' } },
        workingSnapshot: { 'changed.md': { blobHash: 'new' } },
        nowMs,
        quietMs: 60_000,
      }),
    ).toBe(true);
    expect(
      hasRecentLocalChanges({
        root,
        baseSnapshot: { 'same.md': { blobHash: 'same' } },
        workingSnapshot: { 'same.md': { blobHash: 'same' } },
        nowMs,
        quietMs: 60_000,
      }),
    ).toBe(false);
  });
});
