import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Snapshot } from './knowledge-base-state.js';

export type GitTextRunner = (cwd: string, args: string[], options?: { allowFailure?: boolean }) => string;
export type GitBufferRunner = (cwd: string, args: string[], options?: { allowFailure?: boolean }) => Buffer;

export function parseKnowledgeBaseRemoteSnapshotTree(output: Buffer): Snapshot {
  if (output.length === 0) {
    return {};
  }

  const snapshot: Snapshot = {};
  for (const rawEntry of output.toString('utf-8').split('\0')) {
    if (!rawEntry) {
      continue;
    }

    const tabIndex = rawEntry.indexOf('\t');
    if (tabIndex < 0) {
      continue;
    }

    const metadata = rawEntry.slice(0, tabIndex).trim().split(/\s+/);
    const path = rawEntry.slice(tabIndex + 1).trim();
    const blobHash = metadata[2]?.trim();
    if (!path || !blobHash) {
      continue;
    }

    snapshot[path] = { blobHash };
  }

  return snapshot;
}

export function parseNullSeparatedKnowledgeBasePaths(value: string): string[] {
  return value
    .split('\0')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function listKnowledgeBaseWorkingTreePaths(runGitText: GitTextRunner, cwd: string): string[] {
  const tracked = parseNullSeparatedKnowledgeBasePaths(runGitText(cwd, ['ls-files', '-z'], { allowFailure: true }));
  const untracked = parseNullSeparatedKnowledgeBasePaths(
    runGitText(cwd, ['ls-files', '--others', '--exclude-standard', '-z'], { allowFailure: true }),
  );
  return [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right));
}

export function listKnowledgeBaseRemoteSnapshot(input: {
  runGitBuffer: GitBufferRunner;
  refExists: (cwd: string, ref: string) => boolean;
  getRemoteRef: (branch: string) => string;
  cwd: string;
  branch: string;
}): Snapshot {
  const remoteRef = input.getRemoteRef(input.branch);
  if (!input.refExists(input.cwd, remoteRef)) {
    return {};
  }

  try {
    return parseKnowledgeBaseRemoteSnapshotTree(input.runGitBuffer(input.cwd, ['ls-tree', '-rz', '-r', remoteRef]));
  } catch {
    return {};
  }
}

export function listKnowledgeBaseWorkingSnapshot(input: {
  runGitText: GitTextRunner;
  cwd: string;
  computeBlobHash?: (cwd: string, relativePath: string) => string;
}): Snapshot {
  const computeBlobHash =
    input.computeBlobHash ?? ((cwd, relativePath) => input.runGitText(cwd, ['hash-object', '--', relativePath]).trim());
  const snapshot: Snapshot = {};
  for (const relativePath of listKnowledgeBaseWorkingTreePaths(input.runGitText, input.cwd)) {
    const absolutePath = join(input.cwd, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const stats = statSync(absolutePath);
    if (!stats.isFile()) {
      continue;
    }

    snapshot[relativePath] = {
      blobHash: computeBlobHash(input.cwd, relativePath),
    };
  }
  return snapshot;
}
