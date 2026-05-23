export interface KnowledgeBaseGitStatusLike {
  localChangeCount: number;
  aheadCount: number;
  behindCount: number;
}

export interface KnowledgeBaseStateLike {
  repoUrl: string;
  branch: string;
  configured: boolean;
  effectiveRoot: string;
  managedRoot: string;
  usesManagedRoot: boolean;
  syncStatus: string;
  lastError?: string;
  recoveredEntryCount?: number;
  recoveryDir?: string;
  gitStatus?: KnowledgeBaseGitStatusLike | null;
}

export interface RuntimeSyncStateLike {
  syncStatus: string;
  lastSyncAt?: string;
  lastError?: string;
  recoveredEntryCount?: number;
}

export function knowledgeBaseStatesEqual(left: KnowledgeBaseStateLike, right: KnowledgeBaseStateLike): boolean {
  const leftGit = left.gitStatus ?? null;
  const rightGit = right.gitStatus ?? null;
  return (
    left.repoUrl === right.repoUrl &&
    left.branch === right.branch &&
    left.configured === right.configured &&
    left.effectiveRoot === right.effectiveRoot &&
    left.managedRoot === right.managedRoot &&
    left.usesManagedRoot === right.usesManagedRoot &&
    left.syncStatus === right.syncStatus &&
    left.lastError === right.lastError &&
    left.recoveredEntryCount === right.recoveredEntryCount &&
    left.recoveryDir === right.recoveryDir &&
    (leftGit === null
      ? rightGit === null
      : rightGit !== null &&
        leftGit.localChangeCount === rightGit.localChangeCount &&
        leftGit.aheadCount === rightGit.aheadCount &&
        leftGit.behindCount === rightGit.behindCount)
  );
}

export function applyKnowledgeBaseRuntimeStateUpdate<T extends RuntimeSyncStateLike>(runtimeState: T, input: Partial<T>): void {
  if (input.syncStatus) {
    runtimeState.syncStatus = input.syncStatus;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'lastSyncAt')) {
    runtimeState.lastSyncAt = input.lastSyncAt;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'lastError')) {
    runtimeState.lastError = input.lastError;
  }
  if (typeof input.recoveredEntryCount === 'number') {
    runtimeState.recoveredEntryCount = input.recoveredEntryCount;
  }
}
