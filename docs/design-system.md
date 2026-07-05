# Design System

Neon Pilot's design system lives in `packages/ui` and is published as `@neon-pilot/ui`.

Extension authors should normally import through the public SDK surface:

```tsx
import { Field, TextInput, ToolbarButton } from '@neon-pilot/extensions/ui';
```

This applies to sibling first-party extension repositories too, such as `../neon-pilot-extensions`. Those extensions should not copy local `Field`, `TextInput`, `Select`, `Pill`, notice, progress, or panel classes when the SDK component exists. Build the extension after replacement with its repo script.

The desktop app may import from local compatibility paths such as `packages/desktop/ui/src/components/ui`, but reusable components should be implemented in `packages/ui` first and re-exported through `@neon-pilot/extensions/ui`.

## Agent Workflow

1. Search `packages/ui/README.md` and Storybook before writing local UI.
2. Use shared primitives for buttons, fields, switches, notices, page shells, empty states, and status indicators.
3. If a needed reusable component is missing, add it to `packages/ui`, add a story, add tests when behavior is non-trivial, and re-export it through the extension SDK.
4. Replace local copies in app and extension code when the new component is compatible.
5. Keep extension-specific workflow logic inside the extension; keep generic chrome and controls in the design system.

For dynamic or generated settings UIs, avoid local input/select/button class constants. Compose the shared primitives directly. Use `Field` for simple controls, and use `FieldLabel` plus `FieldHint` in a neutral wrapper for composite controls that contain buttons.

Always use the most user-friendly input method available. Prefer constrained controls over free-form text whenever the value space is known: `Select` or `InlineSelect` instead of a typed string, `Switch` or `SettingToggleRow` instead of a boolean text field, `SegmentedControl` or tabs instead of magic mode names, swatches instead of hex-only color fields, and resource pickers instead of path text boxes. Prefer explicit key/value or structured row editors for individual settings and records over a `Textarea` containing JSON. Use raw JSON editing only for genuinely large, deeply nested, import/export, or expert-only payloads, and pair it with validation and clear errors.

User-reachable UI actions should be command-backed when they may need a shortcut, command-palette entry, hardware trigger, or automation hook. Add or reuse an extension/app command for meaningful page actions, toolbar actions, navigation, and workflow operations instead of leaving behavior trapped inside an anonymous button handler.

When auditing an extension or app surface, search first for repeated local recipes such as `rounded-md border border-border-subtle`, `bg-elevated p-`, `ui-toolbar-button`, local `BUTTON_CLASS` constants, `details`/`summary`, and hand-written empty/error/loading text. Most of those should collapse into an existing primitive.

The UI-pattern guardrail is blocking by default:

```sh
pnpm run check:ui-patterns
```

The scan covers desktop UI, first-party extensions, extension webapps, and docs extension templates. It allows zero findings unless a finding is narrowly documented. Use report-only mode only for exploratory audits:

```sh
pnpm run check:ui-patterns -- --report-only
UI_PATTERN_MAX_FINDINGS=unbounded pnpm run check:ui-patterns
```

Inline exceptions must be structured and rule-specific:

```tsx
{
  /* ui-pattern-ok raw-control reason="embedded third-party editor requires native file input semantics" */
}
<input type="file" />;
```

Bare `ui-pattern-ok` comments do not suppress findings and are reported as invalid. Prefer moving the surface to `@neon-pilot/ui` or `@neon-pilot/extensions/ui`; use an exception only when a narrow host, browser, or third-party constraint makes a shared primitive the wrong tool.

The committed/default check must not hide live migration debt behind a broad allowlist. If you add an allowlist entry for local investigation, keep it out of the default path and verify the default audit still matches an allowlist-free audit. Desktop host CSS is not a blanket design-system escape hatch: app-level component recipes in `packages/desktop/ui/src/app/index.css` need selector-level `ui-pattern-ok` reasons unless they move into `packages/ui` primitive styling.

## Commands

Run the component package build:

```sh
pnpm --dir packages/ui run build
```

Run component tests:

```sh
pnpm --dir packages/ui run test
```

Start Storybook:

```sh
pnpm --dir packages/ui run storybook
```

Build Storybook:

```sh
CI=true pnpm --dir packages/ui run build:storybook
```

## Current Foundation

The shared package includes:

- Actions: `Button`, `ButtonLink`, `ToolbarButton`, `TextButton`, `MessageActionButton`, `IconButton`, `IconLink`, `BrowsePathButton`, `CheckButton`, `TaskListItem`, `ChoiceRow`, `ActionTile`
- Attachment controls: `AttachmentChip`, `AttachmentChipButton`
- Status: `Pill`, `StatusDot`, `RingStatusDot`, `Spinner`, `Keycap`, `Tooltip`, `Notice`
- Surfaces: `SurfacePanel`, `PanelHeader`, `PanelMessage`, `CompactCard`, `WorkbenchShell`, `WorkbenchHeader`, `RailSection`, `RailSubsection`, `ShelfSection`, `ShelfHeader`, `ShelfBody`, `ShelfStatusRow`
- Overlays: `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`, `ConfirmDialog`, `TextPromptDialog`
- Feedback: `CenteredState`, `CenteredLoadingState`, `CenteredMessage`, `LoadingState`, `ErrorState`, `EmptyState`, `AppPageEmptyState`
- Forms: `Field`, `FieldLabel`, `FieldHint`, `FieldError`, `TextInput`, `SearchInput`, `Textarea`, `Select`, `InlineTextInput`, `InlineSelect`, `Checkbox`, `KeyboardShortcutCaptureInput`, `Switch`, `SettingsPanel`, `SettingsRow`, `SettingToggleRow`, `SettingsSection`
- Menus: `MenuShell`, `PositionedMenu`, `MenuGroupLabel`, `MenuItem`, `MenuSeparator`
- Selection and filtering: `SegmentedControl`, `TabList`, `TabButton`, `TabPanel`, `FilterToolbar`
- Data display: `SectionLabel`, `MetaLabel`, `CardTitle`, `CardBody`, `CardMeta`, `SupportingText`, `InlineMeta`, `MessageCard`, `MessageMeta`, `ToolResultCard`, `ResourcePickerDialog`, `ResourcePickerToolbar`, `ResourcePickerList`, `ResourceList`, `ResourceListRow`, `ResourceListItem`, `ResourceListLink`, `RowButton`, `InlineCode`, `InlineCodeButton`, `CodeBlock`, `Disclosure`, `ProgressBar`, `ProgressRow`, `Stat`, `StatGrid`, `MetricTile`, `DashboardGrid`, `DashboardGridCell`, `KeyValueList`, `KeyValueItem`, `KeyValueTable`, `DataTable`, `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, `DataTableCell`, `DataTableEmptyRow`, `DataTableActionGroup`, `TerminalBlock`
- Pages and sections: `PageHeader`, `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `AppPageToc`, `AppPageEmptyState`, `RuntimePage`, `RuntimeHeader`, `RuntimeHeaderControls`, `RuntimeStrip`, `RuntimeSection`, `RuntimeFooter`
- Utility: `cx`

Host-backed extension components are also exposed through public SDK subpaths when they need app-owned data or behavior:

- `@neon-pilot/extensions/ui`: app page shells, shared primitives, `ActivityTreeView`, `ChatView`, `ChatRailComposer`, `ExtensionChatRail`, `CheckpointInlineDiff`, `DiffActionButton`, `ContextMenuWrapper`, and file-tree helpers such as `useFileTreeModel`
- `@neon-pilot/extensions/settings`: settings-oriented exports plus shared form, notice, progress, and subsection primitives such as `SettingsSection`, `Field`, `SettingToggleRow`, and `RailSubsection`
- `@neon-pilot/extensions/workbench-files`: `WorkspaceExplorer` and `WorkspaceFileDocument`

Prefer package primitives for generic chrome. Use host-backed components only when the component depends on desktop/app state, workspace files, transcript rendering, activity-tree behavior, or native context menus.

## Extraction Priorities

Extract in small tranches and migrate real usage each time:

1. Forms and feedback: fields, inputs, switches, notices.
2. Overlays: confirmation dialogs and richer positioned menu behavior.
3. Layout: settings sections, cards, page headers, richer search/filter bars.
4. Data display: sortable columns, richer table states, and nested table actions.
5. Host-owned app patterns: file trees, activity trees, chat/transcript surfaces, diff/artifact views.

Each tranche should include documentation, Storybook coverage, and at least one app or extension replacement so the component is proven against production usage.

## Migration Map

- Raw action buttons -> `Button`, `ToolbarButton`, or `IconButton`
- Raw file/folder picker icon buttons -> `BrowsePathButton`
- Raw todo/checklist rows -> `TaskListItem` with `CheckButton`
- Raw selectable radio/checkbox option rows -> `ChoiceRow`
- Raw text/search/number inputs -> `TextInput` or `SearchInput`
- Raw selects -> `Select`
- Raw local `Field`, `TextInput`, `Select`, or `Pill` helpers in external extensions -> SDK imports from `@neon-pilot/extensions/ui`
- Raw textareas -> `Textarea`
- Boolean settings -> `Switch` or `SettingToggleRow`
- Local nested settings cards or provider subsections -> `SettingsPanel`
- Local segmented filters -> `SegmentedControl`
- Local tab rows -> `TabList`, `TabButton`, and `TabPanel`
- Local search/filter header rows -> `FilterToolbar`
- Local route section headers with title/description/count/actions -> `AppPageSection`
- Local fixed/absolute menu shells -> `PositionedMenu` with `MenuItem`
- Local loading/error/empty messages -> `LoadingState`, `ErrorState`, `EmptyState`, `PanelMessage`, `CenteredMessage`, or `Notice`
- Local bordered section cards with title/meta rows -> `SurfacePanel` with `PanelHeader`
- Local workbench editor/detail/preview panes -> `WorkbenchShell` with `WorkbenchHeader`
- Local left/right rail groups -> `RailSection` plus `ResourceListItem`, `ResourceListRow`, or `RowButton`
- Local compact transcript/workbench shelves -> `ShelfSection` with `ShelfHeader` and optional `ShelfBody`
- Local extension runtime/model-server/setup pages -> `RuntimePage`, `RuntimeHeader`, `RuntimeStrip`, `RuntimeSection`, `RuntimeFooter`, and `TerminalBlock`
- Local bordered metric tiles or status grids -> `DashboardGrid`, `DashboardGridCell`, and `MetricTile`
- Local bordered data cards -> `SurfacePanel`, `ResourceList`, `ResourceListRow`, `ResourceListItem`, `KeyValueList`, `KeyValueTable`, `DataTable`, or `Disclosure`
- Local modal resource/file/folder/workspace pickers -> `ResourcePickerDialog`, `ResourcePickerToolbar`, `ResourcePickerList`, and `ResourceListItem`
- Local non-collapsible tool result cards -> `ToolResultCard`
- Local table no-results `tr`/`td` placeholders -> `DataTableEmptyRow`
- Local table row action wrappers -> `DataTableActionGroup`
- Local compact uppercase labels -> `SectionLabel` or `MetaLabel`
- Local code, command, log, or JSON blocks -> `CodeBlock` or `TerminalBlock`
- Local file trees or workspace file panels -> `useFileTreeModel` for app-integrated trees, or `WorkspaceExplorer`/`WorkspaceFileDocument` when the extension needs the existing workspace file UX
- Local transcript/chat surfaces -> `ChatView`, `ChatRailComposer`, `ExtensionChatRail`, `MessageCard`, `MessageMeta`, `MessageActionButton`, and transcript-specific primitives before rebuilding message chrome

## Recent Production Examples

Use these as reference implementations when migrating similar surfaces:

- `extensions/system-settings/src/SettingsPage.tsx`: settings provider advanced sections use `Disclosure`.
- `extensions/system-extension-manager/src/panels.tsx`: manifest inspection uses `Disclosure` and `CodeBlock`.
- `packages/desktop/ui/src/components/ConversationArtifactWorkbench.tsx` and `ConversationCheckpointWorkbench.tsx`: full-height workbench panes use `WorkbenchShell`.
- `packages/desktop/ui/src/components/conversation/ConversationActivityShelf.tsx` and `ConversationQueueShelf.tsx`: compact conversation shelves use `ShelfSection`.
- `packages/desktop/ui/src/components/chat/MessageBlocks.tsx`: transcript messages use `MessageCard`, `MessageMeta`, and `MessageActionButton`.
- `../neon-pilot-extensions/system-ds4/src/frontend.tsx`: runtime settings use `SurfacePanel`, `Disclosure`, `ProgressBar`, `Pill`, `DashboardGrid`, `MetricTile`, and `CodeBlock`.
- `extensions/system-browser/src/panels.tsx`: browser tab rail uses `RailSection` and `ResourceListItem`.

## Agent Checklist

Before introducing local UI markup in an app page or extension:

1. Check `packages/ui/README.md` for a matching primitive and inspect `packages/ui/src/stories/Primitives.stories.tsx` for composition examples.
2. Prefer SDK imports from `@neon-pilot/extensions/ui` for extension code and `@neon-pilot/extensions/settings` for Settings extension code.
3. Choose the friendliest control before defaulting to text: dropdowns, toggles, segmented controls, pickers, key/value editors, and structured rows should replace raw inputs or JSON textareas whenever practical.
4. Back meaningful user actions with commands so they can be discovered, automated, and hot-keyed.
5. Keep domain behavior local, but move generic chrome, spacing, state color, empty/error/loading presentation, and modal/list/table shells to shared primitives.
6. Run `pnpm run check:ui-patterns` before handoff; do not use report-only or an allowlist as proof that first-party UI is migrated.
7. When adding a new primitive, update `packages/ui/src/index.ts`, `packages/desktop/ui/src/extensions/ui.ts` or settings exports if extensions need it, `packages/ui/README.md`, Storybook, and tests where behavior is non-trivial.
8. Validate the actual touched surface: build the package or extension, run `pnpm run check:extensions:static` for extension boundary work, and perform browser/app QA when user-visible UI changes.
