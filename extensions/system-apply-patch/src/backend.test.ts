import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { applyPatch, applyPatchEdit } from './backend.js';

function tempCwd(): string {
  return mkdtempSync(join(tmpdir(), 'pa-apply-patch-'));
}

function ctx(cwd: string) {
  return { toolContext: { cwd } } as never;
}

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
});

describe('applyPatchEdit', () => {
  it('accepts legacy edit input', async () => {
    const cwd = tempCwd();
    writeFileSync(join(cwd, 'legacy.txt'), 'hello\n');

    await applyPatchEdit({ path: 'legacy.txt', edits: [{ oldText: 'hello', newText: 'hi' }] }, ctx(cwd));

    expect(readFileSync(join(cwd, 'legacy.txt'), 'utf-8')).toBe('hi\n');
  });
});
