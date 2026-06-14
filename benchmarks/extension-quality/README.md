# Extension Quality Eval

This suite evaluates whether Neon Pilot can one-shot useful native extensions with strong frontend UX and backend/runtime quality.

The system under test is **Neon Pilot itself** running a target model. The default target is:

```text
opencode-go/deepseek-v4-flash
```

Each case creates an isolated git worktree, starts a Neon Pilot agent-protocol run to build one extension from the task prompt, captures logs, diff, and optional validation output, then leaves artifacts for human or model-assisted review.

## Run

Dry-run the commands first:

```bash
pnpm run eval:extension-quality -- --limit=1 --dry-run
```

Run one case through Neon Pilot:

```bash
pnpm run eval:extension-quality -- \
  --limit=1 \
  --model=opencode-go/deepseek-v4-flash \
  --timeout-ms=1800000
```

Useful options:

- `--cases=<path>`: JSONL case file. Defaults to `benchmarks/extension-quality/tasks.jsonl`.
- `--out=<path>`: artifact directory. Defaults to `artifacts/extension-quality/<timestamp>`.
- `--model=<provider/model>`: Neon Pilot model ref.
- `--case=<id>`: run one case by id.
- `--limit=<n>`: run the first `n` selected cases.
- `--timeout-ms=<ms>`: per-case Neon Pilot timeout.
- `--validate`: run case validation commands after the agent turn.
- `--runner=protocol|ask`: protocol is the default and should be used for coding-agent evals; ask is kept only for debugging.
- `--dry-run`: print planned commands without creating worktrees or invoking Neon Pilot.
- `--keep-worktrees`: keep worktrees after each case. By default they are removed.

## Case Contract

Rows in `tasks.jsonl` are JSON objects with:

- `id`: stable case id.
- `surface`: expected primary extension surface.
- `prompt`: user-facing task prompt given to Neon Pilot.
- `expected`: concise acceptance bullets.
- `validation`: shell commands to run from the isolated worktree when `--validate` is set.
- `scoring`: rubric metadata and hard gates.

The runner wraps each prompt with common instructions requiring a UX brief, one-shot implementation, build/reload/validation notes, and no checkpoint commit inside the worktree.

## Artifacts

Each case writes:

- `<case-id>/prompt.txt`
- `<case-id>/neon-pilot-start.stdout.txt`
- `<case-id>/neon-pilot-wait.stdout.txt`
- `<case-id>/neon-pilot-logs.txt`
- `<case-id>/git-status.txt`
- `<case-id>/diff.patch`
- `<case-id>/validation.json` when `--validate` is used
- `<case-id>/quality.json` with lightweight rubric heuristics such as confirmation, command deep-linking, shared UI imports, backend boundaries, and dist size
- `summary.json`

Use `rubric.md` to score the diff and artifacts. Hard-gate failures should be recorded before assigning qualitative scores.
