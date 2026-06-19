# Agent Plugins

Agent Plugins imports Codex and Claude-style plugin repositories into Neon Pilot as managed agent capability packages.

Extensions are Neon Pilot-native app packages. Agent plugins are foreign capability packages: skills, instruction files, hooks, MCP declarations, and related docs. This extension owns the compatibility workflow so Extension Manager can stay focused on native Neon Pilot extensions.

## Product model

- A plugin install is the user-facing object.
- Git sources are cloned under `<runtime>/plugins/{ecosystem}/{plugin-id}/source`.
- Local directory sources are linked for developer refresh.
- Compatible skills are wrapped through the Neon Pilot extension registry so they can be enabled, disabled, inspected, and validated with the rest of the runtime.
- Unsupported files are listed in the compatibility report instead of being activated silently.
- Update checks are notify-first by default. Per-plugin auto-update can be enabled after install.

## Supported v1 capabilities

- Codex and Claude ecosystem detection with manual override.
- Git URL and local directory sources.
- Skill discovery from `SKILL.md` files.
- MCP declaration discovery from `mcp.json` files.
- Hook file discovery as compatibility metadata.
- Manual update checks, per-plugin auto-update settings, and validated update application for Git sources.

Executable hooks and arbitrary lifecycle commands are intentionally not executed. Hook files are indexed for compatibility reporting until they can be mapped to explicit Neon Pilot lifecycle boundaries.
