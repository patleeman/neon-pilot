import { describe, expect, it } from 'vitest';

import { buildLiveSessionContextResponse } from './localApiLiveSessionContextResponse';

describe('localApiLiveSessionContextResponse', () => {
  it('builds context response without git summary', () => {
    expect(buildLiveSessionContextResponse({ cwd: '/repo', gitSummary: null })).toEqual({ cwd: '/repo', branch: null, git: null });
  });

  it('builds context response with flattened git summary', () => {
    expect(
      buildLiveSessionContextResponse({
        cwd: '/repo',
        gitSummary: {
          branch: 'main',
          changeCount: 1,
          linesAdded: 2,
          linesDeleted: 3,
          changes: [{ relativePath: 'a.ts', change: 'modified', extra: true } as { relativePath: string; change: string }],
        },
      }),
    ).toEqual({
      cwd: '/repo',
      branch: 'main',
      git: {
        changeCount: 1,
        linesAdded: 2,
        linesDeleted: 3,
        changes: [{ relativePath: 'a.ts', change: 'modified' }],
      },
    });
  });
});
