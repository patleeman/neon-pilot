---
name: neon-pilot-parallel-qa
description: Use when running Neon Pilot feature QA from docs/feature-qa-status.md with parallel discover-and-fix worker agents, isolated dev app instances, evidence collection, bug queue triage, and parent-owned final validation/status updates.
metadata:
  short-description: Parallel Neon Pilot feature QA
---

# Neon Pilot Parallel QA

Use this skill to turn the feature inventory QA process into a parallel discover-and-fix worker pipeline without losing strict evidence quality.

## Ground Rules

- `docs/feature-qa-status.md` is the canonical feature queue.
- The parent agent is the only authority that updates `docs/feature-inventory.md`, `docs/feature-qa-status.md`, and any findings queue.
- Worker output is evidence and candidate fixes, not completion proof. The parent must validate before changing a row status.
- Workers may fix issues they discover inside their assigned lane, but must keep edits narrowly scoped and must not touch inventory/status docs unless explicitly told.
- Workers must not mutate shared app state, unrelated source, git state, or user data. Use isolated app state and disposable fixtures for live QA.
- Every row with a user-visible path still needs live app-path evidence, full visible-viewport raw-internal scan, practical fixes, regression tests for fixes, rebuild/relaunch when required, and inventory/status updates.

## Pipeline

1. Parent selects a bounded batch of rows from `docs/feature-qa-status.md`.
2. Parent spawns discover-and-fix workers for non-overlapping rows or feature slices.
3. Each worker launches an isolated dev app if live UI QA is needed.
4. Each worker discovers issues, fixes practical bugs it has enough context to fix, adds focused regressions, and reruns its isolated live path.
5. Workers report findings, fixes, tests/builds, evidence paths, and remaining gaps using the schema below.
6. Parent reviews worker diffs/evidence, deduplicates cross-worker findings, runs final validation, and decides whether to accept each fix.
7. Parent alone updates `docs/feature-inventory.md`, `docs/feature-qa-status.md`, and any findings queue.

## Isolated Dev App

Each live worker needs unique runtime isolation:

```bash
export NEON_PILOT_STATE_ROOT="/tmp/neon-pilot-qa/$WORKER_ID/state"
export NEON_PILOT_DAEMON_NAMESPACE="qa-$WORKER_ID"
export NEON_PILOT_DESKTOP_INITIAL_ROUTE="/conversations/new"
mkdir -p "/tmp/neon-pilot-qa/$WORKER_ID/screenshots" "/tmp/neon-pilot-qa/$WORKER_ID/logs"
node packages/desktop/scripts/launch-dev-app.mjs \
  --remote-debugging-port="$CDP_PORT" \
  --no-quit-confirmation
```

Use a unique `$WORKER_ID` and `$CDP_PORT` per worker. Prefer disposable workspace fixtures for file, git, extension, or settings flows. Stop only the app instance started for that worker.

## Worker Prompt Template

```md
You are a Neon Pilot discover-and-fix QA worker.

cwd: /Users/patrick/workingdir/neon-pilot
Rows/features: <bounded rows or feature names>
CDP port: <unique port>
State root: <unique state root>
Evidence dir: <unique /tmp dir>

You may fix practical bugs you discover inside this assigned lane.
Keep edits narrowly scoped to the bug and owning surface.
Do not edit docs/feature-inventory.md, docs/feature-qa-status.md, git state, shared app state, user data, or unrelated files.
Use the real UI/app path whenever one exists.
Scan the entire visible viewport, including inactive panes, for raw internal errors, stacks, API routes, file URLs, and local paths.
For every fix, add/update focused regression tests and rerun the isolated live path when practical.
Report evidence-backed findings, code changes, tests/builds run, screenshots/logs, and remaining gaps.
```

## Worker Report Schema

```md
## Worker Report

Feature row:
Severity: critical | high | medium | low
User-visible impact:
Repro steps:
Expected:
Actual:
Evidence paths:
Raw internal text seen:
Suspected owner/files:
Fix made:
Regression tests:
Builds/checks run:
Live rerun result:
Blockers/credentials:
Confidence: high | medium | low
Remaining gaps:
```

## Worker Rules

- Reproduce in fresh isolated app state when possible.
- Reduce bugs to the smallest user-visible path before fixing.
- Fix only issues discovered in the assigned rows/features.
- Add or update regression tests for fixed behavior.
- Run the narrowest meaningful tests first, then required package build or app launch checks.
- Return changed files, tests/builds run, live UI evidence paths, and remaining risk.
- Leave ambiguous, risky, destructive, credentialed, or cross-cutting fixes to the parent as confirmed findings.

## Parent Checklist

- Keep at most one writer for docs/source at a time.
- Preserve the strict row queue for final status transitions.
- Give workers non-overlapping row ranges or surfaces.
- Review worker diffs before accepting fixes; reject unrelated refactors.
- Deduplicate worker reports before final validation.
- Prefer high-signal bugs: raw internals in UI, broken real workflows, data loss, stale state, failed recovery, inaccessible controls, or misleading product copy.
- Mark rows `Blocked` only for explicit external requirements such as credentials, signed builds, destructive data, unavailable hardware, or external services.
