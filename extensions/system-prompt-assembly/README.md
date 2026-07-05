# Prompt Assembly Extension

This extension owns internal prompt assembly actions for editing the system prompt template and inspecting non-skill capabilities that shape an agent run: instruction layers, prompt templates, runtime context blocks, tools, MCP servers, and diagnostics.

The product surface is **Settings → Prompt Assembly**. Prompt assembly should not contribute its own left-navigation item or standalone route; expose user-facing controls through its Settings panel. Skill browsing, installation, and enablement belong only in **Skills** at `/skills`.

App-control configuration does not belong here. Commands, keyboard shortcuts, and apps live in **Settings → Commands** and **Settings → Apps**.

## Architecture

Prompt Assembly edits the generated system prompt template through the host settings API, then inspects the runtime capability registry. It does not let extensions mutate the system prompt directly. Instruction content flows through declared instruction providers, then core performs deterministic assembly.

Capability rows expose:

- kind: instruction, tool, MCP server, prompt template, or context
- owner/source/scope
- enabled/status
- provider metadata and diagnostics

## UX rules

- Keep prompt assembly focused on what the agent uses when a turn starts.
- Do not show app-control surfaces here: commands, keybindings, extension enablement, and extension settings belong in Settings.
- Prefer filters/search over nested pages.
- Show concrete runtime state: what the agent can see if a turn starts now.
- Visually inspect Settings → Prompt Assembly after layout or interaction changes.
