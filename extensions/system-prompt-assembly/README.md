# Prompt Assembly Extension

This extension owns internal prompt assembly actions for editing the system prompt template and inspecting the capabilities that shape an agent run: instruction layers, prompt templates, runtime context blocks, skills, tools, MCP servers, and diagnostics.

The product surface is **Extensions**. Prompt assembly should not contribute its own navigation item or standalone route; expose user-facing controls through Settings → Extensions and the Extension Manager page.

App-control configuration does not belong here. Commands, keyboard shortcuts, and extensions live in **Settings → Commands** and **Settings → Extensions**.

## Architecture

Prompt Assembly edits the generated system prompt template through the host settings API, then inspects the runtime capability registry. It does not let extensions mutate the system prompt directly. Instruction content flows through declared instruction providers, then core performs deterministic assembly.

Capability rows expose:

- kind: instruction, skill, tool, MCP server, prompt template, or context
- owner/source/scope
- enabled/status
- provider metadata and diagnostics

## UX rules

- Keep prompt assembly focused on what the agent uses when a turn starts.
- Do not show app-control surfaces here: commands, keybindings, extension enablement, and extension settings belong in Settings.
- Prefer filters/search over nested pages.
- Show concrete runtime state: what the agent can see if a turn starts now.
- Visually inspect Settings → Extensions after layout or interaction changes.
