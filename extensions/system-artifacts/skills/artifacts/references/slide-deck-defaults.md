# Slide Deck Defaults

Use these defaults for `artifactType: "slides"` and `stylePreset: "slide-deck"`.

Slide artifacts are viewport-based presentations. They are not long pages with fake pagination.

## Required Behavior

- each slide is one viewport with `height: 100dvh`
- only one slide is active at a time
- include previous/next controls, slide count, and dot navigation
- support keyboard navigation with ArrowLeft, ArrowRight, Home, and End
- keep text large enough to read in the workbench artifact viewer
- preserve source coverage by adding slides instead of cramming content
- respect `prefers-reduced-motion`

## Slide Types

Use these as building blocks:

- title: topic, subtitle, context
- section: one major phase or theme
- content: one idea with bullets or short evidence
- split: explanation beside diagram, code, or image
- diagram: flow or architecture focus
- table: compact comparison, risk matrix, or checklist
- dashboard: metrics, counts, or status tiles
- code: short snippet with callouts
- quote: decision, principle, or user statement
- recap: final takeaways and next actions

## Default Visual Direction

The default deck should feel like a technical review deck:

- off-white or deep neutral background, not glossy black
- restrained accent color
- strong slide number and progress affordance
- compact but generous enough for presentation
- no decorative blobs, neon glows, or generic AI gradients

Use the full template at `extensions/system-artifacts/templates/slide-deck.html` when a starting point helps.

## Override Handling

Record user overrides in `styleOverrides`:

- `theme`: `paper`, `dark`, `editorial`, `blueprint`
- `accent`: `sage`, `gold`, `cranberry`, `teal`, or accessible custom color
- `density`: `compact`, `standard`, `roomy`
- `notes`: audience, tone, emphasis, or content-specific style constraints

Overrides should change the presentation while keeping navigation, readability, and source coverage intact.

## QA Checklist

Before saving:

- first slide is visible without scrolling
- slide controls are visible and keyboard-operable
- no slide clips important content at desktop artifact-viewer sizes
- table slides remain readable
- all source items are represented somewhere
- artifact tool call includes `artifactType: "slides"` and `stylePreset: "slide-deck"`
