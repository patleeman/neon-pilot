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
  archive/
```

## Runtime behavior

- `memory/system.md` is loaded into prompt assembly whenever it exists.
- `memory/scopes/<scope>/memory.md` is loaded when the current working directory matches a root in the scope frontmatter.
- `memory/skills/<skill>/SKILL.md` is discovered by the skill inventory alongside legacy durable skills.
- Memory edits are committed to the memory Git repository by Neon Pilot.

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
- recent changes and per-file Git history

Memory writes do not require approval. Use the history surface to inspect commits and recover from bad edits.

## Relation to Knowledge

Memory is behavior and stable agent context. The knowledge base is reference material for browsing, search, sync, and explicit context attachment.
