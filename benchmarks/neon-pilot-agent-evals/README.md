---
license: mit
task_categories:
  - text-generation
  - question-answering
language:
  - en
tags:
  - agent-eval
  - coding-agent
  - neon-pilot
  - software-engineering
  - benchmark
pretty_name: Neon Pilot Agent Evals
size_categories:
  - n<1K
configs:
  - config_name: gold
    data_files:
      - split: train
        path: data/gold.jsonl
  - config_name: backfill_candidates
    data_files:
      - split: train
        path: data/backfill_candidates.jsonl
---

# Neon Pilot Agent Evals

This dataset evaluates coding agents on real Neon Pilot work. Neon Pilot was previously named `personal-agent`; source cases come from `patrickleenyc/personal-agent-evals` and are normalized here for the renamed repository.

The `gold` split is the runnable benchmark. Every row has:

- a realistic user prompt,
- a 20 minute target budget,
- a base commit that resolves in the Neon Pilot git history,
- a scoped lane such as `scoped_fix` or `ux_workflow`,
- validation expectations,
- scoring metadata,
- review evidence showing the case is runnable from the selected commit.

The `backfill_candidates` split records audited source cases that are not yet benchmark-ready, usually because their primary commit does not resolve in the current repository history.

## Intended Use

Use this dataset to compare models or agent runtimes on typical Neon Pilot work:

1. Create an isolated worktree at `base_commit`.
2. Give the model the row `prompt`.
3. Enforce `time_budget_minutes`.
4. Capture final answer, diff, command trace, and validation output.
5. Score with the row `scoring` policy and the rubric named in `scoring.judge_rubric`.

The benchmark measures repo navigation, root-cause analysis, focused implementation, UX/product judgment, validation quality, and instruction following.

## Splits

### `gold`

Runnable model-comparison cases. These are suitable for regular benchmark runs.

### `backfill_candidates`

Non-runnable or duplicate source cases retained for audit/backfill. These should not be included in model scorecards until their commits are repaired or mapped.

## Caveats

- Some gold rows use `review.commit_strategy = existing_resolution_candidate`. That means the primary selected/recommended commit from the source resolution is missing, but another associated commit candidate exists locally and was selected to keep the case runnable.
- This is a small v0 suite. It favors real, checkout-able cases over breadth.
- User-facing validation may require Neon Pilot desktop/app setup in addition to unit tests.
