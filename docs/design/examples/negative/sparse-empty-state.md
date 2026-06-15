# Negative Anchor: Sparse Empty State

Avoid empty states that turn the first launch into a mostly blank page.

## Fails Because

- The workflow is unjudgeable before data exists.
- Large centered messages feel like mockups, not tools.
- The intended table/list/editor/detail structure disappears.
- The page looks sparse even when implementation is functionally correct.

## Prefer Instead

- Preserve the real workflow shell.
- Show compact empty rows, placeholder detail panes, starter templates, or inline first-run hints.
- Keep header actions, filters/search, list/table regions, and editor/detail/preview regions visible when they are part of the normal workflow.

## Tags

- `sparse_empty_state`
- `weak_empty_state`
- `empty_canvas`
- `unjudgeable_first_launch`
- `too_sparse`
