---
name: visual-explainer-artifact
description: Create a typed visual explainer conversation artifact. Use when the user invokes /visualize, asks to visualize a topic, wants a visual explanation, diagram-backed explainer, implementation map, concept breakdown, or asks for an artifact with visual-explainer defaults.
---

# Visual Explainer Artifact

Create a self-contained HTML conversation artifact that explains a topic visually and remains useful after the conversation moves on.

## Workflow

1. Determine the topic, source material, audience, and any style overrides from the user request.
2. Read [`../artifacts/references/visual-explainer-defaults.md`](../artifacts/references/visual-explainer-defaults.md) before generating the artifact.
3. Use [`../../templates/visual-explainer.html`](../../templates/visual-explainer.html) as the starting structure when a template is helpful.
4. Prefer compact sections, real tables, labeled diagrams, and explicit source coverage over decorative page chrome.
5. Save through the `artifact` tool with the metadata below.

## Metadata Defaults

Use these defaults unless the user asks for a narrower artifact type or style:

```json
{
  "action": "save",
  "kind": "html",
  "artifactType": "visual-explainer",
  "stylePreset": "visual-explainer",
  "templateVersion": "visual-explainer-v1",
  "source": {
    "kind": "command",
    "command": "visualize"
  }
}
```

Record user-requested theme, accent, density, or visual constraints in `styleOverrides` and apply them only when readability, contrast, and mobile layout remain sound.

## Pre-Save Checks

- The first viewport states what is being explained and why it matters.
- The artifact is complete, self-contained HTML.
- Tables and diagrams wrap cleanly without horizontal overflow.
- The content is source-backed when source material was provided.
- The tool call includes `artifactType`, `stylePreset`, `templateVersion`, and any `styleOverrides`.
