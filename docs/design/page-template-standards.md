# Page Template Standards

Neon Pilot pages should be assembled from shared page templates before adding local layout. The goal is for Settings, Extensions, Skills, Automations, Diagnostics, Gateways, Routines, and extension-owned pages to feel like siblings in the same workbench.

Use `docs/design/page-shell-plan.md` for the shell-region implementation plan and `docs/design/page-type-vetting.md` for the recorded approval decision.

Page templates cover all route-owned shell regions, not only the main content area. A route can declare:

- a main page template with `AppPageLayout` and one approved page type
- an optional contextual-left template with the sidebar primitives
- an optional right-sidebar template with the context-rail primitives

Do not implement side regions as local `aside` shells, custom title bands, or bespoke scroll containers. If a left or right region needs a new recurring anatomy, add or extend a design-system template before using it in app or extension code.

## Status

The shell-region model and six page-type taxonomy are approved design-system defaults:

- global left navigation always remains
- the middle-left contextual area is route-owned and blank when undeclared
- the main page owns the primary workflow
- the right sidebar is route-owned context, hidden when undeclared

New app and first-party extension routes must fit one of the approved page types below before adding local layout. If a workflow does not fit, document the missing behavior and update this design-system guidance before adding another recurring page type.

## Approved Page Types

Most routes should be able to fit one of these types before local layout is added:

| Page type         | Use for                                                                     | Contextual left area                          | Main page                                                   | Right sidebar                                 |
| ----------------- | --------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| Conversation page | Chat, transcript-first agent work                                           | Threads or route-owned conversation navigator | Transcript, composer, run state                             | Workbench/context rail                        |
| Table page        | Durable object management: automations, skills, extensions, providers, logs | Blank by default                              | Table/list with shared toolbar, filters, search, pagination | Optional selected-object details or inspector |
| Editor page       | Routines, canvases, workflows, structured object editing                    | Optional object/step navigator                | Editor, timeline, canvas, or detail surface                 | Inspector, validation, history, preview       |
| Settings page     | Preferences, provider settings, extension settings                          | Optional settings navigation                  | Grouped settings rows                                       | Optional help/details rail only when useful   |
| Dashboard page    | Diagnostics, metrics, status views                                          | Blank by default                              | Metrics, charts, log summaries                              | Optional metric/log details                   |
| Setup page        | Connection, credential, provider, onboarding, install flows                 | Optional provider/object selector             | Linear setup path                                           | Docs, activity, test output, metadata         |

If a workflow does not fit these types, write down the missing behavior before creating a new type. Most mismatches mean the workflow representation needs work, not that the app needs another page shell.

## Default Page Anatomy

Use this order for normal main-route content:

1. `AppPageLayout`
2. `AppPageIntro` with title-only copy by default
3. Optional `Notice` for errors or saved state
4. A shared toolbar such as `DataTableToolbar`
5. The working surface: table, list, editor, inspector, or transcript
6. Optional footer controls such as `DataTablePagination`

Do not put search boxes, filters, and primary actions in different page rows unless the workflow genuinely has separate tool regions.

Every page template must define a layout-preserving empty state for its primary working surface. The standard empty state uses `EmptyState` or `AppPageEmptyState` and includes the feature's job, the condition that makes the page empty, two or three first steps, and the next useful action when one exists. Avoid page-wide blank space, isolated one-line messages, or generic placeholder copy.

## Shell Regions

Main routes are composed from shell regions, not page-local chrome.

1. The global left nav always stays. Top-level app routes and bottom utility routes are global shell navigation.
2. The middle-left contextual area is route-owned. It is blank unless the current route declares contextual navigation or selection content.
3. The main page is required and owns the primary workflow.
4. The right sidebar is route-owned. The shell shows the right-sidebar toggle only when the current route declares right-sidebar content.

Do not show Threads outside the Chat route by default. Threads are the Chat page's contextual left area, not global app chrome.

Do not show disabled shell buttons for unavailable regions. Hide the right-sidebar toggle when the route has no right-sidebar contribution.

Right-sidebar open/closed state is remembered per route. A page that supports right-sidebar content should be allowed to show a compact empty state such as "Select an item" when no object is selected.

Use the approved page types above as the route-region map. In short: Chat gets Threads and Workbench; table, dashboard, and most setup pages start with a blank contextual-left area; editor pages may declare a left navigator; details usually belong in the right sidebar instead of a modal when the user benefits from persistent adjacent context.

## Table/List Pages

Use table/list pages for object management surfaces such as Automations, Skills, Extensions, providers, connections, model records, and logs.

- Use `DataTableToolbar` for tabs, result counts, filters, search, refresh, and create/install actions.
- Put filters in the toolbar, not inside column headers.
- Column headers sort; they do not host select boxes.
- Use `DataTablePagination` when results are paged or visually page-sized.
- Empty and loading states belong inside the table/list body so the page shape does not jump.
- First-run empty states should teach what the records are and how to create, install, connect, or import the first one.
- Search placement is always toolbar-right. Result counts and active-filter summaries are toolbar-left.
- A table page may stay main-only when details are short-lived create/edit flows rather than persistent inspection context. Automations is the canonical main-only table example.

## Setup Pages

Use setup pages for connection or provider workflows.

- Keep the page single-column unless the user benefits from simultaneously comparing two primary work areas.
- Represent status as compact metadata rows, not status cards.
- Put secondary metadata such as docs, configuration location, and recent events in normal sections below the main setup path.
- Avoid sidebar duplication. The host sidebar may select the object; it should not repeat page activity feeds.
- When a setup route has a right sidebar, keep docs, recent activity, and diagnostic metadata there. The main page should keep only the current setup state and the next useful action.
- Empty setup states should describe the provider/resource being connected, the required credential or choice, and the test/verification step that proves setup worked.

## Loading

Avoid visible page-level loading icons. Generic route loading should reserve the page shape or show a quiet inline table/list row. Spinners are reserved for local work: buttons, tool output, progress rows, and places where progress is attached to an object.

Extension route and surface loading should be visually quiet by default: use `QuietLoadingState` to reserve the shell region and keep accessible `status` semantics, but do not draw a centered page message or spinner. If a specific table, list, editor, or right sidebar needs loading feedback, render it inside that working surface so the page chrome stays stable.

## Left Sidebar

The left sidebar has two responsibilities: global navigation and route-owned contextual navigation.

The global nav items at the top and bottom always stay. The middle contextual area belongs to the current route. If a route does not declare middle-left content, leave that region blank; do not fill it with Threads or another unrelated navigator.

Pages that expose an object navigator may use the middle-left area only when that navigator is the natural selection surface for the page. The left contextual area should select or navigate objects; editing, metadata, actions, and inspection belong in the main page or right sidebar.

If an extension provides sidebar content, it must use the native sidebar grammar from `docs/design/neon-pilot-taste.md`: compact section label, icon actions, single-scan rows, and no persistent search box until list size justifies it.

### Contextual Left Template

Use this template for route-owned selection/navigation. It belongs only in a `views[].location: "sidebar"` component bound from `nav[].sidebarView`.

```tsx
import { SidebarActionHeader, SidebarList, SidebarMessage, SidebarSection } from '@neon-pilot/extensions/ui';

export function ExtensionSidebar({ loading, items, selectedId, onSelect }) {
  return (
    <SidebarSection title="Items">
      {loading ? (
        <SidebarMessage>Loading items...</SidebarMessage>
      ) : (
        <SidebarList
          items={items.map((item) => ({
            id: item.id,
            title: item.name,
            meta: item.state,
          }))}
          selectedId={selectedId}
          emptyMessage="No items yet."
          onSelect={(item) => onSelect(item.id)}
        />
      )}
    </SidebarSection>
  );
}
```

Left-sidebar template rules:

- Root with `SidebarSection`; use `SidebarActionHeader` or `SidebarSection actionItems` for compact header actions.
- Use `SidebarList` for normal row lists, `SidebarTemplateList` for starter/example rows, `SidebarRow` only when the row needs custom leading/trailing slots, and `SidebarMessage` for empty/loading/error notes.
- Rows select or navigate. They do not edit records, render forms, carry full descriptions, or duplicate details that belong in the main page or right sidebar.
- Publish selection through route state or `pa.selection` when the main page or right sidebar needs the selected object.
- Omit the sidebar view entirely when the page does not need contextual navigation. The shell leaves the middle-left region blank.

## Right Sidebar

The right sidebar is a generic context rail. Workbench is the Chat page's right-sidebar content, not the name of the shell region.

Route-owned right sidebars must use the shared context-rail primitives from `@neon-pilot/ui` or `@neon-pilot/extensions/ui`: `ContextRail`, `ContextRailHeader`, `ContextRailBody`, and `ContextRailSection`. Do not hand-roll a padded `aside`, local title bar, local scroll container, or section chrome for route-owned right-sidebar content. The shell owns the background and divider; the rail primitive owns header height, padding, scroll behavior, typography, and section rhythm.

Use the right sidebar for contextual companions that benefit from staying adjacent to the main workflow:

- selected row details
- inspector fields
- provider docs or setup output
- recent activity
- preview, logs, metadata, validation, and history
- secondary actions for the current object

Avoid using the right sidebar as a second main column. It should be contextual, collapsible, resizable within shell limits, and useful even when the main page remains the primary workflow.

The main page may publish route context or selected-object state to the right sidebar. If a route supports a right sidebar but no object is selected, the right sidebar should render a compact empty state rather than forcing a modal or hiding details in the table.

Right-sidebar sections should be short and scannable: one header, one optional subtitle, and compact section groups. Prefer `KeyValueList`/`KeyValueItem`, shared buttons, shared empty/error/loading states, and row/list primitives over bespoke text stacks or cards.

### Right Sidebar Template

Use this template for route-owned context, inspectors, details, setup output, activity, logs, previews, validation, or metadata. It belongs only in a `views[].location: "rightRail"` component with `placement: "primary"` bound from `nav[].rightSidebarView`.

```tsx
import {
  ContextRail,
  ContextRailBody,
  ContextRailHeader,
  ContextRailSection,
  EmptyState,
  KeyValueItem,
  KeyValueList,
} from '@neon-pilot/extensions/ui';

export function ExtensionContextRail({ selected }) {
  return (
    <ContextRail>
      <ContextRailHeader eyebrow="Details" title={selected ? selected.name : 'Select an item'} subtitle={selected?.source} />
      <ContextRailBody>
        {!selected ? (
          <EmptyState
            align="start"
            title="Pick a row to inspect"
            body="Select an item in the main page to inspect its state and actions here."
            steps={['Pick an item from the table.', 'Review details here.', 'Use row actions for short-lived work.']}
          />
        ) : (
          <ContextRailSection title="Status">
            <KeyValueList>
              <KeyValueItem label="State" value={selected.state} />
              <KeyValueItem label="Updated" value={selected.updatedAt} />
            </KeyValueList>
          </ContextRailSection>
        )}
      </ContextRailBody>
    </ContextRail>
  );
}
```

Right-sidebar template rules:

- Root with `ContextRail`; do not wrap it in another rail, card, panel, or padded `aside`.
- Put exactly one top band in `ContextRailHeader`. Use it for compact identity and optional header actions only.
- Put all scrollable content inside `ContextRailBody`; do not add another full-height scroll container.
- Use `ContextRailSection` for each group. Keep groups short; promote primary workflows back to the main page.
- Use compact shared content primitives inside sections: `KeyValueList`, `ResourceList`, `TaskListItem`, `Notice`, `EmptyState`, `ErrorState`, `QuietLoadingState`, `ToolbarButton`, `TextButton`, and `IconButton`.
- When no object is selected, render a compact empty state. Do not hide details in a modal or leave the rail blank with only a header.
