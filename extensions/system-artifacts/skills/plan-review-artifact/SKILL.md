---
name: plan-review-artifact
description: Create a typed visual plan review artifact. Use when the user invokes /plan-review, asks to critique or review a plan, wants risks and gaps in a proposed implementation, or needs a visual review matrix for a plan file, message, or scope.
---

# Plan Review Artifact

Create a visual review that turns a proposed plan into clear strengths, gaps, risks, sequencing concerns, and concrete next actions.

## Workflow

1. Locate the plan from the prompt, selected text, referenced file, or conversation context.
2. Preserve the plan's stated objective and constraints before critiquing it.
3. Read [`../artifacts/references/visual-explainer-defaults.md`](../artifacts/references/visual-explainer-defaults.md) and use the `review-matrix` preset.
4. Use [`../../templates/visual-explainer.html`](../../templates/visual-explainer.html) as the HTML starting point when helpful.
5. Save through the `artifact` tool with the metadata below.

## Metadata Defaults

```json
{
  "action": "save",
  "kind": "html",
  "artifactType": "plan-review",
  "stylePreset": "review-matrix",
  "templateVersion": "visual-explainer-v1",
  "source": {
    "kind": "command",
    "command": "plan-review",
    "paths": ["plan-or-scope"]
  }
}
```

Use `source.selection` instead of `source.paths` when the plan comes from selected text or a pasted prompt.

## Artifact Shape

- Lead with the plan objective, verdict, and highest-leverage corrections.
- Use a matrix for risks, missing decisions, dependencies, validation gaps, and owner/action.
- Separate "must fix before starting" from "watch during execution".
- Keep recommendations actionable and tied to the source plan.
- Record style overrides in `styleOverrides` without weakening readability or source coverage.
