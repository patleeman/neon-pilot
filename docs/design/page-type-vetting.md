# Page Type Decision

This records the approved Neon Pilot page taxonomy. The six page types are now design-system defaults for app routes and first-party extension pages.

## Status

Approved on 2026-07-01. New app and first-party extension pages must choose one approved page type before designing local layout. Exceptions should update the design system instead of silently inventing another one-off page shell.

Approved shell rules:

- Global left navigation stays on every route.
- The middle-left contextual area is route-owned and blank/visually absent when undeclared; global top and bottom nav items still remain.
- The main page is required.
- The right sidebar is route-owned context and hidden when undeclared.
- Threads belong to Chat. Workbench is Chat's right-sidebar content, not the generic shell name.

## Approved Types

| Type         | Primary job                               | Default left area                 | Default right sidebar         | Current examples             |
| ------------ | ----------------------------------------- | --------------------------------- | ----------------------------- | ---------------------------- |
| Conversation | Transcript-first agent work               | Threads or conversation navigator | Workbench/context rail        | Chat                         |
| Table        | Durable object management                 | Blank                             | Selected-item details         | Automations, Extensions      |
| Editor       | Structured object editing                 | Optional object/step navigator    | Inspector/history/preview     | Structured editors           |
| Settings     | Preferences and configuration             | Optional settings navigation      | Help/details only when useful | Settings, extension settings |
| Dashboard    | Metrics, diagnostics, status              | Blank                             | Metric/log/detail context     | Diagnostics                  |
| Setup        | Credential, provider, install, onboarding | Optional selector                 | Docs/activity/test output     | Setup Readiness              |

No seventh type is approved. If a workflow does not fit these six, document the missing behavior and update the design-system guidance before introducing a new recurring page type.

## Route Mapping

| Route              | Page type    | Left area          | Right sidebar | Notes                                                                                                   |
| ------------------ | ------------ | ------------------ | ------------- | ------------------------------------------------------------------------------------------------------- |
| `/conversations/*` | Conversation | Threads            | Workbench     | Core-owned for now; extensions contribute into Chat rather than defining separate transcript routes.    |
| `/automations`     | Table        | Blank              | None          | Main-only table workflow. Details/create/edit can remain dialog-backed when they are short-lived flows. |
| `/telemetry`       | Dashboard    | Blank              | None          | Metrics/status view.                                                                                    |
| `/apps`            | Table        | Blank              | None          | App details open inside App Manager instead of a route-level right sidebar.                             |
| `/settings/*`      | Settings     | Settings navigator | None          | Settings grammar applies to host and extension settings surfaces.                                       |

## Manifest Audit

Every first-party extension route with a `main` view must declare one approved page type on its nav item.

| Extension                  | Route          | Page type   | Contextual left    | Right sidebar |
| -------------------------- | -------------- | ----------- | ------------------ | ------------- |
| `system-automations`       | `/automations` | `table`     | None               | None          |
| `system-extension-manager` | `/apps`        | `table`     | None               | None          |
| `system-settings`          | `/settings`    | `settings`  | `settings-sidebar` | None          |
| `system-telemetry`         | `/telemetry`   | `dashboard` | None               | None          |

The manifest shape keeps side-region fields off `main` views. Side-region metadata belongs only on `sidebar` and `rightRail` views; the nav item binds those views to a route with `sidebarView` and `rightSidebarView`.

This audit proves shell declaration conformance, not full visual conformance. Remaining visual sweeps include Settings grammar, Setup Readiness popover, and Automations' dialog-backed detail workflow.

## Resolved Decisions

| Decision                   | Resolution                  | Consequence                                                                                                                                                                             |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup type                 | Standalone type             | Setup Readiness tightens around one setup surface plus right-sidebar docs/activity/test output when useful.                                                                             |
| Conversation extensibility | Core-owned for now          | Extensions can add transcript blocks, shelves, tools, and context rails, but should not define new conversation-like pages until the shell exposes a deliberate conversation route API. |
| Settings scope             | Settings grammar everywhere | Extension-owned settings panels use grouped settings rows and avoid bespoke form chrome.                                                                                                |
| Canvas/editor split        | Canvas stays inside Editor  | Add Canvas only if multiple routes need canvas-specific shell rules such as minimaps, tool palettes, or preview rails.                                                                  |

## Defaults

| Surface            | Default rule                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| New route          | Pick one approved page type before adding local layout.                                                                                           |
| New extension page | Declare `main`; set `nav[].pageType`; declare `sidebarView` only for selection/navigation; declare `rightSidebarView` only for contextual detail. |
| Table/list route   | Shared toolbar, body-owned loading/empty state, no column-header filters, optional context-rail details.                                          |
| Setup route        | Single main setup path with docs/activity/test output in the context rail when useful.                                                            |
| Editor route       | Optional left navigator, main editor/canvas/timeline, optional inspector rail.                                                                    |
| Dashboard route    | Metrics/logs in main, optional detail rail, no fake table/list sidebar.                                                                           |
| Settings route     | Host settings grammar everywhere, including extension settings panels.                                                                            |
| Conversation route | Core-owned for now; extensions contribute tools/blocks/rails, not separate transcript pages.                                                      |

The manifest-level shell contract:

```json
{
  "contributes": {
    "nav": [
      {
        "id": "settings-nav",
        "label": "Settings",
        "route": "/settings",
        "pageType": "settings",
        "sidebarView": "settings-sidebar"
      }
    ],
    "views": [
      { "id": "page", "route": "/settings", "location": "main", "component": "SettingsPage" },
      { "id": "settings-sidebar", "location": "sidebar", "component": "SettingsSidebar" }
    ]
  }
}
```

The page type constrains what those views are for; the manifest declares where they render.
