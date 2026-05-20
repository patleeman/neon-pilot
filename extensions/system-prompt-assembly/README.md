# Prompt Assembly Extension

This extension owns the `/prompt-assembly` inspection page for the inputs that shape an agent run: instruction layers, prompt templates, runtime context blocks, skills, tools, and diagnostics.

## Product direction

Prompt Assembly is an inspector, not a settings maze. Keep the top-level navigation shallow and aligned with Extension Manager page patterns:

- **Assembly** — summary cards, prompt layers, optional templates/context, and diagnostics health.
- **Capabilities** — skills and tools together, with Extension Manager-style filters and search.

Avoid one top-level tab per backend inventory type. If a new prompt input is mostly text that enters the prompt, add it under Assembly. If it gives the agent something it can choose/use, add it under Capabilities. Diagnostics should stay inline unless it grows into a dedicated workflow.

## Agent workflow for this extension

1. Keep UI consistent with Extension Manager list/table/filter patterns.
2. Keep backend action contracts small: inspect current assembly, update skill enabled state.
3. Validate frontend type/build checks after UI changes.
4. Visually inspect `/prompt-assembly` after changing layout or interaction behavior.
