import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isKnowledgeBaseSyncLockStale,
  removeKnowledgeBaseSyncLock,
  shouldReleaseKnowledgeBaseSyncLock,
  tryCreateKnowledgeBaseSyncLock,
} from './knowledge-base-sync-lock-runtime';

describe('knowledge-base-sync-lock-runtime', () => {
  it('classifies missing, corrupt, dead, and old locks as stale', () => {
    const nowMs = 1_000;
    const staleMs = 100;
    expect(isKnowledgeBaseSyncLockStale({ existingLock: null, lockAcquiredAtMs: null, nowMs, staleMs, isProcessAlive: () => true })).toBe(
      true,
    );
    expect(
      isKnowledgeBaseSyncLockStale({
        existingLock: { pid: 1, acquiredAt: 'bad' },
        lockAcquiredAtMs: null,
        nowMs,
        staleMs,
        isProcessAlive: () => true,
      }),
    ).toBe(true);
    expect(
      isKnowledgeBaseSyncLockStale({
        existingLock: { pid: 1, acquiredAt: 'ok' },
        lockAcquiredAtMs: 950,
        nowMs,
        staleMs,
        isProcessAlive: () => false,
      }),
    ).toBe(true);
    expect(
      isKnowledgeBaseSyncLockStale({
        existingLock: { pid: 1, acquiredAt: 'old' },
        lockAcquiredAtMs: 800,
        nowMs,
        staleMs,
        isProcessAlive: () => true,
      }),
    ).toBe(true);
    expect(
      isKnowledgeBaseSyncLockStale({
        existingLock: { pid: 1, acquiredAt: 'fresh' },
        lockAcquiredAtMs: 950,
        nowMs,
        staleMs,
        isProcessAlive: () => true,
      }),
    ).toBe(false);
  });

  it('creates, refuses duplicate, and removes sync locks', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-lock-runtime-'));
    const syncLockDir = join(root, 'lock');
    const syncLockMetadataPath = join(syncLockDir, 'metadata.json');

    expect(tryCreateKnowledgeBaseSyncLock({ syncLockDir, syncLockMetadataPath, timestamp: 'now', pid: 123 })).toBe(true);
    expect(JSON.parse(readFileSync(syncLockMetadataPath, 'utf-8'))).toEqual({ pid: 123, acquiredAt: 'now' });
    expect(tryCreateKnowledgeBaseSyncLock({ syncLockDir, syncLockMetadataPath, timestamp: 'later', pid: 456 })).toBe(false);

    removeKnowledgeBaseSyncLock(syncLockDir);
    expect(existsSync(syncLockDir)).toBe(false);
  });

  it('releases only the active process lock', () => {
    expect(shouldReleaseKnowledgeBaseSyncLock({ activeTimestamp: null, existingLock: { pid: 1, acquiredAt: 'now' }, pid: 1 })).toBe(false);
    expect(shouldReleaseKnowledgeBaseSyncLock({ activeTimestamp: 'now', existingLock: null, pid: 1 })).toBe(false);
    expect(shouldReleaseKnowledgeBaseSyncLock({ activeTimestamp: 'now', existingLock: { pid: 2, acquiredAt: 'now' }, pid: 1 })).toBe(false);
    expect(shouldReleaseKnowledgeBaseSyncLock({ activeTimestamp: 'now', existingLock: { pid: 1, acquiredAt: 'now' }, pid: 1 })).toBe(true);
  });
});
