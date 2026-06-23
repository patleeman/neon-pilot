# UI Migration Plan

Neon Pilot uses one UI grammar: shared primitives from `@neon-pilot/ui`, re-exported to extensions through `@neon-pilot/extensions/ui` and settings-oriented subpaths.

This reset is allowed to break old visual habits because Neon Pilot has no external users yet. Prefer the complete shared pattern over local compatibility shims.

## Target Rules

- Layout utilities are allowed locally: `flex`, `grid`, `min-w-0`, overflow, sizing, positioning, and responsive constraints.
- Component chrome belongs in primitives: buttons, icon buttons, pills, status dots, notices, dialogs, menus, tool cards, settings rows, lists, tables, panels, and app page shells.
- Desktop surfaces should feel compact, technical, flat, and durable. Avoid decorative blur, large shadows, nested cards, glowing status, and SaaS-style badge decoration.
- Extension runtime code imports UI through `@neon-pilot/extensions/ui` or narrow public extension subpaths, not app or core internals.

## Default Replacements

- Raw action buttons -> `Button`, `ToolbarButton`, `TextButton`, `IconButton`, `RowButton`, or `MessageActionButton`.
- Custom pills/status badges -> `Pill`, `StatusDot`, `InlineMeta`, or subdued text status.
- Local panels/cards -> `SurfacePanel`, `PanelHeader`, `WorkbenchShell`, `WorkbenchHeader`, `ShelfSection`, or `RailSection`.
- Local lists and selectable rows -> `ResourceList`, `ResourceListRow`, `ResourceListItem`, `RowButton`, `DataTable`, or `TreeItemButton`.
- Raw form controls -> `Field`, `TextInput`, `SearchInput`, `Textarea`, `Select`, `InlineSelect`, `Switch`, `SettingsPanel`, and `SettingsRow`.
- Local modal/menu chrome -> `Dialog`, `ConfirmDialog`, `TextPromptDialog`, `MenuShell`, `PositionedMenu`, and `MenuItem`.
- Loading/error/empty text -> `LoadingState`, `CenteredLoadingState`, `PanelMessage`, `Notice`, `ErrorState`, `EmptyState`, or `AppPageEmptyState`.

## Enforcement

Run:

```sh
pnpm run check:ui-patterns
```

The checker reports suspicious local component styling. Set `UI_PATTERN_MAX_FINDINGS=0` to make it blocking. During this reset the expected direction is monotonically downward; after the reset lands, CI should keep the budget at zero or a tiny documented allowlist.

## QA Contract

Every UI reset slice must include:

1. Focused tests for changed behavior or rendering.
2. `pnpm --dir packages/ui run build` when shared primitives change.
3. `pnpm --dir packages/desktop run build:ui` for desktop UI changes.
4. `pnpm run check:extensions:static` for extension boundary or extension UI changes.
5. App-path QA through the real desktop route, including empty/loading/error or secondary states when reachable.
