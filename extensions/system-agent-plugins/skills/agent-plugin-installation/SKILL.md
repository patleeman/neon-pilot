---
name: agent-plugin-installation
description: Use when installing, inspecting, or explaining Codex and Claude Code style agent plugins in Neon Pilot.
metadata:
  id: agent-plugin-installation
  title: Agent Plugin Installation
  status: active
---

# Agent Plugin Installation

Use this skill when the user asks to install, add, inspect, update, enable, disable, remove, or explain a Codex or Claude Code style agent plugin.

## Mental model

- **Agent plugins** are external Codex or Claude Code style repositories or folders.
- They can contain skills, instruction files, docs, MCP server definitions, hooks, and related files.
- Neon Pilot imports compatible pieces through an extension wrapper so agents can use them.
- Installed agent plugins are turned on by default. Treat turning a plugin off as an explicit user choice, not a normal installation step.

## Install workflow

1. Use `neon-pilot agent-plugins list --json` if you need to check whether the requested plugin is already installed.
2. Use `neon-pilot agent-plugins install <git-url> --json` when the user supplies or clearly approves a Git repository URL.
3. Use `neon-pilot agent-plugins install <folder> --local --json` when the user supplies or clearly approves a local folder path.
4. After install, summarize the imported capabilities:
   - skills
   - instructions/docs
   - MCP server definitions
   - ignored hooks or compatibility warnings
5. Tell the user if the plugin installed but produced no supported capabilities.

## Source safety

- Only install from a source the user supplied or explicitly approved.
- Do not invent a plugin repository URL.
- If the source is ambiguous, ask for the exact Git URL or local folder.
- If a plugin reports compatibility warnings or ignored hooks, surface them plainly.

## Useful UI

Users can manage installed plugins in Settings > Agent plugins. The same operations are available through:

- `neon-pilot agent-plugins list`
- `neon-pilot agent-plugins install`
- `neon-pilot agent-plugins enable`
- `neon-pilot agent-plugins disable`
- `neon-pilot agent-plugins check-updates`
- `neon-pilot agent-plugins update`
- `neon-pilot agent-plugins remove`
