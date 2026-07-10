# Pi vs OMP Flash Capacity Comparison

Run date: 2026-07-10

Model: `opencode-go/deepseek-v4-flash`

Interfaces:

- Direct Pi, as recorded in `REPORT-2026-07-10.md`
- System OMP `16.3.15`, using its default native implementation tools

Both interfaces received the same worker prompt, historical worktrees, setup builds, task contracts, time budgets, one-nudge limit, and hidden validation. OMP documentation: <https://omp.sh/#tools>.

## Audited result

| Level | Task                                | Pi            | OMP           | OMP audit note                                                                                                                                           |
| ----: | ----------------------------------- | ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | Settings shell cleanup              | accepted      | accepted      | Complete, slightly broader adjacent test cleanup.                                                                                                        |
|     1 | Native surface cleanup              | accepted      | accepted      | Complete and focused.                                                                                                                                    |
|     2 | Windowed app create options         | accepted      | minor repair  | Repaired one hidden validation failure in-session.                                                                                                       |
|     2 | Persist runtime build errors        | minor repair  | accepted      | Durable state-root-scoped config design with focused coverage.                                                                                           |
|     3 | Registry refresh after reload       | accepted      | accepted      | Complete event-driven refresh path.                                                                                                                      |
|     3 | Workspace files in Start search     | minor repair  | accepted      | Complete route/client/UI slice without a nudge.                                                                                                          |
|     4 | Home widgets and autobuild          | major rewrite | major rewrite | Green gates were false: contributed extension components were not loaded and the source watcher was not connected to host reload.                        |
|     4 | Desktop activity startup stalls     | major rewrite | major rewrite | OMP added a fast scan and latency test, but cached partial metadata as exact and marked the catalog complete without the claimed enrichment path.        |
|     5 | Extension source and desktop search | major rewrite | major rewrite | Documents search was absent, wildcard literals were escaped into non-matching text, and source reads did not resolve symlinks before containment checks. |
|     5 | Remove gateway runtime              | minor repair  | minor repair  | One semantic nudge removed release smoke, Electron fixture, UI projection, public type, SDK, and guard-script residue; all final gates passed.           |

Both interfaces therefore finish at:

- Audited passes: **7/10**
- Reliable ceiling: **level 3**
- First break: **level 4**
- Level 5: **frontier, 1/2**

## Economics

| Measure                                           |        Pi |       OMP |
| ------------------------------------------------- | --------: | --------: |
| Audited worker cost                               | $0.730504 | $0.654101 |
| Audited passes                                    |         7 |         7 |
| Accepted changed lines                            |     7,947 |     7,685 |
| Accepted changed lines excluding gateway deletion |       763 |       487 |
| Valid repair nudges                               |         3 |         2 |
| Codex source edits in worker worktrees            |         0 |         0 |

OMP cost includes the $0.037073 semantic repair nudge for gateway cleanup and excludes the discarded $0.015536 adapter smoke. It was $0.076403, or **10.5%**, cheaper than Pi for the same audited pass count.

OMP's ten initial task runs used about 63.5 minutes of level-by-level parallel wall time. The gateway semantic repair added about five minutes. Pi elapsed time is not directly comparable because its run was split across recovery artifacts and one level-4 task did not produce a result record.

## What differed

OMP was stronger on level-2 and level-3 implementation ownership. It completed the registry refresh and workspace search tasks without the repairs Pi needed, and its LSP/read/search tools helped it map broader ownership paths quickly. OMP also produced a much more substantial startup-performance attempt than Pi.

That extra activity did not raise the audited capacity ceiling. OMP produced three automated false greens at levels 4-5, including one performance implementation whose comments promised background enrichment that did not exist. Its raw 10/10 result would have been dangerously misleading without Codex semantic review.

Pi and OMP failed the same coupled product tasks for similar reasons: they could build many locally coherent pieces, but did not close the full public-contract, backend, lifecycle, and visible-product loop. Large mechanical deletion remained easier than smaller coupled product composition.

## Recommendation

1. Keep the default delegation ceiling at level 3 for either interface.
2. Prefer OMP for future Flash implementation lanes when the task is level 2-3 or mechanically broad. It achieved the same audited throughput at lower cost and needed fewer repairs in this sample.
3. Do not treat OMP's green tests or confident final report as stronger evidence than Pi's. Keep Codex semantic review mandatory for product, lifecycle, security, persistence, and performance claims.
4. Split level-4/5 coupled outcomes into independently testable vertical slices unless the repository already has one clear owner path.
5. Add hidden gates for the failures exposed here: real extension component loading/reload, exact-vs-approximate session metadata cache behavior, Documents search visibility/wildcards, symlink containment, and release/fixture residue.

## Artifacts

- Pi report: `benchmarks/flash-capacity/REPORT-2026-07-10.md`
- OMP run: `~/.codex/pi-orchestrator/neon-pilot-flash-capacity/omp-runs/2026-07-10-omp-full`
- OMP adapter smoke: `~/.codex/pi-orchestrator/neon-pilot-flash-capacity/omp-runs/2026-07-10-omp-smoke-l1-a`
- OMP adapter commit: `97b8c58ad`
