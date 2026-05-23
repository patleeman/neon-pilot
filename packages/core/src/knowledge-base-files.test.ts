import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { deleteFileIfExists, directoryHasEntries, removeEmptyParentDirectories } from './knowledge-base-files';

describe('knowledge-base-files', () => {
  it('detects directories with entries and treats missing paths as empty', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-files-'));
    expect(directoryHasEntries(join(root, 'missing'))).toBe(false);
    expect(directoryHasEntries(root)).toBe(false);
    writeFileSync(join(root, 'file.txt'), 'hello');
    expect(directoryHasEntries(root)).toBe(true);
  });

  it('removes empty parent directories without removing the root', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-files-'));
    const nested = join(root, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });

    removeEmptyParentDirectories(root, join(nested, 'file.txt'));

    expect(existsSync(root)).toBe(true);
    expect(existsSync(join(root, 'a'))).toBe(false);
  });

  it('deletes files and cleans empty parent directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-kb-files-'));
    const filePath = join(root, 'a', 'b', 'file.txt');
    mkdirSync(join(root, 'a', 'b'), { recursive: true });
    writeFileSync(filePath, 'hello');

    deleteFileIfExists(filePath, root);
    deleteFileIfExists(filePath, root);

    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(join(root, 'a'))).toBe(false);
    expect(existsSync(root)).toBe(true);
  });
});
