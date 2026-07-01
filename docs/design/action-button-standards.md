# Action Button Standards

Neon Pilot actions should feel like IDE/workbench controls, not web page form buttons. Use icon-first chrome for common operations, reserve text for actions where the label carries real decision-making value, and keep each action visually attached to the object or tool it affects.

## Default Grammar

- Common ambient verbs use `IconButton` or `IconLink` with an icon, `aria-label`, and `title`: close, open, collapse, expand, more actions, row details, inline remove.
- Common toolbar verbs that need visible button chrome use icon-only `Button variant="toolbar"` or `ToolbarButton` with `aria-label` and `title`: refresh, search, filter, copy, add, retry.
- Primary, destructive, domain-specific, or ambiguous actions use icon plus text in `Button` or `ButtonLink`. The icon anchors the action; the text disambiguates it.
- Toolbar actions use `Button variant="toolbar"` or `ToolbarButton`; use icon-only toolbar buttons for familiar verbs and icon plus text when a label is genuinely useful.
- Strong app actions use `Button variant="action"` with `tone="accent" | "danger" | "warning" | "success"` when the action needs emphasis.
- Low-emphasis actions use `Button variant="ghost"` only inside a toolbar, row, dialog footer, or selected-detail area where the action is contextually attached.
- Inline row/detail actions use `TextButton`, especially in metadata rows, key/value lists, compact shelves, and places where bordered chrome would add noise.
- Transcript and tool-output actions use `MessageActionButton`.
- Composer submit, stop, steer, follow-up, and answer actions use `ComposerActionButton`.
- Editor command bars use `EditorToolbarButton`.
- Whole-row selection or navigation uses `RowButton`, `SidebarRow`, `SidebarNavButton`, `ResourceListItem`, `ResourceListLink`, or `TreeItemButton`, not a general `Button`.

## Required Labels

- Icon-only actions must have both an accessible name and hover help: pass `aria-label` and usually `title`.
- Icon plus text actions should still use `title` when the action has side effects, is truncated, or uses an unfamiliar icon.
- Text-only actions are allowed only when the action is inline prose/detail chrome or when an icon would be misleading.
- Do not expose raw enum, API, or implementation labels in buttons. Labels must match the user's task.

## Placement

- Put actions in toolbars, headers, row trailing slots, context menus, overflow menus, dialog footers, selected-detail regions, or object-local shelves.
- Avoid isolated action buttons floating in blank space.
- Avoid persistent disabled text buttons. Prefer hiding unavailable low-value actions or showing compact status text with recovery actions nearby.
- Meaningful user-reachable actions should be command-backed where the surface supports command contributions.

## Variants

The public `Button` variants are:

- `toolbar`: quiet labeled toolbar chrome.
- `action`: compact emphasized action chrome.
- `ghost`: transparent contextual action chrome.

Do not add local names such as `primary`, `secondary`, or `link` at call sites. If a new semantic is needed, add it to `@neon-pilot/ui`, document it here, add Storybook coverage, and migrate call sites through the shared primitive.

Chromed action primitives share one workbench geometry: `Button`, `ButtonLink`, and `ToolbarButton` own their own height, padding, border, radius, background, font size, and hover/focus treatment. `IconButton` and `IconLink` are ambient icon controls for app chrome, row actions, modal closes, and compact object actions. Call-site `className` may position the action in layout, but must not locally override action size or typography with classes such as `min-h-*`, `h-*`, `w-*`, `px-*`, `py-*`, or arbitrary text sizes.

## Banned Patterns

- Raw `<button>` in app UI or first-party extension UI when a shared primitive can express the action.
- Local button class families such as extension-specific `*-button`, `*-primary`, or handwritten danger/accent button classes.
- Text-only bordered buttons for common tool verbs like refresh, add, copy, close, remove, search, and filter.
- Button-like anchors without `ButtonLink`, `IconLink`, or `TextLink`.
- Rebuilding icon button, segmented button, tab button, row button, or composer action chrome locally.

Exceptions must be narrow, documented near the code, and should usually result in a shared primitive or standard update before the pattern spreads.

## Sweep Priority

When standardizing existing surfaces, migrate in this order:

1. Replace invalid `Button` variants and raw app/extension buttons.
2. Convert common text toolbar buttons to icon-only `IconButton` with `aria-label` and `title`.
3. Convert primary/domain/destructive actions to icon plus text `Button`.
4. Move scattered actions into toolbar, row trailing, selected-detail, dialog footer, or overflow-menu placement.
5. Remove local button CSS once all call sites use shared primitives.
