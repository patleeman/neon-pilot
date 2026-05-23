import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSessionFiles, resolveSessionFileCwdSlug, slugToCwd } from './sessionFiles';

describe('sessionFiles', () => {
  it('converts cwd slugs back to paths', () => {
    expect(slugToCwd('--Users-user-project--')).toBe('Users/user/project');
  });

  it('resolves root and nested cwd slugs', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-session-files-'));
    expect(resolveSessionFileCwdSlug(join(root, 'root.jsonl'), root)).toBe('');
    expect(resolveSessionFileCwdSlug(join(root, '--Users-user-project--', 'nested.jsonl'), root)).toBe('--Users-user-project--');
  });

  it('lists jsonl session files recursively and skips unreadable/mismatched entries', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-session-files-'));
    const nested = join(root, '--Users-user-project--');
    mkdirSync(nested);
    writeFileSync(join(root, 'a.jsonl'), '');
    writeFileSync(join(root, 'ignore.txt'), '');
    writeFileSync(join(nested, 'b.jsonl'), '');

    expect(listSessionFiles(root).sort((left, right) => left.cwdSlug.localeCompare(right.cwdSlug))).toEqual([
      { filePath: join(root, 'a.jsonl'), cwdSlug: '' },
      { filePath: join(nested, 'b.jsonl'), cwdSlug: '--Users-user-project--' },
    ]);
  });
});
