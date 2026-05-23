import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface WorkingSnapshotEntry {
  blobHash: string;
}

export type Snapshot = Record<string, WorkingSnapshotEntry>;

export interface StoredKnowledgeBaseState {
  version: 1;
  repoUrl: string;
  branch: string;
  lastSyncAt?: string;
  lastSyncHead?: string;
  lastMaintenanceAt?: string;
  lastFullMaintenanceAt?: string;
  snapshot: Snapshot;
}

const SNAPSHOT_VERSION = 1;

function normalizeBranch(value: string | null | undefined): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || 'main';
}

export function normalizeStoredKnowledgeBaseState(value: unknown): StoredKnowledgeBaseState | null {
  const parsed = value as Partial<StoredKnowledgeBaseState>;
  if (parsed.version !== SNAPSHOT_VERSION) return null;
  if (typeof parsed.repoUrl !== 'string' || typeof parsed.branch !== 'string' || !parsed.snapshot || typeof parsed.snapshot !== 'object') {
    return null;
  }

  const snapshot: Snapshot = {};
  for (const [path, entry] of Object.entries(parsed.snapshot as Record<string, { blobHash?: unknown }>)) {
    if (!path || !entry || typeof entry !== 'object' || typeof entry.blobHash !== 'string' || entry.blobHash.trim().length === 0) {
      continue;
    }
    snapshot[path] = { blobHash: entry.blobHash.trim() };
  }

  return {
    version: SNAPSHOT_VERSION,
    repoUrl: parsed.repoUrl.trim(),
    branch: normalizeBranch(parsed.branch),
    ...(typeof parsed.lastSyncAt === 'string' && parsed.lastSyncAt.trim().length > 0 ? { lastSyncAt: parsed.lastSyncAt.trim() } : {}),
    ...(typeof parsed.lastSyncHead === 'string' && parsed.lastSyncHead.trim().length > 0
      ? { lastSyncHead: parsed.lastSyncHead.trim() }
      : {}),
    ...(typeof parsed.lastMaintenanceAt === 'string' && parsed.lastMaintenanceAt.trim().length > 0
      ? { lastMaintenanceAt: parsed.lastMaintenanceAt.trim() }
      : {}),
    ...(typeof parsed.lastFullMaintenanceAt === 'string' && parsed.lastFullMaintenanceAt.trim().length > 0
      ? { lastFullMaintenanceAt: parsed.lastFullMaintenanceAt.trim() }
      : {}),
    snapshot,
  };
}

export function readStoredKnowledgeBaseState(filePath: string): StoredKnowledgeBaseState | null {
  if (!existsSync(filePath)) return null;
  try {
    return normalizeStoredKnowledgeBaseState(JSON.parse(readFileSync(filePath, 'utf-8')) as unknown);
  } catch {
    return null;
  }
}

export function writeStoredKnowledgeBaseState(filePath: string, state: StoredKnowledgeBaseState): void {
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
}
