import type { Snapshot } from './knowledge-base-state.js';

export interface PathChangeResolution {
  path: string;
  winner: 'local' | 'remote';
  localExists: boolean;
  remoteExists: boolean;
  localChanged: boolean;
  remoteChanged: boolean;
}

export function collectKnowledgeBaseChangedPaths(input: {
  baseSnapshot: Snapshot;
  workingSnapshot: Snapshot;
  remoteSnapshot: Snapshot;
  snapshotsEqual: (left: Snapshot[string] | undefined, right: Snapshot[string] | undefined) => boolean;
}): string[] {
  const changedPaths = new Set<string>();
  for (const path of Object.keys(input.baseSnapshot)) {
    if (
      !input.snapshotsEqual(input.baseSnapshot[path], input.workingSnapshot[path]) ||
      !input.snapshotsEqual(input.baseSnapshot[path], input.remoteSnapshot[path])
    ) {
      changedPaths.add(path);
    }
  }
  for (const path of Object.keys(input.workingSnapshot)) {
    if (
      !input.snapshotsEqual(input.baseSnapshot[path], input.workingSnapshot[path]) ||
      !input.snapshotsEqual(input.baseSnapshot[path], input.remoteSnapshot[path])
    ) {
      changedPaths.add(path);
    }
  }
  for (const path of Object.keys(input.remoteSnapshot)) {
    if (
      !input.snapshotsEqual(input.baseSnapshot[path], input.remoteSnapshot[path]) ||
      !input.snapshotsEqual(input.baseSnapshot[path], input.workingSnapshot[path])
    ) {
      changedPaths.add(path);
    }
  }

  return [...changedPaths].sort((left, right) => left.localeCompare(right));
}

export function resolveKnowledgeBaseChangedPaths(input: {
  baseSnapshot: Snapshot;
  workingSnapshot: Snapshot;
  remoteSnapshot: Snapshot;
  snapshotsEqual: (left: Snapshot[string] | undefined, right: Snapshot[string] | undefined) => boolean;
  readLocalPathTimestampMs: (path: string, existsInLocal: boolean) => number;
  readRemotePathTimestampMs: (path: string, existsInRemote: boolean) => number;
}): PathChangeResolution[] {
  const resolutions: PathChangeResolution[] = [];
  const changedPaths = collectKnowledgeBaseChangedPaths(input);

  for (const path of changedPaths) {
    const localExists = Boolean(input.workingSnapshot[path]);
    const remoteExists = Boolean(input.remoteSnapshot[path]);
    const localChanged = !input.snapshotsEqual(input.baseSnapshot[path], input.workingSnapshot[path]);
    const remoteChanged = !input.snapshotsEqual(input.baseSnapshot[path], input.remoteSnapshot[path]);

    if (!localChanged && !remoteChanged) {
      continue;
    }

    if (localChanged && !remoteChanged) {
      resolutions.push({ path, winner: 'local', localExists, remoteExists, localChanged, remoteChanged });
      continue;
    }

    if (!localChanged && remoteChanged) {
      resolutions.push({ path, winner: 'remote', localExists, remoteExists, localChanged, remoteChanged });
      continue;
    }

    if (!localExists && !remoteExists) {
      resolutions.push({ path, winner: 'remote', localExists, remoteExists, localChanged, remoteChanged });
      continue;
    }

    const localTimestampMs = input.readLocalPathTimestampMs(path, localExists);
    const remoteTimestampMs = input.readRemotePathTimestampMs(path, remoteExists);
    const winner = localTimestampMs >= remoteTimestampMs ? 'local' : 'remote';
    resolutions.push({ path, winner, localExists, remoteExists, localChanged, remoteChanged });
  }

  return resolutions;
}
