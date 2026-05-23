import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Snapshot } from './knowledge-base-state.js';

export function copyKnowledgeBaseSnapshotFiles(input: {
  sourceRoot: string;
  destinationRoot: string;
  snapshot: Snapshot;
  ensureParentDirectory: (path: string) => void;
}): void {
  for (const relativePath of Object.keys(input.snapshot)) {
    const sourcePath = join(input.sourceRoot, relativePath);
    if (!existsSync(sourcePath)) {
      continue;
    }
    const destPath = join(input.destinationRoot, relativePath);
    input.ensureParentDirectory(destPath);
    writeFileSync(destPath, readFileSync(sourcePath));
  }
}

export function backupKnowledgeBaseWorkingTree(input: {
  root: string;
  snapshot: Snapshot;
  backupPrefix: string;
  ensureParentDirectory: (path: string) => void;
}): string {
  const backupDir = mkdtempSync(join(tmpdir(), input.backupPrefix));
  copyKnowledgeBaseSnapshotFiles({
    sourceRoot: input.root,
    destinationRoot: backupDir,
    snapshot: input.snapshot,
    ensureParentDirectory: input.ensureParentDirectory,
  });
  return backupDir;
}

export function restoreKnowledgeBaseWorkingTree(input: {
  backupDir: string;
  root: string;
  snapshot: Snapshot;
  ensureParentDirectory: (path: string) => void;
}): void {
  copyKnowledgeBaseSnapshotFiles({
    sourceRoot: input.backupDir,
    destinationRoot: input.root,
    snapshot: input.snapshot,
    ensureParentDirectory: input.ensureParentDirectory,
  });
}

export function cleanupKnowledgeBaseBackup(backupDir: string | null): null {
  if (!backupDir) {
    return null;
  }

  try {
    rmSync(backupDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
  return null;
}
