# Client Workflow Tests

This is the source map for frontend tests that protect user-visible Neon Pilot workflows. These tests should exercise product outcomes across client state, API snapshots, routing, and extension registries instead of only testing isolated helpers.

Use focused client workflow tests before relying on Electron smoke tests. Electron smoke should prove packaging and native wiring; client workflow tests should catch most regressions quickly in `vitest`.

## Coverage Principles

- Test the same state transitions users depend on: create, navigate, refresh, reopen, resize, enable, disable, save, and recover.
- Mock at the API/SSE boundary, not inside the component under test, when the workflow depends on backend timing.
- Assert visible or route-level outcomes: sidebar rows, active route, selected panel, enabled controls, persisted layout, and rendered extension surfaces.
- Include stale snapshot, loading, empty, and error cases when a workflow can cross async boundaries.
- Keep workflow tests deterministic and narrow enough to run in focused package checks.

## Workflow Matrix

| Area | Workflow | Expected coverage |
| --- | --- | --- |
| Chat primary | Draft prompt creates a reserved conversation, opens `/conversations/:id`, keeps the sidebar row through snapshot refresh and stale remote layout sync | `ui/src/hooks/useConversations.test.tsx` covers the sidebar model. Add an App/ConversationPage submit workflow test for the full client route. |
| Chat primary | Existing conversation opens from sidebar, updates active id, and survives reload hydration | Add a sidebar/App workflow test with mocked session snapshot and remote layout. |
| Chat primary | Close, reopen, pin, unpin, archive, and restore preserve the expected shelves and active route | Existing `sessionTabs`/`useConversations` tests cover primitives. Add one sidebar workflow test for visible row actions. |
| Chat primary | Live title, running state, pending prompt, and queued prompt state render consistently in sidebar/header/composer | Existing hook/component tests cover pieces. Add a route-level workflow test for title and pending prompt transitions. |
| Extensions | Registry loads nav items, opens extension routes, invokes backend actions with real frontend context shape, and handles action failures | Existing extension host tests cover surfaces. Add extension manager workflow tests around nav, route host, and action calls. |
| Extensions | Sidebar extension views temporarily replace native Threads body without breaking native sidebar restore | Add sidebar nav workflow test with mocked extension registry. |
| Settings | Settings nav opens provider and desktop panels, edits constrained controls, persists through reload, and shows validation errors | Existing settings panel tests cover components. Add panel workflow tests with API persistence mocks. |
| Geometry | Sidebar/workbench resizing, layout mode changes, tab rail visibility, and route transitions preserve bounded dimensions | Existing sizing/model tests cover helpers. Add Layout workflow tests for visible mode transitions and persisted widths. |
| Command palette | Opens commands, extension commands, file/conversation search, empty states, keyboard navigation | Existing command palette tests cover pieces. Add app-shell workflow test for route/action results. |
| Recovery | Stale snapshots, missing session metadata, failed backend calls, and reconnects preserve valid local UI while surfacing errors | Expand `useConversations` and route recovery tests for representative failure paths. |

## Required Checks

For client workflow changes, run the focused `vitest` file first, then the affected desktop package build or UI build when app shell code changes. If a behavior is reachable through the desktop app, follow with an Electron/app-path smoke or explicitly record the blocker.
