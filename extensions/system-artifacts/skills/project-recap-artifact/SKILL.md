---
name: project-recap-artifact
description: Create a typed project recap conversation artifact. Use when the user invokes /project-recap, asks for a context-switching recap, wants a visual summary of project state, decisions, progress, blockers, or next steps.
---

# Project Recap Artifact

Create a concise visual recap that helps someone re-enter a project with the current state, decisions, open work, and next actions in one place.

## Workflow

1. Gather the relevant project state from the conversation, workspace status, referenced docs, and user-provided scope.
2. Prefer confirmed facts and label uncertain or inferred items clearly.
3. Read [`../artifacts/references/visual-explainer-defaults.md`](../artifacts/references/visual-explainer-defaults.md) and use the `technical-report` preset.
4. Use [`../../templates/visual-explainer.html`](../../templates/visual-explainer.html) as the HTML starting point when helpful.
5. Save through the `artifact` tool with the metadata below.

## Metadata Defaults

```json
{
  "action": "save",
  "kind": "html",
  "artifactType": "project-recap",
  "stylePreset": "technical-report",
  "templateVersion": "visual-explainer-v1",
  "source": {
    "kind": "command",
    "command": "project-recap"
  }
}
```

Add `source.paths` for project files or docs used as recap sources.

## Artifact Shape

- Start with status, current objective, and what changed recently.
- Include decisions made, evidence, open questions, risks, and recommended next actions.
- Use a compact timeline or status table when it improves scanning.
- Avoid inventing certainty; mark assumptions and missing context.
- Preserve user style overrides in `styleOverrides` while keeping the recap calm and readable.
