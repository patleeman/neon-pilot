# Agent Runtime Extension

This extension owns the `/agent-runtime` settings page for inspecting the capabilities that shape an agent run: enabled extensions, instruction layers, prompt templates, runtime context blocks, skills, tools, MCP servers, and diagnostics.

`/prompt-assembly` remains as a compatibility route, but the product surface is **Settings → Agent Runtime**.

## Architecture

Agent Runtime is an inspector over the runtime capability registry. It does not let extensions mutate the system prompt directly. Instruction content flows through declared instruction providers, then core performs deterministic assembly.

Capability rows expose:

- kind: extension, instruction, skill, tool, MCP server, prompt template, or context
- owner/source/scope
- enabled/status
- provider metadata and diagnostics

## UX rules

- Keep one top-level settings destination: Agent Runtime.
- Extensions are a capability kind inside this page, not a separate settings nav item.
- Prefer filters/search over nested pages.
- Show concrete runtime state: what the agent can see if a turn starts now.
- Visually inspect `/agent-runtime` after layout or interaction changes.
