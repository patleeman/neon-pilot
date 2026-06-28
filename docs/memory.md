# Memory

Neon Pilot memory is a Git-backed Markdown filesystem for durable agent behavior and stable context.

The managed memory folder lives under the configured knowledge root:

```text
memory/
  system.md
  scopes/
    <scope>/
      memory.md
  skills/
    <skill>/
      SKILL.md
  reflections/
    <conversation>.md
  archive/
```

## Runtime behavior

- `memory/system.md` is loaded into prompt assembly whenever it exists.
- `memory/scopes/<scope>/memory.md` is loaded when the current working directory matches a root in the scope frontmatter.
- `memory/skills/<skill>/SKILL.md` is discovered by the skill inventory alongside legacy durable skills.
- `memory/reflections/<conversation>.md` stores non-injected reflection drafts created from conversation lifecycle events.
- Memory edits are committed to the memory Git repository by Neon Pilot.
- A remote can be configured from the Memory page. Sync fetches, fast-forwards when possible, and pushes the current branch.

Scope frontmatter controls activation:

```md
---
name: Neon Pilot
type: workspace
roots:
  - /Users/patrick/workingdir/neon-pilot
aliases:
  - neon pilot
inject: true
---
```

## Desktop UI

Open **Memory** from the sidebar.

The page has:

- setup for creating the local memory Git repository
- System memory editing
- scope browsing and creation
- memory skill browsing and editing
- current workspace scoping
- repository health, remote setup, and sync
- import from legacy knowledge notes into a non-injected review scope
- recent changes and per-file Git history

Memory writes do not require approval. Use the history surface to inspect commits and recover from bad edits.

## Reflection

Neon Pilot queues memory reflection after conversation turn-end events, auto-compaction, and close/archive operations. Reflection writes a committed draft under `memory/reflections/` with `inject: false`; it does not directly mutate `system.md`, scope memory, or skills. Review drafts and move stable preferences, project facts, or recurring workflow rules into the correct injected memory file when they are worth keeping.

Reflection drafts include structured candidate updates and ignored signals. The extractor is intentionally conservative: stable user preferences target `system.md`, repository facts target the active scope, repeated workflows target skill drafts, and duplicate, sensitive, or short-lived details are rejected.

## Eval and tuning

Run the deterministic memory reflection evals with:

```sh
pnpm run eval:memory
```

The scorecard reports candidate precision, candidate recall, and reject recall across golden fixtures in `packages/desktop/server/memory/memoryReflectionEval.fixtures.ts`. Add a fixture whenever dogfooding finds a bad memory draft: include the summary input, existing memory state, expected candidates, and expected rejects. The eval command should stay fast and deterministic so it can run before changing promotion policy or extraction rules.

## Relation to Knowledge

Memory is behavior and stable agent context. Legacy knowledge files remain reference material for browsing, search, and explicit context attachment. Importing knowledge into Memory creates `memory/scopes/imported-knowledge/memory.md` with `inject: false`, so old notes are visible for review without changing agent behavior automatically.
