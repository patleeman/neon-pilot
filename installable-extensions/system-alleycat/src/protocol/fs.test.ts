import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { fs } from './fs.js';

const conn = { initialized: true, subscribedThreads: new Set<string>(), activeTurnThreads: new Set<string>() };
const ctx = {} as never;
const notify = () => undefined;
const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'neon-pilot-alleycat-fs-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('system-alleycat fs protocol', () => {
  it('writes empty files from empty base64 payloads', async () => {
    const root = await tempRoot();
    const path = join(root, 'empty.txt');

    await expect(fs.writeFile({ path, dataBase64: '' }, ctx, conn, notify)).resolves.toEqual({});

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe('');
  });

  it('respects force=false when removing missing paths', async () => {
    const root = await tempRoot();
    const missing = join(root, 'missing.txt');

    await expect(fs.remove({ path: missing, force: false }, ctx, conn, notify)).rejects.toThrow();
    await expect(fs.remove({ path: missing, force: true }, ctx, conn, notify)).resolves.toEqual({});
  });

  it('surfaces failed non-recursive directory removal', async () => {
    const root = await tempRoot();
    const dir = join(root, 'dir');
    mkdirSync(dir);
    await writeFile(join(dir, 'child.txt'), 'child');

    await expect(fs.remove({ path: dir, recursive: false, force: true }, ctx, conn, notify)).rejects.toThrow();
    expect(existsSync(dir)).toBe(true);
  });

  it('finds nested fuzzy file picker matches beyond shallow directory caps', async () => {
    const root = await tempRoot();
    let dir = root;
    for (let index = 0; index < 120; index += 1) {
      dir = join(dir, `l${String(index).padStart(3, '0')}`);
      mkdirSync(dir);
    }
    const target = join(dir, 'mobile-kitty-target.ts');
    await writeFile(target, 'export const target = true;');

    const result = (await fs.fuzzyFileSearch({ roots: [root], query: 'mkt', limit: 5 }, ctx, conn, notify)) as {
      files: Array<{ path: string; fileName: string; indices?: number[] }>;
    };

    expect(result.files[0]).toMatchObject({ path: target, fileName: 'mobile-kitty-target.ts' });
    expect(result.files[0].indices).toEqual(expect.any(Array));
  });

  it('honors fuzzy search result limits and ranks file-name exact matches first', async () => {
    const root = await tempRoot();
    mkdirSync(join(root, 'nested'));
    await writeFile(join(root, 'nested', 'alpha-query.txt'), 'nested');
    await writeFile(join(root, 'query.txt'), 'root');
    await writeFile(join(root, 'other-query.txt'), 'other');

    const result = (await fs.fuzzyFileSearch({ roots: [root], query: 'query', limit: 1 }, ctx, conn, notify)) as {
      files: Array<{ path: string }>;
    };

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe(join(root, 'query.txt'));
  });
});
