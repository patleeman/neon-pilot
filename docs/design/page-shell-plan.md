# Page Shell Plan

Status: accepted shell direction; the route shell contract is implemented for the current app shell and first-party extension routes. The six page types in `docs/design/page-template-standards.md` are approved defaults. Visual conformance is still in progress.

Neon Pilot routes should use one shared shell model instead of page-local sidebar and rail patterns. A page owns the primary route content, and may declare contextual shell regions around it.

## Goal

Make every route and extension page declare the shell regions it needs:

- global left nav: persistent app navigation at the top and bottom
- contextual left area: route-owned selection or navigation content
- main page: required primary workflow
- right sidebar: route-owned context rail

Threads are the Chat route's contextual left area, not global filler for every page. Workbench is the Chat route's right-sidebar content, not the name of the generic right sidebar.

## Standards Boundary

The shell-region model and page-type taxonomy are approved. New app and first-party extension routes must declare one of the approved page types, and exceptions should update the design system instead of adding one-off shell chrome.

Implementation should continue tightening the accepted shell behavior:

- non-chat routes do not inherit Threads as filler
- routes declare contextual-left and right-sidebar ownership explicitly
- right-sidebar details replace modal-first details where the route already has an approved context rail
- page-level loading stays quiet and region-local

## Resolved Decisions

- Keep the global left nav top and bottom regions on every route.
- Treat the middle-left sidebar body as route-owned contextual content.
- Leave the middle-left sidebar body blank when the route does not declare contextual content.
- Do not show Threads on non-chat routes by default.
- Let pages declare both contextual left content and right-sidebar content.
- Use the contextual left area for selection and navigation.
- Use the right sidebar for context, inspection, metadata, previews, logs, activity, and secondary actions.
- Hide the right-sidebar toggle when the current route has no right-sidebar content.
- Do not show disabled right-sidebar chrome for unavailable routes.
- Remember right-sidebar open/closed state per route.
- Let main pages publish selection/context that right-sidebar views can consume.
- Move Extensions details into right-sidebar detail views instead of modal-first details.
- Keep Automations as a main table page with no Threads sidebar and no route-owned right sidebar.

## Recommended Defaults

- Use one fixed contextual-left width for now. Add resizing later only if a workflow proves it needs it.
- Make the right sidebar resizable with min/max bounds.
- If a route supports a right sidebar but nothing is selected, keep the toggle visible and render a compact empty state in the context rail.
- Use the same shell contract for core app pages and extension pages.
- Allow extension-rendered contextual-left UI, but require shared sidebar/list primitives and native sidebar grammar.

## Current Route Contract

The extension model already has `views` with `location: "main" | "sidebar" | "rightRail" | "workbench"`.
Nav items already bind route-owned shell regions with `sidebarView` and `rightSidebarView`.

A route composition looks like this at the shell level:

```ts
{
  route: "/settings",
  mainView: "settings.page",
  leftContextView: "settings.sidebar"
}
```

It is represented by existing nav/page contributions rather than a parallel shell API:

```ts
interface ExtensionNavContribution {
  id: string;
  label: string;
  route: string;
  icon?: ExtensionIconName;
  pageType?: 'conversation' | 'table' | 'editor' | 'settings' | 'dashboard' | 'setup';
  sidebarView?: string;
  rightSidebarView?: string;
  section?: 'primary' | 'settings';
}
```

The shell resolves the active route, finds the route's declared views, and renders only those regions.

Current implementation work should focus on conformance and verification:

- keep `sidebarView` as the route-owned contextual-left binding
- keep `rightSidebarView` as the route-owned right-sidebar binding
- hide the right-sidebar toggle when no right-sidebar view is declared
- keep the global nav top/bottom visible even when the contextual-left area is blank
- keep tests around route prefix matching, disabled extensions, missing views, and routes with both side regions green
- keep extension-author docs in `packages/extensions/README.md` and `docs/extensions.md` aligned with the route-region contract

## Page Type Mapping

| Page type         | Contextual left area              | Main page                                            | Right sidebar                      |
| ----------------- | --------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| Conversation page | Threads or conversation navigator | Transcript/composer/run state                        | Workbench/context rail             |
| Table page        | Blank by default                  | Table/list with toolbar, filters, search, pagination | Optional selected-item detail      |
| Editor page       | Optional object/step navigator    | Editor, timeline, canvas, or detail surface          | Optional inspector/history/preview |
| Settings page     | Optional settings navigation      | Grouped settings rows                                | Optional help/details              |
| Dashboard page    | Blank by default                  | Metrics, charts, log summaries                       | Optional metric/log detail         |
| Setup page        | Optional provider/object selector | Linear setup path                                    | Optional docs/activity/test output |

## Current Page Mapping

- Chat: Conversation page. Threads left, Conversation main, Workbench right.
- Automations: Table page. Blank contextual left, Automations table main. No right sidebar; create/edit/details stay in the main workflow.
- Diagnostics: Dashboard page. Blank contextual left, diagnostics main, optional metric detail right later.
- Extensions: Table page. Blank contextual left, extensions table main, selected extension detail right.
- Settings: Settings page. Settings navigation left, settings group main, no right sidebar by default.

## Current Shell Declaration Audit

This is the working checklist for conforming existing first-party page routes to the accepted shell model and approved page types.

| Route              | Extension                  | Page type    | Contextual left                           | Right sidebar | Status                                                 |
| ------------------ | -------------------------- | ------------ | ----------------------------------------- | ------------- | ------------------------------------------------------ |
| `/conversations/*` | desktop shell              | Conversation | Threads                                   | Workbench     | Accepted shell owner                                   |
| `/automations`     | `system-automations`       | Table        | Blank                                     | None          | Conformed shell; main-only table workflow              |
| `/telemetry`       | `system-telemetry`         | Dashboard    | Blank                                     | None          | Conformed                                              |
| `/apps`            | `system-extension-manager` | Table        | Blank                                     | None          | Conformed; details open inside the App Manager window  |
| `/settings/*`      | `system-settings`          | Settings     | `settings-sidebar` via `/settings` prefix | None          | Conformed shell; settings grammar needs separate sweep |

Remaining broad sweeps:

- Apply the vetted page taxonomy to any new or optional extension pages outside the bundled first-party route set.
- Tighten Settings and setup/readiness surfaces against the chosen page type.
- Replace any remaining page-local second columns, loading chrome, or modal CRUD flows that duplicate the accepted shell regions.
- Keep generic route/extension loading visually quiet; visible loading belongs inside the object or working surface that is actually waiting.
- Keep the UI-pattern guardrail aligned so future pages cannot reintroduce route-local sidebar or right-sidebar lookalikes.

## Implementation Phases

1. Shell contract — implemented
   - Keep route-level `sidebarView` and `rightSidebarView` as the route shell bindings.
   - Keep existing `sidebarView` as the contextual-left binding.
   - Resolve active route shell regions from one helper used by Sidebar, Layout, and top bar.

2. Top bar behavior — implemented for route-owned right sidebars
   - Hide the right-sidebar toggle when the active route has no right-sidebar content.
   - Rename user-facing labels from Workbench-only language to Right Sidebar or Context Rail where generic.
   - Preserve Workbench labels inside Chat/workbench-specific content.

3. Left contextual area — implemented
   - Render route-declared contextual left views when present.
   - Render a blank middle-left area when absent.
   - Stop rendering Threads as the fallback for non-chat routes.
   - Keep Threads as the fallback only for Chat/conversation routes.

4. Right sidebar state — implemented for route-owned rails
   - Persist right-sidebar open/closed state per route.
   - Keep existing resizable right-sidebar behavior with route-specific storage keys.
   - Pass route context, active cwd, and shared selection into right-sidebar surfaces.

5. Page conformance — in progress
   - Update Automations, Extensions, Diagnostics, and Settings to declare the regions they own.
   - Move Extensions details out of modal-first flows and into selected-item context rails.
   - Keep Automations main-only with no right-sidebar toggle.
   - Use shared route selection/context for selected-object details so the main table and right sidebar stay synchronized.
   - Remove custom in-page second columns where the right sidebar is the correct surface.

6. Documentation and guardrails — in progress
   - Keep `docs/design/page-template-standards.md` and `docs/design/neon-pilot-taste.md` aligned with this shell model.
   - Update `packages/extensions/README.md` once the manifest/API contract is implemented.
   - Add UI-pattern guardrails against page-local sidebar lookalikes, unbound or invalid side-region manifest references, and disabled unavailable shell buttons.

## Next Implementation Slices

Use these slices to finish conformance against the approved shell and page-type standards.

1. Shell enforcement and tests
   - Done: `routeShellRegions` tests cover chat routes, prefix matching, disabled extensions, missing views, side-view type checks, and primary right-sidebar resolution.
   - Done: Layout tests cover hidden right-sidebar toggles, route-owned right sidebars, per-route right-sidebar state, and non-leaking Workbench tools.
   - Done: Sidebar tests cover blank contextual-left regions and route-owned sidebar context.
   - Done: DesktopTopBar tests cover hiding the right-sidebar toggle when no right sidebar is available.
   - Done: Manifest audits cover first-party route page-type inventory, main-only routes, nav-bound contextual-left sidebars, and nav-bound primary right sidebars.

2. Extension authoring docs
   - Done: updated `docs/extensions.md` and `packages/extensions/README.md` with the route-region contract.
   - Done: added examples for one main-only route, one left+main editor route, and one table+right-detail route.
   - Document that `workbench` is tab-local Chat/workbench content; route-owned context uses `rightRail` with `placement: "primary"`.

3. Table/detail route sweep
   - Keep Automations main-only.
   - Keep Extensions details in context rails, not modal-first detail inspection.
   - Normalize table toolbar, filters, search placement, pagination, row actions, empty/loading states.

4. Setup and settings sweep
   - Tighten Setup Readiness around Setup-page rules.
   - Keep provider docs, recent activity, diagnostics, and test output in context rails when they need adjacent context.
   - Normalize host and extension settings under the Settings-page grammar.

5. Editor/dashboard sweep
   - Keep Diagnostics as Dashboard and avoid page-local second-column reinvention.

## Acceptance Criteria

- Non-chat pages no longer show Threads unless they explicitly declare Threads-like content.
- Automations shows global nav, blank contextual middle-left area, main table, and no right-sidebar toggle.
- Chat shows Threads, conversation, and Workbench with the right-sidebar toggle visible.
- Extensions can show selected-item details in the right sidebar.
- The right-sidebar toggle is hidden, not disabled, on routes without right-sidebar content.
- Right-sidebar open/closed state is remembered per route.
- Extension docs explain how to declare main, contextual-left, and right-sidebar route regions.
- Design docs and guardrails prevent future one-off sidebar/context-rail patterns.

## Validation

- Done: unit-test route shell resolution for chat, main-only pages, left-only pages, right-only pages, and three-region pages.
- Done: test DesktopTopBar hides the right-sidebar button when no route context rail exists.
- Done: test Sidebar renders Threads only on chat/conversation routes or explicit route ownership.
- Done: test fixture extension routes with `sidebarView` and `rightSidebarView`.
- Done: run UI-pattern guardrails for page-local sidebars, main-view side fields, unbound or invalid contextual-left sidebars, unbound or invalid primary right sidebars, and old right-sidebar wording.
- Run `pnpm --dir packages/desktop run build:ui`, `pnpm run check:types`, extension static checks, and UI pattern checks.
- Launch the desktop app and visually QA Chat, Automations, Extensions, Diagnostics, and Settings.
