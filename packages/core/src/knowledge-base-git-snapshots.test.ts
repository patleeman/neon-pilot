import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  listKnowledgeBaseRemoteSnapshot,
  listKnowledgeBaseWorkingSnapshot,
  listKnowledgeBaseWorkingTreePaths,
  parseKnowledgeBaseRemoteSnapshotTree,
  parseNullSeparatedKnowledgeBasePaths,
} from './knowledge-base-git-snapshots';

describe('knowledge-base-git-snapshots', () => {
  it('parses null-separated path output', () => {
    expect(parseNullSeparatedKnowledgeBasePaths(' a.md\0\0 nested/b.md \0')).toEqual(['a.md', 'nested/b.md']);
  });

  it('parses remote ls-tree output into a snapshot', () => {
    const output = Buffer.from(
      '100644 blob abc123\ta.md\0' + '100644 blob def456\tnested/b.md\0' + 'malformed\0' + '100644 blob \tmissing-hash.md\0',
    );

    expect(parseKnowledgeBaseRemoteSnapshotTree(output)).toEqual({
      'a.md': { blobHash: 'abc123' },
      'nested/b.md': { blobHash: 'def456' },
    });
    expect(parseKnowledgeBaseRemoteSnapshotTree(Buffer.alloc(0))).toEqual({});
  });

  it('deduplicates and sorts tracked and untracked working tree paths', () => {
    const runGitText = (_cwd: string, args: string[]) => (args.includes('--others') ? 'b.md\0a.md\0' : 'c.md\0a.md\0');
    expect(listKnowledgeBaseWorkingTreePaths(runGitText, '/repo')).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('lists remote snapshots only when the remote ref exists', () => {
    expect(
      listKnowledgeBaseRemoteSnapshot({
        runGitBuffer: () => Buffer.from('100644 blob abc123\ta.md\0'),
        refExists: () => true,
        getRemoteRef: (branch) => `refs/remotes/origin/${branch}`,
        cwd: '/repo',
        branch: 'main',
      }),
    ).toEqual({ 'a.md': { blobHash: 'abc123' } });
    expect(
      listKnowledgeBaseRemoteSnapshot({
        runGitBuffer: () => Buffer.from('100644 blob abc123\ta.md\0'),
        refExists: () => false,
        getRemoteRef: (branch) => `refs/remotes/origin/${branch}`,
        cwd: '/repo',
        branch: 'main',
      }),
    ).toEqual({});
  });

  it('lists file-only working snapshots with computed blob hashes', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-working-snapshot-'));
    mkdirSync(join(root, 'dir'));
    writeFileSync(join(root, 'a.md'), 'hello');
    const runGitText = (_cwd: string, args: string[]) => {
      if (args[0] === 'ls-files' && args.includes('--others')) {
        return 'dir\0missing.md\0';
      }
      return 'a.md\0';
    };

    expect(
      listKnowledgeBaseWorkingSnapshot({ runGitText, cwd: root, computeBlobHash: (_cwd, relativePath) => `hash:${relativePath}` }),
    ).toEqual({
      'a.md': { blobHash: 'hash:a.md' },
    });
  });
});
