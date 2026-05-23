import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeStoredKnowledgeBaseState, readStoredKnowledgeBaseState, writeStoredKnowledgeBaseState } from './knowledge-base-state';

describe('knowledge-base-state', () => {
  it('normalizes stored state and filters invalid snapshot entries', () => {
    expect(
      normalizeStoredKnowledgeBaseState({
        version: 1,
        repoUrl: ' git@example.com:kb.git ',
        branch: ' ',
        lastSyncAt: ' 2026-05-23T00:00:00.000Z ',
        lastSyncHead: ' abc123 ',
        lastMaintenanceAt: '',
        lastFullMaintenanceAt: ' 2026-05-20T00:00:00.000Z ',
        snapshot: {
          'notes/a.md': { blobHash: ' hash-a ' },
          'bad-empty': { blobHash: ' ' },
          'bad-missing': {},
        },
      }),
    ).toEqual({
      version: 1,
      repoUrl: 'git@example.com:kb.git',
      branch: 'main',
      lastSyncAt: '2026-05-23T00:00:00.000Z',
      lastSyncHead: 'abc123',
      lastFullMaintenanceAt: '2026-05-20T00:00:00.000Z',
      snapshot: { 'notes/a.md': { blobHash: 'hash-a' } },
    });
  });

  it('rejects unsupported state shapes', () => {
    expect(normalizeStoredKnowledgeBaseState({ version: 2 })).toBeNull();
    expect(normalizeStoredKnowledgeBaseState({ version: 1, repoUrl: 'repo', branch: 'main' })).toBeNull();
  });

  it('reads and writes stored state files', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'pa-kb-state-')), 'state.json');
    const state = {
      version: 1 as const,
      repoUrl: 'repo',
      branch: 'main',
      snapshot: { 'a.md': { blobHash: 'abc' } },
    };

    writeStoredKnowledgeBaseState(path, state);
    expect(readFileSync(path, 'utf-8')).toContain('\n');
    expect(readStoredKnowledgeBaseState(path)).toEqual(state);
  });
});
