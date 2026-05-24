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

  it('derives a display diff for edit tool input when metadata is absent', () => {
    expect(
      readFileChangesForToolBlock({
        tool: 'edit',
        input: {
          path: 'src/app.ts',
          edits: [
            {
              oldText: 'const label = "old";\n',
              newText: 'const label = "new";\nconst enabled = true;\n',
            },
          ],
        },
        details: null,
      }),
    ).toEqual([
      expect.objectContaining({
        path: 'src/app.ts',
        status: 'modified',
        additions: 2,
        deletions: 1,
        patch: expect.stringContaining('-const label = "old";\n+const label = "new";'),
      }),
    ]);
  });

  it('does not derive file changes from non-edit tool input', () => {
    expect(readFileChangesForToolBlock({ details: null })).toEqual([]);
  });
});
