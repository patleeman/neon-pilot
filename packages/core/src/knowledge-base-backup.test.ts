import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { backupKnowledgeBaseWorkingTree, cleanupKnowledgeBaseBackup, restoreKnowledgeBaseWorkingTree } from './knowledge-base-backup';

const ensureParentDirectory = (path: string) => mkdirSync(dirname(path), { recursive: true });

describe('knowledge-base-backup', () => {
  it('backs up and restores snapshot files only', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-backup-root-'));
    mkdirSync(join(root, 'nested'));
    writeFileSync(join(root, 'a.md'), 'one');
    writeFileSync(join(root, 'nested', 'b.md'), 'two');
    writeFileSync(join(root, 'ignored.md'), 'ignored');

    const backupDir = backupKnowledgeBaseWorkingTree({
      root,
      snapshot: { 'a.md': { blobHash: 'a' }, 'nested/b.md': { blobHash: 'b' }, 'missing.md': { blobHash: 'missing' } },
      backupPrefix: 'pa-kb-backup-test-',
      ensureParentDirectory,
    });

    expect(readFileSync(join(backupDir, 'a.md'), 'utf-8')).toBe('one');
    expect(readFileSync(join(backupDir, 'nested', 'b.md'), 'utf-8')).toBe('two');
    expect(existsSync(join(backupDir, 'ignored.md'))).toBe(false);

    writeFileSync(join(root, 'a.md'), 'changed');
    restoreKnowledgeBaseWorkingTree({
      backupDir,
      root,
      snapshot: { 'a.md': { blobHash: 'a' }, 'nested/b.md': { blobHash: 'b' }, 'missing.md': { blobHash: 'missing' } },
      ensureParentDirectory,
    });

    expect(readFileSync(join(root, 'a.md'), 'utf-8')).toBe('one');
    expect(cleanupKnowledgeBaseBackup(backupDir)).toBeNull();
    expect(existsSync(backupDir)).toBe(false);
  });

  it('ignores null backup cleanup', () => {
    expect(cleanupKnowledgeBaseBackup(null)).toBeNull();
  });
});
