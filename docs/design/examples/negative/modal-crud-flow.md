# Negative Anchor: Modal CRUD Flow

Do not use modal forms as the default way to create and edit durable extension objects.

## Fails Because

- Modals break spatial context.
- Editing feels less interactive and less IDE-like.
- The list/detail relationship disappears while editing.
- Repeated modal forms make object management feel like a generic web CRUD app.

## Prefer Instead

- Inline row creation for small records.
- Selection-driven detail editors.
- Split list/detail layouts.
- Main editor plus context tabs.
- Drawers or modals only for short transient flows, destructive confirmations, or rare blocking decisions.

## Tags

- `modal_crud_flow`
- `missing_secondary_state`
- `weak_hierarchy`
