# Home

Home is the first composition dashboard for the Windowed OS → Agentic OS direction. Instead of a marketing or hero surface, Home is a real app surface that composes existing shared data: document collections, inbox, and background activity. It is the canonical landing route for a quick, dense read of what needs attention across the app.

## App contract

- **Route:** `/home`
- **Source:** core (first-party windowed app, single owner alongside Chat, Documents, Inbox, Activity, Settings)
- **Window:** singleton; one Home window open at a time, sizes `1040 × 660`
- **Accent:** `settings`, aliases `dashboard`, `overview`, `start`, `home screen`

Home is registered in `CANONICAL_WINDOWED_DESKTOP_APPS` (`packages/windowed-os-ui/src/windowedOs.tsx`) and projected as a core app by `buildWindowedAppRegistry` (`packages/desktop/ui/src/windowed/windowedAppRegistry.ts`). It appears in the Start menu next to Chat/Files/Documents and in the taskbar like any other open window.

## Data sources

Home reads only existing client API methods. It does not add backend routes:

- `api.documents.collections()` — collection list
- `api.inbox.list({ limit })` — recent inbox records (drives unread and recent counts)
- `api.activity({ limit })` — app-wide activity rows (drives active worker count)

Home subscribes to the `documents`, `inbox`, `executions`, and `sessions` app event topics through `useInvalidateOnTopics`, so store mutations and run-state changes refresh the dashboard in the background without a manual refresh.

## UI surface

`/home` renders `HomePage` (`packages/desktop/ui/src/pages/HomePage.tsx`) as a core windowed feature page wired through `WindowedLayout`. The page uses the shared primitives already in use by Activity/Documents/Inbox: `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `MetricTile`, `StatusDot`, `AppPageEmptyState`, `ErrorState`, and `QuietLoadingState`.

The layout is work-focused and dense:

- A header with a manual **Refresh** action.
- A metric row: document collections, unread inbox, active work.
- Three sections that summarize the underlying data:
  - **Documents collections** — recent collections with owner and last-updated time, linking to `/documents`.
  - **Inbox** — recent messages with read/unread indicator, sender, and time, linking to `/inbox`.
  - **Activity** — recent activity rows with status dot and relative time, linking to `/activity`.

Loading, error, and empty states are handled per section and at the page level. The full-page loading state only shows while every source is still on its first load; once any source has data, the page renders and per-section states take over. Per-section errors surface inline; a global error state only appears when every source failed on the first load.

Navigation links use scoping react-router navigation so they route through `navigateWindow` and focus or open the corresponding app window instead of causing a top-level browser navigation.

## Why this is the first composition dashboard

Home is intentionally a composition layer, not a new data store. It demonstrates the Windowed OS composition pattern: a core app surface that reads from the existing shared data plane (documents store, inbox, activity) and points the user into the dedicated apps (Documents, Inbox, Activity) for the full experience. Future composition apps should follow the same rule — read existing client APIs, subscribe to existing invalidation topics, and link to the owning app rather than duplicating its workflow.
