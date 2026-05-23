import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

import type { SyncLockMetadata } from './knowledge-base-sync-lock.js';

export function isKnowledgeBaseSyncLockStale(input: {
  existingLock: SyncLockMetadata | null;
  lockAcquiredAtMs: number | null;
  nowMs: number;
  staleMs: number;
  isProcessAlive: (pid: number) => boolean;
}): boolean {
  const metadataCorrupt = input.existingLock && input.lockAcquiredAtMs === null;
  const staleByAge = input.lockAcquiredAtMs !== null && input.nowMs - input.lockAcquiredAtMs > input.staleMs;
  return !input.existingLock || Boolean(metadataCorrupt) || !input.isProcessAlive(input.existingLock.pid) || staleByAge;
}

export function tryCreateKnowledgeBaseSyncLock(input: {
  syncLockDir: string;
  syncLockMetadataPath: string;
  timestamp: string;
  pid: number;
}): boolean {
  try {
    mkdirSync(input.syncLockDir);
  } catch (error) {
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    if (errorCode === 'EEXIST') {
      return false;
    }
    throw error;
  }

  writeFileSync(input.syncLockMetadataPath, `${JSON.stringify({ pid: input.pid, acquiredAt: input.timestamp }, null, 2)}\n`);
  return true;
}

export function shouldReleaseKnowledgeBaseSyncLock(input: {
  activeTimestamp: string | null;
  existingLock: SyncLockMetadata | null;
  pid: number;
}): boolean {
  if (!input.activeTimestamp) {
    return false;
  }

  return Boolean(input.existingLock && input.existingLock.pid === input.pid && input.existingLock.acquiredAt === input.activeTimestamp);
}

export function removeKnowledgeBaseSyncLock(syncLockDir: string): void {
  rmSync(syncLockDir, { recursive: true, force: true });
}
