# Neon Pilot Design Taste

Neon Pilot is an IDE-like agent workbench. It should feel durable, compact, neutral, technical, and useful for repeated daily work.

It is not a SaaS dashboard, marketing site, native preferences clone, or decorative AI app. Extension UIs are workbench contributions: they should integrate into the existing shell, inherit its rhythm, and choose the simplest layout mode that fully supports the workflow.

## North Star

- Prefer IDE/tooling density over spacious presentation.
- Prefer flat, divider-light surfaces over boxed cards.
- Prefer technical, literal copy over productized explanation.
- Prefer inline, selection-driven editing over modal CRUD.
- Prefer structured controls over raw text inputs for structured data.
- Prefer neutral, semantic color over decorative accent styling.
- Prefer rows, tables, trees, lists, editors, and inspectors over card grids.

## Visual Concept First

For frontend-heavy surfaces, do not rely on a coding model to invent the final visual design from prose alone.

When the layout, visual hierarchy, or interaction model is uncertain, generate several static visual concepts first, choose the strongest direction, then implement against that selected reference. Use an image generator for concept exploration when it can produce concrete UI compositions faster than code iteration.

The selected concept is not a pixel-perfect spec. It is a target for density, structure, hierarchy, action placement, and control treatment. The implementation must still use Neon Pilot primitives, real data, accessibility, command-backed actions, extension boundaries, and the taste rules in this document.

Use this workflow especially when:

- building a new extension page
- redesigning Settings or another major app surface
- the first generated version looks demo-like
- the task has many layout/control tradeoffs
- Patrick has not already supplied a concrete visual reference

## Layout Modes

Neon Pilot uses adaptive workbench layouts, not one-off page chrome. Every main-route app or extension page must start from the shared `AppPageLayout` and `AppPageIntro` rhythm unless it is embedded in an existing workbench pane.

Canonical page rules:

- `AppPageLayout` owns page padding and responsive behavior. Main-route pages are left-aligned in the workspace, not centered hero pages. Do not hard-code competing `max-w-*`, page-level `px-*`, or oversized vertical gaps on normal pages.
- `AppPageIntro` owns the page title scale, optional summary, and top-right actions. Do not create local hero headers or 30–40px page titles.
- Page sections should use shared page/section/list/table primitives before local wrappers. A page can be solo, list/detail, table, editor, or split-pane, but its outer shell should still feel like the same product.
- Full-height split workflows may use `h-full` inside the canonical shell, but they should not invent separate top bars, padding systems, or title treatments.
- Settings, Extension Manager, Diagnostics, Automations, Routines, and installed extension pages should look like siblings: same title rhythm, toolbar density, spacing scale, and edge alignment.

### Chat + Workbench

Use for agentic workflows where conversation, instructions, run status, and generated outputs coexist.

- Chat/task rail owns instructions and conversation state.
- Workbench tabs own files, preview, logs, diffs, artifacts, settings, or runtime state.
- Keep workflow status visible without turning the page into a dashboard.

### Solo Panel

Use for focused tools with one primary surface, such as knowledge, telemetry, settings-like utilities, reports, and editors.

- Use a compact header/toolstrip.
- Start the working surface quickly.
- Avoid large intro blocks before controls.

### List + Detail

Use for durable object management: presets, workflows, rules, automations, snippets, connections, resources, and model/provider records.

- Keep the list/table compact.
- Reveal editing, preview, metadata, and actions through selection, inline expansion, an adjacent detail area, or context tabs.
- Avoid full-page forms for small records.

### Main + Context Tabs

Use when a primary workflow has secondary state worth keeping reachable: preview, logs, metadata, history, debug, help, or validation.

- Main content owns the primary task.
- Context tabs should reduce clutter, not create a second app frame.

### Modal / Drawer Focus

Use sparingly for destructive confirmations, short blocking decisions, or bounded transient flows.

Do not default to modal forms for normal create/edit workflows. Inline editing feels more interactive and preserves spatial context.

## Density

Bias toward IDE/tooling density. Sparse layouts are more often wrong than busy layouts.

A first viewport should usually show multiple useful things at once:

- objects plus details
- settings plus status
- workflow plus logs or preview
- table/list plus filters/actions
- editor plus validation or metadata

Whitespace is for readability, not presentation. Avoid oversized cards, large vertical gaps, hero-like empty states, and single-column forms that stretch across the page.

## Surface Treatment

Use flat, dense workbench surfaces.

- Avoid box-in-box layouts.
- Avoid nested bordered containers and card stacks.
- Use borders and dividers sparingly: between major regions, between toolbar and content, or inside dense inspectors where scanning improves.
- Do not use dividers as decoration or to compensate for weak layout.
- Repeated operational data should usually be rows, tables, trees, or lists before cards.

Cards are appropriate only when the item benefits from spatial preview, visual comparison, or repeated card-like content. They are not the default page structure.

## Settings Surfaces

Settings pages use one cohesive settings grammar. They should look like a compact IDE preferences pane, with Codex-style grouped rows, not a collection of unrelated forms.

- The content title is the current settings page, such as `Appearance`, `Providers`, or `Extensions`. Do not render a redundant top-level `Settings` title inside the settings content.
- Use one page title, then section headings only when they divide real conceptual groups. Avoid title stacks like `Settings` -> `Appearance` -> `Theme` unless each level changes the user's decision.
- A conceptual group should be one cohesive rounded row list: a single background, one outside border, and subtle internal dividers between rows.
- Do not mix boxed and unboxed controls inside the same conceptual group. If one row in a group is boxed, all sibling rows share the same list container.
- Rows use the same anatomy everywhere: label and earned secondary text on the left; the control, status, or actions on the right.
- Management sections, such as providers, MCP servers, extension repositories, and installed integrations, use the same list grammar: a small section heading/tool action above a single bordered list with rows.
- Avoid long runs of standalone horizontal rules. Dividers belong inside a cohesive list or between major page regions only.
- Extension-provided settings must inherit the host settings grammar. Generic extension settings, extension manager controls, and system extension panels should not invent separate spacing, borders, title sizes, or row structures.
- Settings auto-save when changing normal preferences. Do not show persistent Save/Cancel buttons for ordinary settings rows.
- Keep the page content max-width constrained and centered within the workspace region, so wide windows do not stretch rows into unreadable bands.

## Text Economy

Neon Pilot copy should be technical, literal, and compact.

Do not default to `title + description` pairs. A nav item, row name, section title, or field label should usually stand on its own.

Add secondary text only when it provides operational value:

- current state
- constraint
- consequence
- error or recovery instruction
- count or scope
- credential/source/status detail
- non-obvious behavior

Avoid secondary text that merely rephrases the label. Avoid marketing language, vague benefit copy, playful empty-state prose, and repeated subtitles.

## Controls

Always choose the friendliest constrained control that matches the data.

- Boolean: switch or checkbox.
- Enum: select, inline select, segmented control, radio group, or tabs depending on count and importance.
- Tags/list of strings: token/chip editor with add/remove and suggestions, not comma-separated text.
- Key/value settings: structured row editor with add/remove/reorder, not raw JSON.
- Ordered steps: reorderable list, not textarea.
- Prompt/body text: textarea or code editor when the value is genuinely free-form text.
- Templates with variables: editor plus variable picker/preview.
- File/resource references: picker/browser when host data exists, not path strings.
- Numbers: stepper, slider, or number input with units and bounds.

Raw textareas and JSON editors are acceptable only for prose, code, import/export, genuinely large or deeply nested payloads, or expert-only escape hatches with validation.

## Editing Model

Prefer inline and selection-driven editing.

Users should be able to select an object, inspect it, edit fields in place, and see related status, preview, metadata, or logs without losing context.

Use modals only for destructive confirmations, rare blocking decisions, or short transient flows where context is not useful.

## Workflow Representation

When a screen feels ugly, confusing, or hard to grok, the root problem is often the workflow representation, not the styling.

Do not fix a weak surface by adding more explanatory copy, padding, headings, dividers, cards, or status decoration. First identify the objects, the user's next decision, and the natural editing model. A clearer object model should make the UI feel obvious with less text.

- Provider/setup flows should optimize the happy path first: choose provider, add credential, auto-detect models, then expose advanced model editing after connection.
- A form embedded at the bottom of a list usually means the workflow model is wrong. Prefer selected row -> detail editor, inline expansion, or a short guided flow.
- Lists must look like lists: distinct rows, compact metadata, predictable row actions, and no card-grid default for operational records.
- Do not duplicate host navigation inside extension content. Use host sidebars, top bars, and detail surfaces before inventing in-page rails.
- Visual consistency issues count as product failures: mismatched header heights, padding, backgrounds, title bars, and misplaced controls are not harmless polish.

## Host Sidebar Surfaces

The left sidebar is app chrome. Extension sidebar views should feel like they temporarily replace the native Threads body, not like a standalone panel embedded inside the sidebar.

Use the native sidebar grammar:

- section title: compact uppercase accent label, same weight/color/rhythm as `Threads`
- actions: compact icon buttons beside the section title
- rows: title-first, single-scan rows with hover/selected states matching native thread rows
- empty text: compact inline sidebar message, not a centered card
- spacing: align to the host sidebar's section/header/row rhythm

Avoid:

- second-level panel chrome inside the sidebar
- visible filter tabs by default, especially `All` / `Enabled`, before there is enough data and workflow need
- row descriptions that repeat or explain the title
- tag subtitles, decorative chips, badges, or raw metadata in sidebar rows
- search boxes by default for tiny lists; prefer command palette/search actions until the list size justifies persistent search

If an extension needs an object navigator, the sidebar should select objects and the main/workbench surface should edit or inspect the selected object. Do not make the sidebar row carry the whole object model.

## Actions

Use IDE-like action chrome.

- Common actions may be icon-only with tooltips: refresh, add, remove, copy, open, search, filter, collapse, expand.
- Use text labels for domain-specific, ambiguous, primary, or destructive actions.
- Place actions in toolbars, rows, context menus, overflow menus, or selected-detail regions.
- Avoid isolated text buttons floating in blank space.
- Avoid persistent disabled text buttons as visual clutter.
- Meaningful user-reachable actions should be command-backed.

Actions should feel attached to tools and objects, not scattered like web-form buttons.

## Status

Status is compact operational metadata, not decoration.

Prefer subdued text, columns, icons, or small semantic indicators:

```text
Bot Token        Not saved
Routes           0 active
Provider         Connected
```

Avoid glowing badges, large status pills, decorative "Live" treatments, and status cards that compete with the working surface.

## Empty States

Empty states should be compact, operational, and embedded in the working surface.

They should explain what is missing, offer the next useful action, and preserve the intended layout. Avoid giant centered cards, illustrations, marketing copy, or empty expanses.

Prefer:

- an empty table/list row with a clear action
- a compact inline placeholder in an editor or detail region
- a small first-run hint near the relevant control
- disabled/placeholder preview panels that preserve layout

An empty object-management page should still show its header/toolstrip, list/table region, and selected-detail or guidance region when those structures are part of the workflow.

## Color

Use a mostly neutral workbench palette.

Color is reserved for selection, focus, active tabs, primary actions, semantic status, and charts or visual encodings where color carries meaning.

Avoid decorative color. Do not use purple/blue AI-app gradients, colorful glow effects, bokeh backgrounds, glassy panels, or accent-heavy SaaS styling. Extensions should not invent brand palettes unless the domain genuinely requires visual encoding.

## Progressive Disclosure

Dense does not mean everything is visible at once.

- Show primary workflow controls by default.
- Keep rare, advanced, unavailable, or destructive actions behind menus, disclosure, context tabs, or selected-state regions.
- Avoid long pages containing every possible setting and every possible button.
- Avoid permanent disabled controls unless their disabled state is essential information.

## Named Negative Smells

Use these names in review notes and judge output:

- `ai_purple_gradient`: purple/blue gradients, glow, bokeh, or glassy AI-app styling.
- `text_button_sprawl`: common actions rendered as scattered text buttons.
- `title_description_noise`: repeated two-line label/description pairs where descriptions add no operational value.
- `box_in_box`: nested cards, bordered sections, or floating panels used as layout.
- `sparse_empty_state`: a mostly blank page or large centered message before data exists.
- `modal_crud_flow`: normal create/edit behavior hidden behind modal forms.
- `card_grid_default`: repeated operational records rendered as cards when rows/tables/lists fit better.
- `decorative_status`: glowing pills, oversized status badges, or status treatments used as ornament.
- `wrong_workflow_representation`: styling a confusing form/list/page instead of choosing the right object model, control model, and host surface.

## Extension UI Checklist

Before shipping or judging generated extension UI:

1. Does the surface choose the right layout mode?
2. Does the first viewport contain a real working surface?
3. Are repeated records rows/tables/lists unless cards are justified?
4. Are controls structured for the data?
5. Is editing inline or selection-driven where practical?
6. Are common actions icon/tool/menu based instead of text-button sprawl?
7. Does secondary text earn its space?
8. Is the empty state compact and layout-preserving?
9. Are color and status treatments neutral and semantic?
10. Does the workflow representation make the screen obvious without extra explanation?
11. Does the page feel like a Neon Pilot workbench contribution, not an embedded standalone app?
