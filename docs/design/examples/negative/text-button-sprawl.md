# Negative Anchor: Text Button Sprawl

Avoid pages where every action appears as a rounded rectangle with text.

## Fails Because

- Common tool actions such as refresh, add, remove, copy, search, filter, collapse, and expand feel heavy as text buttons.
- Disabled text buttons become persistent visual clutter.
- Scattered buttons make the page feel like a janky web app instead of an IDE-like tool.
- Actions feel detached from the objects they affect.

## Prefer Instead

- Icon toolbar buttons with labels/tooltips for common IDE actions.
- Inline row actions on hover/focus.
- Context menus or overflow menus for rare actions.
- Text buttons only for domain-specific, ambiguous, primary, or destructive actions.
- Command-backed actions for meaningful user-reachable operations.

## Tags

- `text_button_sprawl`
- `bespoke_chrome`
- `weak_hierarchy`
- `unclear_destructive_action`
