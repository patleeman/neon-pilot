# Agent Runtime Extension

This extension owns the `/agent-runtime` settings page for inspecting the capabilities that shape an agent run and the app-control surfaces that drive Neon Pilot: commands, keybindings, enabled extensions, instruction layers, prompt templates, runtime context blocks, skills, tools, MCP servers, and diagnostics.

`/prompt-assembly` remains as a compatibility route, but the product surface is **Settings → Agent Runtime**.

## Architecture

Agent Runtime is an inspector over the runtime capability registry. It does not let extensions mutate the system prompt directly. Instruction content flows through declared instruction providers, then core performs deterministic assembly.

Capability rows expose:

- kind: extension, instruction, skill, tool, MCP server, prompt template, or context
- owner/source/scope
- enabled/status
- provider metadata and diagnostics

Command rows expose every host and extension command as the primary object. Keybindings are editable from the command row, including commands that did not declare a default shortcut. User keybinding overrides are persisted by the extension registry backend, not renderer-local storage, so the runtime keyboard dispatcher and inspector use the same source of truth.

## UX rules

- Keep one top-level settings destination: Agent Runtime.
- Split product control from agent context: **App control** contains commands, keybindings, and extensions; **Agent context** contains instructions, skills, tools, MCP servers, prompt templates, and context blocks.
- Prefer filters/search over nested pages.
- Show concrete runtime state: what the agent can see if a turn starts now.
- Visually inspect `/agent-runtime` after layout or interaction changes.
