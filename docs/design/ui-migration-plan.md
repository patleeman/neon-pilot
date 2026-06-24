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

The checker reports suspicious local component styling and fails with any finding by default. It scans desktop UI, first-party extensions, extension webapps, and docs extension templates.

Use report-only mode only when measuring migration work:

```sh
pnpm run check:ui-patterns -- --report-only
UI_PATTERN_MAX_FINDINGS=unbounded pnpm run check:ui-patterns
```

Narrow source exceptions must be structured inline comments:

```tsx
{/* ui-pattern-ok raw-details-summary reason="browser-native disclosure preserves markdown-rendered transcript semantics" */}
<details>
```

Bare `ui-pattern-ok` comments are invalid and do not suppress findings. Prefer replacing raw controls, local `details`/`summary`, semantic color recipes, surface CSS, shadows, and blur with shared primitives. If an exception is unavoidable, name the exact rule and the concrete constraint so future agents can remove it intentionally.

Do not commit a default allowlist that means "scheduled for migration." The default audit should be equivalent to an allowlist-free audit; migration debt belongs in code changes or in a narrow inline exception with a reason. Desktop `index.css` may host shared primitive CSS while the app owns the CSS bundle, but each app-level component recipe must be selector-scoped and justified.

## QA Contract

Every UI reset slice must include:

1. Focused tests for changed behavior or rendering.
2. `pnpm --dir packages/ui run build` when shared primitives change.
3. `pnpm --dir packages/desktop run build:ui` for desktop UI changes.
4. `pnpm run check:extensions:static` for extension boundary or extension UI changes.
5. App-path QA through the real desktop route, including empty/loading/error or secondary states when reachable.
