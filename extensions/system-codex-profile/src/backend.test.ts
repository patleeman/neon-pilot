import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import codexCompatibilityExtension, { applyPatch } from './backend.js';

function tempCwd(): string {
  return mkdtempSync(join(tmpdir(), 'pa-apply-patch-'));
}

function ctx(cwd: string) {
  return { toolContext: { cwd } } as never;
}

describe('codex tool activation', () => {
  it('adds apply_patch and removes write/edit without clobbering other tools', () => {
    const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
    codexCompatibilityExtension({
      on: (event: string, handler: (event: unknown, ctx: unknown) => void) => handlers.set(event, handler),
    } as never);

    const added: string[][] = [];
    const removed: string[][] = [];
    const ctx = {
      addActiveTools: (tools: string[]) => added.push(tools),
      removeActiveTools: (tools: string[]) => removed.push(tools),
      modelProfile: { kind: 'resolved', profile: { id: 'codex-compatible' } },
    };

    handlers.get('session_start')?.({}, ctx);

    expect(added).toEqual([['apply_patch']]);
    expect(removed).toEqual([['write', 'edit']]);
  });

  it('does nothing for non-Codex sessions', () => {
    const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
    codexCompatibilityExtension({
      on: (event: string, handler: (event: unknown, ctx: unknown) => void) => handlers.set(event, handler),
    } as never);
    const added: string[][] = [];
    const removed: string[][] = [];

    handlers.get('session_start')?.(
      {},
      {
        addActiveTools: (tools: string[]) => added.push(tools),
        removeActiveTools: (tools: string[]) => removed.push(tools),
        modelProfile: { kind: 'none' },
      },
    );

    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });
});

describe('applyPatch', () => {
  it('adds updates deletes and moves files', async () => {
    const cwd = tempCwd();
    writeFileSync(join(cwd, 'app.txt'), 'one\ntwo\nthree\n');
    writeFileSync(join(cwd, 'old.txt'), 'remove me\n');

    const result = await applyPatch(
      {
        patch: `*** Begin Patch
*** Update File: app.txt
@@
 one
-two
+TWO
 three
*** Add File: added.txt
+hello
+world
*** Delete File: old.txt
*** Update File: app.txt
*** Move to: moved.txt
@@
-one
+ONE
*** End Patch`,
      },
      ctx(cwd),
    );

    expect(result.text).toContain('Applied patch to 4 files.');
    expect(result.details.fileChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'app.txt',
          status: 'modified',
          additions: 1,
          deletions: 1,
          patch: expect.stringMatching(/diff --git a\/app\.txt b\/app\.txt[\s\S]* one\n-two\n\+TWO\n three/),
        }),
        expect.objectContaining({
          path: 'added.txt',
          status: 'added',
          additions: 2,
          deletions: 0,
          patch: expect.stringContaining('+++ b/added.txt'),
        }),
        expect.objectContaining({
          path: 'old.txt',
          status: 'deleted',
          additions: 0,
          deletions: 1,
          patch: expect.stringContaining('--- a/old.txt'),
        }),
        expect.objectContaining({
          path: 'moved.txt',
          previousPath: 'app.txt',
          status: 'renamed',
          additions: 1,
          deletions: 1,
          patch: expect.stringContaining('diff --git a/app.txt b/moved.txt'),
        }),
      ]),
    );
    expect(readFileSync(join(cwd, 'moved.txt'), 'utf-8')).toBe('ONE\nTWO\nthree\n');
    expect(readFileSync(join(cwd, 'added.txt'), 'utf-8')).toBe('hello\nworld\n');
  });

  it('matches hunks with trailing whitespace fuzziness', async () => {
    const cwd = tempCwd();
    writeFileSync(join(cwd, 'space.txt'), 'alpha   \nbeta\n');

    await applyPatch(
      {
        patch: `*** Begin Patch
*** Update File: space.txt
@@
-alpha
+ALPHA
 beta
*** End Patch`,
      },
      ctx(cwd),
    );

    expect(readFileSync(join(cwd, 'space.txt'), 'utf-8')).toBe('ALPHA\nbeta\n');
  });

  it('rejects repeated file operations before mutating disk', async () => {
    const cwd = tempCwd();
    writeFileSync(join(cwd, 'app.txt'), 'one\n');

    await expect(
      applyPatch(
        {
          patch: `*** Begin Patch
*** Delete File: app.txt
*** Update File: app.txt
@@
-one
+two
*** End Patch`,
        },
        ctx(cwd),
      ),
    ).rejects.toThrow('Patch touches the same file more than once');

    expect(readFileSync(join(cwd, 'app.txt'), 'utf-8')).toBe('one\n');
  });
});
