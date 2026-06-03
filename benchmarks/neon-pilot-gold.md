# Neon Pilot Gold Agent Benchmark

Source dataset: `patrickleenyc/personal-agent-evals`

Selected runnable cases: 8
Excluded source cases: 199

## Lane Counts

- scoped_fix: 7
- ux_workflow: 1

## Exclusion Counts

- commit_not_in_repo: 176
- duplicate_case_id: 23

## Runnable Cases

| ID                                           | Lane        | Base commit | Subject                                                             |
| -------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------- |
| `wtf-gateway-timeouts-validation-001`        | scoped_fix  | `7f347b47`  | gateway: keep typing indicator alive during active runs             |
| `wtf-tool-calls-missing-transcript-001`      | scoped_fix  | `a0bf45d6`  | fix: ignore stale live snapshot replay                              |
| `wtf-automations-state-broken-001`           | scoped_fix  | `6f2d7ac8`  | chore: checkpoint current personal-agent updates                    |
| `wtf-note-editor-wrong-direction-001`        | scoped_fix  | `e34182c9`  | refactor: replace markdown document editors with TipTap             |
| `information-architecture-runs-settings-001` | ux_workflow | `40276c35`  | fix: restore settings control center links                          |
| `wtf-deleted-feature-regression-001`         | scoped_fix  | `83b0dd5d`  | feat: rename knowledge nodes to pages                               |
| `wtf-missing-compaction-progress-001`        | scoped_fix  | `29ae4a42`  | Show 'Compacting context…' indicator when session compaction starts |
| `wtf-failed-feature-rethink-001`             | scoped_fix  | `6e5657a0`  | fix: retry reply menu sync across browser selection timing          |

## Notes

- Every selected case has an associated commit that resolves in this repository via `git cat-file -e <commit>^{commit}`.
- Every selected case was also checked for a recognizable Neon Pilot repo shape at that commit (`package.json`, `docs`, and `packages`).
- The suite is intentionally small for v0 because missing commits make many mined cases non-runnable without backfill.
- Backfill candidates should start with excluded `commit_not_in_repo` and `missing_base_commit` cases.
