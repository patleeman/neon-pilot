# Design System

Neon Pilot's design system lives in `packages/ui` and is published as `@neon-pilot/ui`.

Extension authors should normally import through the public SDK surface:

```tsx
import { Field, TextInput, ToolbarButton } from '@neon-pilot/extensions/ui';
```

The desktop app may import from local compatibility paths such as `packages/desktop/ui/src/components/ui`, but reusable components should be implemented in `packages/ui` first and re-exported through `@neon-pilot/extensions/ui`.

## Agent Workflow

1. Search `packages/ui/README.md` and Storybook before writing local UI.
2. Use shared primitives for buttons, fields, switches, notices, page shells, empty states, and status indicators.
3. If a needed reusable component is missing, add it to `packages/ui`, add a story, add tests when behavior is non-trivial, and re-export it through the extension SDK.
4. Replace local copies in app and extension code when the new component is compatible.
5. Keep extension-specific workflow logic inside the extension; keep generic chrome and controls in the design system.

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

The initial package includes:

- Actions: `Button`, `ToolbarButton`, `IconButton`, `CheckButton`
- Status: `Pill`, `Keycap`, `Notice`
- Surfaces: `SurfacePanel`
- Feedback: `LoadingState`, `ErrorState`, `EmptyState`
- Forms: `Field`, `FieldLabel`, `FieldHint`, `FieldError`, `TextInput`, `SearchInput`, `Textarea`, `Select`, `Switch`, `SettingToggleRow`
- Menus: `MenuShell`, `MenuGroupLabel`, `MenuItem`, `MenuSeparator`
- Selection: `SegmentedControl`, `TabList`, `TabButton`
- Data display: `SectionLabel`, `ResourceListItem`, `CodeBlock`, `Stat`, `StatGrid`, `KeyValueList`, `KeyValueItem`, `DataTable`, `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, `DataTableCell`
- Pages: `PageHeader`, `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `AppPageToc`, `AppPageEmptyState`
- Utility: `cx`

## Extraction Priorities

Extract in small tranches and migrate real usage each time:

1. Forms and feedback: fields, inputs, switches, notices.
2. Overlays: confirmation dialogs and positioned menus.
3. Layout: settings sections, cards, page headers, search/filter bars.
4. Data display: richer tables, sortable columns, tab panels.
5. Host-owned app patterns: file trees, activity trees, chat/transcript surfaces, diff/artifact views.

Each tranche should include documentation, Storybook coverage, and at least one app or extension replacement so the component is proven against production usage.
