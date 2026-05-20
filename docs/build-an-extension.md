# Build an extension with your agent

The normal way to create a Neon Pilot extension is to ask your agent to build it for you.

Extensions are how Neon Pilot grows new product features. You usually should not hand-write one from scratch: describe the workflow you want, then ask your agent to create, build, reload, and test the extension. The manifest and SDK docs are reference material for the agent and for debugging.

## Copy-paste prompt

```text
Build a Neon Pilot extension that [does what].

Use the extension manager/template if helpful. Pick the right surface:
- main page for a full app/workflow
- right rail for conversation-specific side panel
- workbench detail for split-pane workflows

Implement it with editable source files, build it, reload it, visually test it, and checkpoint the changes. Ask me only if a product decision blocks you.
```

Add concrete product details after the first sentence: what data it should show, what actions it should support, and what “done” looks like.

## Pick the right surface

Use this as agent guidance, not homework for the user:

| If you want...                                       | Ask for...                                 |
| ---------------------------------------------------- | ------------------------------------------ |
| A full app, dashboard, or workflow                   | `main-page` extension                      |
| Context beside the current conversation              | `right-rail` extension                     |
| A side panel plus center detail pane                 | `workbench-detail` extension               |
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
11. Checkpoint only the files it touched.

## Where files live

User-created extensions live in runtime state by default:

```text
~/.local/state/neon-pilot/extensions/{extension-id}/
```

Bundled first-party extensions live in the repo under `extensions/`. Experimental bundled extensions live under `experimental-extensions/extensions/` and should usually set `defaultEnabled: false`.

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

## Good extension requests

```text
Build a right-rail extension that shows a checklist for the current conversation. It should let me add, complete, and delete items, and persist per conversation.
```

```text
Build a main-page extension for reviewing background runs. It should list recent runs, show status and duration, and open run logs in a detail pane.
```

```text
Build an extension that adds an agent-callable tool for looking up snippets from my local project glossary. Include a small settings panel for the glossary path.
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

In the packaged app, use Extension Manager actions or endpoints to create, validate, and reload built artifacts:

```text
POST /api/extensions
POST /api/extensions/{id}/validate
POST /api/extensions/{id}/reload
```

Validation is not optional. The extension doctor catches missing bundles, stale output, bad manifest references, missing frontend/backend exports, tool schema problems, forbidden backend imports, non-portable paths, and backend import crashes.

## Troubleshooting

- **The page or panel does not appear** — reload extensions and check manifest `contributes.views` / `contributes.nav`.
- **The UI opens blank** — check frontend export names and Extension Manager diagnostics.
- **Backend action/tool is missing** — check backend import errors and handler export names.
- **Works from source but not in the app** — build `dist/`; the app does not compile extensions at runtime.
- **Need an app capability the SDK lacks** — add the smallest reusable API to `@neon-pilot/extensions`; do not import desktop/server internals.

## Reference

- [Extension authoring reference](extensions.md)
- [Extension SDK/API reference](../packages/extensions/README.md)
- [Extension Manager behavior](../extensions/system-extension-manager/README.md)
- [System extension examples](../extensions)
- [Experimental extension examples](../experimental-extensions)
