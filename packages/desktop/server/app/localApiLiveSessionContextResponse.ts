export interface GitStatusSummaryLike {
  branch?: string | null;
  changeCount: number;
  linesAdded: number;
  linesDeleted: number;
  changes: Array<{ relativePath: string; change: string }>;
}

export function buildLiveSessionContextResponse(input: { cwd: string; gitSummary: GitStatusSummaryLike | null | undefined }): {
  cwd: string;
  branch: string | null;
  git: null | {
    changeCount: number;
    linesAdded: number;
    linesDeleted: number;
    changes: Array<{ relativePath: string; change: string }>;
  };
} {
  return {
    cwd: input.cwd,
    branch: input.gitSummary?.branch ?? null,
    git: input.gitSummary
      ? {
          changeCount: input.gitSummary.changeCount,
          linesAdded: input.gitSummary.linesAdded,
          linesDeleted: input.gitSummary.linesDeleted,
          changes: input.gitSummary.changes.map((change) => ({
            relativePath: change.relativePath,
            change: change.change,
          })),
        }
      : null,
  };
}
