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
- `--require-visual`: fail the case unless screenshot-backed visual review artifacts are present.
- `--runner=protocol|ask`: protocol is the default and should be used for coding-agent evals; ask is kept only for debugging.
- `--dry-run`: print planned commands without creating worktrees or invoking Neon Pilot.
- `--keep-worktrees`: keep worktrees after each case. By default they are removed.

## Visual Review

Build, doctor, static checks, and source heuristics do **not** prove that the extension looks good. They only prove that it is loadable and follows some structural rules.

For each case, the runner writes `<case-id>/visual-review.md` with the expected screenshot/review contract. A case has screenshot-backed visual evidence only when both exist:

- `<case-id>/screenshots/*.png`
- `<case-id>/visual-review.json`

Run with `--require-visual` when the eval is meant to answer whether the extension one-shots the user-facing UI. Without that flag, missing visual evidence is recorded as a warning so structural runs can still be used for fast debugging.

The visual review should inspect the extension in the real Neon Pilot host, not a fake isolated React preview. Review the primary surface plus at least one empty/error/loading or secondary state for:

- hierarchy, density, alignment, and readable typography
- host consistency with shared UI primitives
- long-content wrapping/truncation without overlap
- distinct empty/loading/error/success/disabled/long-running states
- labeled icon controls and visible focus behavior
- absence of nested cards, decorative chips, bespoke chrome, and one-note color styling

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
- `<case-id>/visual-review.md` with the required screenshot-backed visual review checklist
- `<case-id>/screenshots/` and `<case-id>/visual-review.json` when a real visual pass has been completed
- `summary.json`

Use `rubric.md` to score the diff and artifacts. Hard-gate failures should be recorded before assigning qualitative scores.
