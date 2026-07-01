# Extension Manager Extension

This extension owns the UI and operations for discovering, creating, building, reloading, enabling, disabling, importing, exporting, and inspecting Neon Pilot native extensions.

The normal user-facing flow is agent-first: ask Neon Pilot to build the extension, then let the agent use Extension Manager to create, build, validate, reload, and inspect it. The manual buttons and APIs exist so agents and advanced users have a reliable control surface.

For the extension authoring contract, read [`packages/extensions/README.md`](../../packages/extensions/README.md) in a repo checkout, or use the packaged `local-extension-development` skill when operating from the built app. Those are the source of truth for agents building extensions: package layout, manifests, frontend/backend APIs, dependencies, skills, tools, storage, permissions, and the build loop. Do not duplicate that contract here.

## Product direction

Extensions are Neon Pilot's native product-module system. They let Patrick or an agent add app functionality without editing the core shell for every workflow.

Extensions are also the superset install model for external agent ecosystems. Native Neon Pilot packages, Codex-style plugins, Claude skill packages, MCP bundles, instruction packs, prompt templates, and similar capability packages should all install as Neon Pilot extensions. Imported packages should be wrapped or adapted into a valid extension package so they share the same enable/disable controls, diagnostics, permissions, search paths, and marketplace flow.

The old iframe/HTML extension model is deprecated. New extensions render native React inside the Neon Pilot UI, declare their surfaces in `extension.json`, call stable PA capabilities from `@neon-pilot/extensions`, and use separate frontend/backend entries.

Extension frontends must use the native PA client/action bridge for app-internal communication. Extension HTTP routes are for external or side-channel consumers only, not for Neon Pilot renderer-to-extension calls.

Settings → Extensions should make that loop boring. It should be a single scrollable management page with Settings-style section anchors rather than a tabbed catalog:

- create a starter native extension package
- list built-in and installed extensions together
- list imported plugin/package wrappers as extensions
- show manifest, surfaces, routes, protocol entrypoints, build status, and permissions
- show contributed skills, tools, MCP servers, app views, instructions, diagnostics, and developer details as sections on the same page
- expose host and extension command/keybinding inspection in a separate Commands tab
- reload extension registry/runtime
- keep per-extension actions visibly acknowledged with inline progress and result notices even when the list is scrolled
- enable/disable add-on extensions without replacing the Settings page; registry-backed navigation and surfaces refresh in place
- export/import extension packages
- snapshot an add-on extension before agent edits
- open an extension folder in Finder/editor
- expose validate/reload operations through the Settings → Extensions UI and backend actions
- expose backend smoke checks through `neon-pilot extensions smoke <extension-id>`
- show build/runtime errors in a way an agent can fix

## Operational model

Add-on extensions live in runtime state by default:

```text
~/.local/state/neon-pilot/extensions/{extension-id}/
```

Built-in first-party extensions live in the repo/app bundle under `extensions/` and use the same extension contract. They are discovered by the same package-path scanner as add-on extensions; there is no hard-coded built-in extension discovery allowlist.

Some bundled extensions are required platform surfaces. Extension Manager keeps them out of the default extension management list because they are not user-manageable, but exposes them in the **Platform** filter for diagnostics and inspection. The core extension host refuses user/API disable attempts, ignores stale disabled config, and records circuit-breaker failures without quarantining required extensions. Keep that required list in `packages/desktop/server/extensions/extensionEnabledConfig.ts`; UI code should consume the `required` install-summary field instead of maintaining its own source of truth.

Optional first-party extensions live in the separate [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) repo. The loader does not auto-discover source directories. Build and install those packages into `<state-root>/extensions/{extension-id}` when you want them to behave as installed extensions during development. Normal users install GitHub release artifacts from the Available Extensions flow.

Users can add more GitHub extension repositories from Settings -> Extensions -> Extension repositories, or from the same repository control in the install dialog. Repositories are stored in `settings.json` as `extensions.sources`, fetched from each repo's root `neon.extensions.json`, and merged into the installable extension catalog. The first-party Neon Pilot extension repo remains the built-in default source.

The Settings → Extensions surface includes an **Install** dialog for normal users. It lists native Neon Pilot extensions from configured extension repositories. First-party Neon Pilot extension bundles (`.neon-extension.zip`) install from the GitHub release tag matching the installed app version, for example `v0.9.1-rc.0`. Codex and Claude behavior packages are managed by the separate Agent Plugins extension from Settings -> Agent Plugins; Extension Manager should only show their generated wrappers as registry entries for enablement, diagnostics, and inspection.

The loader scans the default runtime install location `<state-root>/extensions`. Users can add more package roots or parent folders through the `extensions.additionalPaths` setting exposed by this extension; entries may be comma- or newline-separated. The loader also accepts package roots through `NEON_PILOT_EXTENSION_PATHS` for process-level overrides.

Extension Manager does not build extensions in-app. Build extensions outside the desktop runtime with repo/CLI tooling such as `pnpm run extension:build -- <extension-dir>` or `neon-pilot-extension build <extension-dir>`, then use **Validate**, **Reload**, and `neon-pilot extensions smoke <extension-id>`. Packaged app validation can also target a local folder with `neon-pilot extensions validate --package-root <extension-dir>`. The extension doctor checks manifest references, dist files, stale output, frontend/backend exports, service handlers, tool schemas, skill files, forbidden process imports, non-portable bundled imports, deprecated frontend action clients, missing worker declarations, and backend import crashes. Desktop runtimes load existing `dist` bundles only and reject runtime compilation. Starter creation supports six templates: `main-page`, `route-sidebar` (route page with contextual-left navigation), `route-right-sidebar` (route page with a context rail), `route-shell` (contextual-left plus right sidebar), `right-rail` (legacy tab-local Workbench rail), and `workbench-detail`; generated READMEs and the packaged `local-extension-development` skill include richer examples for services, subscriptions, selection actions, transcript blocks, and dependencies. Required `dependsOn` entries block enablement when missing; optional dependencies remain runtime-discovery contracts.

Package a built add-on extension with `neon-pilot-extension pack <extension-dir> --out <name>.neon-extension.zip` before importing or sharing it. The bundle is a zip with one top-level extension directory and prebuilt `dist/` files; `node_modules`, `sidecar/target`, and `.dist.tmp-*` are excluded. Import installs that package into `<state-root>/extensions/{extension-id}` and does not build it at runtime. Optional first-party packages use the same zip format and publish those artifacts from GitHub releases.

## Agent workflow for this extension

When modifying Extension Manager itself:

1. Keep product behavior docs here and authoring/API contract docs in `packages/extensions/README.md`.
2. Inspect `packages/desktop/server/extensions/*` before changing lifecycle, registry, manifest, import/export, or build behavior.
3. Inspect `packages/desktop/ui/src/extensions/*` before changing native surface hosting, registry state, or extension UI.
4. If a first-party extension needs a new stable host primitive, add it deliberately to `packages/extensions` instead of importing app internals.
5. Validate create/validate/reload flows after changes.
6. Visually inspect the Settings → Extensions UI before reporting done.

## Migration stance

Do not create new iframe `frontend/*.html` surfaces. If old iframe extension files remain during migration, treat them as legacy code to replace, not examples to copy.

Artifacts remain the sketchpad for generated reports, previews, and custom throwaway UI. Extensions are native product modules.

Preferred split: core records and serves cross-cutting state; native extensions own product surfaces.

## Migrated system extensions

Native system extensions include:

- `system-automations` owns `/automations` and scheduled/conversation-bound automation UI.
- `system-telemetry` owns `/telemetry` while telemetry collection remains core infrastructure.
- `system-files` owns the workspace File Explorer rail and paired workbench file detail view while workspace filesystem APIs remain core infrastructure.
- `system-diffs` owns the checkpoint tool and inline transcript diff rendering while checkpoint persistence remains core infrastructure.
- `system-runs` owns background command/subagent tools, the activity shelf, and inline transcript run cards while durable run execution remains core infrastructure.
- `system-settings` owns deep links for first-party settings subpanels while settings persistence remains core infrastructure.

## View placement model

Native extension views declare host intent with `placement`, `scope`, and `activation`.

- `placement: "primary"` — stable left-sidebar destination plus main page route. Use for global app pages like Automations, Gateways, Telemetry, Settings, Extensions, and standalone Knowledge.
- `placement: "workbench-tool"` — workbench tool, optionally with a tab-local right sidebar and paired detail pane. Use for side-by-side surfaces like Knowledge tree/editor and File Explorer, or single-pane tabs like Browser and Drawing.

`scope` binds the view data: `global`, `workspace`, or `conversation`. `activation` controls lifecycle: `on-route` for routed pages, `on-open` for rail surfaces, `always` only for tiny host services, and `on-demand` for backend/tool-only work.

## Implementation checklist

Target order:

1. Keep manifest schema v2 and public types in `@neon-pilot/extensions` current.
2. Keep `npm run extension:build -- <extension-dir>` working for frontend/backend bundles.
3. Keep native `ExtensionSurfaceHost` lazy-loading extension frontend bundles.
4. Keep scoped CSS loading with extension root, reset boundary, theme tokens, and cascade layer.
5. Keep typed `pa` surface props and PA UI components/hooks stable.
6. Wire manifest `views`, `nav`, commands, slash commands, skills, tools, and settings through registry surfaces.
7. Migrate system product surfaces to native extensions.
8. Remove legacy iframe extension UI runtime and starter HTML templates when no longer needed.
9. Keep Settings → Extensions validate/reload/status flows agent-fixable.
10. Backfill tests around manifest parsing, lazy loading, action invocation, CSS scoping, and system extension migrations.
