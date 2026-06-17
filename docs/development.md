# Development Workflow

Use this page for day-to-day repo development, validation, UI QA, and targeted checkpoints.

## Local development

```bash
pnpm install
pnpm run setup:hooks   # optional: enable tracked git hooks
pnpm run build
pnpm run desktop:start
```

The repo intentionally avoids a root `postinstall`. Third-party build scripts are allowlisted in `pnpm-workspace.yaml`; new blocked scripts appear in `pnpm ignored-builds`.

For the desktop dev app:

```bash
cd packages/desktop && pnpm run dev
# or from repo root:
pnpm run desktop:dev
```

## Validation

Pick checks based on the change. Do not run the whole world for a docs-only edit; do run product-specific tests when behavior changes.

```bash
pnpm run fix      # prettier --write + eslint --fix
pnpm run check    # types, lint, format, full test suite, extension static checks, knip advisory
```

Focused checks:

| Command                           | Use when                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm run check:types`            | TypeScript/import/unused-symbol risk                                                |
| `pnpm run lint`                   | Lint/import-order risk                                                              |
| `pnpm run fmt`                    | Formatting-only verification                                                        |
| `pnpm test`                       | Broad regression pass; deterministic unit, integration, smoke, and regression tests |
| `pnpm run test:extensions`        | Focused extension runtime smoke tests                                               |
| `pnpm run check:extensions`       | Extension static checks plus focused extension smoke tests                          |
| `pnpm run test:release-hardening` | Focused tests for release smoke wiring and the extension golden matrix              |
| `pnpm run check:coverage`         | Periodic coverage review; advisory, not blocking                                    |

`check:extensions:static` enforces the extension/core boundary. Extension runtime source and fenced markdown examples in extension docs must use `@neon-pilot/extensions` public APIs instead of importing `@neon-pilot/core`, `@neon-pilot/desktop`, or app package internals directly. Host backend API modules must stay narrow and lazy-load host implementations rather than statically re-exporting core/desktop modules.

Use `pnpm test` as the default single command for behavior regressions. Keep standalone smoke scripts only for live-app or external-environment checks that should not run in every deterministic test pass.

Startup idle smoke:

```bash
pnpm run smoke:startup-idle -- --seconds=30 --sessions=2500 --blocks=80
```

This creates a temporary old-profile fixture with many historical conversations and no conversation context DB, launches the desktop app against that state root, samples CPU, and fails if idle startup spawns local model processes or sustains excessive CPU. Use `--app="/Applications/Neon Pilot RC.app"` to test a packaged app instead of the dev launcher.

The npm script uses a loose CPU threshold because the dev launcher may include build-tool CPU. RC/release publishing passes `--app` and uses the stricter packaged-app threshold.

Desktop performance smoke:

```bash
pnpm run perf:desktop -- --app="/Applications/Neon Pilot RC.app" --sessions=2500 --blocks=80 --seconds=30
```

This runs the fuller startup/application performance suite against a packaged app: app-shell readiness, old-profile idle CPU, draft submit click-to-visible timing, pending prompt paint, route switches, model fetch, conversation search, long-transcript open, previous-page loading, recovery, fork/rewind creation and open-time checks, basic interaction timing, and renderer heap delta. Pass `--skip-fork` only for a deliberately narrower local run. `appUsableMs` is the startup readiness gate: it waits for React hydration, an enabled composer, and the extension registry/critical extension UI to be available. `startupReadyMs` and `appHydratedMs` are diagnostic paint/hydration timings, not sufficient readiness on their own. `draftSubmitVisibleMs` measures from clicking Send on `/conversations/new` until the submitted prompt is visible on the saved conversation route; setup time to navigate to the draft page is reported separately as `draftSubmitSetupMs`. `draftSubmitPendingPromptBlockVisibleMs`, `longTranscriptLoadPreviousMs`, repeated conversation switch max, recovery/open timings, and fork/rewind open timings are enforced separately so regressions do not hide inside a broad pass. The smoke refuses stale desktop UI/server/main bundles for the source files it covers; rebuild the touched bundle first when it reports a stale output.

Packaged extension golden smoke:

```bash
pnpm run smoke:release-extensions -- --app="/Applications/Neon Pilot RC.app"
```

This launches the packaged app with isolated state, config, knowledge, user-data, HOME, and XDG roots, reads `scripts/release-extension-golden-matrix.json`, verifies required extensions are enabled in the real registry, opens every golden extension route, checks expected agent tools through `/api/tools`, and invokes representative backend/tool actions through `/api/extensions/:id/actions/:actionId`. Add release-critical extension workflows to the matrix when a regression would block a release or when a new extension surface becomes part of the expected app experience. The matrix also supports installable package zips and catalog installs so optional first-party extension artifacts can be promoted through the same gate.

For local iteration on transcript/new-conversation latency, prefer the Testing app instead of RC so release state stays untouched:

```bash
pnpm run perf:desktop -- --app="$PWD/dist/dev-desktop/Neon Pilot Testing.app" --sessions=400 --blocks=5000 --seconds=3 --idle-settle-ms=5000
```

Use `--draft-submit-wait-ms=<ms>` to simulate a user waiting/typing before sending. For release candidates, use:

```bash
pnpm run perf:desktop -- --app="/Applications/Neon Pilot RC.app" --sessions=2500 --blocks=80 --seconds=30 --max-ready-ms=5000 --max-cpu=120
```

If the pre-commit hook reports pre-existing baseline issues, make sure the task did not add new ones and document the constraint.

Agent gold benchmark:

```bash
pnpm run bench:agent -- --output=benchmarks/neon-pilot-gold.jsonl --report=benchmarks/neon-pilot-gold.md
```

This builds a 20-minute-per-task gold benchmark suite from `patrickleenyc/personal-agent-evals`. It joins shaped cases with commit-resolution metadata, deduplicates repeated generated cases, and includes only cases whose selected/base commit exists in the Neon Pilot git history. The benchmark is meant for model-comparable agent runs that measure diagnosis, scoped fixes, UX workflow judgment, instruction following, and validation quality on real Neon Pilot work.

The dataset is private/gated, so the script reads `HF_TOKEN` or `~/.cache/huggingface/token`. Use `--limit=<n>` to tune suite size. Cases excluded because their commits are missing should be treated as backfill candidates, not benchmark-ready gold.

The packaged dataset lives in `benchmarks/neon-pilot-agent-evals/` and is published privately at `patrickleenyc/neon-pilot-agent-evals` on Hugging Face. It includes a runnable `gold` config and a non-scoring `backfill_candidates` config.

## Web UI and desktop QA

If you modify web UI, inspect it visually before signing off. Avoid raw `agent-browser`; use the repo wrapper so sessions close cleanly:

```bash
pnpm run ab:run -- --session <name> --command "ab ..."
pnpm run ab:cleanup -- --session <name>
```

When launching the test desktop app for QA, pass a non-interactive quit flag:

```bash
pnpm run desktop:dev -- --remote-debugging-port=9222 --no-quit-confirmation
```

Desktop runtime channels are intentionally isolated under the `neon-pilot*` namespace. Stable uses `neon-pilot`; RC uses `neon-pilot-rc`; dev uses `neon-pilot-dev`; test launches use `neon-pilot-testing`. The user-facing CLI command remains `neon-pilot` for every channel; channel-local app shells prepend that channel's managed CLI bin directory, and user shell installation is opt-in with `neon-pilot cli install`. Dev/test ports default to random/unset (`0`) and each dev/test app process gets a unique `NEON_PILOT_DAEMON_NAMESPACE` unless one is explicitly provided, so multiple dev/test app invocations do not share daemon sockets, pid locks, runtime DBs, or companion ports. Override only for dev/test with `NEON_PILOT_RUNTIME_CHANNEL`, `NEON_PILOT_DAEMON_NAMESPACE`, or `NEON_PILOT_DAEMON_SOCKET_PATH`.

Before launching or closing `Neon Pilot Testing.app`, check whether another instance already exists. Do not quit, kill, or recycle a process you did not start; connect to it when appropriate or use a separate debug port/session. After QA, close only the app process and browser session you started.

## Checkpoints

Before final summary, use the checkpoint skill/tool. In this repo, checkpoint commits go directly to `main`; no branch is needed.

Rules:

- Stage only files for the current task.
- If unrelated work is mixed into a file and cannot be safely separated, stop and tell Patrick.
- Do not manually `git add`, `git commit`, or `git push`; use the checkpoint tool.

## Secret scanning

The tracked pre-commit hook lives at `.githooks/pre-commit` and runs gitleaks, typecheck, prettier, and eslint on staged files. Enable it with:

```bash
pnpm run setup:hooks
# or:
git config core.hooksPath .githooks
```

Install gitleaks locally with `brew install gitleaks` if needed. If gitleaks flags staged content, fix it unless it is a clear false positive; bypass only deliberately with `git commit --no-verify`.
