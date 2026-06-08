# Build an extension with your agent

The normal way to create a Neon Pilot extension is to ask your agent to build it for you.

Extensions are how Neon Pilot grows new product features. You usually should not hand-write one from scratch: describe the workflow you want, then ask your agent to create, build, reload, and test the extension. The manifest and SDK docs are reference material for the agent and for debugging.

## Copy-paste prompt

```text
Build a Neon Pilot extension that [does what].

Use the extension manager/template if helpful. Pick the right surface:
- main page for a full app/workflow
- tab-local right rail for a compact conversation-specific tool panel inside the workbench
- workbench detail for split-pane workflows

Implement it with editable source files, build it, reload it, visually test it, and checkpoint the changes. Ask me only if a product decision blocks you.
```

Add concrete product details after the first sentence: what data it should show, what actions it should support, and what “done” looks like.

## Production agent loop

Use this as the no-ambiguity loop for an agent building an extension in a repo checkout:

1. Read this guide, [`docs/extensions.md`](extensions.md), [`packages/extensions/README.md`](../packages/extensions/README.md), and the closest existing extension `README.md`.
2. Inspect existing extension ids, routes, nav labels, action ids, commands, settings components, and tools before choosing names.
3. Pick exactly one primary surface for the first version: `main-page`, `right-rail`, `workbench-detail`, `settingsComponent`, backend tool/action, or theme.
4. Start from [`docs/extension-templates/`](extension-templates/README.md) when the feature matches a template; otherwise copy the closest first-party extension shape.
5. Create editable source files in `src/`, declare every contribution in `extension.json`, and keep generated bundles in `dist/`.
6. Build with `pnpm run extension:build -- <extension-dir>`.
7. Run `neon-pilot-extension doctor <extension-dir>` when the CLI is available; in a packaged app, run `neon-pilot extensions validate --package-root <extension-dir>` before install or `neon-pilot extensions validate <extension-id>` after install. For repo extension or boundary work, also run `pnpm run check:extensions:static`.
8. Reload extensions from Settings -> Extensions, or restart the desktop app when reload is unavailable.
9. Run `neon-pilot extensions smoke <extension-id>` when the app is running, then validate through the same surface the user will use: open the route, rail, Settings section, command, composer control, or agent tool.
10. Exercise empty, loading, error, and success states when the surface has UI; for backend tools/actions, run one representative invocation and inspect the transcript or visible result.
11. Update the extension `README.md` with install/build/use notes and any non-obvious behavior.
12. If the extension is meant for other users, prepare `.neon-extension.zip` release artifacts and document the GitHub release tag users should install from.
13. Checkpoint only the files touched for this extension and its docs.

Do not stop after a successful build. A built extension is only ready after its manifest diagnostics are clean and the user-visible path has been exercised.

## Templates

Before writing from scratch, check [`docs/extension-templates/`](extension-templates/README.md) for copy-paste stubs
derived from real first-party extensions:

| Template                                                                       | Pattern                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [`data-dashboard`](extension-templates/templates/template-data-dashboard/)     | Read-only page — load from backend, render table or cards |
| [`crud-page`](extension-templates/templates/template-crud-page/)               | List + slide-in form editor. Full CRUD.                   |
| [`settings-section`](extension-templates/templates/template-settings-section/) | Section in the shared Settings page. No separate route.   |

Copy the matching folder, rename the extension id, replace domain types, and build.

## Pick the right surface

Use this as agent guidance, not homework for the user:

| If you want...                                       | Ask for...                                 |
| ---------------------------------------------------- | ------------------------------------------ |
| A full app, dashboard, or workflow                   | `main-page` extension                      |
| Context inside a workbench tab-local rail            | `right-rail` extension                     |
| A compact rail panel plus workbench pane detail view | `workbench-detail` extension               |
| Something the agent can call                         | backend tool or action                     |
| A command palette, slash command, or composer button | command/composer contribution              |
| Settings for an integration                          | settings contribution                      |
| Recurring or background behavior                     | automation/scheduled-task backed extension |
| A color theme only                                   | theme contribution                         |

When unsure, tell the agent the user experience you want and let it choose the smallest surface that fits.

## What your agent should do

For a new extension, the agent should:

1. Inspect existing extension IDs, routes, commands, and nearby examples before choosing names.
2. Create the package through Extension Manager when available, or create the same package layout by hand.
3. Keep editable source files in `src/`; do not create dist-only extensions.
4. Declare surfaces, commands, tools, settings, skills, and permissions in `extension.json`.
5. Use `@neon-pilot/extensions` as the SDK seam; do not import app internals.
6. Build outside the desktop app using repo or CLI extension tooling.
7. Validate and fix Extension Manager diagnostics.
8. Reload extensions.
9. Open the contributed page/panel and visually inspect UI changes.
10. Add or update the extension `README.md` when behavior is non-obvious.
11. If publishing through an extension repo, build release artifacts; source folders plus `neon.extensions.json` are not enough for normal GitHub install.
12. Checkpoint only the files it touched.

## Where files live

User-created extensions live in runtime state by default:

```text
~/.local/state/neon-pilot/extensions/{extension-id}/
```

Bundled first-party system extensions live in the repo under `extensions/`. Optional first-party extensions live in [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) and install from GitHub release artifacts. See [Extension Distribution](extension-distribution.md) before publishing packages for other users.

A normal native extension package looks like:

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

`src/` is the source of truth. `dist/` is generated output that every desktop runtime loads.

## Extension repositories and releases

When building an extension repository for other users, do not stop at source folders and `neon.extensions.json`. GitHub install expects prebuilt release assets:

```text
<extension-id>.neon-extension.zip
neon-extension-catalog.json
```

Use [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) as the example repo. Its release flow is:

```bash
NEON_PILOT_REPO=/path/to/neon-pilot pnpm run release:prepare -- --tag v0.9.1-rc.6
gh release create v0.9.1-rc.6 \
  release-artifacts/v0.9.1-rc.6/*.neon-extension.zip \
  release-artifacts/v0.9.1-rc.6/neon-extension-catalog.json \
  --repo owner/repo
```

Use the app version tag unless the catalog package explicitly declares another compatible `tag`. A repo without release assets can be inspected, but normal users cannot install its packages through the GitHub install flow.

## Good extension requests

```text
Build a tab-local right-rail extension that shows a checklist for the current conversation. It should let me add, complete, and delete items, and persist per conversation.
```

```text
Build a main-page extension for reviewing background work. It should list recent executions, show status and duration, and open background command or subagent logs in a detail pane.
```

```text
Build an extension that adds an agent-callable tool for looking up snippets from my local workspace glossary. Include a small settings panel for the glossary path.
```

```text
Build a theme-only extension with a calm dark palette. Install it, reload extensions, and tell me how to enable it.
```

## Build, reload, validate

Build outside the desktop app:

```bash
pnpm run extension:build -- /path/to/my-extension
# or, when linked/installed:
neon-pilot-extension build /path/to/my-extension
```

In the packaged app, use Extension Manager actions to create, validate, and reload built artifacts. Extension UI communicates with backend actions through the native PA client/IPC bridge; do not build extension frontends that fetch `/api/extensions/*`.

Validation is not optional. The extension doctor catches missing bundles, stale output, bad manifest references, missing frontend/backend exports, tool schema problems, forbidden backend imports, non-portable paths, and backend import crashes.

Acceptance criteria for agent-built extensions:

- `extension.json` uses schema v2, stable kebab-case ids, `/ext/{extension-id}` routes for main pages, and matching frontend/backend export names.
- Runtime code imports only from `@neon-pilot/extensions`, `@neon-pilot/extensions/ui`, and narrow `@neon-pilot/extensions/backend/*` subpaths for host access.
- Backend actions validate their inputs enough to return useful errors instead of crashing on malformed agent/tool calls.
- UI calls backend actions through `pa.extension.invoke(...)` and shows loading, empty, error, and success states.
- Dist files are current, diagnostics are clean, and the extension has been reloaded in the app.
- The contributed surface or tool was exercised through the app/extension host, not only by unit tests or direct module imports.

## Troubleshooting

- **The page or panel does not appear** — reload extensions and check manifest `contributes.views` / `contributes.nav`.
- **The UI opens blank** — check frontend export names and Extension Manager diagnostics.
- **Backend action/tool is missing** — check backend import errors and handler export names.
- **Works from source but not in the app** — build `dist/`; the app does not compile extensions at runtime.
- **Settings section does not appear** — use one `contributes.settingsComponent` object with `id`, `component`, `sectionId`, and `label`; the component export name must match `component`.
- **Agent tool returns an opaque failure** — validate action/tool input and return a structured `{ text, details }` result when the transcript should show more than a raw object.
- **Need an app capability the SDK lacks** — add the smallest reusable API to `@neon-pilot/extensions`; do not import desktop/server internals.

## Reference

- [Extension authoring reference](extensions.md)
- [Extension SDK/API reference](../packages/extensions/README.md)
- [Extension Manager behavior](../extensions/system-extension-manager/README.md)
- [System extension examples](../extensions)
- [First-party optional extension repo](https://github.com/patleeman/neon-pilot-extensions)
