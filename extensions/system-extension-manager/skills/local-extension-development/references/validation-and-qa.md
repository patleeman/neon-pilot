# Validation and QA

## Contents

- Deterministic command loop
- Manifest checks
- Real app checks
- Surface-specific checks
- Recovery checks
- Final report

## Deterministic command loop

Run from any directory; use the installed extension ID:

```bash
neon-pilot extensions build <id> --json
neon-pilot extensions validate <id> --json
neon-pilot extensions reload <id> --json
neon-pilot extensions enable <id> --json
neon-pilot extensions smoke <id> --json
```

Invoke representative backend behavior with the running desktop app:

```bash
neon-pilot extensions invoke <id> <actionId> --input-json '<json>' --json
```

For persisted behavior, follow a write invocation with a read invocation and confirm the saved value appears. An exit code alone is not proof; inspect `ok` and the returned `result`.

Repeat build and validation after every source or manifest repair. Never edit generated `dist/` files.

## Manifest checks

- Schema version is 2 and package type is `user`.
- Source and generated entry files exist.
- Component and handler names resolve to named exports.
- New applications are explicit, not compatibility projections.
- Start route belongs to the declared application.
- All owned main views have qualified `applicationId` and correct `openPolicy`.
- Application sidebar view exists when referenced.
- Navigation targets the intended application and declared slot.
- Commands, tools, actions, services, settings, and permissions are declared.
- No private imports, repo paths, or direct process APIs remain.
- The installed app bundle and packaged authoring resources were not modified; all handwritten files remain under the extension `packageRoot`.

## Real application checks

Use Neon Pilot itself:

1. Open the Launcher with Command-K.
2. Find the application/page/command using user-facing language.
3. Open it and verify the intended route and active taskbar label.
4. Exercise every primary action.
5. Navigate between internal pages and use back/forward.
6. Close the application and reopen it from the Launcher.
7. Reload or restart when persistence or restoration matters.
8. Inspect diagnostics and visible errors.

Capture screenshots of the full host frame for the primary state and at least one important empty, populated, loading, error, or secondary state. Use viewport and scroll-depth captures for application-owned scroll containers; do not accept a black or blank capture as evidence. Populate the product through its real backend/UI path rather than hard-coded sample state.

When more than one Neon Pilot process may exist, do not use native computer control: a same-name window is not proof that you reached the authored extension and may expose unrelated user data. Use extension lifecycle commands for build/validate/smoke and the host-owned extension QA flow for exact-process route, interaction, and screenshot evidence.

For durable state, mutate through a declared action, restart the app/extension host, then read through another declared action. A same-process write/read pair does not prove persistence.

## Surface-specific checks

- Application: Launcher, start page, internal nav, taskbar close/reopen, singleton reuse, restart.
- Existing-app page: appears in the correct owning application and does not create another taskbar identity.
- Settings: route opens, values save, validation appears, secrets remain masked, restart persists.
- Tool: representative invocation reaches the backend and produces inspectable output.
- Command: searchable, executable, and routes or mutates as documented.
- Sidebar/rail: opens in the intended scope, selection updates, long content fits, empty/error states remain useful.
- Service: start, health, stop, disable, reload, and restart behavior are visible in diagnostics.

## Recovery checks

- Invalid or missing input produces a visible, actionable error.
- Backend failure does not blank the page or destroy prior state.
- Duplicate clicks do not duplicate durable operations.
- Disabling or removing an extension with an open view yields host recovery UI.
- A failed rebuild preserves the prior working `dist/` bundle.

## Final report

Include:

- Package root and extension ID
- Product shape selected and why
- User-visible routes, commands, tools, or settings
- Build, validate, reload, enable, and smoke results
- App paths and states exercised
- Screenshots or evidence locations
- Any untested path and exact reason
