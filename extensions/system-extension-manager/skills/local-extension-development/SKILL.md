---
name: local-extension-development
description: Use when creating, editing, externally building, validating, reloading, importing, or debugging Neon Pilot native extensions.
metadata:
  id: local-extension-development
  title: Local Extension Development
  summary: Built-in workflow and reference for agents building native extensions with packaged app resources and Extension Manager actions.
  status: active
---

# Local Extension Development

Use this skill when an agent is asked to build, fix, or inspect a Neon Pilot extension locally. It is packaged with the built app, so it must be self-contained enough to use without a source checkout.

## Fast rule

When a user asks how to create an extension, lead with: describe the feature you want and ask your agent to build it. The point of extensions is that the agent can create the package, build it outside the app with extension tooling, validate, reload, and test it for the user.

Build native extensions: a folder with `extension.json`, optional `src/frontend.tsx`, optional `src/backend.ts`, and generated `dist/` bundles. The app loads manifest-declared `dist/*` entries. Do not create iframe/webview extensions.

## Guided extension-builder workflow

Use this workflow when a user says they want to build an extension, has a feature idea, or clicks a "build with agent" entrypoint. Do not treat the first message as an implementation ticket unless the user explicitly says they already have a complete spec and wants to skip planning.

### Phase 1: Interview

Start by interviewing the user. Ask focused product questions that would change what gets built:

- What workflow or annoyance should this improve?
- Who is going to use it?
- What should the first useful version do, and what can wait?
- Where should it appear: full page, conversation rail, workbench detail, settings, command, tool, automation, or background capability?
- What data should it read or store?
- What actions should the user or agent be able to take?
- What should the user see when it is empty, loading, successful, blocked, or broken?
- Does it need secrets, external services, filesystem access, shell access, or Git access?
- What would make the user say "yes, this feels right" after trying it?

Do not ask implementation trivia the agent can decide from the repo. Recommend defaults when the user is unsure. If the user gives enough detail, state the assumptions and move on.

### Phase 2: UX Brief

Before writing source files, produce a compact brief the user can react to:

- Primary user and job-to-be-done.
- First-version scope and non-goals.
- Extension surface and why it fits.
- Information architecture: sections, list/detail shape, commands, settings, tools, or background behavior.
- State model: default, empty, loading, error, success, disabled, and long-running states.
- Data and permissions: storage, secrets, host capabilities, external systems, and destructive actions.
- UI plan: shared `@neon-pilot/extensions/ui` or `@neon-pilot/extensions/settings` primitives to use.
- Validation plan: build, validate, reload, app-path QA, screenshots, and representative tool/action invocation.

Ask the user to correct the brief when product choices are still uncertain. If the user clearly approves or says to proceed, build.

### Phase 3: Prototype UI When UI Matters

For pages, rails, workbench details, settings surfaces, and multi-step workflows, create a quick visual prototype before implementation unless the user explicitly skips it. The prototype can be an artifact, a lightweight local HTML mock, or another preview the user can inspect.

The prototype should show the actual product shape: layout density, main controls, copy, empty/error states, and where actions live. Use Neon Pilot taste and shared primitive patterns; do not produce a generic SaaS mockup. Revise the prototype from user feedback before writing the extension when visual direction is still unsettled.

### Phase 4: Build

Once the brief is accepted, create or edit the extension. Keep editable source in `src/`, declare contributions in `extension.json`, use the public extension SDK, and keep generated output in `dist/`. Reuse templates or nearby system extensions before inventing structure.

### Phase 5: Validate and Iterate

Build, validate, reload, and exercise the exact path the user will use. Open every contributed page, rail, workbench detail, settings section, command, composer control, or agent tool. Check important states and take screenshots when UI changed. If the user asks for changes after trying it, treat that as normal iteration, not a failure.

## First moves

1. Run the guided extension-builder workflow above unless the user has already provided a complete spec and explicitly wants implementation.
2. Inspect installed extensions through Extension Manager.
3. If editing an existing user extension, snapshot it first from Extension Manager.
4. If creating a new extension, use Extension Manager **Create**.
5. Edit `src/` files and `extension.json`, then build outside the app with `neon-pilot-extension build <extension-dir>` or repo tooling.
6. Validate from Extension Manager and fix every error.
7. Reload from Extension Manager.
8. Open the declared route/surface and visually inspect UI changes.
9. If the extension is being published through a GitHub extension repo, prepare `.neon-extension.zip` release assets; source folders plus `neon.extensions.json` are not enough for normal install.
10. Check Extension Manager diagnostics before reporting done.

## Source checkout / bundled system extension workflow

When working in the Neon Pilot repo on a bundled system extension under `extensions/system-*`, do **not** rely on the packaged-app Extension Manager loop alone. Use the repo loop and treat app-path QA as mandatory:

1. Read the owning extension `README.md`, `docs/extensions.md`, and any relevant design guidance before changing behavior or UI.
2. For UI work, compare against the closest existing system surface (for example Automations, Settings, Runs, or Diffs) before inventing local layout. Reuse `@neon-pilot/extensions/ui` primitives first.
3. Edit source and manifest together. If you add a backend action, declare it in `extension.json`; if you add a nav/sidebar route, declare both the main view and the sidebar view.
4. Run the focused extension build: `pnpm run extension:build -- extensions/<id>`. This validates release artifacts, but it is not enough for the desktop renderer.
5. If frontend code, manifest routes/nav/sidebar views, or shared UI imports changed, also run `pnpm --dir packages/desktop run build:ui`. The app renderer can keep stale chunks until this build/restart cycle happens.
6. Restart the dev app after rebuilding before QA. A renderer reload can still show stale UI or old manifest/component registrations; use the repo launch script or an equivalent full restart.
7. Open the real route/surface in the app and exercise every user-facing interaction you touched: create, edit, save, delete, reorder/drag, filter/search, empty/error/loading states, dialogs, dropdowns, autocomplete, and persistence after refresh/reopen.
8. Visually inspect a screenshot of the full app frame, not just an isolated component. Check alignment with neighboring surfaces, sidebar use, typography, overflow/clipping, menu placement, and whether controls stay open or disappear unexpectedly.
9. Only checkpoint after tests, extension build, desktop UI build when needed, static checks for boundary/manifest work, and app-path QA all pass.

If a user has to point out that a menu is stuck open, a save blanks the page, drag/drop does not work, or the page does not match a nearby product surface, assume the workflow failed at steps 2, 6, or 7. Stop, reproduce it in the app, fix it, and re-QA before reporting done.

Copy-paste user prompt:

```text
Build a Neon Pilot extension that [does what]. Use the local-extension-development skill to guide the work.

Start by interviewing me before you write code. Ask focused product/design questions until you understand the workflow, user, first-version scope, surface, data, actions, states, and permissions.

Then write a short UX brief. If the extension has UI, make a quick visual prototype or artifact using Neon Pilot's UI patterns so I can react before implementation.

After I approve the direction, implement it with editable source files, build it, validate it, reload it, test the real app path, and checkpoint the changes.
```

Starter create payload:

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "One sentence about what this extension does.",
  "template": "main-page"
}
```

## Extension Manager action contract

Use Extension Manager UI actions for the built-app authoring loop when a repo checkout is not available. Extension frontends must communicate with backend code through the native PA client/action bridge, not by fetching `/api/extensions/*`. HTTP routes are reserved for external or side-channel consumers.

A validation result has this shape:

```json
{
  "ok": false,
  "extensionId": "my-extension",
  "packageRoot": "/.../extensions/my-extension",
  "summary": { "errors": 1, "warnings": 0, "info": 0 },
  "findings": [
    {
      "severity": "error",
      "code": "missing-frontend-dist",
      "message": "Frontend entry is missing: dist/frontend.js",
      "path": "/.../dist/frontend.js",
      "fix": "Build the extension."
    }
  ]
}
```

Treat `ok: false` as actionable, not fatal. Fix every `error`, usually fix every `warning`, rebuild, validate again, then reload.

Templates:

- `main-page` — global app page with `/ext/{id}` route and sidebar nav.
- `right-rail` — conversation-scoped tab-local rail panel.
- `workbench-detail` — tab-local rail selector paired with a workbench detail view.

## Package layout

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
    build-manifest.json
  skills/
    my-extension/SKILL.md
```

`src/` is source of truth. `dist/` is generated output. Packaged app runtimes load `dist/` and do not rely on TypeScript source.

## Extension repository publishing

A GitHub extension repo must provide both source metadata and release assets:

```text
neon.extensions.json
release tag/
  <extension-id>.neon-extension.zip
  neon-extension-catalog.json
```

Use `patleeman/neon-pilot-extensions` as the reference repo. Its repo-local flow is:

```bash
NEON_PILOT_REPO=/path/to/neon-pilot pnpm run release:prepare -- --tag v0.9.1-rc.6
gh release create v0.9.1-rc.6 \
  release-artifacts/v0.9.1-rc.6/*.neon-extension.zip \
  release-artifacts/v0.9.1-rc.6/neon-extension-catalog.json \
  --repo owner/repo
```

The current GitHub installer resolves `<extension-id>.neon-extension.zip` from the package tag. Declare both `version` and `tag` in `neon.extensions.json`; the app uses the explicit version for update detection and the explicit tag for the release asset. If those fields are missing, install can fall back to the installed Neon Pilot app version tag, but update detection is not reliable.

Repo-distributed extensions should use `"packageType": "user"` in `extension.json`. `"system"` is reserved for extensions bundled with Neon Pilot itself; runtime-installed packages must stay uninstallable and updateable through the Extension Manager.

## Minimal manifest

```json
{
  "schemaVersion": 2,
  "id": "my-extension",
  "name": "My Extension",
  "description": "One sentence about what this extension does.",
  "version": "0.1.0",
  "packageType": "user",
  "frontend": {
    "entry": "dist/frontend.js",
    "styles": []
  },
  "backend": {
    "entry": "dist/backend.mjs",
    "actions": [{ "id": "ping", "handler": "ping", "title": "Ping", "worker": { "enabled": true } }]
  },
  "contributes": {
    "views": [{ "id": "page", "title": "My Extension", "location": "main", "route": "/ext/my-extension", "component": "ExtensionPage" }],
    "nav": [{ "id": "nav", "label": "My Extension", "route": "/ext/my-extension", "icon": "app" }]
  },
  "permissions": []
}
```

Rules:

- `id` is stable kebab-case. Use `/ext/{id}` for user extension pages.
- Frontend `component` values must be named exports from `src/frontend.tsx`.
- Backend action `handler` values must be named exports from `src/backend.ts`.
- Declare host contributions in the manifest; code implements them.
- Use `defaultEnabled: false` for installable extensions that should be visible but inactive until enabled.

## Common contributions

### Main page

```json
{
  "views": [{ "id": "page", "title": "Tasks", "location": "main", "route": "/ext/tasks", "component": "TasksPage" }],
  "nav": [{ "id": "nav", "label": "Tasks", "route": "/ext/tasks", "icon": "app" }]
}
```

### Tab-local right rail

```json
{
  "views": [{ "id": "panel", "title": "Tasks", "location": "rightRail", "scope": "conversation", "component": "TasksPanel", "icon": "app" }]
}
```

### Workbench detail paired with a tab-local right rail

```json
{
  "views": [
    { "id": "rail", "title": "Files", "location": "rightRail", "scope": "conversation", "component": "FilesRail", "detailView": "detail" },
    { "id": "detail", "title": "File", "location": "workbench", "component": "FileDetail" }
  ]
}
```

### Backend-backed tool

```json
{
  "backend": {
    "entry": "dist/backend.mjs",
    "actions": [{ "id": "search", "handler": "search", "title": "Search", "worker": { "enabled": true } }]
  },
  "contributes": {
    "tools": [
      {
        "id": "search",
        "name": "my_extension_search",
        "description": "Search this extension's data.",
        "action": "search",
        "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } }, "required": ["query"] }
      }
    ]
  }
}
```

Tool prompt rules:

- `description` and `inputSchema` are already sent to the model as the tool definition; do not repeat parameter/action details in prompt guidance.
- Add `promptGuidelines` only for behavior the schema cannot express, such as safety boundaries, when not to use the tool, or required follow-up behavior.
- Keep each tool's prompt guidance to one short sentence by default. If a workflow needs more, write an extension skill and point the agent there.
- Keep tools coarse and useful. Do not expose every button click as an agent tool.

### Skill contribution

```json
{
  "contributes": {
    "skills": [{ "id": "my-workflow", "title": "My Workflow", "description": "When to use it.", "path": "skills/my-workflow/SKILL.md" }]
  }
}
```

Skill files need Agent Skills frontmatter and enough procedural detail to operate from the built app.

### Selection, transcript blocks, services, subscriptions, and dependencies

Use `selectionActions` for selected text/messages/files/transcript ranges, and use `pa.selection.get/set/subscribe` from frontend code for shared selection state.

Use `transcriptBlocks` plus `ctx.conversations.appendTranscriptBlock/updateTranscriptBlock` for extension-owned visible transcript blocks with stable block ids.

Use `backend.services` for long-lived backend services. A service handler can return a stop function; declare `healthCheck` and `restart` for host diagnostics/restart policy. The host stops services on shutdown/disable/reload, restarts unhealthy services when policy allows, and Extension Manager shows live `running`/`stopped` state.

Use `contributes.subscriptions` for host event sources like workspace files, knowledge files, settings, conversations, routes, and selection changes. Current built-in producers include `host:workspaceFiles`, `host:settings`, and `host:selection`.

Use top-level `dependsOn` for extension dependencies, e.g. `["system-knowledge", { "id": "agent-board", "optional": true }]`. Missing required dependencies block enablement. Check optional dependencies with `pa.extensions.getStatus(...)` or `ctx.extensions.getStatus(...)` before calling them.

## Frontend source pattern

```tsx
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageLayout, EmptyState, ToolbarButton } from '@neon-pilot/extensions/ui';

export function ExtensionPage({ pa }: ExtensionSurfaceProps) {
  async function ping() {
    const result = await pa.extension.invoke('ping', {});
    pa.ui.toast(`Ping: ${JSON.stringify(result)}`);
  }

  return (
    <AppPageLayout title="My Extension" description="One sentence about the page.">
      <EmptyState title="Ready" description="The extension is wired up." />
      <ToolbarButton onClick={ping}>Ping backend</ToolbarButton>
    </AppPageLayout>
  );
}
```

Frontend rules:

- Import app-native primitives from `@neon-pilot/extensions/ui` instead of building isolated card-heavy UI.
- Use `pa.extension.invoke(actionId, input)` for backend calls.
- Use `pa.storage`, `pa.events`, and `pa.extensions` for host-provided client capabilities when available.
- Keep exported component names exactly aligned with `extension.json`.
- Use app theme tokens and shared primitives; avoid decorative nested boxes and iframe-style layouts.

## Backend source pattern

```ts
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export async function ping(input: unknown, ctx: ExtensionBackendContext) {
  ctx.log.info('ping', { input });
  await ctx.storage.put('lastPing', { at: new Date().toISOString() });
  return { ok: true, at: new Date().toISOString() };
}
```

Backend rules:

- Use `ctx.storage` for persistent extension state.
- Use `ctx.log.info/warn/error` for structured logs.
- Use `ctx.shell` and `ctx.git` for process execution. Do not import `child_process`, `worker_threads`, or similar direct process APIs.
- Use `ctx.events.publish/subscribe` and `ctx.extensions.callAction/listActions` for inter-extension communication.
- Keep module scope side-effect-light. Backend modules are imported during health checks and validation.

## Settings and state

Use manifest settings for user-visible configuration:

```json
{
  "contributes": {
    "settings": {
      "myExtension.enabled": { "type": "boolean", "title": "Enabled", "default": true },
      "myExtension.mode": { "type": "select", "title": "Mode", "enum": ["fast", "safe"], "default": "safe" }
    }
  }
}
```

Use `ctx.storage` / `pa.storage` for private runtime state, caches, and per-extension records.

## Dependencies

`package.json` should be small:

```json
{
  "type": "module",
  "dependencies": {
    "@neon-pilot/extensions": "*"
  }
}
```

Normal third-party dependencies are bundled into `dist/` by the builder. Host packages such as `@neon-pilot/extensions`, `react`, and `react-dom` are provided by the app. If package tooling is unavailable in the built app, avoid adding new dependencies or vendor a tiny local helper.

Never import app internals like `packages/desktop/server/*`, `packages/desktop/ui/*`, `@neon-pilot/core`, or `@neon-pilot/daemon` from an extension. If a host capability is missing, the right platform change is a reusable SDK/backend subpath, not a private import.

## Build, validate, and reload

Built app path:

1. Build outside the app with `neon-pilot-extension build /path/to/extension` or repo tooling.
2. Validate with Extension Manager **Validate**, or run `neon-pilot extensions validate --package-root /path/to/extension` for a local folder. The doctor checks manifest references, dist files, stale output, frontend component exports, backend action exports, tool schemas, skill files, forbidden process imports, non-portable absolute imports, deprecated frontend action clients, missing worker declarations, and backend module import crashes.
3. Reload with Extension Manager **Reload**.
4. Run `neon-pilot extensions smoke <extension-id>` when the app is running.
5. Inspect diagnostics in Extension Manager.

Repo checkout fallback:

```bash
node scripts/extension-build.mjs /path/to/extension
node scripts/check-packaged-extensions.mjs
```

If `pnpm` exists:

```bash
pnpm run extension:build -- /path/to/extension
pnpm run check:extensions
pnpm run check:extensions:quick
```

Do not depend on repo scripts from an installed app unless the repo checkout is explicitly present.

## Validation checklist

Before reporting done:

- `extension.json` parses and all contribution references match real exports.
- `dist/frontend.js` exists when `frontend.entry` is declared.
- `dist/backend.mjs` exists when `backend.entry` is declared.
- Extension Manager validation returns `ok: true`, or every finding is understood and explicitly reported.
- External build and Extension Manager reload succeeded without diagnostics.
- Backend imports at module scope without throwing.
- No absolute, `file:`, release-temp, or machine-local imports remain in `dist/`.
- No direct process APIs are imported by backend source.
- UI surfaces open and look native.
- README explains what the extension does and how to use it.

## Quality bar for full-fledged extensions

A full-fledged extension should have more than a passing build. Check these before calling it done:

- **Disambiguated product shape**: ambiguous requests were clarified with the user before building, and the first shipped version reflects explicit choices about workflow, surface, data/actions, and visual tone.
- **Clear product boundary**: README says what the extension owns, where its data lives, and how a user starts using it.
- **Native UI**: uses shared UI primitives and app theme tokens; no iframe/webview fallback, no isolated website styling.
- **Recoverable failures**: backend actions return useful errors, log with `ctx.log`, and avoid throwing from module scope.
- **Agent-safe tools**: tool names are stable, descriptions are action-oriented, schemas are precise, and destructive actions require explicit inputs.
- **State model**: user-visible config is in manifest settings; private runtime data is in extension storage; no secrets are written to source or README.
- **Portability**: dist bundles contain no machine-local paths and do not depend on repo-only packages.
- **Operations**: build, validate, reload, self-test, and export all behave predictably from Extension Manager.
- **Visual proof**: every contributed page, rail, workbench detail, modal, renderer, or settings component was opened and inspected.

## Debugging guide

- `Failed to fetch dynamically imported module .../dist/frontend.js`: missing/stale frontend bundle. Build and reload.
- Blank surface or missing component: manifest `component` does not match a named frontend export, or frontend import crashed.
- Backend action/tool disappears: backend import failed or action handler export is missing. Check Extension Manager diagnostics and backend logs.
- `Cannot find module` with an absolute temp path: bundle contains a non-portable import. Rebuild with the app builder and remove private/absolute imports.
- Handler not found: manifest action `handler` does not match a named backend export.
- Tool schema validation errors: `inputSchema` must be an object schema with `type: "object"` and `properties`.
- Permission/setting errors: permissions use `resource:action`; setting keys should be dot-separated.
- Build rejects process imports: replace direct Node process APIs with `ctx.shell` or `ctx.git`.

## Packaged references

When details matter, read these packaged resources if available:

- `docs/extensions.md` — full native extension contract.
- `extensions/system-extension-manager/README.md` — Extension Manager behavior and operations.
- Existing system extension READMEs — examples of tools, pages, rails, settings, skills, and backend actions.
- Extension API docs surfaced in the app docs. In a repo checkout this is `packages/extensions/README.md`.
