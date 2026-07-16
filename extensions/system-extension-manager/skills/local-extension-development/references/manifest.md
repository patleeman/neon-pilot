# Manifest reference

## Contents

- Required package fields
- Explicit application example
- Views and navigation
- Commands, tools, and settings
- Icons and routes
- Contribution integrity

## Required package fields

Use schema version 2 and a user package:

```json
{
  "schemaVersion": 2,
  "id": "local-models",
  "name": "Local Models",
  "description": "Download and run local language models.",
  "version": "0.1.0",
  "packageType": "user",
  "frontend": { "entry": "dist/frontend.js", "styles": [] },
  "backend": {
    "entry": "dist/backend.mjs",
    "actions": [{ "id": "listModels", "handler": "listModels", "title": "List models", "worker": { "enabled": true } }]
  },
  "contributes": {},
  "permissions": []
}
```

Omit `frontend` for genuinely headless extensions. Omit `backend` when no backend action or service is needed.

## Explicit application example

```json
{
  "applications": [
    {
      "id": "app",
      "title": "Local Models",
      "description": "Download and run local language models.",
      "icon": "database",
      "startRoute": "/ext/local-models",
      "sidebarView": "application-sidebar",
      "instancePolicy": "singleton",
      "defaultPinned": false,
      "navigationSlots": [
        { "id": "primary", "order": 0 },
        { "id": "manage", "label": "Manage", "order": 10 }
      ]
    }
  ],
  "views": [
    {
      "id": "models",
      "title": "Models",
      "location": "main",
      "route": "/ext/local-models",
      "applicationId": "local-models:app",
      "openPolicy": "internal",
      "component": "ModelsPage"
    },
    {
      "id": "downloads",
      "title": "Downloads",
      "location": "main",
      "route": "/ext/local-models/downloads",
      "applicationId": "local-models:app",
      "openPolicy": "internal",
      "component": "DownloadsPage"
    },
    {
      "id": "application-sidebar",
      "title": "Local Models navigation",
      "location": "sidebar",
      "component": {
        "host": "application.sidebar",
        "props": { "applicationId": "local-models:app", "showConversations": false }
      }
    }
  ],
  "nav": [
    {
      "id": "models",
      "label": "Models",
      "route": "/ext/local-models",
      "icon": "database",
      "pageType": "table",
      "applicationId": "local-models:app",
      "slot": "primary",
      "order": 0
    },
    {
      "id": "downloads",
      "label": "Downloads",
      "route": "/ext/local-models/downloads",
      "icon": "play",
      "pageType": "dashboard",
      "applicationId": "local-models:app",
      "slot": "manage",
      "order": 10
    }
  ],
  "commands": [
    {
      "id": "open",
      "title": "Open Local Models",
      "action": "app.navigate",
      "args": { "to": "/ext/local-models" }
    }
  ]
}
```

## Views and navigation

Supported common view locations:

- `main`: application page route.
- `sidebar`: application-owned left navigation or resource list.
- `rightRail`: contextual inspector or conversation sidebar.
- `workbench`: large detail surface paired with a right sidebar.

The complete page-type enum is `conversation`, `table`, `editor`, `settings`, `dashboard`, and `setup`.

Use routes under `/ext/<extension-id>`. Route strings, command destinations, application start routes, and nav routes must agree.

## Commands, tools, and settings

Navigation command:

```json
{ "id": "open", "title": "Open My App", "action": "app.navigate", "args": { "to": "/ext/my-app" } }
```

Backend command actions must reference a declared backend action with `worker.enabled: true`.

Treat commands as the searchable action model, not only as navigation. Add a command for each primary workflow action the user can perform—such as add/create, refresh, run, update/toggle, or delete—when that action is meaningful outside the current pointer context. For a CRUD page, an open command plus at least its primary add/create command is the normal minimum.

Agent tool:

```json
{
  "id": "search",
  "name": "my_extension_search",
  "description": "Search saved extension records.",
  "action": "search",
  "inputSchema": {
    "type": "object",
    "properties": { "query": { "type": "string" } },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

Settings surfaces use `settingsComponent` and a named frontend export. Use `@neon-pilot/extensions/settings` primitives and backend persistence for secrets or shared configuration.

Host-readable settings and secrets are declared by key:

```json
{
  "settings": {
    "refreshMinutes": {
      "type": "number",
      "default": 15,
      "description": "Minutes between refreshes.",
      "group": "Sync",
      "order": 0
    },
    "displayMode": {
      "type": "select",
      "default": "compact",
      "enum": ["compact", "comfortable"],
      "group": "Appearance"
    }
  },
  "secrets": {
    "apiKey": {
      "label": "API key",
      "description": "Credential used for model downloads.",
      "placeholder": "Enter key",
      "order": 0
    }
  },
  "settingsComponent": {
    "id": "local-models",
    "component": "LocalModelsSettings",
    "sectionId": "settings-local-models",
    "label": "Local Models",
    "description": "Configure downloads and runtime defaults.",
    "order": 50
  }
}
```

Setting types are exactly `string`, `boolean`, `number`, and `select`. Read resolved secrets only through backend `ctx.secrets.get`; request `secrets:read` and never expose the value to the frontend.

## Icons and routes

Allowed manifest icons:

`app`, `automation`, `browser`, `database`, `diff`, `file`, `gear`, `graph`, `kanban`, `play`, `sparkle`, `terminal`.

Choose a meaningful icon; do not use emoji. Custom icon assets are not currently part of the application manifest contract.

## Contribution integrity

- Every frontend component string names an exported component.
- Every backend handler/action names an exported function.
- Every owned main view uses a qualified application ID.
- Every nav slot exists on the owning application.
- Every application start route resolves to one of its owned main views.
- `internal` is the default page policy inside singleton applications.
- External application contributions do not redeclare the external application.
