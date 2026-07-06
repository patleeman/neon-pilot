# Build an extension with your agent

The normal way to create a Neon Pilot extension is to ask your agent to build it for you.

Extensions are how Neon Pilot grows new product features. You usually should not hand-write one from scratch: describe the workflow you want, then ask your agent to create, build, reload, and test the extension. The manifest and SDK docs are reference material for the agent and for debugging.

## Copy-paste prompt

```text
Build a Neon Pilot extension that [does what]. Use the local-extension-development skill to guide the work.

Start by interviewing me before you write code. Ask focused questions until you understand the workflow I want, who it is for, what the first version should do, where it should live in Neon Pilot, and what empty, loading, error, and success states it needs.

Then write a short UX brief. If the extension has UI, make a quick visual prototype or artifact using Neon Pilot's UI patterns so I can react before implementation.

After I approve the direction, build the extension, reload it, test the real app path, and keep iterating with me until it feels right.
```

Add concrete product details after the first sentence: what data it should show, what actions it should support, and what “done” looks like.

## Extension-building workflow

Use this sequence when an agent helps a user create a new extension:

1. **Interview first.** Ask enough questions to understand the job, the user, the data involved, the first useful version, the expected controls, and what the user should see when nothing is configured or something fails. Do not start coding while the product shape is still vague.
2. **Write the brief.** Summarize the primary user, job-to-be-done, first-version scope, chosen extension surface, state model, main actions, and validation plan. State any assumptions so the user can correct them.
3. **Prototype UI when UI matters.** For pages, panels, settings, or workflow surfaces, make a quick artifact or local prototype before implementation. Use Neon Pilot's density, shared primitives, and copy rules so the user reacts to the product shape, not a generic mockup.
4. **Build the extension.** Create editable source in `src/`, declare contributions in `extension.json`, use the public extension SDK, and keep generated output in `dist/`.
   For route-based app extensions, include `contributes.appearance` with a desktop accent, useful Start menu aliases, and singleton/window defaults when the app should appear as a durable desktop surface.
5. **Reload and test in the app.** Build, validate, reload extensions, open the actual contributed surface, and exercise default, empty, loading, error, success, disabled, and long-running states that apply.
6. **Iterate with the user.** Adjust scope, copy, layout, actions, or state behavior from what the user sees. Checkpoint only when the extension is working through the real app path.

## Production agent loop

Use this as the no-ambiguity loop for an agent building an extension in a repo checkout:

1. Read this guide, [Extension SDK](extension-sdk.md), [Extension authoring](extensions.md), and the closest existing extension `README.md`.
2. Inspect existing extension ids, routes, nav labels, action ids, commands, settings components, and tools before choosing names.
3. Write a short UX brief before implementation:
   - **Primary user and job**: who uses it, what they are trying to accomplish, and what they should inspect or change first.
   - **Primary surface**: exactly one first-version surface: main route, route-owned right sidebar, tab-local workbench rail/detail, `settingsComponent`, backend tool/action, or theme. If the feature has a route, state whether it is main-only, left+main, or table+right-detail.
   - **Information architecture**: the core sections, list/detail structure, controls, and command-backed actions.
   - **State model**: default, empty, loading, error, success, disabled, and long-running states.
   - **Primitive plan**: which `@neon-pilot/extensions/ui` components will be used for page shell, lists/tables, forms, feedback, dialogs, runtime status, rails, or workbench chrome.
     For Settings components, use `@neon-pilot/extensions/settings` row-list primitives (`SettingsPanel`, `SettingsRow`, `Switch`, `Select`, `TextInput`, `ToolbarButton`) and autosave normal preferences.
   - **Visual acceptance**: what must be visible in the app screenshot or manual inspection before calling the UI correct.
4. Ask focused questions for unresolved UX/product decisions before writing code. If the user gave enough detail, state the assumptions and proceed.
5. For user-visible UI, make a quick artifact or local prototype before implementation unless the user explicitly wants to skip straight to code. The prototype should show the chosen surface, primary actions, and important states; use the shared Neon Pilot UI patterns instead of generic app chrome.
6. Start from [`docs/extension-templates/`](extension-templates/README.md) when the feature matches a template; otherwise copy the closest first-party extension shape.
7. Create editable source files in `src/`, declare every contribution in `extension.json`, and keep generated bundles in `dist/`.
8. Build with `pnpm run extension:build -- <extension-dir>`.
9. Run `neon-pilot-extension doctor <extension-dir>` when the CLI is available; in a packaged app, run `neon-pilot extensions validate --package-root <extension-dir>` before install or `neon-pilot extensions validate <extension-id>` after install. For repo extension or boundary work, also run `pnpm run check:extensions:static`.
10. Reload extensions from Settings -> Extensions, or restart the desktop app when reload is unavailable.
11. Run `neon-pilot extensions smoke <extension-id>` when the app is running, then validate through the same surface the user will use: open the route, route-owned right sidebar, tab-local workbench rail, Settings section, command, composer control, or agent tool.
    For a Settings component, open `/settings#<sectionId>` and inspect it beside neighboring Settings sections for row spacing, padding, title hierarchy, and action alignment.
12. Exercise empty, loading, error, success, disabled, and long-running states when the surface has UI; for backend tools/actions, run one representative invocation and inspect the transcript or visible result.
13. Visually inspect the UI against the brief. Check layout density, text wrapping, keyboard/focus behavior, responsive constraints, empty/error copy, command availability, and whether shared primitives were used instead of one-off chrome.
14. Update the extension `README.md` with install/build/use notes and any non-obvious behavior.
15. If the extension is meant for other users, prepare `.neon-extension.zip` release artifacts and document the GitHub release tag users should install from.
16. Checkpoint only the files touched for this extension and its docs.

Do not stop after a successful build. A built extension is only ready after its manifest diagnostics are clean and the user-visible path has been exercised.

## Templates

Before writing from scratch, check [`docs/extension-templates/`](extension-templates/README.md) for copy-paste stubs
derived from real first-party extensions:

| Template                                                                       | Pattern                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`data-dashboard`](extension-templates/templates/template-data-dashboard/)     | Read-only page — load from backend, render table or cards                            |
| [`crud-page`](extension-templates/templates/template-crud-page/)               | Main-only list with inline editor flow. Full CRUD.                                   |
| [`settings-section`](extension-templates/templates/template-settings-section/) | Section in the shared Settings page. No separate route. Autosaving row-list example. |

Copy the matching folder, rename the extension id, replace domain types, and build.

## Pick the right surface

Use this as agent guidance, not homework for the user:

| If you want...                                       | Ask for...                                 |
| ---------------------------------------------------- | ------------------------------------------ |
| A full app, dashboard, or workflow                   | Main route extension                       |
| A route with object navigation                       | Main route plus `sidebarView`              |
| A table/list with persistent selected-item details   | Main route plus `rightSidebarView`         |
| Context inside a workbench tab-local rail            | Tab-local workbench rail                   |
| A compact rail panel plus workbench pane detail view | Tab-local workbench rail plus detail view  |
| Something the agent can call                         | backend tool or action                     |
| A command palette, slash command, or composer button | command/composer contribution              |
| Settings for an integration                          | settings contribution                      |
| Recurring or background behavior                     | automation/scheduled-task backed extension |
| A color theme only                                   | theme contribution                         |

When unsure, tell the agent the user experience you want and let it choose the smallest surface that fits. Do not use a tab-local workbench rail as a substitute for a route-owned right sidebar; if the context belongs beside an extension page, declare `rightSidebarView`.

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
9. Open the contributed route, right sidebar, tab-local workbench rail, panel, or tool and visually inspect UI changes.
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
Build a tab-local workbench rail extension that shows a checklist for the current conversation. It should let me add, complete, and delete items, and persist per conversation.
```

```text
Build a main-route extension for reviewing background work. It should list recent executions, show status and duration, and open background command or subagent logs in a route-owned right sidebar.
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
- [Extension SDK](extension-sdk.md)
- [Extension Manager behavior](../../extensions/system-extension-manager/README.md)
- [System extension examples](../../extensions)
- [First-party optional extension repo](https://github.com/patleeman/neon-pilot-extensions)
