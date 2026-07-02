# Architecture notes

Local App OS should feel like a desktop operating environment hosted inside Electron.

Electron provides the native app container. The platform provides its own desktop shell, app runtime, package model, and app APIs.

## Runtime layers

The intended runtime has four layers.

1. Electron main process owns the native window and OS integration.
2. Platform backend owns app registry, storage, files, permissions, jobs, services, packages, events, and logs.
3. Renderer owns the desktop shell, dock, internal windows, and app frontends.
4. Workers run app services, background jobs, agent runs, and other expensive work.

The MVP currently combines the platform backend with the Electron main process and keeps state in memory. This is acceptable for the first playable prototype. The API boundary should stay stable enough to move the backend behind a separate process and SQLite store.

## Platform APIs

The app-facing API families are:

- `apps`
- `windows`
- `storage`
- `files`
- `services`
- `processes`
- `jobs`
- `events`
- `contributions`
- `permissions`
- `network`
- `packages`
- `logs`
- `workspaces`

Apps should not talk directly to Electron, Node, SQLite, operating system secrets, workers, or other apps.

Apps should call the platform API. The platform should enforce lifecycle, permissions, performance, and logging.

## App package shape

An app package should include:

- manifest
- frontend files
- optional service files
- migrations
- assets
- design-system usage metadata
- declared permissions
- contribution declarations
- package metadata
- optional seed data

Packages must not include raw secrets.

## App manifest shape

The manifest should describe:

- app identity
- app version
- app icon
- windows
- services
- jobs
- startup behavior
- contributed commands, dock items, settings panes, tools, menus, file handlers, and context actions
- permission requests

The manifest is the main portability boundary.

## Persistence model

The platform should have a built-in database.

The database should support:

- app registry
- app versions
- virtual files
- app data
- window state
- commands and contributions
- permissions
- jobs and job runs
- events
- logs
- packages

SQLite is the preferred first backend.

Files and storage should remain separate APIs even if both use SQLite internally.

## Performance rules

The renderer must stay responsive.

Heavy work should run outside the renderer. App frontends should call typed platform services, jobs, and streams instead of using raw IPC.

Large data should move by reference when possible. Streaming progress and logs should be first-class.

## Design rules

The first visual model is simple:

- top bar
- desktop canvas
- dock
- internal windows

Avoid web-dashboard page chrome.

The design system should cover common app needs: windows, titlebars, toolbars, sidebars, tables, lists, forms, settings rows, empty states, inspectors, split panes, and command bars.

The Builder should default to design-system primitives. It may eject into custom CSS and custom UI when the user asks.
