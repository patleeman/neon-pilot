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

- Actions: `Button`, `ButtonLink`, `ToolbarButton`, `TextButton`, `IconButton`, `IconLink`, `CheckButton`, `ActionTile`
- Attachment controls: `AttachmentChip`, `AttachmentChipButton`
- Status: `Pill`, `StatusDot`, `RingStatusDot`, `Spinner`, `Keycap`, `Tooltip`, `Notice`
- Surfaces: `SurfacePanel`, `PanelHeader`, `PanelMessage`, `CompactCard`
- Overlays: `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`, `ConfirmDialog`, `TextPromptDialog`
- Feedback: `CenteredState`, `CenteredLoadingState`, `CenteredMessage`, `LoadingState`, `ErrorState`, `EmptyState`
- Forms: `Field`, `FieldLabel`, `FieldHint`, `FieldError`, `TextInput`, `SearchInput`, `Textarea`, `Select`, `Switch`, `SettingsRow`, `SettingToggleRow`
- Menus: `MenuShell`, `PositionedMenu`, `MenuGroupLabel`, `MenuItem`, `MenuSeparator`
- Selection and filtering: `SegmentedControl`, `TabList`, `TabButton`, `TabPanel`, `FilterToolbar`
- Data display: `SectionLabel`, `MetaLabel`, `CardTitle`, `CardBody`, `CardMeta`, `SupportingText`, `InlineMeta`, `ResourceListItem`, `RowButton`, `InlineCode`, `CodeBlock`, `Disclosure`, `ProgressBar`, `ProgressRow`, `Stat`, `StatGrid`, `MetricTile`, `DashboardGrid`, `DashboardGridCell`, `KeyValueList`, `KeyValueItem`, `KeyValueTable`, `DataTable`, `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, `DataTableCell`
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
- Use `IconButton` for icon-only actions such as close, remove, more, edit, refresh, or composer controls. Use `shape="circle"` for composer controls and compact round affordances. Always provide `aria-label` and usually `title`.
- Use `IconLink` when the same square icon treatment navigates with a real `href`. Prefer it over styling anchors by hand.
- Use `ActionTile` for dashboard, chooser, new-tab, and empty-state actions that need an icon, label, description, and optional meta. Prefer it over rebuilding bordered action cards.
- Use `AttachmentChip` with `AttachmentChipButton` for compact file, image, drawing, and generated-asset rows in composer shelves, attachment lists, and upload previews. Keep file-specific labels, thumbnails, and actions in the caller.
- `Button`, `ButtonLink`, `ToolbarButton`, `TextButton`, `IconButton`, `IconLink`, and `CheckButton` forward refs for focus management, anchored menus, and keyboard workflows.
- Use `Field` only when the child is a simple form control that can be labeled by wrapping it, such as `TextInput`, `Textarea`, or `Select`. For composite controls containing buttons, compose `FieldLabel` and `FieldHint` in a neutral container instead.
- Use `TextInput`, `SearchInput`, `Textarea`, and `Select` instead of handwritten bordered controls. Override only sizing/background with `className`.
- Use `SettingsRow` for settings with title/description copy and a trailing control or action. Use `Switch` or `SettingToggleRow` for boolean settings. `SettingToggleRow` is preferred when a title and description are part of the row.
- Use `SegmentedControl` for two-to-six mutually exclusive modes or filters. Do not rebuild segmented buttons locally.
- Use `TabList`, `TabButton`, and `TabPanel` for larger view navigation where content panels change. Use `TabPanel active={false}` for mounted-but-hidden inactive content, or render one active panel when inactive content does not need to stay mounted.
- Use `FilterToolbar` to align filter controls, search inputs, and optional actions on list pages.
- Use `MenuShell`, `MenuItem`, `MenuGroupLabel`, and `MenuSeparator` for menu contents. Use `PositionedMenu` when a menu needs fixed, absolute, or static placement without rebuilding menu chrome.
- Use `Dialog` and its header/body/footer pieces for modal shells before creating local fixed overlays. `Dialog` accepts `backdropClassName` and `backdropStyle` for host-specific overlay alignment or blur without rewriting the shell.
- Use `ConfirmDialog` for destructive or high-impact confirmations instead of `window.confirm`; it keeps extension prompts inside the app shell and supports explicit button labels.
- Use `TextPromptDialog` for simple rename, create, and move prompts that need one text input plus Cancel/Submit actions.
- Use `StatusDot` for compact colored status markers, `RingStatusDot` for compact percent/budget/quota markers, and `Spinner` for compact inline progress markers. Use `LoadingState`, `Notice`, `ErrorState`, and `EmptyState` for larger feedback surfaces. Avoid page-specific loading/error markup unless the layout requires it.
- Use `CenteredLoadingState` for full-height route, panel, and Suspense fallbacks instead of handwritten centered loading divs. Use `CenteredState` when the centered content is not a loading state.
- Use `CenteredMessage` for full-height empty, intro, and "select an item" panels that need an eyebrow, title, supporting body, and optional actions.
- Use `PanelMessage` for compact loading, empty, and error copy inside rails, menus, and bounded panels.
- Use `ErrorState` for blocking load failures; pass `title` plus `body` or `message` when a heading helps. Use `Notice tone="danger"` for inline validation, save, and action feedback.
- Use `SurfacePanel` with `PanelHeader` for repeated bordered data sections with a title, count, status, or action area.
- Use `CompactCard` for small bordered metadata blocks in rails, settings, dashboards, and extension panels. Compose it with `CardTitle`, `CardBody`, and `CardMeta`; set `as="article"` or `as="li"` only when the surrounding structure needs that semantic element.
- Use `SectionLabel` for compact uppercase section, chart, editor, menu, error-panel, and metadata labels. Set `tone="muted"` for low-emphasis labels in dense dashboards and app chrome.
- Use `MetaLabel` for inline uppercase metadata tags such as file status, artifact kind, and live/current badges.
- Use `CardTitle`, `CardBody`, and `CardMeta` for compact rail, settings, and panel typography instead of raw `ui-card-*` class names. Set `as="span"`, `as="label"`, or `as="summary"` only when semantics require it.
- Use `InlineMeta` for compact dim metadata with optional icons or spinners, such as "updated 2m ago", "saving...", counts, and inline status notes.
- For transcript or tool-result cards, compose `SurfacePanel muted` with `CardTitle`, `Pill`, `CardMeta`, optional `CardBody`, `InlineMeta`, `MetaLabel`, `SectionLabel`, and `TextButton`. Use `MetaLabel` for live/current/kind markers and compact field labels, and `SectionLabel` for small subsections such as prompts, replies, errors, and problems. This keeps artifact, checkpoint, ask-user, trace, and tool cards consistent without creating tool-specific primitives.
- Use `RowButton` for compact interactive rows with custom internals, such as file rows, command rows, disclosure headers, chooser rows, and nested list entries. Use `compact` for dense rails and `selected` for the active row.
- Use `MetricTile` for compact value/label cards in dashboards. Prefer its `tone`, `size`, `align`, and `appearance="plain"` props over custom font and color utility recipes.
- Use `DashboardGrid` with `DashboardGridCell` for compact metric and trace dashboards that need two-to-four columns with consistent dividers.
- Use `InlineCode` for inline paths, ids, commands, commit hashes, and compact tokens. It wraps long values by default; set `wrap={false}` only for short fixed tokens.
- Use `ProgressBar`, `ProgressRow`, `StatGrid`, `Stat`, `KeyValueList`, `KeyValueTable`, `DataTable`, `ResourceListItem`, `CodeBlock`, and `Disclosure` for data display before composing raw rows or panels. `ProgressRow` is for label/bar/value dashboard rows; `KeyValueList` is for vertical definition rows with optional actions; `KeyValueTable` is for compact two-to-four column summaries. Use `DataTable` with `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, and `DataTableCell` for structured tables; pass `columns={<colgroup>...</colgroup>}` and `tableClassName="table-fixed"` when fixed column sizing matters. `Stat` accepts `valueClassName`, `detailClassName`, `labelPosition`, and children for status dots or other small overlays.

## Proven Replacement Targets

These production areas already use the shared package and are useful examples for agents:

- Extension page shell and states: `system-telemetry`, `system-skills`, `system-extension-manager`
- Forms and settings: `system-automations`, `system-knowledge`, desktop `SettingsField`, workbench browser comment forms
- Search and filters: `system-extension-manager`, `system-automations`
- Menus and tabs: `system-extension-manager`, `system-dynamic-workflows`, `system-prompt-assembly`, `system-model-picker`
- Data display: telemetry trace views, dynamic workflows, prompt assembly, artifacts, diffs
- Status markers: context-usage status bar indicators
- Compact rows: checkpoint file pickers, file-change headers, trace disclosure headers, and nested file lists
- Feedback: extension manager diagnostics, automations page notices, and conversation bootstrap warnings
- Transcript chrome: desktop browser comment shelves, app error recovery panels, file-change tool diffs, inline run cards, and activity shelves
- Attachment chrome: desktop composer image and drawing attachment shelves
- Composer menus: model picker provider groups and slash-command source labels
- Composer controls: file attachment and local dictation buttons
- Compact editors: scheduled task advanced options and other dense field groups
- Dialog shells: desktop modals and extension install/details dialogs

## Extraction Backlog

Next good candidates:

- richer route header/chrome primitives
- reusable activity/tree empty-state patterns
- transcript and tool-result card anatomy
