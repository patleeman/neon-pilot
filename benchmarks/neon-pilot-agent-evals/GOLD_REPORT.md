# Neon Pilot Gold Agent Benchmark

Source dataset: `patrickleenyc/personal-agent-evals`

Selected runnable cases: 13
Excluded source cases: 194

## Lane Counts

- scoped_fix: 11
- ux_workflow: 2

## Exclusion Counts

- commit_not_in_repo: 171
- duplicate_case_id: 23

## Commit Selection

- primary_resolution_commit: 8
- existing_resolution_candidate: 5

## Runnable Cases

| ID                                           | Lane        | Base commit | Subject                                                             |
| -------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------- |
| `wtf-gateway-timeouts-validation-001`        | scoped_fix  | `7f347b47`  | gateway: keep typing indicator alive during active runs             |
| `wtf-tool-calls-missing-transcript-001`      | scoped_fix  | `a0bf45d6`  | fix: ignore stale live snapshot replay                              |
| `wtf-automations-state-broken-001`           | scoped_fix  | `6f2d7ac8`  | chore: checkpoint current personal-agent updates                    |
| `wtf-note-editor-wrong-direction-001`        | scoped_fix  | `e34182c9`  | refactor: replace markdown document editors with TipTap             |
| `information-architecture-runs-settings-001` | ux_workflow | `40276c35`  | fix: restore settings control center links                          |
| `wtf-beachball-validation-performance-001`   | scoped_fix  | `ec797de9`  | fix: keep large-conversation typing responsive                      |
| `wtf-context-menu-latency-001`               | scoped_fix  | `ec797de9`  | fix: keep large-conversation typing responsive                      |
| `wtf-deleted-feature-regression-001`         | scoped_fix  | `83b0dd5d`  | feat: rename knowledge nodes to pages                               |
| `wtf-missing-compaction-progress-001`        | scoped_fix  | `29ae4a42`  | Show 'Compacting context…' indicator when session compaction starts |
| `wtf-qr-pairing-validation-001`              | scoped_fix  | `8cb969a2`  | fix: sync entire managed sync root                                  |
| `wtf-toggle-still-broken-001`                | scoped_fix  | `ef5d76a2`  | chore(datadog): memory maintenance 2026-03-11                       |
| `wtf-failed-feature-rethink-001`             | scoped_fix  | `6e5657a0`  | fix: retry reply menu sync across browser selection timing          |
| `wtf-sidebar-scope-misread-001`              | ux_workflow | `d8638978`  | fix: harden gateway synthetic follow-up handling                    |

## Notes

- Every selected case has an associated commit that resolves in this repository via `git cat-file -e <commit>^{commit}`.
- Every selected case was also checked for a recognizable Neon Pilot repo shape at that commit (`package.json`, `docs`, and `packages`).
- Cases using `existing_resolution_candidate` have a missing primary selected/recommended commit, but another associated commit candidate exists locally.
- The suite is intentionally small for v0 because missing commits still make many mined cases non-runnable without backfill.
- Backfill candidates should start with excluded `commit_not_in_repo` and `missing_base_commit` cases.
