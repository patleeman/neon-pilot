export type KnowledgeBaseCheckoutPreparation =
  | { action: 'archive-for-repo-change'; reason: string; clearStoredState: true }
  | { action: 'archive-non-git-root'; reason: string; clearStoredState: false }
  | { action: 'remove-empty-root'; clearStoredState: false }
  | { action: 'none'; clearStoredState: false };

export function planKnowledgeBaseCheckoutPreparation(input: {
  repoUrl: string;
  currentRemoteUrl: string;
  gitDirExists: boolean;
  rootHasEntries: boolean;
}): KnowledgeBaseCheckoutPreparation {
  if (input.currentRemoteUrl.length > 0 && input.currentRemoteUrl !== input.repoUrl) {
    return { action: 'archive-for-repo-change', reason: `repo-change-${input.repoUrl}`, clearStoredState: true };
  }

  if (input.gitDirExists) {
    return { action: 'none', clearStoredState: false };
  }

  if (input.rootHasEntries) {
    return { action: 'archive-non-git-root', reason: `non-git-root-${input.repoUrl}`, clearStoredState: false };
  }

  return { action: 'remove-empty-root', clearStoredState: false };
}

export function buildKnowledgeBaseCheckoutRemoteCommands(input: {
  branch: string;
  remoteExists: boolean;
  headExists: boolean;
  getRemoteRef: (branch: string) => string;
}): { args: string[]; allowFailure?: boolean }[] {
  if (input.remoteExists) {
    const remoteRef = input.getRemoteRef(input.branch);
    return [{ args: ['checkout', '-B', input.branch, remoteRef] }, { args: ['reset', '--hard', remoteRef] }];
  }

  if (input.headExists) {
    return [{ args: ['checkout', '-B', input.branch] }];
  }

  return [{ args: ['checkout', '--orphan', input.branch], allowFailure: true }];
}
