# Frontend and UI reference

## Contents

- Component contract
- Shared primitives
- Page patterns
- Data and actions
- State and accessibility
- Visual guardrails

## Component contract

```tsx
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageIntro, AppPageLayout, EmptyState, ToolbarButton } from '@neon-pilot/extensions/ui';

export function MyPage({ pa, context, params }: ExtensionSurfaceProps) {
  return (
    <AppPageLayout>
      <AppPageIntro title="My page" />
      <EmptyState title="Nothing here yet" body="Create the first item to begin." />
      <ToolbarButton onClick={() => pa.ui.toast('Ready')}>Test</ToolbarButton>
    </AppPageLayout>
  );
}
```

Named exports must match manifest `component` values. Do not mount a separate React root.

The installed-app builder bundles TypeScript and JSX; it does **not** run an extension-local Tailwind compilation step. Do not write `className` utility strings. They may appear plausible in source while rendering as collapsed, unstyled markup in the app. Compose shared primitives and use a narrow React `style={{ ... }}` object only when product-specific grid, flex, sizing, or spacing is not already owned by a primitive. Validation treats `className` and raw `<button>`, `<input>`, `<select>`, or `<textarea>` controls in user extensions as errors.

## Shared primitives

Use `@neon-pilot/extensions/ui` before local markup:

- Page: `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `AppPageEmptyState`.
- Actions: `Button`, `ToolbarButton`, `IconButton`, `ButtonLink`.
- Forms: `Field`, `FieldLabel`, `FieldHint`, `FieldError`, `TextInput`, `Textarea`, `Select`, `Checkbox`, `Switch`, `SegmentedControl`.
- Data: `DataTable`, `DataTableToolbar`, `DataTableHead`, `DataTableBody`, `DataTableRow`, `DataTableCell`, `DataTableHeaderCell`, `DataTableEmptyRow`, `FilterToolbar`, `ResourceList`, `ResourceListItem`, `KeyValueTable`.
- Status: `EmptyState`, `ErrorState`, `CenteredLoadingState`, `Notice`, `Pill`, `ProgressBar`, `RuntimeStatusDot`.
- Sidebar: `SidebarSection`, `SidebarActionHeader`, `SidebarList`, `SidebarRow`, `SidebarMessage`, `SidebarTemplateList`.
- Inspector/rail: `ContextRail`, `ContextRailHeader`, `ContextRailBody`, `ContextRailSection`, `RailSection`, `RailSubsection`, `PanelHeader`, `PanelMessage`.
- Dialogs: `Dialog`, `ConfirmDialog`, `TextPromptDialog`.
- Layout: `WorkbenchShell`, `DashboardGrid`, `SurfacePanel`, `Disclosure`.

Not every workflow needs every primitive. Import only what the component uses. Names are case-sensitive. This list is the packaged public inventory; do not guess adjacent names. `extensions build` verifies export names and JavaScript bundling; it does not type-check component props, so follow the copyable recipes in these references.

## Page patterns

- **Table/list management**: toolbar and filters, durable list/table, detail or inline editor. Keep the shell present when empty.
- **Editor**: resource selection in owned sidebar, focused editor in main page, optional inspector for metadata or validation.
- **Runtime**: compact status, primary start/stop action, bounded logs, clear error and retry.
- **Settings**: rows and sections using settings primitives; no bespoke settings cards.
- **Dashboard**: operational summary plus immediately useful actions and records. Avoid metric-card wallpaper.

Use the application-owned sidebar for destinations or durable selection. Do not draw a second navigation column inside the main page.

For a data-management toolbar, use the primitive's rendered slots. Arbitrary children are not displayed:

```tsx
<DataTableToolbar
  summary={`${items.length} items`}
  search={<SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items" />}
  actions={
    <>
      <ToolbarButton onClick={refresh}>Refresh</ToolbarButton>
      <Button onClick={beginCreate}>New item</Button>
    </>
  }
/>
```

`DataTableToolbar` supports rendered `tabs`, `summary`, `search`, `filters`, and `actions` slots. It does not accept `searchValue`/`onSearchChange`, and it does not render action buttons passed as ordinary children. Every management destination must expose at least one obvious visible action in its page toolbar; Launcher commands supplement rather than replace page controls.

## Data and actions

Invoke backend actions through:

```ts
const result = await pa.extension.invoke('listItems', { query });
```

Use `pa.ui.toast` for brief confirmation and `pa.ui.confirm` immediately before destructive work. Use command contributions for open, create, refresh, run, or other meaningful actions.

Keep selection or route state deep-linkable when users may navigate back, reload, or reopen it. Read the actual route/search state supplied by the host.

## State and accessibility

- Render a stable loading layout instead of a blank page.
- Keep the normal working structure visible in the empty state.
- Show actionable errors and retry where safe.
- Disable duplicate submissions during long operations.
- Confirm irreversible deletion or replacement.
- Label controls and icon-only buttons.
- Make clickable rows semantic controls. Use `Button` or another shared action primitive; never put `onClick` on a `div`, `span`, `li`, or `tr`. This keeps list navigation keyboard-accessible and lets real-app QA target it reliably.
- Preserve keyboard focus and visible focus rings.
- Truncate or wrap long paths, titles, logs, and user data.
- Avoid horizontal overflow at narrow desktop widths.

## Visual guardrails

Neon Pilot is a dense operational workbench:

- Prefer flat sections, rows, tables, split panes, and inspectors.
- Avoid nested cards, decorative gradients, glowing pills, giant headings, sparse centered canvases, and generic SaaS dashboards.
- Avoid repeated title plus subtitle copy that does not help the task.
- Prefer toolbar icons, row actions, and menus over scattered text buttons.
- Use structured controls instead of comma-separated fields or raw JSON editors.
- Do not seed fake demo records merely to fill space; use purposeful templates or guidance inside the real workflow.
- Inspect UI inside the complete Neon Pilot frame.

For CRUD and operational products, these are release requirements rather than optional polish:

- Keep the list, table, queue, or runtime shell visible before the first record exists. Put guidance and the primary action inside that shell; never leave most of the application as an undifferentiated blank canvas.
- Default to an inline editor, owned detail pane, or selection-driven inspector for ordinary create/edit work. Reserve modal dialogs for short interruptions such as confirmation, credential entry, or a narrowly scoped choice.
- Give Models, Downloads, Runs, Reviews, and similar destinations a persistent operational structure with column/row affordances and obvious actions. A centered sentence is not a complete empty state.
- Destructive row actions must say `Delete` or use an unambiguous shared destructive icon with accessible label and tooltip. Do not use `×`, `✕`, or `x`; those read as close/dismiss.
- Write visible JSX copy with actual characters or plain ASCII punctuation. Do not put literal escapes such as `\\u2026` in JSX strings; browsers display that implementation text verbatim.
- Never size an application pane with `height: calc(100vh - ...)`. The host owns chrome around the extension. Use `WorkbenchShell`, flex growth, or `minHeight` so split dividers fill the owned content region.
- `AppPageSection` defaults to a two-column settings layout: a 12rem heading column plus its body. For a full-width table, list, or split-pane workbench, write `<AppPageSection layout="stacked">` or use `WorkbenchShell`; a bare `<AppPageSection>` will visibly collapse the workbench into the body column.

### Full-height workbench contract

`WorkbenchShell` accepts `header?`, `children`, `footer?`, `style?`, and ordinary div attributes. `WorkbenchHeader` accepts `title`, `meta?`, `leading?`, `actions?`, `style?`, and ordinary div attributes. Use this exact public pattern for a list/detail or editor workbench:

```tsx
<WorkbenchShell
  style={{ height: '100%', minHeight: 0 }}
  header={<WorkbenchHeader title="Reviews" meta={`${items.length} saved`} actions={<ToolbarButton>Add review</ToolbarButton>} />}
>
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(14rem, 32%) minmax(0, 1fr)',
      height: '100%',
      minHeight: 0,
    }}
  >
    <div style={{ minHeight: 0, overflow: 'auto' }}>{/* filter + list */}</div>
    <div
      style={{
        minHeight: 0,
        overflow: 'auto',
        borderLeft: '1px solid rgb(var(--color-border-subtle))',
        padding: 16,
      }}
    >
      {/* selected detail, inline editor, or empty state */}
    </div>
  </div>
</WorkbenchShell>
```

The grid owns the full shell body, so the divider spans the application content region. Keep both panes at `minHeight: 0` and put scrolling inside the panes. Do not use `100vh`, guessed host offsets, or an `AppPageSection` wrapper around this shell.

For a selectable list in the left pane, use the public row props exactly as shown. `ResourceListItem` does **not** support `title`, `description`, `active`, or `trailing`; those plausible-looking props render no primary text and fail extension validation.

```tsx
<ResourceList>
  {items.map((item) => (
    <ResourceListItem
      key={item.id}
      label={item.title}
      detail={item.summary || 'No summary'}
      meta={item.status}
      selected={item.id === selectedId}
      onClick={() => setSelectedId(item.id)}
    >
      {/* Optional badges or other extra row content go here as children. */}
    </ResourceListItem>
  ))}
</ResourceList>
```

`ResourceListItem` is already a semantic button. Do not wrap it in a clickable container. Its supported content props are `label` (required), `detail?`, `meta?`, `leading?`, `selected?`, and `children?`; ordinary button props such as `onClick`, `disabled`, and `aria-label` are also supported. Use `ResourceListRow` instead for a non-clickable display row; it accepts `title`, `detail?`, `meta?`, `leading?`, `actions?`, and `children?`.

- Use one clear surface hierarchy. Prefer compact rows with dividers and a focused detail region over a grid of individually outlined cards nested inside other panels.
- A management destination needs its owning action, not only Search and Refresh. Downloads needs a visible start/add-download path; jobs need Run; installed resources need Install or Add where appropriate. Empty states must keep that action reachable.
- Status-oriented data needs a structured filter when users will repeatedly ask “which state?” Use `SegmentedControl`, `Select`, or another shared control for All/active/completed rather than forcing status queries through free-text search.
- Runtime pages must remain informative while stopped. Show useful engine, endpoint, model, resource, or last-run metadata beside the start/stop action instead of leaving a mostly empty canvas.
- Judge both empty and populated states. Create representative records through real backend actions before capturing the populated state; do not hard-code demo data into product source.
