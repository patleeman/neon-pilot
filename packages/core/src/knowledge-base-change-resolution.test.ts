import { describe, expect, it } from 'vitest';

import { collectKnowledgeBaseChangedPaths, resolveKnowledgeBaseChangedPaths } from './knowledge-base-change-resolution';
import { snapshotsEqual } from './knowledge-base-snapshots';

describe('knowledge-base-change-resolution', () => {
  it('collects sorted changed paths across base, local, and remote snapshots', () => {
    expect(
      collectKnowledgeBaseChangedPaths({
        baseSnapshot: { 'same.md': { blobHash: 'a' }, 'remote.md': { blobHash: 'old' } },
        workingSnapshot: { 'same.md': { blobHash: 'a' }, 'local.md': { blobHash: 'new' } },
        remoteSnapshot: { 'same.md': { blobHash: 'a' }, 'remote.md': { blobHash: 'new' } },
        snapshotsEqual,
      }),
    ).toEqual(['local.md', 'remote.md']);
  });

  it('resolves one-sided local and remote changes without timestamp reads', () => {
    const resolutions = resolveKnowledgeBaseChangedPaths({
      baseSnapshot: { 'local.md': { blobHash: 'old' }, 'remote.md': { blobHash: 'old' } },
      workingSnapshot: { 'local.md': { blobHash: 'new' }, 'remote.md': { blobHash: 'old' } },
      remoteSnapshot: { 'local.md': { blobHash: 'old' }, 'remote.md': { blobHash: 'new' } },
      snapshotsEqual,
      readLocalPathTimestampMs: () => {
        throw new Error('should not read local timestamp');
      },
      readRemotePathTimestampMs: () => {
        throw new Error('should not read remote timestamp');
      },
    });

    expect(resolutions).toEqual([
      { path: 'local.md', winner: 'local', localExists: true, remoteExists: true, localChanged: true, remoteChanged: false },
      { path: 'remote.md', winner: 'remote', localExists: true, remoteExists: true, localChanged: false, remoteChanged: true },
    ]);
  });

  it('uses timestamps to resolve two-sided changes', () => {
    expect(
      resolveKnowledgeBaseChangedPaths({
        baseSnapshot: { 'conflict.md': { blobHash: 'old' } },
        workingSnapshot: { 'conflict.md': { blobHash: 'local' } },
        remoteSnapshot: { 'conflict.md': { blobHash: 'remote' } },
        snapshotsEqual,
        readLocalPathTimestampMs: () => 200,
        readRemotePathTimestampMs: () => 100,
      }),
    ).toEqual([{ path: 'conflict.md', winner: 'local', localExists: true, remoteExists: true, localChanged: true, remoteChanged: true }]);
  });

  it('keeps remote as winner when both sides delete a changed path', () => {
    expect(
      resolveKnowledgeBaseChangedPaths({
        baseSnapshot: { 'deleted.md': { blobHash: 'old' } },
        workingSnapshot: {},
        remoteSnapshot: {},
        snapshotsEqual,
        readLocalPathTimestampMs: () => 200,
        readRemotePathTimestampMs: () => 100,
      }),
    ).toEqual([{ path: 'deleted.md', winner: 'remote', localExists: false, remoteExists: false, localChanged: true, remoteChanged: true }]);
  });
});
