import { describe, expect, it } from 'vitest';

import { readFileChanges, readFileChangesForToolBlock } from './FileChangesToolDiff.js';

describe('readFileChanges', () => {
  it('normalizes standard fileChanges metadata', () => {
    expect(
      readFileChanges({
        fileChanges: [
          {
            path: 'src/app.ts',
            previousPath: 'src/old.ts',
            status: 'renamed',
            additions: 3,
            deletions: 1,
            patch: 'diff --git a/src/old.ts b/src/app.ts',
          },
          { path: '', status: 'modified' },
          { path: 'bad.ts', status: 'wat' },
        ],
      }),
    ).toEqual([
      {
        path: 'src/app.ts',
        previousPath: 'src/old.ts',
        status: 'renamed',
        additions: 3,
        deletions: 1,
        patch: 'diff --git a/src/old.ts b/src/app.ts',
        truncated: false,
      },
    ]);
  });

  it('ignores malformed details', () => {
    expect(readFileChanges(null)).toEqual([]);
    expect(readFileChanges({ fileChanges: 'nope' })).toEqual([]);
  });

  it('reads manifest tool wrapper result metadata', () => {
    expect(
      readFileChanges({
        result: {
          fileChanges: [{ path: 'src/app.ts', status: 'modified', additions: 1, deletions: 1 }],
        },
      }),
    ).toEqual([expect.objectContaining({ path: 'src/app.ts', status: 'modified', additions: 1, deletions: 1 })]);
  });

  it('derives an added-file diff for write tool blocks', () => {
    expect(readFileChangesForToolBlock({ tool: 'write', input: { path: 'demo.txt', content: 'one\ntwo\n' } })).toEqual([
      expect.objectContaining({
        path: 'demo.txt',
        status: 'added',
        additions: 2,
        deletions: 0,
        patch: expect.stringContaining('+one\n+two'),
      }),
    ]);
  });
});
