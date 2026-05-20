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

# 4. Reload via Extension Manager or:
#    POST /api/extensions/my-extension/reload
```

## When to pick each template

**data-dashboard** — displaying state the user can't directly edit (server health, run history,
token usage). Add a Refresh button. One-shot load or polling.

**crud-page** — a list of user-managed items. The automations and gateway pages are the canonical
examples. Pattern: list → click item or "New" → editor form slides in → save/cancel.

**settings-section** — contributing to the existing Settings page rather than a new route. Simpler
than a full page; the host handles layout. Good for integration config and toggle-style preferences.

## Shared patterns across templates

- `AppPageLayout` + `AppPageIntro` — standard page chrome (`max-w-[72rem]`, consistent header)
- `LoadingState` / `ErrorState` / `EmptyState` — unified feedback components
- `ToolbarButton` / `IconButton` — action buttons
- `pa.ui.notify` — toast notifications on error
- `pa.ui.confirm` — confirmation dialogs before destructive actions
- Backend actions declared in `extension.json` → exported functions in `src/backend.ts`
- Frontend calls backend via `pa.actions.call('actionId', input)`
