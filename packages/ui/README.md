# @neon-pilot/ui

Neon Pilot's shared design-system package.

Use this package for reusable React UI primitives and extension-friendly app patterns. Extension authors normally import these through `@neon-pilot/extensions/ui`, which is the public SDK surface the host resolves at runtime.

## Agent Rules

- Prefer these components before writing local button, field, switch, notice, modal, menu, page, or status markup.
- Keep components generic and product-neutral. Extension-specific workflows belong in extensions.
- Add Storybook stories for every new reusable component.
- Add or update this README when adding a component so future agents can discover it without reading implementation details.
- Components must use explicit props and stable class names. Avoid relying on app-only globals.
- When replacing existing UI, preserve behavior first, then improve consistency.

## Current Components

- Actions: `Button`, `ButtonLink`, `ToolbarButton`, `TextButton`, `IconButton`, `IconLink`, `CheckButton`
- Status: `Pill`, `StatusDot`, `Spinner`, `Keycap`, `Tooltip`, `Notice`
- Surfaces: `SurfacePanel`, `PanelHeader`
- Overlays: `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`, `ConfirmDialog`, `TextPromptDialog`
- Feedback: `LoadingState`, `ErrorState`, `EmptyState`
- Forms: `Field`, `FieldLabel`, `FieldHint`, `FieldError`, `TextInput`, `SearchInput`, `Textarea`, `Select`, `Switch`, `SettingToggleRow`
- Menus: `MenuShell`, `PositionedMenu`, `MenuGroupLabel`, `MenuItem`, `MenuSeparator`
- Selection and filtering: `SegmentedControl`, `TabList`, `TabButton`, `FilterToolbar`
- Data display: `SectionLabel`, `SupportingText`, `ResourceListItem`, `InlineCode`, `CodeBlock`, `Disclosure`, `ProgressBar`, `ProgressRow`, `Stat`, `StatGrid`, `MetricTile`, `DashboardGrid`, `DashboardGridCell`, `KeyValueList`, `KeyValueItem`, `DataTable`, `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, `DataTableCell`
- Pages and sections: `PageHeader`, `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `AppPageToc`, `AppPageEmptyState`, `SettingsSection`
- Utility: `cx`

## Storybook

Run:

```sh
pnpm --dir packages/ui run storybook
```

Build static Storybook:

```sh
pnpm --dir packages/ui run build:storybook
```

Storybook should document component intent, variants, empty/error/loading states, and extension usage examples.

## Extension Usage

Use the SDK re-export:

```tsx
import { Field, TextInput, ToolbarButton } from '@neon-pilot/extensions/ui';

export function MyExtensionPage() {
  return (
    <form className="grid gap-3">
      <Field label="Name" hint="Shown in the extension list.">
        <TextInput name="name" placeholder="Daily Summary…" autoComplete="off" />
      </Field>
      <ToolbarButton type="submit">Save</ToolbarButton>
    </form>
  );
}
```

## Component Selection Guide

Reach for the smallest primitive that covers the interaction before composing a new local control:

- Use `Button` for semantic app actions. `variant="toolbar"` is quiet chrome, `variant="action"` is stronger, and `variant="ghost"` is best for selectable cards or low-emphasis row actions.
- Use `ButtonLink` when the same text-button treatment navigates with a real `href`. Prefer it over styling anchors by hand.
- Use `TextButton` for inline detail actions in rows, key-value lists, and compact headers where bordered button chrome would add visual noise.
- Use `IconButton` for icon-only actions such as close, remove, more, edit, or refresh. Use `shape="circle"` for composer controls and compact round affordances. Always provide `aria-label` and usually `title`.
- Use `IconLink` when the same square icon treatment navigates with a real `href`. Prefer it over styling anchors by hand.
- `Button`, `ButtonLink`, `ToolbarButton`, `TextButton`, `IconButton`, `IconLink`, and `CheckButton` forward refs for focus management, anchored menus, and keyboard workflows.
- Use `Field` only when the child is a simple form control that can be labeled by wrapping it, such as `TextInput`, `Textarea`, or `Select`. For composite controls containing buttons, compose `FieldLabel` and `FieldHint` in a neutral container instead.
- Use `TextInput`, `SearchInput`, `Textarea`, and `Select` instead of handwritten bordered controls. Override only sizing/background with `className`.
- Use `Switch` or `SettingToggleRow` for boolean settings. `SettingToggleRow` is preferred when a title and description are part of the row.
- Use `SegmentedControl` for two-to-six mutually exclusive modes or filters. Do not rebuild segmented buttons locally.
- Use `TabList` and `TabButton` for larger view navigation where content panels change.
- Use `FilterToolbar` to align filter controls, search inputs, and optional actions on list pages.
- Use `MenuShell`, `MenuItem`, `MenuGroupLabel`, and `MenuSeparator` for menu contents. Use `PositionedMenu` when a menu needs fixed, absolute, or static placement without rebuilding menu chrome.
- Use `Dialog` and its header/body/footer pieces for modal shells before creating local fixed overlays. `Dialog` accepts `backdropClassName` and `backdropStyle` for host-specific overlay alignment or blur without rewriting the shell.
- Use `ConfirmDialog` for destructive or high-impact confirmations instead of `window.confirm`; it keeps extension prompts inside the app shell and supports explicit button labels.
- Use `TextPromptDialog` for simple rename, create, and move prompts that need one text input plus Cancel/Submit actions.
- Use `StatusDot` for compact colored status markers and `Spinner` for compact inline progress markers. Use `LoadingState`, `Notice`, `ErrorState`, and `EmptyState` for larger feedback surfaces. Avoid page-specific loading/error markup unless the layout requires it.
- Use `ErrorState` for blocking load failures; pass `title` plus `body` or `message` when a heading helps. Use `Notice tone="danger"` for inline validation, save, and action feedback.
- Use `SurfacePanel` with `PanelHeader` for repeated bordered data sections with a title, count, status, or action area.
- Use `SectionLabel` for compact uppercase section, chart, and metadata labels. Set `tone="muted"` for low-emphasis labels in dense dashboards.
- Use `MetricTile` for compact value/label cards in dashboards. Prefer its `tone`, `size`, `align`, and `appearance="plain"` props over custom font and color utility recipes.
- Use `DashboardGrid` with `DashboardGridCell` for compact metric and trace dashboards that need two-to-four columns with consistent dividers.
- Use `InlineCode` for inline paths, ids, commands, commit hashes, and compact tokens. It wraps long values by default; set `wrap={false}` only for short fixed tokens.
- Use `ProgressBar`, `ProgressRow`, `StatGrid`, `Stat`, `KeyValueList`, `DataTable`, `ResourceListItem`, `CodeBlock`, and `Disclosure` for data display before composing raw rows or panels. `ProgressRow` is for label/bar/value dashboard rows; `Stat` accepts `valueClassName`, `detailClassName`, `labelPosition`, and children for status dots or other small overlays.

## Proven Replacement Targets

These production areas already use the shared package and are useful examples for agents:

- Extension page shell and states: `system-telemetry`, `system-skills`, `system-extension-manager`
- Forms and settings: `system-automations`, `system-knowledge`, desktop `SettingsField`
- Search and filters: `system-extension-manager`, `system-automations`
- Menus and tabs: `system-extension-manager`, `system-dynamic-workflows`, `system-prompt-assembly`
- Data display: telemetry trace views, dynamic workflows, prompt assembly, artifacts, diffs
- Dialog shells: desktop modals and extension install/details dialogs

## Extraction Backlog

Next good candidates:

- `ConfirmDialog`
- richer tab panels
- `KeyValueTable`
- `SettingsRow`
