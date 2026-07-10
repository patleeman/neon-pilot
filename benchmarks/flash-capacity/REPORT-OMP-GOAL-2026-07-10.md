# OMP Goal Mode Flash Capacity Comparison

Run date: 2026-07-10

Model: `opencode-go/deepseek-v4-flash`

Interfaces compared:

- Direct Pi baseline
- System OMP `16.3.15` in ordinary prompt mode
- System OMP `16.3.15` with its built-in Goal Mode

All variants received the same ten historical worktrees, worker prompt, task contracts, native implementation tools, time budgets, hidden validation, and one-nudge-per-task policy. Goal Mode ran through OMP's interactive TUI so its durable objective, completion audit, and autonomous continuation machinery were active.

## Audited result

| Level | Task                                | OMP Goal      | Audit note                                                                                                                                                                                                                                                                        |
| ----: | ----------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | Settings shell cleanup              | accepted      | Complete and validated without a nudge.                                                                                                                                                                                                                                           |
|     1 | Native surface cleanup              | accepted      | Complete and validated without a nudge.                                                                                                                                                                                                                                           |
|     2 | Windowed app create options         | accepted      | Goal Mode eliminated the hidden-check nudge ordinary OMP needed.                                                                                                                                                                                                                  |
|     2 | Persist runtime build errors        | major rewrite | Green gates missed wrong-root persistence, cross-extension overwrite, and a dropped config field. One semantic repair fixed those issues but deleted the validation route and changed reload behavior outside scope.                                                              |
|     3 | Registry refresh after reload       | accepted      | Complete event-driven refresh path without a nudge.                                                                                                                                                                                                                               |
|     3 | Workspace files in Start search     | accepted      | Complete route/client/UI slice without a nudge.                                                                                                                                                                                                                                   |
|     4 | Home widgets and autobuild          | major rewrite | Goal Mode added real extension component loading and Home rendering, improving on ordinary OMP, but did not connect source watching to bounded rebuild and host reload.                                                                                                           |
|     4 | Desktop activity startup stalls     | major rewrite | Goal Mode persisted through failing tests and a timed-out probe, but still stored estimated message counts as catalog truth and weakened exact tail assertions instead of preserving exact-vs-approximate semantics.                                                              |
|     5 | Extension source and desktop search | major rewrite | Documents and conversation search were added and wildcard-like input is treated literally, but source containment does not resolve symlinks, the public source API lacks a convincing caller permission boundary, and visibility filtering occurs after the bounded result limit. |
|     5 | Remove gateway runtime              | major rewrite | A same-session hidden-check repair restored accidentally removed app-event topics, but release smoke, UI fixtures/projections, manifest configuration, SDK guard residue, and public documentation still reference gateways. The task's one nudge was exhausted.                  |

Audited totals:

- Passes: **5/10**
- Outcomes: **5 accepted, 5 major rewrite**
- Audited 2/2 levels: **1 and 3**
- First frontier: **level 2**
- Accepted changed lines: **482**
- Codex source edits in worker worktrees: **0**

The non-monotonic level result reflects task variance: both level-3 replays passed, while the level-2 persistence replay exposed state-root and edit-scope failures. It should not be interpreted as Goal Mode being reliably safe through level 3.

## Economics

| Measure                                           |             Pi | Ordinary OMP |  OMP Goal |
| ------------------------------------------------- | -------------: | -----------: | --------: |
| Audited worker cost                               |      $0.730504 |    $0.654101 | $0.901056 |
| Audited passes                                    |              7 |            7 |         5 |
| Accepted changed lines excluding gateway deletion |            763 |          487 |       482 |
| External repair nudges                            |              3 |            2 |         2 |
| Approximate wall time                             | not comparable |     68.5 min | 105.7 min |

Goal Mode cost includes the $0.029112 Level-5 hidden-check repair and the $0.045451 Level-2 semantic repair attempt. It cost **37.8% more than ordinary OMP** and **23.4% more than Pi**, while producing fewer audited passes. It did not meet the economic bar for making Goal Mode the default benchmark interface.

## Persistence findings

Goal Mode was real and observable, not a prompt imitation:

- It recovered from its own failed assertions, test-command mistakes, and latency-probe timeout without Codex intervention.
- It automatically continued the gateway goal after an initial completion attempt and performed another acceptance-criteria audit.
- It used durable goal state across a same-session repair.
- It eliminated ordinary OMP's Level-2 create-options nudge.

That persistence had meaningful costs:

- Level 1 cost more than twice ordinary OMP with no outcome improvement.
- Goal workers repeatedly broadened validation and investigation after the implementation was already coherent.
- The Level-2 semantic repair fixed the reported bugs but expanded into unrelated route deletion and reload behavior changes.
- Goal completion audits still missed semantic failures in persistence, autobuild, cache correctness, symlink containment, permission boundaries, and gateway residue.

The practical conclusion is that Goal Mode reduces some orchestration nudges, but it does not substitute for bounded task design or Codex semantic review. In this sample it converted fewer stops into more autonomous work, not more accepted work.

## Harness findings

The first large-session repair resume exposed an adapter bug: the harness sent `/goal set` before OMP finished restoring the TUI, silently dropping the command. The adapter now waits longer for resumed sessions and verifies that the objective reached persisted session state, retrying a dropped command before the task deadline.

One Goal worker also left a benchmark-owned Vitest child after completion. The process was terminated without touching unrelated processes. These are operational reliability costs to retain in future interface comparisons.

## Recommendation

1. Keep ordinary OMP as the preferred Flash implementation interface for now.
2. Use Goal Mode selectively for bounded tasks where autonomous test/repair loops are valuable and the write surface is narrow.
3. Do not use Goal Mode as permission to assign broader coupled product tasks; its persistence can amplify scope drift.
4. Keep one external nudge, strict elapsed/cost ceilings, isolated worktrees, and mandatory Codex semantic review.
5. Add the newly exposed semantic gates to the eval set: state-root-aware multi-extension persistence, retained route behavior, real autobuild/reload, exact-vs-approximate metadata, symlink containment, permission enforcement, visibility-before-limit, and gateway residue.

## Artifacts

- Goal run: `~/.codex/pi-orchestrator/neon-pilot-flash-capacity/omp-goal-runs/2026-07-10-omp-goal-full`
- Pi report: `benchmarks/flash-capacity/REPORT-2026-07-10.md`
- Pi vs ordinary OMP report: `benchmarks/flash-capacity/REPORT-PI-VS-OMP-2026-07-10.md`
