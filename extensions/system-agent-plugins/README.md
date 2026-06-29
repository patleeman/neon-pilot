# Agent Plugins

The Agent Plugins extension imports Codex and Claude Code style plugin repositories into Neon Pilot so agents can use their skills, instructions, docs, and MCP servers.

Extensions are Neon Pilot-native app packages. Agent plugins are external capability packages: skills, instruction files, hooks, MCP declarations, and related docs from Codex or Claude ecosystems. This extension owns the import and compatibility workflow so Extension Manager can stay focused on native Neon Pilot extensions.

## Product model

- An agent plugin install is the user-facing object.
- Agent plugins are turned on immediately when added — no separate enable step required.
- Git sources are cloned under `<runtime>/plugins/{ecosystem}/{plugin-id}/source`.
- Local directory sources are linked for developer refresh.
- Compatible skills are wrapped through the Neon Pilot extension registry so they can be enabled, disabled, inspected, and validated with the rest of the runtime.
- Ecosystem (Codex or Claude) is auto-detected from plugin files — no manual selection needed.
- Update checks are notify-first by default. Per-plugin auto-update can be enabled after install.
- Agents can install approved plugin sources with `neon-pilot agent-plugins install` and should summarize imported skills, instructions/docs, MCP server definitions, and ignored hooks.

## Supported v1 capabilities

- Codex and Claude ecosystem auto-detection from `.codex-plugin/` or `.claude-plugin/` markers.
- Git URL and local directory sources.
- Skill discovery from `SKILL.md` files.
- MCP declaration discovery from `mcp.json` files.
- Hook file discovery as compatibility metadata (displayed as warnings, not executed).
- Manual update checks, per-plugin auto-update settings, and validated update application for Git sources.

Executable hooks and arbitrary lifecycle commands are intentionally not executed. Hook files are indexed for compatibility reporting until they can be mapped to explicit Neon Pilot lifecycle boundaries.
