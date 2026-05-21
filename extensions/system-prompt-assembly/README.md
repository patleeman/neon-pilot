# Agent Runtime Extension

This extension owns the `/agent-runtime` page for inspecting the capabilities that shape an agent run: instruction layers, prompt templates, runtime context blocks, skills, tools, MCP servers, and diagnostics.

`/prompt-assembly` remains as a compatibility route, but the product surface is **Agent Runtime**.

App-control configuration does not belong here. Commands, keyboard shortcuts, and extensions live in **Settings → Commands** and **Settings → Extensions**.

## Architecture

Agent Runtime is an inspector over the runtime capability registry. It does not let extensions mutate the system prompt directly. Instruction content flows through declared instruction providers, then core performs deterministic assembly.

Capability rows expose:

- kind: instruction, skill, tool, MCP server, prompt template, or context
- owner/source/scope
- enabled/status
- provider metadata and diagnostics

## UX rules

- Keep Agent Runtime focused on what the agent uses when a turn starts.
- Do not show app-control surfaces here: commands, keybindings, extension enablement, and extension settings belong in Settings.
- Prefer filters/search over nested pages.
- Show concrete runtime state: what the agent can see if a turn starts now.
- Visually inspect `/agent-runtime` after layout or interaction changes.
