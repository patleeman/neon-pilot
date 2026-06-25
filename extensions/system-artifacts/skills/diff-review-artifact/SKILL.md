---
name: diff-review-artifact
description: Create a typed visual diff review artifact. Use when the user invokes /diff-review, asks for a visual review of current git or workspace changes, wants changed files summarized by risk, or needs a source-backed review matrix artifact.
---

# Diff Review Artifact

Create a source-backed visual review of workspace changes, optimized for quickly seeing risk, intent, and follow-up work.

## Workflow

1. Inspect the current workspace changes with the narrowest useful git commands, normally `git status --short` and focused `git diff` reads.
2. Identify changed paths, behavioral surfaces, test coverage, risks, and unresolved questions.
3. Read [`../artifacts/references/visual-explainer-defaults.md`](../artifacts/references/visual-explainer-defaults.md) and use the `review-matrix` preset.
4. Use [`../../templates/visual-explainer.html`](../../templates/visual-explainer.html) as the HTML starting point when helpful.
5. Save through the `artifact` tool with the metadata below.

## Metadata Defaults

```json
{
  "action": "save",
  "kind": "html",
  "artifactType": "diff-review",
  "stylePreset": "review-matrix",
  "templateVersion": "visual-explainer-v1",
  "source": {
    "kind": "command",
    "command": "diff-review",
    "paths": ["changed/path"]
  }
}
```

Set `source.paths` to the actual changed files or top-level areas covered by the review.

## Artifact Shape

- Start with a summary matrix: area, change, risk, confidence, validation.
- Group findings by severity or decision impact.
- Include evidence from specific files or diff hunks without pasting huge source blocks.
- Distinguish confirmed issues from risks and open questions.
- Preserve user overrides in `styleOverrides` while keeping the review readable and source-backed.
