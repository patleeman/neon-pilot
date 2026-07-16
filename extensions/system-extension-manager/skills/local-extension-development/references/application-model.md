# Application model

## Contents

- Product objects
- Ownership rules
- Application policies
- Page policies
- Navigation and sidebars
- Existing-application contributions
- Decision examples

## Product objects

An **extension package** is the installable and permissioned unit. It may contribute zero or one primary application plus related capabilities.

An **application** is a top-level experience with its own Launcher identity and taskbar view. It owns the window below Neon Pilot's global top bar.

A **page** is a destination inside an application. A page is not automatically a separate application.

A **view** connects a route or host region to a frontend component. Main views represent pages; sidebar and right-rail views represent owned supporting regions.

## Ownership rules

New application work must declare `contributes.applications`. Qualify ownership references as `<extension-id>:<application-id>`.

Every main page in an explicit application must set `applicationId`. Its `startRoute` must resolve to a main view owned by that application.

An extension contributing to another application must not redeclare that application. Point its views and navigation at the qualified external application ID.

Prefer one extension package to affect one primary application. Cross-application contributions are allowed when the feature genuinely spans them, but each contribution must declare its owner explicitly.

## Application policies

Use `instancePolicy`:

- `singleton`: one open taskbar view; internal page and resource selection stays inside it. Default for most applications.
- `multiple`: several independent application views may be open. Use only for workflows whose resources must remain open side-by-side or independently restorable.

`defaultPinned` controls the initial Launcher pin, not whether a closed app remains in the taskbar. The taskbar shows open applications. Users pin and unpin applications or destinations from the Launcher.

## Page policies

Use `openPolicy` on owned main views:

- `internal`: route changes inside the existing application view. Use for ordinary application pages.
- `singleton`: one dedicated view for that page.
- `resource`: a selected resource can create or reuse its own view. Pair with a resource route and a multiple-instance application only when required.

For singleton applications, internal pages should normally use `internal`.

## Navigation and sidebars

Applications can declare ordered `navigationSlots`. Navigation contributions set the qualified `applicationId`, a declared `slot`, and an `order`.

Use a sidebar when the application has several destinations, a hierarchy, or a durable resource list. The standard host sidebar is declared as:

```json
{
  "id": "application-sidebar",
  "title": "Application navigation",
  "location": "sidebar",
  "component": {
    "host": "application.sidebar",
    "props": {
      "applicationId": "my-extension:app",
      "showConversations": false
    }
  }
}
```

Connect it from the application with `"sidebarView": "application-sidebar"`. Manifest navigation items then populate it. Build a custom sidebar component only when the standard navigation list cannot express the workflow.

Right inspectors are application-owned. Add one only for selected-object context, preview, logs, validation, metadata, or secondary actions.

## Existing-application contributions

To add a page to Agent:

```json
{
  "views": [
    {
      "id": "review-page",
      "title": "Reviews",
      "location": "main",
      "route": "/ext/my-reviews",
      "applicationId": "system-agent:agent",
      "openPolicy": "internal",
      "component": "ReviewPage"
    }
  ],
  "nav": [
    {
      "id": "reviews",
      "label": "Reviews",
      "route": "/ext/my-reviews",
      "icon": "file",
      "applicationId": "system-agent:agent",
      "slot": "tools",
      "order": 50
    }
  ]
}
```

Agent slots are `primary`, `work`, and `tools`. Do not declare `applications` for this shape.

## Decision examples

- A model download/runtime manager: multi-page singleton application.
- A reading list with one list/detail page: single-page application.
- A prompt-evaluation page tightly coupled to Agent: existing Agent page contribution.
- An alert rule, gateway, provider adapter, or agent tool: capability extension, possibly with Settings.
- A per-conversation checklist: conversation right sidebar contribution, not an application.
