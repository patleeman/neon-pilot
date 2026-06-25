# Artifacts Extension

This extension owns the product behavior documented below. Keep extension-specific user and agent docs here so the implementation and documentation move together.

---

# Artifacts

Artifacts are rendered outputs visible inside a conversation. They support HTML, Mermaid diagrams, and copyable LaTeX source. Saving one inserts a transcript card you can open as its own workbench tab beside the conversation.

## Supported Render Kinds

| Kind      | Description                           | Use Cases                                            |
| --------- | ------------------------------------- | ---------------------------------------------------- |
| `html`    | Self-contained rendered web content   | Interactive prototypes, styled documents, dashboards |
| `mermaid` | Diagrams rendered from Mermaid source | Flowcharts, sequence diagrams, architecture diagrams |
| `latex`   | Copyable LaTeX source                 | Formulas, scientific papers, technical docs          |

## Semantic Artifact Types

Artifacts can also carry metadata that explains what the artifact is for. Keep `kind` focused on rendering and use metadata for meaning:

| Metadata          | Purpose                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artifactType`    | `visual-explainer`, `visual-plan`, `diff-review`, `plan-review`, `project-recap`, `slides`, `architecture`, `data-table`, `fact-check`, or `report` |
| `stylePreset`     | `visual-explainer`, `technical-report`, `architecture-map`, `review-matrix`, or `slide-deck`                                                        |
| `styleOverrides`  | User-requested theme, accent, density, or styling notes                                                                                             |
| `source`          | Optional source command, selection, message, or file paths                                                                                          |
| `templateVersion` | Template/default version used to create the artifact                                                                                                |

Most visual explainers and slide decks use `kind: "html"` plus semantic metadata.

## Creating an Artifact

Use the `artifact` tool from a conversation:

```json
{
  "action": "save",
  "kind": "mermaid",
  "title": "Architecture Overview",
  "content": "graph TD\n    A[Client] --> B[Server]\n    B --> C[Database]",
  "artifactType": "architecture",
  "stylePreset": "architecture-map",
  "open": true
}
```

Parameters:

| Parameter         | Type                             | Description                                                    |
| ----------------- | -------------------------------- | -------------------------------------------------------------- |
| `artifactId`      | string (optional)                | Stable ID for updates. Omit to generate a new one              |
| `kind`            | `"html"`, `"mermaid"`, `"latex"` | Artifact type                                                  |
| `title`           | string                           | Display title                                                  |
| `content`         | string                           | Source content                                                 |
| `open`            | boolean                          | Whether the artifact panel opens automatically (default: true) |
| `artifactType`    | string                           | Semantic type used for labels and workflow intent              |
| `stylePreset`     | string                           | Opinionated visual default used to generate the artifact       |
| `styleOverrides`  | object                           | Optional user override notes for theme/accent/density          |
| `source`          | object                           | Optional source metadata                                       |
| `templateVersion` | string                           | Template/default version used                                  |

## Visual Explainers and Slides

The Artifacts extension includes opinionated visual defaults adapted for Neon Pilot:

- `skills/artifacts/references/visual-explainer-defaults.md`
- `skills/artifacts/references/slide-deck-defaults.md`
- `templates/visual-explainer.html`
- `templates/slide-deck.html`

Slash commands generate prompts that create typed artifacts through the normal agent/tool flow:

| Command          | Artifact type      | Style preset       |
| ---------------- | ------------------ | ------------------ |
| `/visualize`     | `visual-explainer` | `visual-explainer` |
| `/diff-review`   | `diff-review`      | `review-matrix`    |
| `/plan-review`   | `plan-review`      | `review-matrix`    |
| `/project-recap` | `project-recap`    | `technical-report` |
| `/slides`        | `slides`           | `slide-deck`       |

Each command also has a matching agent skill so natural-language requests can trigger the same workflow:

| Skill                       | Command          |
| --------------------------- | ---------------- |
| `visual-explainer-artifact` | `/visualize`     |
| `diff-review-artifact`      | `/diff-review`   |
| `plan-review-artifact`      | `/plan-review`   |
| `project-recap-artifact`    | `/project-recap` |
| `slide-deck-artifact`       | `/slides`        |

Users can override the defaults in the prompt. Agents should pass those constraints through `styleOverrides` and reflect them in the generated HTML while preserving readability, contrast, and source coverage.

## Viewing Artifacts

Artifacts open as individual workbench tabs from the transcript. Each artifact is rendered inline:

- **HTML** — rendered as a web page in a sandboxed iframe
- **Mermaid** — rendered as an SVG diagram
- **LaTeX** — shown as raw source for copying

The rail, transcript card, and detail header use semantic labels when metadata is present. For example, an HTML artifact with `artifactType: "slides"` displays as a slide deck while still rendering through the HTML viewer.

Multiple artifacts in a conversation can be opened side by side as separate tabs.

## Updating Artifacts

Reuse the same `artifactId` to update an existing artifact:

```json
{
  "action": "save",
  "artifactId": "arch-v1",
  "kind": "mermaid",
  "title": "Architecture Overview (updated)",
  "content": "graph TD\n    A[Client] --> B[Server]\n    B --> C[Database]\n    C --> D[Cache]"
}
```

The artifact panel refreshes to show the updated content.

## Deleting Artifacts

```json
{
  "action": "delete",
  "artifactId": "arch-v1"
}
```

## Listing Artifacts

```json
{
  "action": "list"
}
```

Returns all artifacts in the current conversation with their metadata.

## Use Cases

- **Architecture diagrams** — agent generates a Mermaid diagram of the system
- **Prototypes** — agent generates HTML for a UI mockup
- **Math explanations** — agent renders LaTeX formulas inline
- **Report generation** — agent creates formatted HTML documents
- **Iterative design** — agent updates the same artifact as the design evolves
- **Visual reviews** — agent creates source-backed diff, plan, and fact-check artifacts
- **Slide decks** — agent creates self-contained deck artifacts with one slide per viewport
