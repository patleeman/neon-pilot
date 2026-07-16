# Page Type Decision

This records the approved Neon Pilot page taxonomy. The six page types are now design-system defaults for app routes and first-party extension pages.

## Status

Approved on 2026-07-01. New app and first-party extension pages must choose one approved page type before designing local layout. Exceptions should update the design system instead of silently inventing another one-off page shell.

Approved shell rules:

- Global application navigation lives in the host top bar and launcher.
- The left contextual area is application-owned and blank/visually absent when undeclared.
- The main page is required.
- The right sidebar is route-owned context and hidden when undeclared.
- Threads belong to Chat. Workbench is Chat's right-sidebar content, not the generic shell name.

## Approved Types

| Type         | Primary job                               | Default left area                 | Default right sidebar         | Current examples                |
| ------------ | ----------------------------------------- | --------------------------------- | ----------------------------- | ------------------------------- |
| Conversation | Transcript-first agent work               | Threads or conversation navigator | Workbench/context rail        | Chat                            |
| Table        | Durable object management                 | Blank                             | Selected-item details         | Automations, Skills, Extensions |
| Editor       | Structured object editing                 | Optional object/step navigator    | Inspector/history/preview     | Routines, Dynamic Workflows     |
| Settings     | Preferences and configuration             | Optional settings navigation      | Help/details only when useful | Settings, extension settings    |
| Dashboard    | Metrics, diagnostics, status              | Blank                             | Metric/log/detail context     | Diagnostics, Model Arena        |
| Setup        | Credential, provider, install, onboarding | Optional selector                 | Docs/activity/test output     | Gateways, Setup Readiness       |

No seventh type is approved. If a workflow does not fit these six, document the missing behavior and update the design-system guidance before introducing a new recurring page type.

## Route Mapping

| Route              | Page type    | Left area          | Right sidebar    | Notes                                                                                                   |
| ------------------ | ------------ | ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `/conversations/*` | Conversation | Threads            | Workbench        | Core-owned for now; extensions contribute into Chat rather than defining separate transcript routes.    |
| `/conversations`   | Conversation | Agent navigation   | Workbench        | Agent application entry route; individual conversations remain internal application state.              |
| `/home`            | Dashboard    | Blank              | None             | Optional launcher and recent-work starting point.                                                       |
| `/automations`     | Table        | Blank              | None             | Main-only table workflow. Details/create/edit can remain dialog-backed when they are short-lived flows. |
| `/gateways`        | Setup        | Blank              | Gateway context  | Provider onboarding, readiness, docs, activity, and test output use Setup grammar.                      |
| `/model-arena`     | Dashboard    | Blank              | Arena context    | Monitors challenger state, eligibility, settings, and history.                                          |
| `/routines`        | Editor       | Routine navigator  | Routine context  | Structured routine editing with optional inspector/history context.                                     |
| `/workflows`       | Editor       | Workflow navigator | None             | Add a context rail only when workflow inspection grows.                                                 |
| `/telemetry`       | Dashboard    | Blank              | None             | Metrics/status view.                                                                                    |
| `/skills`          | Table        | Blank              | Skill detail     | Selected skill details belong in the right sidebar.                                                     |
| `/extensions`      | Table        | Blank              | Extension detail | Selected extension details belong in the right sidebar.                                                 |
| `/settings/*`      | Settings     | Settings navigator | None             | Settings grammar applies to host and extension settings surfaces.                                       |

## Manifest Audit

Every first-party extension route with a `main` view must declare one approved page type on its nav item.

| Extension                  | Route            | Page type      | Contextual left     | Right sidebar              |
| -------------------------- | ---------------- | -------------- | ------------------- | -------------------------- |
| `system-agent`             | `/conversations` | `conversation` | None                | None                       |
| `system-automations`       | `/automations`   | `table`        | None                | None                       |
| `system-dynamic-workflows` | `/workflows`     | `editor`       | `workflows-sidebar` | None                       |
| `system-extension-manager` | `/extensions`    | `table`        | None                | `extension-details-rail`   |
| `system-gateways`          | `/gateways`      | `setup`        | None                | `gateway-context-rail`     |
| `system-home`              | `/home`          | `dashboard`    | None                | None                       |
| `system-model-arena`       | `/model-arena`   | `dashboard`    | None                | `model-arena-context-rail` |
| `system-routines`          | `/routines`      | `editor`       | `routines-sidebar`  | `routines-context-rail`    |
| `system-settings`          | `/settings`      | `settings`     | `settings-sidebar`  | None                       |
| `system-skills`            | `/skills`        | `table`        | None                | `skills-context-rail`      |
| `system-telemetry`         | `/telemetry`     | `dashboard`    | None                | None                       |

The manifest shape keeps side-region fields off `main` views. Side-region metadata belongs only on `sidebar` and `rightRail` views; the nav item binds those views to a route with `sidebarView` and `rightSidebarView`.

This audit proves shell declaration conformance, not full visual conformance. Remaining visual sweeps include Gateways setup flow, Model Arena dashboard shape, Settings grammar, Setup Readiness popover, and Automations' dialog-backed detail workflow.

## Resolved Decisions

| Decision                   | Resolution                  | Consequence                                                                                                                                                                             |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model Arena type           | Dashboard                   | Do not add an Evaluation type yet. Revisit only if multiple evaluation surfaces appear.                                                                                                 |
| Setup type                 | Standalone type             | Gateways and Setup Readiness tighten around one setup surface plus right-sidebar docs/activity/test output when useful.                                                                 |
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
        "id": "routines-nav",
        "label": "Routines",
        "route": "/routines",
        "pageType": "editor",
        "sidebarView": "routines-sidebar",
        "rightSidebarView": "routines-context-rail"
      }
    ],
    "views": [
      { "id": "page", "route": "/routines", "location": "main", "component": "RoutinesPage" },
      { "id": "routines-sidebar", "location": "sidebar", "component": "RoutinesSidebar" },
      { "id": "routines-context-rail", "location": "rightRail", "placement": "primary", "component": "RoutinesContextRail" }
    ]
  }
}
```

The page type constrains what those views are for; the manifest declares where they render.
