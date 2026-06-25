---
name: slide-deck-artifact
description: Create a typed slide deck conversation artifact. Use when the user invokes /slides, asks for slides, a presentation, briefing deck, deck artifact, or wants source material converted into viewport-based slides.
---

# Slide Deck Artifact

Create a self-contained HTML slide deck artifact with one active slide per viewport and built-in navigation.

## Workflow

1. Identify the topic, source material, audience, length, and any style overrides.
2. Read [`../artifacts/references/slide-deck-defaults.md`](../artifacts/references/slide-deck-defaults.md) before generating slides.
3. Use [`../../templates/slide-deck.html`](../../templates/slide-deck.html) as the starting structure when helpful.
4. Add slides rather than cramming content; preserve the important source material.
5. Save through the `artifact` tool with the metadata below.

## Metadata Defaults

```json
{
  "action": "save",
  "kind": "html",
  "artifactType": "slides",
  "stylePreset": "slide-deck",
  "templateVersion": "slide-deck-v1",
  "source": {
    "kind": "command",
    "command": "slides"
  }
}
```

Record audience, theme, accent, density, or tone constraints in `styleOverrides`.

## Required Behavior

- Each slide fits one viewport with `height: 100dvh`.
- Previous/next controls, slide count, dot navigation, and keyboard navigation work.
- ArrowLeft, ArrowRight, Home, and End are supported.
- Reduced-motion preferences are respected.
- Tables, code, and diagrams remain readable in the artifact viewer.
- The artifact tool call includes `artifactType: "slides"` and `stylePreset: "slide-deck"`.
