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

- Actions: `Button`, `ToolbarButton`, `IconButton`, `CheckButton`
- Status: `Pill`, `Keycap`, `Notice`
- Surfaces: `SurfacePanel`
- Overlays: `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`
- Feedback: `LoadingState`, `ErrorState`, `EmptyState`
- Forms: `Field`, `FieldLabel`, `FieldHint`, `FieldError`, `TextInput`, `SearchInput`, `Textarea`, `Select`, `Switch`, `SettingToggleRow`
- Menus: `MenuShell`, `MenuGroupLabel`, `MenuItem`, `MenuSeparator`
- Selection: `SegmentedControl`, `TabList`, `TabButton`
- Data display: `SectionLabel`, `SupportingText`, `ResourceListItem`, `CodeBlock`, `Disclosure`, `Stat`, `StatGrid`, `KeyValueList`, `KeyValueItem`, `DataTable`, `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableHeaderCell`, `DataTableCell`
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

## Extraction Backlog

Next good candidates:

- `ConfirmDialog`
- `PositionedMenu`
- `FilterToolbar`
- richer tab panels
- `KeyValueTable`
- `SettingsRow`
