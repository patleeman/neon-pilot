---
name: local-extension-development
description: Use when designing, creating, editing, building, validating, installing, or debugging Neon Pilot extensions, application pages, contributions to existing applications, or complete first-class applications from the bundled desktop app. This skill is self-contained and must be used without a Neon Pilot source checkout.
---

# Neon Pilot application authoring

Build against the installed application only. Do not search for or depend on the Neon Pilot repository, private source files, `pnpm`, workspace packages, or nearby first-party extensions. Never read those sources even if a checkout happens to exist on the machine: that makes the result non-portable and fails the bundled-authoring benchmark. This skill and its references are the complete authoring contract.

Do not extract, grep, decompile, or inspect `app.asar`, compiled desktop JavaScript, or other private implementation files inside the installed bundle. Packaged declarations, references, templates, CLI output, and runtime behavior are the only authoring contract. If a public component is still underspecified after reading them, use a documented equivalent pattern or report the missing public contract instead of reverse-engineering the host.

Treat the installed Neon Pilot app bundle and every packaged skill/reference/runtime path as read-only. Never create files there, run `npm install`/`pnpm install`/`yarn`, initialize a package, or alter packaged resources to inspect or repair the SDK. Edit only the `packageRoot` returned by `neon-pilot extensions create`; use packaged declarations and build errors to choose supported exports.

## Load the right references

Read these files relative to this `SKILL.md` before implementing:

1. Always read [application-model.md](references/application-model.md) and [manifest.md](references/manifest.md).
2. For any UI, read [frontend-ui.md](references/frontend-ui.md).
3. For actions, tools, storage, services, settings, filesystem, shell, or network work, read [backend.md](references/backend.md) and the exact [public-api.md](references/public-api.md) signatures.
   For a specialized contribution or backend module not expanded there, read the packaged declarations under `references/sdk/`: `index.d.ts` and `ui.d.ts` define the complete manifest, surface, client, and backend-context contract; `backend/<name>.d.ts` defines every allowlisted `@neon-pilot/extensions/backend/<name>` module.
4. Before finishing, read [validation-and-qa.md](references/validation-and-qa.md).

Do not substitute external docs for these packaged references.

## Choose the product shape first

Classify the request before creating files:

- **Capability extension**: no independent destination; contributes tools, commands, settings, hooks, services, transcript rendering, composer controls, or side panels. Start with `capability`.
- **Single-page application**: one durable destination with its own taskbar identity but no internal navigation hierarchy. Start with `page`.
- **Multi-page application**: owns a distinct workflow, multiple internal destinations, and usually an application sidebar. Start with `application`.
- **Existing-application contribution**: adds a page or navigation item to an application such as `system-agent:agent`; do not declare another application. Start from the closest scaffold, then replace its ownership fields as described in `application-model.md`.
- **Resource application**: needs several independently open instances of the same resource. Declare `instancePolicy: "multiple"` and resource pages only when the user genuinely needs parallel instances.

Do not create a new application for a preference panel, small helper, alert, tool, or narrow Agent workflow. Do not rely on implicit applications for new work.

## Work autonomously when the request is complete

If the user supplied enough product detail, state concise assumptions and build. Ask only questions whose answers materially change the product boundary, data authority, permissions, or destructive behavior.

For underspecified product work:

1. Ask focused questions about the job, user, first useful version, surface, data, actions, states, permissions, and success criteria.
2. Write a short UX brief covering information architecture, state model, shared primitives, commands, and validation.
3. For substantial UI, show a compact visual concept before implementation when the user has not already approved a direction.

## Create the package

Use the installed CLI. It returns the absolute `packageRoot`; perform all edits inside that directory.

```bash
neon-pilot extensions create <id> \
  --name "<Name>" \
  --description "<One sentence>" \
  --template <capability|page|application> \
  --json
```

Use stable kebab-case IDs. User application routes belong under `/ext/<id>`.

The primary package layout is:

```text
<packageRoot>/
  extension.json
  package.json
  README.md
  src/frontend.tsx   # UI packages only
  src/backend.ts     # actions/services/tools when needed
  dist/              # generated; never edit directly
```

The scaffold is a structural starting point, not finished product UI. Edit `src/` and `extension.json`. Keep manifest component and handler names synchronized with named exports.

## Implementation rules

- Use only `@neon-pilot/extensions`, `@neon-pilot/extensions/ui`, `@neon-pilot/extensions/settings`, and documented narrow `@neon-pilot/extensions/backend/*` imports.
- The packaged builder does not compile extension-local Tailwind. Never use `className` utility strings or raw form/action elements in a user extension; validation rejects them. Compose shared UI primitives and use narrow inline layout styles only when necessary.
- Never import Neon Pilot core, desktop, server, UI source, or filesystem paths.
- Use `pa.extension.invoke(actionId, input)` from frontend code.
- Use `ctx.storage`, `ctx.filesystem`, `ctx.shell`, `ctx.git`, `ctx.events`, and other documented backend capabilities instead of direct host internals.
- Never import `child_process`, `worker_threads`, or Electron.
- Declare every action, component, command, tool, permission, service, and application relationship in `extension.json`.
- Give every primary user-reachable action its own command contribution, not only an "open" command. Inventory create/add, refresh, run, update/toggle, and destructive actions from the request; make each applicable primary action searchable and executable through the Launcher. Point commands with complete safe inputs at declared backend actions. When the action needs user input, use `app.navigate` with a documented query intent so the page opens its inline editor; never invoke an input-requiring backend action with empty arguments.
- Confirm destructive actions immediately before mutation.
- Implement visible empty, loading, error, success, disabled, and long-running states when relevant.
- Use shared UI primitives. Do not recreate buttons, inputs, tables, lists, sidebars, rails, dialogs, settings rows, or page chrome.
- Keep application navigation in the application-owned sidebar or manifest navigation slots, not in a second sidebar drawn inside the main page.

## Build and install through the bundled app

Never use repo build commands. Use this exact loop:

```bash
neon-pilot extensions build <id> --json
neon-pilot extensions validate <id> --json
neon-pilot extensions reload <id> --json
neon-pilot extensions enable <id> --json
neon-pilot extensions smoke <id> --json
```

For a callable backend action, prove behavior directly before UI QA:

```bash
neon-pilot extensions invoke <id> <actionId> --input-json '<json>' --json
```

Use a safe representative input, inspect the structured result, and then verify persisted state through a second read action or an app reload.

On build or validation failure:

1. Read the structured error and cited path.
2. Fix source or manifest—not `dist/`.
3. Build and validate again.
4. Do not reload a broken build.

The builder atomically replaces `dist/`; the previous working bundle remains intact when compilation fails.

## Validate in the real application

Open the actual contribution through the Launcher, application sidebar, command, settings page, conversation surface, or tool path. Do not treat build success as user-visible proof.

For an application, verify:

- Launcher discovery and correct application identity
- First open and correct start page
- Internal navigation without opening duplicate singleton views
- Taskbar active label and close action
- Close followed by Launcher reopen
- Back/forward behavior where routes change
- Restart restoration when applicable
- Disabled/missing-extension recovery
- Narrow-window layout and keyboard focus

For tools and actions, invoke at least one representative operation and inspect the visible result. For stored state, reload or restart and verify persistence.

## Completion gate

Do not report completion until:

- Source, manifest, and README describe the same product.
- Bundled build succeeds.
- Validation has zero errors.
- Reload, enable, and smoke succeed.
- Every contributed route or surface opens in Neon Pilot.
- Primary interactions and important states work.
- UI was inspected in the full host frame.
- No source-checkout path, repo command, private import, or machine-specific absolute path is present in the package.
- Every primary action named or implied by the request has a matching searchable command contribution; opening the page alone does not satisfy this check.

Report the package root, architecture chosen, user-visible entry points, validation results, and anything that could not be exercised.
