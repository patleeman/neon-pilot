import { describe, expect, it } from 'vitest';

import { readFileChanges } from './FileChangesToolDiff.js';

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
});
