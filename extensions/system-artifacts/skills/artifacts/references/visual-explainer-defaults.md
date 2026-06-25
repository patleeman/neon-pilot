# Visual Explainer Defaults

Use these defaults for `artifactType: "visual-explainer"` and adjacent types such as `visual-plan`, `architecture`, `diff-review`, `plan-review`, `project-recap`, `fact-check`, and `data-table`.

## Product Fit

Visual explainers are conversation artifacts, not marketing pages. They should feel like polished workbench documents: compact, technical, neutral, easy to scan, and useful after the conversation has moved on.

Prefer:

- clear title, context line, and outcome summary in the first viewport
- dense but readable sections
- real tables for comparisons, audits, and requirement matrices
- diagram regions for system shape, flow, or dependencies
- callouts only for important risks, decisions, or unresolved questions
- CSS custom properties for palette and spacing

Avoid:

- purple/blue gradient AI styling
- hero sections with decorative blobs or abstract backgrounds
- card stacks inside card stacks
- huge centered empty space
- tiny text in dense tables
- pure ASCII diagrams copied into HTML

## Style Presets

`visual-explainer`
: General-purpose technical explainer. Neutral page, muted ink colors, one restrained accent, compact summary strip, section grid, optional diagram shell.

`technical-report`
: Prose-first memo. Single-column reading width, strong section rhythm, inline evidence tables, minimal accent color.

`architecture-map`
: Hybrid overview and detail cards. One diagram or topology map near the top, followed by component rows or grouped modules.

`review-matrix`
: Diff reviews, plan reviews, audits, and fact checks. Summary table first, then findings grouped by severity or decision.

## Required HTML Shape

Every visual explainer artifact should be a complete self-contained HTML document:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Artifact title</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f7f5f0;
        --surface: #fffdf8;
        --ink: #202323;
        --muted: #5d6661;
        --border: #d8d1c5;
        --accent: #2f7d6d;
        --accent-strong: #194f46;
        --warning: #a15c12;
        --danger: #a83f3f;
      }
    </style>
  </head>
  <body>
    ...
  </body>
</html>
```

Use the full template at `extensions/system-artifacts/templates/visual-explainer.html` when a starting point helps.

## Override Handling

When the user asks for a style override, record it in `styleOverrides` and apply it deliberately:

- `theme`: changes the broad surface direction, such as `paper`, `dark`, `blueprint`, or `editorial`
- `accent`: changes the primary accent, such as `sage`, `cranberry`, `gold`, or a specific accessible color
- `density`: changes spacing and content density, such as `compact`, `standard`, or `roomy`
- `notes`: free-form constraints, such as "more executive-friendly" or "emphasize risks"

Do not apply overrides that reduce contrast, hide source coverage, break mobile layout, or turn the artifact into generic decorative chrome.

## QA Checklist

Before saving:

- first viewport explains what the artifact is and why it matters
- no horizontal overflow at desktop width
- tables preserve columns and wrap long text
- body text is comfortably readable
- colors are not one-note purple/blue gradients
- source coverage is explicit for reviews and recaps
- artifact tool call includes `artifactType`, `stylePreset`, and any `styleOverrides`
