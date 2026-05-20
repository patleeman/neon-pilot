# Extension templates

Ready-to-copy starting points for common extension patterns. Each template is a minimal, annotated stub
derived from real first-party extensions. Copy the folder, rename the extension id, fill in your domain
logic, build, and reload.

| Template                                  | Use when…                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`data-dashboard`](./data-dashboard/)     | Read-only page that polls a backend for data and renders it as a table or card grid. Good for status pages, analytics, and diagnostics. |
| [`crud-page`](./crud-page/)               | Management page with a list view and a slide-in form editor. Good for anything where users create, edit, and delete items.              |
| [`settings-section`](./settings-section/) | Adds a section to the main Settings page. No separate route. Good for integration configuration and toggle-style preferences.           |

## Quick-start

```bash
# Copy the template
cp -r docs/extension-templates/crud-page ~/.local/state/neon-pilot/extensions/my-extension

# Edit extension.json: change id, name, description, routes, component names
# Edit src/: replace placeholder types and handler logic
# Build
pnpm run extension:build -- ~/.local/state/neon-pilot/extensions/my-extension

# Reload via Extension Manager or POST /api/extensions/my-extension/reload
```

## Shared patterns used across templates

- `AppPageLayout` + `AppPageIntro` — standard page chrome (max-w-[72rem], consistent header)
- `LoadingState` / `ErrorState` / `EmptyState` — unified feedback components
- `ToolbarButton` / `IconButton` — action buttons
- `pa.ui.notify` — toast notifications on error
- `pa.ui.confirm` — confirmation dialogs before destructive actions
- Backend actions declared in `extension.json` → exported functions in `src/backend.ts`
- Frontend calls backend via `pa.actions.call('actionId', input)`

## When to pick each template

**data-dashboard** — you're displaying state the user can't directly edit (server health, run history,
token usage). Add a Refresh button. Use polling or one-shot load.

**crud-page** — you have a list of user-managed items. The automations and gateway pages are the canonical
examples. Pattern: list → click item or "New" → editor form slides in → save/cancel.

**settings-section** — you're contributing to the existing Settings page rather than a new route. Simpler
than a full page; the host handles layout. Use `SettingsPanelHost` to render the contribution.
