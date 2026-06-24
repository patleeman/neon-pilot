import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hashlineEdit, readHashline } from './backend';

const tempDirs: string[] = [];

function createWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'hashline-edit-'));
  tempDirs.push(dir);
  return dir;
}

function ctx(cwd: string) {
  return { cwd } as never;
}

function tagFromRead(text: string): string {
  const match = /^\[[^#]+#([0-9A-F]{4})\]/.exec(text);
  if (!match) throw new Error(`Missing hashline header in ${text}`);
  return match[1];
}

describe('system-hashline-edit backend', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('reads a text file with a stable hashline header and line window', async () => {
    const cwd = createWorkspace();
    writeFileSync(join(cwd, 'src.txt'), 'one\ntwo\nthree\nfour\n');

    const result = await readHashline({ path: 'src.txt', offset: 2, limit: 2 }, ctx(cwd));

    expect(result.content[0]?.text).toMatch(/^\[src\.txt#[0-9A-F]{4}\]\n2:two\n3:three\n… 1 more line\(s\) omitted$/);
    expect(result.details).toEqual(expect.objectContaining({ path: 'src.txt', startLine: 2, lines: 2, totalLines: 4 }));
  });

  it('applies hash-guarded swaps, deletes, and inserts, then returns a fresh header', async () => {
    const cwd = createWorkspace();
    const filePath = join(cwd, 'src.txt');
    writeFileSync(filePath, 'one\ntwo\nthree\nfour\n');
    const read = await readHashline({ path: 'src.txt' }, ctx(cwd));
    const tag = tagFromRead(read.content[0]?.text ?? '');

    const result = await hashlineEdit(
      {
        input: [`[src.txt#${tag}]`, 'SWAP 2:', '+TWO', 'DEL 3', 'INS.HEAD:', '+zero', 'INS.TAIL:', '+five'].join('\n'),
      },
      ctx(cwd),
    );

    expect(readFileSync(filePath, 'utf8')).toBe('zero\none\nTWO\nfour\nfive\n');
    expect(result.content[0]?.text).toMatch(/^\[src\.txt#[0-9A-F]{4}\]/);
    expect(result.content[0]?.text).toContain('1:zero\n2:one\n3:TWO');
    expect(result.details).toEqual({ files: ['src.txt'] });
  });

  it('rejects edits when the supplied tag is stale', async () => {
    const cwd = createWorkspace();
    const filePath = join(cwd, 'src.txt');
    writeFileSync(filePath, 'one\ntwo\n');
    const read = await readHashline({ path: 'src.txt' }, ctx(cwd));
    const tag = tagFromRead(read.content[0]?.text ?? '');
    writeFileSync(filePath, 'changed\ntwo\n');

    const result = await hashlineEdit({ input: `[src.txt#${tag}]\nSWAP 1:\n+ONE` }, ctx(cwd));

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: expect.stringContaining('does not match live file') }],
    });
    expect(readFileSync(filePath, 'utf8')).toBe('changed\ntwo\n');
  });

  it('returns tool errors for paths outside the workspace before reading or writing', async () => {
    const cwd = createWorkspace();

    await expect(readHashline({ path: '../outside.txt' }, ctx(cwd))).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Invalid workspace path: ../outside.txt' }],
    });
    await expect(hashlineEdit({ input: '[../outside.txt#ABCD]\nDEL 1' }, ctx(cwd))).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Invalid workspace path: ../outside.txt' }],
    });
  });

  it('returns a tool error for files that exceed the read limit', async () => {
    const cwd = createWorkspace();
    writeFileSync(join(cwd, 'large.txt'), 'x'.repeat(513 * 1024));

    await expect(readHashline({ path: 'large.txt' }, ctx(cwd))).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'File is too large for read_hashline (524288 byte limit).' }],
    });
  });

  it('returns a sanitized tool error when a file is missing', async () => {
    const cwd = createWorkspace();

    await expect(readHashline({ path: 'missing.txt' }, ctx(cwd))).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'File not found. Check the path and run read_hashline again.' }],
    });
  });
});
