import { statSync } from 'node:fs';
import { join } from 'node:path';

import type { Snapshot, WorkingSnapshotEntry } from './knowledge-base-state.js';

export function snapshotsEqual(left: WorkingSnapshotEntry | undefined, right: WorkingSnapshotEntry | undefined): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.blobHash === right.blobHash;
}

export function readLocalPathTimestampMs(root: string, relativePath: string, existsInLocal: boolean, nowMs = Date.now()): number {
  if (!existsInLocal) {
    return nowMs;
  }

  try {
    return statSync(join(root, relativePath)).mtimeMs;
  } catch {
    return nowMs;
  }
}

export function hasRecentLocalChanges(input: {
  root: string;
  baseSnapshot: Snapshot;
  workingSnapshot: Snapshot;
  nowMs: number;
  quietMs: number;
}): boolean {
  const changedPaths = new Set<string>([...Object.keys(input.baseSnapshot), ...Object.keys(input.workingSnapshot)]);

  for (const path of changedPaths) {
    if (snapshotsEqual(input.baseSnapshot[path], input.workingSnapshot[path])) {
      continue;
    }

    const existsInLocal = Boolean(input.workingSnapshot[path]);
    const localTimestampMs = readLocalPathTimestampMs(input.root, path, existsInLocal, input.nowMs);
    if (input.nowMs - localTimestampMs < input.quietMs) {
      return true;
    }
  }

  return false;
}
