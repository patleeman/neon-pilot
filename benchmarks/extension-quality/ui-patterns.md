# Extension UI Patterns

Use these patterns with `docs/design/neon-pilot-taste.md`. The taste profile is canonical; this file adds extension-specific workflow guidance.

## CRUD Management Page

A good CRUD extension page should feel like a compact tool surface, not a demo form.

- Keep the primary workflow visible in one stable layout: a compact resource list/table plus a detail/editor/preview inspector.
- For small durable records, create/edit should stay in that inspector or detail pane. Do not replace the whole surface with a full-page form.
- The first launch must be useful without fake persisted records. Use compact starter rows, inline creation, a placeholder inspector, or an empty list paired with a real editor/guidance pane.
- Put search, filters, and counts near the resource list. Keep them compact and aligned.
- Use shared controls: `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `SurfacePanel`, `ResourceList`, `DataTable`, `SearchInput`, `ToolbarButton`, `TextButton`, `Switch`, `SegmentedControl`, `Pill`, `InlineMeta`, and `KeyValueList` where they fit.
- Do not create nested card stacks. Use section borders, alignment, and typographic hierarchy before adding framed containers.
- Prefer resource rows, tables, trees, or lists over cards for repeated operational objects.
- The editor should have a compact action bar, grouped fields, and a clear preview or usage outcome. For prompt presets, show how the preset will be used or inserted.
- Tags, labels, categories, and modes should be token editors, selectable suggestions, segmented controls, or structured rows. Never use comma-separated text inputs.
- Metadata should be subdued and inline, for example `Created today · Enabled`, not prominent raw timestamp rows.
- Empty states should sit inside the workflow shell. Avoid a tiny centered message floating in a mostly blank page.
- Starter content must read as suggested templates or examples, not as fake user data. Label it as templates/examples and keep it visually secondary to the user's real list.
- When the list is empty, do not let an empty left pane dominate the page. Keep the list column compact or use the right pane for dense starter actions.
- Starter-template sections should be compact resource rows, table rows, or subdued action rows. Do not use oversized headings, marketing cards, or card grids.
- Tag editors must visibly render added tags as removable tokens and should offer selectable suggestions. Do not support comma as the primary add mechanism or mention comma-separated entry in helper text.
- Prompt/code textareas are allowed, but they should not dominate the form before metadata is complete. Use a balanced height plus preview/usage context where helpful.
- Avoid `title + description` repetition. Secondary text should earn its space through state, constraint, consequence, count, source, or non-obvious behavior.
- Use text buttons sparingly. Common actions should sit in toolbars, rows, icon buttons with labels/tooltips, context menus, or overflow menus.

## Prompt Presets Page

A polished prompt-presets extension should expose the actual workflow:

- Use the host left sidebar body for the preset navigator when the extension owns preset selection. Contribute a `views[].location: "sidebar"` view and connect it through `contributes.nav[].sidebarView`.
- Do not put a second left navigation rail inside the main page when the host sidebar can hold that navigation model.
- Sidebar view: match the native left-sidebar section style: uppercase accent section label, compact icon actions, no card/list panel chrome, and rows that scan like thread rows.
- Do not add visible filter tabs such as `All` / `Enabled` unless the user has enough real data and a workflow reason to need them.
- Starter templates should be compact sidebar rows. Prefer title-only rows with a subdued row action; avoid descriptions, tag subtitles, large bordered cards, or marketing grids.
- Main route: editor/detail surface similar to file or knowledge editing. Selecting a preset in the sidebar opens it in the main editor area.
- Main editor: compact toolbar, title, description with counters if useful, tokenized tags with removable chips and suggestion buttons, enabled switch, prompt editor, and a preview/usage region.
- Keep the selection/editing model spatially stable. `?new=true` should select/create a draft in the main editor while the sidebar navigator remains the navigator.
- Primary actions: create/save, cancel, delete only in edit mode with confirmation.
- Avoid raw implementation details. Users should see what the preset does, where it applies, and how it will be invoked.
