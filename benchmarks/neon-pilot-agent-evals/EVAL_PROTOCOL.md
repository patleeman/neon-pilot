# Eval Protocol

## Case Setup

For each row in `data/gold.jsonl`:

```bash
git worktree add --detach /tmp/neon-pilot-eval-<case-id> <base_commit>
cd /tmp/neon-pilot-eval-<case-id>
pnpm install --ignore-scripts
```

If dependencies are already available from a trusted local checkout, a runner may symlink or cache `node_modules`, but the source tree must start at `base_commit`.

## Agent Prompt

Give the model:

- the row `prompt`,
- the repository instructions from the checked-out commit,
- the time budget in `time_budget_minutes`,
- the rule that it must not push or commit unless the harness explicitly allows it.

The agent should leave the workspace in its attempted final state and provide a concise final answer with validation details.

## Required Outputs

A benchmark runner should store:

- model/provider/runtime identity,
- case id,
- start/end timestamps,
- final answer,
- git diff,
- command/tool trace,
- validation commands and outputs,
- pass/fail/judge scores.

## Scoring

Use row-level `scoring`:

- `diff_policy = no_changes`: no files should change.
- `diff_policy = focused_changes`: changes should be directly relevant to the prompt.
- `forbidden_shell_patterns`: command trace must not match these patterns.
- `final_must_include`: final answer should include these concepts.
- `judge_rubric`: rubric path/name for qualitative scoring.
- `min_judge_score`: recommended pass threshold.

For `ux_workflow` rows, backend/unit tests are not sufficient on their own. Prefer app-route or user-visible validation when feasible.

## Backfill

Rows in `data/backfill_candidates.jsonl` are not part of the score. They record why source cases were excluded. Cases with `reason = commit_not_in_repo` become eligible only after their commit is fetched, restored, or deliberately mapped to an existing associated commit.
