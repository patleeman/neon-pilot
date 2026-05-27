---
name: skills-and-capabilities
description: Use when deciding whether behavior belongs in an instruction file, durable doc, reusable skill, tool, or extension.
metadata:
  id: skills-and-capabilities
  title: Skills and Extension Capabilities
  summary: Built-in guidance for distinguishing reusable workflow skills from extension features.
  status: active
---

# Skills and Extension Capabilities

Use this doc when you need to decide whether something should be a skill, a doc, an instruction file, an imported plugin package, or an extension.

## Fast split

- **instruction file** — standing behavior and policy
- **doc** — reusable knowledge
- **skill** — reusable workflow
- **extension** — Neon Pilot capability package implemented directly or wrapping another package format
- **plugin** — external ecosystem package format imported through an extension wrapper

## Skills

Skills are reusable workflow packages.

Shared contract:

```text
<knowledge-root>/skills/<skill>/SKILL.md
```

Use a skill when you want:

- a named repeatable workflow
- reusable procedural guidance
- supporting files bundled with the workflow

## Extensions

Extensions change what Neon Pilot can do.

Examples in this repo:

- `knowledge-base`
- `web-tools`
- `daemon-run-orchestration-prompt`
- `codex-profile`

Use an extension when the change requires code and runtime integration, not just new instructions.

Use an imported plugin/package wrapper when the capability already exists in another agent ecosystem, such as Codex, Claude, or MCP, and should be managed through Neon Pilot's extension registry.

## What to edit when you want to change behavior

- change `AGENTS.md` or selected instruction files for policy and standing behavior
- add or edit a doc for reusable knowledge
- add or edit a skill for reusable workflow
- add or edit an extension when the runtime itself needs new behavior

## Practical rule

If markdown is enough, do not start with an extension.

Reach for an extension only when you need new tools, UI, event handling, runtime hooks, or permission behavior.

## Related docs

- [Knowledge](../../../system-knowledge/README.md)
- [Decision Guide](../../../../docs/decision-guide.md)
- [Command-Line Guide (`pa`)](../../../../docs/command-line.md)
- [Web UI Guide](../../../../docs/web-ui.md)
