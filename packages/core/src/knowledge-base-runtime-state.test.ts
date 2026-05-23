import { describe, expect, it } from 'vitest';

import {
  applyKnowledgeBaseRuntimeStateUpdate,
  type KnowledgeBaseStateLike,
  knowledgeBaseStatesEqual,
} from './knowledge-base-runtime-state';

describe('knowledge-base-runtime-state', () => {
  const baseState = (): KnowledgeBaseStateLike => ({
    repoUrl: 'git@example.com:kb.git',
    branch: 'main',
    configured: true,
    effectiveRoot: '/vault',
    managedRoot: '/managed',
    usesManagedRoot: true,
    syncStatus: 'idle',
    recoveredEntryCount: 1,
    recoveryDir: '/recovery',
    gitStatus: { localChangeCount: 0, aheadCount: 1, behindCount: 2 },
  });

  it('compares knowledge base states including optional git status', () => {
    expect(knowledgeBaseStatesEqual(baseState(), baseState())).toBe(true);
    expect(knowledgeBaseStatesEqual({ ...baseState(), branch: 'docs' }, baseState())).toBe(false);
    expect(knowledgeBaseStatesEqual({ ...baseState(), gitStatus: null }, { ...baseState(), gitStatus: null })).toBe(true);
    expect(knowledgeBaseStatesEqual({ ...baseState(), gitStatus: null }, baseState())).toBe(false);
    expect(
      knowledgeBaseStatesEqual(baseState(), {
        ...baseState(),
        gitStatus: { localChangeCount: 0, aheadCount: 1, behindCount: 3 },
      }),
    ).toBe(false);
  });

  it('applies runtime state updates while preserving explicit undefined clears', () => {
    const runtimeState = {
      syncStatus: 'idle',
      lastSyncAt: 'before',
      lastError: 'boom',
      recoveredEntryCount: 1,
    };

    applyKnowledgeBaseRuntimeStateUpdate(runtimeState, {
      syncStatus: 'syncing',
      lastSyncAt: undefined,
      lastError: undefined,
      recoveredEntryCount: 2,
    });

    expect(runtimeState).toEqual({
      syncStatus: 'syncing',
      lastSyncAt: undefined,
      lastError: undefined,
      recoveredEntryCount: 2,
    });
  });
});
