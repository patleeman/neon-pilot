import { existsSync, readFileSync } from 'node:fs';

export interface SyncLockMetadata {
  pid: number;
  acquiredAt: string;
}

export function readKnowledgeBaseSyncLockMetadata(filePath: string): SyncLockMetadata | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<SyncLockMetadata>;
    const pid = parsed.pid;
    const acquiredAt = parsed.acquiredAt;
    if (typeof pid !== 'number' || !Number.isInteger(pid) || typeof acquiredAt !== 'string' || acquiredAt.trim().length === 0) {
      return null;
    }

    return {
      pid,
      acquiredAt: acquiredAt.trim(),
    };
  } catch {
    return null;
  }
}
