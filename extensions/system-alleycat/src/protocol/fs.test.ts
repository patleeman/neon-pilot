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
  const root = await mkdtemp(join(tmpdir(), 'pa-alleycat-fs-'));
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
});
