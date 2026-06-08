# Extension templates

Ready-to-copy starting points for common extension patterns. Each template lives as a real, buildable
example under `docs/extension-templates/templates/template-*` — copy the folder, rename the extension
id, fill in your domain logic, build, and reload. Templates are documentation/scaffolding, not runtime-loaded extensions.

| Template           | Pattern                                                   | Location                                                                                               |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `data-dashboard`   | Read-only page — load from backend, render table or cards | [`docs/extension-templates/templates/template-data-dashboard`](templates/template-data-dashboard/)     |
| `crud-page`        | List + slide-in form editor. Full create/edit/delete.     | [`docs/extension-templates/templates/template-crud-page`](templates/template-crud-page/)               |
| `settings-section` | Section in the shared Settings page. No separate route.   | [`docs/extension-templates/templates/template-settings-section`](templates/template-settings-section/) |

## Quick-start

```bash
# Copy the template to your extensions directory
cp -r docs/extension-templates/templates/template-crud-page \
      ~/.local/state/neon-pilot/extensions/my-extension

# 1. Edit extension.json: change "id", route, component name, action ids
# 2. Edit src/: replace placeholder types and handler logic with your domain
# 3. Build
pnpm run extension:build -- ~/.local/state/neon-pilot/extensions/my-extension

# 4. Reload via Extension Manager
```

## Agent copy checklist

After copying a template, replace every template-scoped identifier before the first build:

- `extension.json`: `id`, `name`, `description`, route, nav label, component export names, action ids, handler names, permissions, and settings component ids when present.
- `package.json`: package name when a package name is present, plus any runtime dependencies the extension imports.
- `src/backend.ts`: domain types, input validation, persistence, action return shapes, and notification/error text.
- `src/frontend.tsx`: exported component name, `pa.extension.invoke(...)` ids, visible labels, empty/error/loading states, and any action source strings passed to `pa.ui.notify`.
- `README.md`: what the extension does, how to build it, how to validate it in the app, and which surface it contributes.

Build and validate the copied extension, not the template directory:

```bash
pnpm run extension:build -- ~/.local/state/neon-pilot/extensions/my-extension
neon-pilot-extension doctor ~/.local/state/neon-pilot/extensions/my-extension
```

Then reload extensions and open the contributed route, rail, Settings section, command, or tool through the app.

## When to pick each template

**data-dashboard** — displaying state the user can't directly edit (server health, run history,
token usage). Add a Refresh button. One-shot load or polling.

**crud-page** — a list of user-managed items. The automations and gateway pages are the canonical
examples. Pattern: list → click item or "New" → editor form slides in → save/cancel.

**settings-section** — contributing to the existing Settings page rather than a new route. Simpler
than a full page; the host handles layout. Good for integration config and toggle-style preferences.

## Shared patterns across templates

- `AppPageLayout` + `AppPageIntro` — standard page chrome (`max-w-[72rem]`, consistent header)
- `AppPageSection` / `AppPageEmptyState` — standard page sections and empty page states
- `LoadingState` / `ErrorState` / `EmptyState` — unified feedback components
- `ToolbarButton` / `IconButton` / `TextButton` — action buttons
- `SegmentedControl` / `Switch` / `ToggleRow` — mode and boolean controls
- `DataTable` / `DataTableActionGroup` — management tables and row actions
- `RuntimePage` / `RuntimeHeaderControls` / `MetricTile` — runtime status pages
- `RailSubsection` / `ResourcePickerDialog` / `ChatView` / `ExtensionChatRail` — compact panels, file pickers, and chat surfaces
- `pa.ui.notify` — toast notifications on error
- `pa.ui.confirm` — confirmation dialogs before destructive actions
- Backend actions declared in `extension.json` → exported functions in `src/backend.ts`
- Frontend calls backend via `pa.extension.invoke('actionId', input)`

## Template validation expectations

Templates are scaffolding, so their in-memory stores and placeholder copy are intentionally simple. A production extension copied from a template should persist user data when the workflow needs durability, validate backend action input, and include an extension-local `README.md` that tells future agents exactly how to build, reload, and exercise the user-visible path.
