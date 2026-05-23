import { describe, expect, it } from 'vitest';

import { buildKnowledgeBaseCheckoutRemoteCommands, planKnowledgeBaseCheckoutPreparation } from './knowledge-base-checkout';

describe('knowledge-base-checkout', () => {
  it('plans checkout root preparation', () => {
    expect(
      planKnowledgeBaseCheckoutPreparation({
        repoUrl: 'git@example.com:new.git',
        currentRemoteUrl: 'git@example.com:old.git',
        gitDirExists: true,
        rootHasEntries: true,
      }),
    ).toEqual({ action: 'archive-for-repo-change', reason: 'repo-change-git@example.com:new.git', clearStoredState: true });

    expect(
      planKnowledgeBaseCheckoutPreparation({
        repoUrl: 'git@example.com:kb.git',
        currentRemoteUrl: '',
        gitDirExists: false,
        rootHasEntries: true,
      }),
    ).toEqual({ action: 'archive-non-git-root', reason: 'non-git-root-git@example.com:kb.git', clearStoredState: false });

    expect(
      planKnowledgeBaseCheckoutPreparation({
        repoUrl: 'git@example.com:kb.git',
        currentRemoteUrl: '',
        gitDirExists: false,
        rootHasEntries: false,
      }),
    ).toEqual({ action: 'remove-empty-root', clearStoredState: false });

    expect(
      planKnowledgeBaseCheckoutPreparation({
        repoUrl: 'git@example.com:kb.git',
        currentRemoteUrl: 'git@example.com:kb.git',
        gitDirExists: true,
        rootHasEntries: true,
      }),
    ).toEqual({ action: 'none', clearStoredState: false });
  });

  it('builds checkout commands for remote, existing-head, and orphan branches', () => {
    const getRemoteRef = (branch: string) => `refs/remotes/origin/${branch}`;

    expect(buildKnowledgeBaseCheckoutRemoteCommands({ branch: 'main', remoteExists: true, headExists: true, getRemoteRef })).toEqual([
      { args: ['checkout', '-B', 'main', 'refs/remotes/origin/main'] },
      { args: ['reset', '--hard', 'refs/remotes/origin/main'] },
    ]);
    expect(buildKnowledgeBaseCheckoutRemoteCommands({ branch: 'main', remoteExists: false, headExists: true, getRemoteRef })).toEqual([
      { args: ['checkout', '-B', 'main'] },
    ]);
    expect(buildKnowledgeBaseCheckoutRemoteCommands({ branch: 'main', remoteExists: false, headExists: false, getRemoteRef })).toEqual([
      { args: ['checkout', '--orphan', 'main'], allowFailure: true },
    ]);
  });
});
