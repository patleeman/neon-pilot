# Flash Capacity Eval

This suite measures how much coherent Neon Pilot implementation work can be delegated to Flash before Codex review and repair costs erase the benefit. It is a capacity benchmark, not a patch-reproduction benchmark: the worker must satisfy the task contract, but it does not need to recreate the historical reference diff exactly.

The suite contains two historical replay tasks at each of five levels:

| Level | Name             | Intended scope                                        |  Budget |
| ----- | ---------------- | ----------------------------------------------------- | ------: |
| 1     | `micro_change`   | One narrow cleanup or contract adjustment             |  15 min |
| 2     | `subsystem_task` | One complete backend or client subsystem task         |  30 min |
| 3     | `vertical_slice` | A feature crossing backend, contracts, UI, and tests  |  45 min |
| 4     | `roadmap_item`   | A substantial roadmap item with multiple moving parts |  75 min |
| 5     | `phase_chunk`    | A broad phase chunk or subsystem removal              | 120 min |

Each task starts from the parent of a known-good historical commit. The public worker input is limited to the task prompt, acceptance criteria, validation expectations, repository instructions, and time budget. Reference commits, expected paths, exact diff statistics, and hidden validation commands remain grader-only.

## Files

- `manifest.json`: suite defaults, level definitions, and progression policy.
- `tasks.jsonl`: ten replay tasks and grader metadata.
- `schema.json`: task record schema.
- `EVAL_PROTOCOL.md`: future runner contract and artifact requirements.
- `rubric.md`: hard gates, scoring, and capacity interpretation.

## Validate the set

```bash
pnpm run eval:flash-capacity:validate
```

The validator checks schema invariants, level balance, commit existence, parent relationships, reference diff statistics, hidden path existence, and prompt leakage. It does not run Flash.

## Run the benchmark

```bash
pnpm run eval:flash-capacity
```

Use `pnpm run eval:flash-capacity:omp` for the equivalent system OMP run. You can also pass `-- --interface=pi|omp`, `-- --level=3`, `-- --min-level=2`, `-- --max-level=4`, `-- --task=<task-id>`, or `-- --run-dir=<absolute-path>` to choose an interface, filter, or relocate a run. The runner executes two isolated tasks per level in parallel with `opencode-go/deepseek-v4-flash`, each interface's full native implementation tools, at most one corrective nudge, and no commits or pushes. It suppresses partial JSON event streams from Codex context and retains compact completed events as artifacts for later inspection.

Pi and OMP comparisons use identical task prompts, historical worktrees, setup, time budgets, nudge policy, and hidden grading. Native tool behavior is deliberately not normalized away: the purpose of the comparison is to measure each interface as an implementation delegate, while attributing all model usage and cost reported by that interface to its result.

The result is not a single pass rate. The useful outputs are the reliable ceiling, frontier, break level, accepted implementation volume, Codex rework, nudges, elapsed time, and worker cost. See `rubric.md` for exact definitions.

Recorded reports:

- `REPORT-2026-07-10.md`: direct Pi baseline
- `REPORT-PI-VS-OMP-2026-07-10.md`: audited system OMP comparison
