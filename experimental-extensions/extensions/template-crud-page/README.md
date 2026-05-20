# Template: crud-page

Management page with a list view and a slide-in editor form. Supports create, edit, and delete.
The main view shows a filterable table; clicking "New" or an edit button opens an inline form panel.

Derived from: `system-automations`.

## Files

- `extension.json` — manifest with one main-page view and four backend actions (list/get/save/delete)
- `package.json` — minimal package descriptor
- `src/frontend.tsx` — list + editor pattern; two top-level states: `listView` / `editorOpen`
- `src/backend.ts` — four action handlers backed by an in-memory store (replace with sqlite or file)

## Customise

1. Change `"id"` in `extension.json` (must be unique).
2. Update `contributes.views` route and `component` name, and `contributes.nav` route + label.
3. Rename `CrudPage` in `extension.json` → `component` and throughout `src/frontend.tsx`.
4. Replace the `Item` type and `FormState` shape to match your domain.
5. Replace the in-memory store in `src/backend.ts` with your persistence layer.
6. Add/remove form fields in the editor section of `src/frontend.tsx`.
