# Template: data-dashboard

Read-only page that loads data from a backend action and renders it as a table or stat grid.
No create/edit/delete. Good for status pages, diagnostics, run history, and analytics.

Derived from: `system-telemetry`, `system-local-models` (server tab).

## Files

- `extension.json` — manifest with one main-page view, one backend action
- `package.json` — minimal package descriptor
- `src/frontend.tsx` — page component: load → show table or cards
- `src/backend.ts` — backend action that returns structured data

## Customise

1. Change `"id"` in `extension.json` (must be unique across all extensions).
2. Change the route in `contributes.views` and `contributes.nav` to match your id.
3. Rename `DataDashboardPage` in `extension.json` → `component` and in `src/frontend.tsx`.
4. Replace `Item` type and backend fetch logic in `src/backend.ts`.
5. Replace the table columns and row rendering in `src/frontend.tsx`.
