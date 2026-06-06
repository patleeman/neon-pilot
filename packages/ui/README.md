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

- Actions: `Button`, `ButtonLink`, `ToolbarButton`, `TextButton`, `MessageActionButton`, `IconButton`, `IconLink`, `BrowsePathButton`, `CheckButton`, `TaskListItem`, `ActionTile`
- Attachment controls: `AttachmentChip`, `AttachmentChipButton`
- Status: `Pill`, `StatusDot`, `RingStatusDot`, `Spinner`, `Keycap`, `Tooltip`, `Notice`
- Surfaces: `SurfacePanel`, `PanelHeader`, `PanelMessage`, `CompactCard`, `WorkbenchShell`, `WorkbenchHeader`, `RailSection`
- Overlays: `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`, `ConfirmDialog`, `TextPromptDialog`
- Feedback: `CenteredState`, `CenteredLoadingState`, `CenteredMessage`, `LoadingState`, `ErrorState`, `EmptyState`
- Forms: `Field`, `FieldLabel`, `FieldHint`, `FieldError`, `TextInput`, `SearchInput`, `Textarea`, `Select`, `InlineTextInput`, `InlineSelect`, `Checkbox`, `KeyboardShortcutCaptureInput`, `Switch`, `SettingsPanel`, `SettingsRow`, `SettingToggleRow`
- Menus: `MenuShell`, `PositionedMenu`, `MenuGroupLabel`, `MenuItem`, `MenuSeparator`
- Selection and filtering: `SegmentedControl`, `TabList`, `TabButton`, `TabPanel`, `FilterToolbar`
- Data display: `SectionLabel`, `MetaLabel`, `CardTitle`, `CardBody`, `CardMeta`, `SupportingText`, `InlineMeta`, `MessageCard`, `MessageMeta`, `ToolResultCard`, `ResourcePickerDialog`, `ResourcePickerToolbar`, `ResourcePickerList`, `ResourceList`, `ResourceListRow`, `ResourceListItem`, `ResourceListLink`, `RowButton`, `InlineCode`, `CodeBlock`, `Disclosure`, `ProgressBar`, `ProgressRow`, `Stat`, `StatGrid`, `MetricTile`, `DashboardGrid`, `DashboardGridCell`, `KeyValueList`, `KeyValueItem`, `KeyValueTable`, `DataTable`, `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, `DataTableCell`, `DataTableEmptyRow`, `DataTableActionGroup`, `TerminalBlock`
- Pages and sections: `PageHeader`, `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `AppPageToc`, `AppPageEmptyState`, `SettingsSection`, `RuntimePage`, `RuntimeHeader`, `RuntimeStrip`, `RuntimeSection`, `RuntimeFooter`
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

- Use `Button` for semantic app actions. `variant="toolbar"` is quiet chrome, `variant="action"` is stronger and works for compact transcript/tool action controls, and `variant="ghost"` is best for selectable cards or low-emphasis row actions.
- Use `ButtonLink` when the same text-button treatment navigates with a real `href`. Prefer it over styling anchors by hand.
- Use `TextButton` for inline detail actions in rows, key-value lists, and compact headers where bordered button chrome would add visual noise.
- Use `MessageActionButton` for low-emphasis transcript, message, and tool-output actions such as copy, edit, rerun, fork, and extension-provided message actions.
- Use `MessageCard` for transcript-like user and assistant message bodies in chat rails, extension-owned agent conversations, and message previews. Pass `role="user"` for right-aligned prompt bubbles and omit it for assistant text blocks. Use `MessageMeta` for timestamps and compact transcript metadata beside `MessageActionButton`.
- Use `IconButton` for icon-only actions such as close, remove, more, edit, refresh, or composer controls. Use `size="sm"` for dense 28px chrome, and `shape="circle"` for composer controls and compact round affordances. Always provide `aria-label` and usually `title`.
- Use `IconLink` when the same square icon treatment navigates with a real `href`. Prefer it over styling anchors by hand.
- Use `BrowsePathButton` for compact file/folder picker triggers. It provides the shared folder-plus icon, disabled/busy treatment, and picker focus chrome; callers still own the actual browse action.
- Use `ActionTile` for dashboard, chooser, new-tab, and empty-state actions that need an icon, label, description, and optional meta. Prefer it over rebuilding bordered action cards.
- Use `CheckButton` for compact binary state controls where the row label is adjacent, such as todo completion, checklist steps, or small selectable resources.
- Use `TaskListItem` for compact checklist/todo rows with a control, label, optional detail text, done styling, and hover/focus actions. It is the default primitive for todo shelves, agent task lists, setup checklists, and queue items.
- Use `ChoiceRow` for selectable radio/checkbox option rows with an indicator, label, and optional details. It is the default primitive for ask-user prompts, setup wizards, and compact extension decision flows.
- Use `AttachmentChip` with `AttachmentChipButton` for compact file, image, drawing, and generated-asset rows in composer shelves, attachment lists, and upload previews. Keep file-specific labels, thumbnails, and actions in the caller.
- `Button`, `ButtonLink`, `ToolbarButton`, `TextButton`, `IconButton`, `IconLink`, and `CheckButton` forward refs for focus management, anchored menus, and keyboard workflows.
- Use `Field` only when the child is a simple form control that can be labeled by wrapping it, such as `TextInput`, `Textarea`, or `Select`. For composite controls containing buttons, compose `FieldLabel` and `FieldHint` in a neutral container instead.
- Use `TextInput`, `SearchInput`, `Textarea`, `Select`, and `Checkbox` instead of handwritten bordered controls. Override only sizing/background with `className`.
- Use `InlineTextInput` and `InlineSelect` for dense row editors, toolbar controls, cron builders, and other compact controls embedded in sentence-like UI. Use the regular `TextInput`/`Select` for full form rows.
- Use `KeyboardShortcutCaptureInput` for command and settings shortcut editors. It formats stored shortcut strings with `formatKeyboardShortcutLabel`, handles keyboard capture, and avoids rebuilding one-off capture buttons.
- Use `SettingsPanel` for repeated subsection panels inside a larger settings section, especially provider cards, grouped editor options, and advanced configuration blocks that need their own title/description/actions. Use `SettingsRow` inside it for individual settings with title/description copy and a trailing control or action. Use `Switch` or `SettingToggleRow` for boolean settings. `SettingToggleRow` is preferred when a title and description are part of the row.
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
- Use `WorkbenchShell` with `WorkbenchHeader` for full-height editor, preview, file diff, artifact, and inspection panes that need a fixed header, scroll/viewport body, and optional footer. Use `RailSection` for side rails inside those panes or app chrome: it provides the compact section label, optional actions, and a stable scroll body. Keep resource-specific rows in the caller, usually with `ResourceListItem`, `ResourceListLink`, `RowButton`, or `ResourceListRow`.
- Use `AppPageLayout`, `AppPageIntro`, and `AppPageSection` for extension-owned routes. `AppPageSection` accepts `meta` for counts, `actions` for search/filter controls, and optional children, so do not hand-roll bordered route section headers with local `h2`/description/count markup.
- Use `RuntimePage`, `RuntimeHeader`, `RuntimeStrip`, `RuntimeSection`, `RuntimeFooter`, `RuntimeStatusDot`, and `TerminalBlock` for extension pages that manage a local backend, model server, watcher, daemon, or installer. `RuntimeStrip` is the top status/progress band; pass `tone="ready" | "running" | "warning" | "muted"`, `metadata`, optional `message`, and optional `progress`. Use `RuntimeSection` for setup, backend settings, library, and logs sections instead of hand-rolled `border-t` section headers. Use `TerminalBlock` for bounded logs and command output.
- Use `CompactCard` for small bordered metadata blocks in rails, settings, dashboards, and extension panels. Compose it with `CardTitle`, `CardBody`, and `CardMeta`; set `as="article"` or `as="li"` only when the surrounding structure needs that semantic element.
- Use `SectionLabel` for compact uppercase section, chart, editor, menu, error-panel, and metadata labels. Set `tone="muted"` for low-emphasis labels in dense dashboards and app chrome.
- Use `MetaLabel` for inline uppercase metadata tags such as file status, artifact kind, and live/current badges.
- Use `CardTitle`, `CardBody`, and `CardMeta` for compact rail, settings, and panel typography instead of raw `ui-card-*` class names. Set `as="span"`, `as="label"`, or `as="summary"` only when semantics require it.
- Use `InlineMeta` for compact dim metadata with optional icons or spinners, such as "updated 2m ago", "saving...", counts, and inline status notes.
- Use `ToolResultCard` for non-collapsible transcript and extension tool-result cards with a leading icon, title, badges, meta, body, and actions. Use `tone="danger"` for failed tool cards and compose `Pill`, `InlineMeta`, and `TextButton` inside its slots. For custom collapsible or highly interactive tool cards, keep the behavior local but reuse `CardTitle`, `Pill`, `CardMeta`, `InlineMeta`, `MetaLabel`, and `SectionLabel` for the inner anatomy.
- Use `ResourcePickerDialog` with `ResourcePickerToolbar`, `ResourcePickerList`, and `ResourceListItem` for modal pickers that select files, folders, workspaces, artifacts, drawings, saved resources, or extension-owned records. Keep domain-specific loading, filtering, and row actions in the caller, but do not rebuild modal sizing, header/body/footer chrome, searchable toolbar bands, or scroll containers by hand.
- Use `ResourceList` and `ResourceListRow` for non-modal resource lists with a title, metadata badge, detail text, and trailing actions, such as skills, extension repositories, marketplace rows, saved presets, or installable resources. Use `ResourceListItem` when the whole row is a button, `ResourceListLink` when the whole row navigates, and `ResourceListRow` when the row contains independent controls.
- Use `RowButton` for compact interactive rows with custom internals, such as file rows, command rows, disclosure headers, chooser rows, and nested list entries. Use `compact` for dense rails and `selected` for the active row.
- Use `MetricTile` for compact value/label cards in dashboards. Prefer its `tone`, `size`, `align`, and `appearance="plain"` props over custom font and color utility recipes.
- Use `DashboardGrid` with `DashboardGridCell` for compact metric and trace dashboards that need two-to-four columns with consistent dividers.
- Use `InlineCode` for inline paths, ids, commands, commit hashes, and compact tokens. It wraps long values by default; set `wrap={false}` only for short fixed tokens.
- Use `ProgressBar`, `ProgressRow`, `StatGrid`, `Stat`, `KeyValueList`, `KeyValueTable`, `DataTable`, `ResourceListItem`, `CodeBlock`, and `Disclosure` for data display before composing raw rows or panels. `ResourceListItem` is for selectable resources and chooser rows; use its `leading` slot for compact file/folder icons. `ProgressRow` is for label/bar/value dashboard rows; `KeyValueList` is for vertical definition rows with optional actions; `KeyValueTable` is for compact two-to-four column summaries. Use `DataTable` with `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, and `DataTableCell` for structured tables; pass `columns={<colgroup>...</colgroup>}` and `tableClassName="table-fixed"` when fixed column sizing matters. Use `DataTableEmptyRow` for no-results rows instead of hand-written `tr`/`td` placeholders, and `DataTableActionGroup` for right-aligned row action clusters. `Stat` accepts `valueClassName`, `detailClassName`, `labelPosition`, and children for status dots or other small overlays.

## Proven Replacement Targets

These production areas already use the shared package and are useful examples for agents:

- Extension page shell and states: `system-telemetry`, `system-skills`, `system-extension-manager`
- Forms and settings: `system-automations`, `system-knowledge`, desktop `SettingsField`, workbench browser comment forms
- Search and filters: `system-extension-manager`, `system-automations`
- Menus and tabs: `system-extension-manager`, `system-dynamic-workflows`, `system-prompt-assembly`, `system-model-picker`
- Data display: telemetry trace views, dynamic workflows, prompt assembly, artifacts, diffs
- Workbench and rail chrome: artifact preview panes and checkpoint diff rails
- Tool result cards: artifact transcript renderers and extension-owned tool outputs
- Status markers: context-usage status bar indicators
- Compact rows: checkpoint file pickers, file-change headers, trace disclosure headers, and nested file lists
- Feedback: extension manager diagnostics, automations page notices, and conversation bootstrap warnings
- Transcript chrome: desktop browser comment shelves, app error recovery panels, file-change tool diffs, inline run cards, and activity shelves
- Message actions: transcript copy/edit/rewind/fork actions and message edit controls
- Message cards and actions: desktop user/assistant transcript messages, transcript copy/edit/rewind/fork actions, and extension-owned chat rails
- Tool actions: transcript diff buttons, deferred output loaders, image loaders, question tabs, and trace expansion controls
- Choice rows: ask-user prompt radio and checkbox options in both the desktop transcript and system conversation-tools extension
- Attachment chrome: desktop composer image and drawing attachment shelves
- Composer menus: model picker provider groups and slash-command source labels
- Composer controls: file attachment and local dictation buttons
- Compact editors: scheduled task advanced options and other dense field groups
- Dialog shells: desktop modals and extension install/details dialogs

## Extraction Backlog

Next good candidates:

- reusable activity/tree empty-state patterns
- transcript and tool-result card anatomy
- transcript cluster and context shelf components
