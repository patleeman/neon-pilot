# Flash Capacity Eval Protocol

## Setup

For each task, create a clean detached worktree at `base_commit`:

```bash
git worktree add --detach /tmp/neon-pilot-flash-<task-id> <base_commit>
cd /tmp/neon-pilot-flash-<task-id>
pnpm install --ignore-scripts
```

Reuse a trusted dependency cache when practical, but never reuse source changes or a worker session across tasks.

## Worker input

Give Flash only:

- `prompt`
- `acceptance_criteria`
- `agent_validation_expectations`
- `time_budget_minutes`
- the repository instructions available at the base commit
- the shared Flash worker prompt used by the active orchestration policy

Do not expose `reference_commit`, `grader.reference_diff`, `grader.expected_paths`, or `grader.hidden_validation`. Tell the worker that other agents may be active, it must avoid unrelated files, and it must not commit, push, release, or use destructive Git commands.

## Invocation

Use direct Pi with a fresh session per task:

```bash
pi --mode json --session-dir <run-dir>/sessions --session-id <task-id> --approve \
  --provider opencode-go --model deepseek-v4-flash \
  -p @<run-dir>/<task-id>.prompt.md > <run-dir>/<task-id>.jsonl
```

Do not restrict implementation tools. Redirect the raw JSON stream directly to disk so it does not consume Codex context. Extract only the final response, command failures, usage, elapsed time, and completion markers for orchestration.

## Intervention policy

- Give the initial worker the full task-level contract.
- Allow at most one corrective nudge in the same Pi session.
- A nudge may identify a failed acceptance criterion or validation failure, but must not prescribe the exact patch.
- Freeze the workspace when the worker reports completion or leaves a coherent diff.
- Stop the suite immediately on destructive behavior, credential access, a release action, or a material write outside the worktree.

## Required artifacts

Store these under one timestamped run directory:

- suite and task identifiers
- model, provider, Pi version, base commit, and repository HEAD
- rendered worker prompt
- raw Pi JSONL log and final response
- start/end timestamps, elapsed time, token usage, and cost
- nudge prompt when used
- final Git status and diff
- worker-run validation commands and outputs
- grader-run hidden validation commands and outputs
- hard-gate results, rubric score, outcome class, and Codex repair notes

## Grading

1. Apply the hard gates in `rubric.md`.
2. Run every `grader.hidden_validation` command from the task worktree.
3. Review behavior against acceptance criteria and reference intent, not textual diff similarity.
4. Classify the result as `accepted`, `minor_repair`, `major_rewrite`, `discarded`, or `empty`.
5. Record Codex review and repair time separately from worker time.
6. Compute task and level results using `rubric.md`.

The reference diff is evidence for task feasibility and likely ownership boundaries. It is not automatically the only correct implementation.
