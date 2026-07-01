# Extension SDK

The Neon Pilot extension SDK is the public surface for building native extensions. Use it instead of importing desktop or core internals.

The normal path is still agent-first: ask your agent to build the extension, then use this page to understand what the agent can use and what is available to you.

## Main imports

| Import                                        | Use it for                                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@neon-pilot/extensions`                      | Manifest types, surface props, frontend client types, backend context types, contribution types, and shared extension contracts.                                        |
| `@neon-pilot/extensions/ui`                   | Shared UI primitives for extension pages, rails, lists, forms, empty/error/loading states, dialogs, resource pickers, chat views, and workbench chrome.                 |
| `@neon-pilot/extensions/settings`             | Settings-page primitives such as panels, rows, switches, selects, text inputs, and settings helpers.                                                                    |
| `@neon-pilot/extensions/backend/*`            | Backend host capabilities such as conversations, settings, storage, shell, git, browser, MCP, model gateway, prompt assembly, telemetry, and extension registry access. |
| `@neon-pilot/extensions/host-view-components` | Catalog of host-owned UI components an extension can reference instead of bundling a custom React surface.                                                              |

Extension runtime code should not import from `packages/desktop`, `packages/core`, or app internals.

## Package shape

A native extension package usually looks like this:

```text
my-extension/
  extension.json
  package.json
  README.md
  src/
    frontend.tsx
    backend.ts
    styles.css
  dist/
    frontend.js
    frontend.css
    backend.mjs
```

`src/` is the editable source. `dist/` is generated output loaded by packaged Neon Pilot builds.

## Manifest contributions

The manifest declares what the extension adds to Neon Pilot.

Common contributions:

| Contribution                                            | What it adds                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `views`                                                 | Main pages, sidebars, right rails, workbench panels, and other React surfaces. |
| `nav`                                                   | App navigation entries and route-owned sidebar/right-rail bindings.            |
| `commands`                                              | Command palette actions and app-level commands.                                |
| `cliCommands`                                           | `neon-pilot` CLI commands contributed by the extension.                        |
| `tools`                                                 | Agent-callable tools.                                                          |
| `skills`                                                | Agent skills packaged with the extension.                                      |
| `settings`                                              | Scalar settings shown in Settings.                                             |
| `settingsComponent`                                     | A custom Settings panel rendered by the extension.                             |
| `secrets`                                               | Secret declarations for provider keys or integration credentials.              |
| `setupItems`                                            | Host-rendered readiness checks and actions.                                    |
| `modelProfiles`                                         | Provider/model-specific behavior hooks.                                        |
| `mentions`                                              | `@` mention providers for composer context.                                    |
| `quickOpen` and `searchProviders`                       | Command palette scopes and backend-powered search.                             |
| `transcriptRenderers` and `transcriptBlocks`            | Custom transcript rendering.                                                   |
| `composerControls`, `composerShelves`, `toolbarActions` | Composer UI extensions.                                                        |
| `subscriptions` and backend services                    | Background behavior and event-driven work.                                     |

See [Extension authoring](extensions.md) for the full manifest contract.

## Frontend surfaces

Frontend components receive `ExtensionSurfaceProps`. The important object is `pa`, the Neon Pilot client passed to extension UI.

Use `pa` to:

- call extension backend actions;
- read and update route selection;
- work with conversation context;
- invoke host capabilities exposed through the extension API;
- subscribe to supported runtime changes;
- invalidate or refresh extension-owned data.

Use `@neon-pilot/extensions/ui` for visible UI. Do not clone app chrome with local markup when a shared primitive exists.

Good first choices:

| Need                           | Use                                                              |
| ------------------------------ | ---------------------------------------------------------------- |
| Page shell                     | App/page layout primitives from `@neon-pilot/extensions/ui`.     |
| Toolbar action                 | `ToolbarButton` or `IconButton`.                                 |
| Empty, loading, or error state | Shared `EmptyState`, `LoadingState`, or `ErrorState` primitives. |
| Table or list actions          | Data table/list primitives and action groups.                    |
| Resource selection             | Resource picker primitives.                                      |
| Compact workbench rail         | Rail/workbench primitives.                                       |
| Chat-like extension UI         | `ChatView` or `ExtensionChatRail`.                               |
| Settings rows                  | `@neon-pilot/extensions/settings` row-list primitives.           |

## Backend actions and tools

Backend code exports handlers declared in `extension.json`.

Use backend actions for UI calls, setup checks, settings saves, search providers, and integration logic.

Use tools when the agent should call the capability during a turn.

Backend handlers receive an `ExtensionBackendContext`. Use that context instead of Node or app internals.

Common backend capabilities include:

| Capability          | Use it for                                                          |
| ------------------- | ------------------------------------------------------------------- |
| `ctx.storage`       | Extension key-value storage.                                        |
| `ctx.database`      | Extension-owned SQLite data.                                        |
| `ctx.filesystem`    | Scoped file access.                                                 |
| `ctx.shell`         | Host-owned process execution.                                       |
| `ctx.git`           | Git operations through the host boundary.                           |
| `ctx.conversations` | Conversation reads, writes, transcript blocks, and related actions. |
| `ctx.models`        | Provider/model reads and host-owned provider writes.                |
| `ctx.events`        | Publish or subscribe to extension/runtime events.                   |
| `ctx.notify`        | User-visible notifications.                                         |
| `ctx.secrets`       | Extension-declared secrets.                                         |
| `ctx.telemetry`     | Extension telemetry records.                                        |
| `ctx.ui`            | Invalidate or refresh UI surfaces.                                  |

Direct `child_process`, `worker_threads`, and desktop server imports are blocked for normal extension backend code. Use host capabilities so Neon Pilot can apply policy, diagnostics, and future isolation.

## Settings and secrets

Use manifest `settings` for simple scalar preferences.

Use `settingsComponent` when the extension needs a richer settings UI, such as account connection state, model downloads, path pickers, or multi-row configuration.

Use `secrets` for API keys and integration credentials. Secrets should not be stored in plain extension settings or logged into transcripts.

## Provider and model behavior

Use `modelProfiles` when an extension needs behavior tied to a provider or model.

Examples:

- expose a patch-edit tool for one coding model family;
- start a local runtime before a local model request;
- disable network-heavy tools for local-only models;
- add vision-specific tools for vision-capable models.

Model profiles match provider/model refs such as `openai-codex/*` or `*/gpt-5.5`.

## Host view components

Use host view components when you want a standard Neon Pilot UI surface with small customization.

For example, an extension can reference a host-owned conversation page or workbench detail component instead of bundling a copy of the same UI.

See [Host view components](host-view-components.md).

## Build and validate

Build extensions before loading them in packaged Neon Pilot:

```bash
pnpm run extension:build -- /path/to/my-extension
```

Validate with the extension doctor or Extension Manager diagnostics when available.

For UI extensions, always open the contributed route, sidebar, settings section, workbench panel, composer control, or transcript renderer in the app. A build is not enough.

## Related pages

- [Build an extension](build-an-extension.md)
- [Extension authoring](extensions.md)
- [Host view components](host-view-components.md)
- [Extension distribution](extension-distribution.md)
