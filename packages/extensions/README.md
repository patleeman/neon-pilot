# Neon Pilot Extension SDK

The normal way to create a Neon Pilot extension is to ask your agent to build it for you. Start with [`docs/build-an-extension.md`](../../docs/build-an-extension.md) for the agent-first workflow and copy-paste prompt.

This package is the public import surface for native Neon Pilot extensions. Extension code should import from `@neon-pilot/extensions` and its subpath modules instead of reaching into `packages/desktop` internals. Backend extensions must use host capabilities such as `ctx.shell` for process execution; direct Node process APIs are blocked so the host can apply sandbox and execution-wrapper policy.

Extension code must not depend on Electron IPC as a product API. Host product data is exposed through SDK capabilities backed by the desktop HTTP data plane; realtime changes are exposed through SDK subscriptions backed by the realtime plane; native OS/Electron actions stay behind explicit host capabilities. If the SDK lacks a capability, add a reusable SDK primitive instead of importing app internals or creating extension-specific IPC.

This doc is written for agents building extensions. Read it before creating or editing an extension, then inspect the current schema/types and nearby system extensions for exact examples.

## Platform rule

Build new Neon Pilot product features as extensions by default. Core is the small, stable platform: agent/conversation runtime, model and tool protocol, transcript/event stream, durable storage primitives, knowledge/system-prompt assembly, extension host/manifest/API/permissions, security boundaries, app shell/routing, install/update plumbing, and shared UI primitives.

User-facing, domain-specific, and workflow-specific behavior belongs in extensions: pages, panels, tool renderers, commands, integrations, context providers, automations, import/export flows, diagnostics views, settings sections, and opinionated UX.

If the SDK lacks a host primitive needed by a first-party extension, add a reusable API to `@neon-pilot/extensions` instead of importing app internals or hardcoding the feature in the app shell. Core should make features possible; extensions should be where features live.

## Agent workflow

When a user asks how to create an extension, lead with: describe the feature you want and ask your agent to build it. Do not start by dumping manifest schema unless they ask for reference details.

When asked to build or modify an extension:

1. Inspect existing extension IDs, routes, commands, and surfaces before choosing names.
2. Create editable source files, not dist-only output.
3. Declare all host contributions in `extension.json` and all Node dependencies in `package.json`.
4. Use `@neon-pilot/extensions` as the SDK seam. Do not import from `packages/desktop/ui/src/...` or `packages/desktop/server/...`.
5. Run the repo-owned extension build and reload extensions.
6. Visually inspect any UI surface you changed.
7. Checkpoint only the files you touched.

Do not create new iframe or webview extensions. Native extensions render React components inside the Neon Pilot UI.

## Where extensions live

User-created extensions live in runtime state by default:

```text
~/.local/state/neon-pilot/extensions/{extension-id}/
```

Bundled first-party extensions live in the repo under `extensions/`. Optional first-party extensions live in [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) and install from GitHub release artifacts. They use the same runtime contract as user extensions and are good examples when you need to copy a working shape.

The loader also accepts package roots through `NEON_PILOT_EXTENSION_PATHS`. Each path can point directly at a folder with `extension.json` or at a parent folder containing many extension packages.

A native extension package usually looks like this:

```text
agent-board/
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
  skills/
    agent-board/SKILL.md
```

`src/` is the source of truth. `dist/` is generated output that the runtime loads.

## Build and reload loop

Neon Pilot owns the build command. Run it from the repo root:

```bash
pnpm run extension:build -- ~/.local/state/neon-pilot/extensions/agent-board
```

The builder compiles frontend React to `dist/frontend.js`, backend Node code to `dist/backend.mjs`, and bundles normal third-party dependencies. Host packages such as `react`, `react-dom`, and `@neon-pilot/extensions` are treated as provided by the app. Backend `dist/` output is the runtime contract for system extensions, and stale, missing, oversized, or non-portable system-extension bundles fail validation. System frontends are loaded from source by the desktop renderer so they share the app's React singleton; their `dist/frontend.js` output is still built and checked for packaged releases.

Static extension-local `bin/` and `templates/` directories are copied into `dist/` during `extension:build` for packaged runtime use.

Packaged desktop releases only load prebuilt `dist/` files. They do not run esbuild for extensions at runtime, so imported/user extensions must already include their built frontend/backend bundles.

After building, reload extensions from the Extension Manager or the app reload path. If you changed UI, open the declared route, workbench tab, or tab-local rail surface and visually inspect it.
When the app is running, `neon-pilot extensions smoke <extension-id>` invokes host-level backend smoke checks through the same extension host path used by the packaged app.

## Packaging extensions

Package only after building and validating the extension. The portable bundle format is a zip with one top-level extension directory containing `extension.json`, source/docs/assets, and prebuilt `dist/` files. Runtime-installed extensions are not compiled by the packaged app.

```bash
pnpm run extension:build -- ~/.local/state/neon-pilot/extensions/agent-board
neon-pilot-extension doctor ~/.local/state/neon-pilot/extensions/agent-board
neon-pilot-extension pack ~/.local/state/neon-pilot/extensions/agent-board --out /tmp/agent-board.neon-extension.zip
```

The pack command excludes `node_modules`, `sidecar/target`, and transient `.dist.tmp-*` folders. If `--out` is omitted, it writes `<extension-dir>.zip` beside the package.

Import and catalog installs expect the same safe zip shape: exactly one top-level package directory with `extension.json`. The installer unpacks it into `<state-root>/extensions/{extension-id}` and loads the existing `dist/` bundles.

Optional first-party extensions use the same packer from their own repo checkout:

```bash
pnpm run extension:build -- <extension-dir>
neon-pilot-extension doctor <extension-dir>
neon-pilot-extension pack <extension-dir> --out <extension-id>-<version>.neon-extension.zip
```

Those bundles are named `{extension-id}.neon-extension.zip` and are uploaded to the matching GitHub release tag for Settings → Extensions → Install.

## Manifest contract

Every extension package has an `extension.json` manifest. The desktop runtime validates the manifest before loading the extension, so malformed contributions fail fast instead of turning into mystery UI bugs.

Supported top-level fields:

- `schemaVersion`: currently `2`.
- `id`, `name`, `description`, `version`. Runtime derives `packageType` from install location: repo/app-bundled packages are system extensions; runtime-installed packages are user extensions.
- `frontend`: native React bundle entry and optional styles.
- `backend`: backend module entry, backend actions, backend protocol entrypoints, and optional agent lifecycle factory.
- `contributes`: views, nav, commands, keybindings, slash commands, mentions, quick-open providers, search providers, gateway providers, prompt reference resolvers, skills, tools, prompt assembly providers/hooks, conversation connection providers, transcript renderers, transcript blocks, selection actions, subscriptions, themes, topBarElements, messageActions, composerShelves, composerControls, toolbarActions, conversationDecorators, conversationLifecycle, composer attachment providers/renderers/resolvers, activity tree item elements/styles/actions, contextMenus, statusBarItems, sidebar views, secrets, and settings metadata.
- `dependsOn`: required or optional extension dependencies surfaced by diagnostics and available for runtime discovery.
- `permissions`: declared capability intent.

Minimal example:

```json
{
  "schemaVersion": 2,
  "id": "agent-board",
  "name": "Agent Board",
  "description": "Kanban board for agent-executed tasks.",
  "version": "0.1.0",
  "frontend": {
    "entry": "dist/frontend.js",
    "styles": ["dist/frontend.css"]
  },
  "backend": {
    "entry": "dist/backend.mjs",
    "actions": [{ "id": "createTask", "handler": "createTask", "title": "Create task", "worker": { "enabled": true } }]
  },
  "contributes": {
    "views": [
      {
        "id": "page",
        "title": "Agent Board",
        "location": "main",
        "route": "/ext/agent-board",
        "component": "AgentBoardPage"
      }
    ],
    "nav": [{ "id": "nav", "label": "Agent Board", "icon": "kanban", "route": "/ext/agent-board" }]
  },
  "permissions": ["storage:readwrite"]
}
```

Nav items can also replace the left sidebar body with an extension-owned view while their route is active:

```json
{
  "contributes": {
    "views": [{ "id": "sessions-sidebar", "title": "Sessions", "location": "sidebar", "component": "SessionsSidebar" }],
    "nav": [
      {
        "id": "nav",
        "label": "Remote Agent",
        "icon": "sparkle",
        "route": "/ext/remote-agent",
        "sidebarView": "sessions-sidebar"
      }
    ]
  }
}
```

Rules:

- `id` is stable kebab-case.
- Use `/ext/{id}` by convention for user extension pages unless you have a strong reason not to.
- The manifest declares what exists; code implements the behavior.
- Renderable views point to named frontend exports.
- Backend actions point to named backend exports.
- Color themes are token maps under `contributes.themes`; use `--color-*` CSS variables with RGB triplet strings.
- Permissions are intent declarations today and should match what the extension can do.
- For `location: "sidebar"` views, use `SidebarSection` with `actionItems`, `SidebarList`, `SidebarTemplateList`, and `SidebarMessage` for flat lists. Use `SidebarTreeSection` for hierarchical sidebar data; it wraps the Pierre-backed `ActivityTreeView` in native left-sidebar chrome. Do not hand-roll nested sidebar rails, filter tabs, description-heavy rows, or local card/list chrome inside the host sidebar.

## Color themes

Extensions can contribute color-only themes without frontend code. Theme IDs are scoped by extension at runtime, so `solarized-dark` from `agent-board` is stored and applied as `agent-board/solarized-dark`.

```json
{
  "contributes": {
    "themes": [
      {
        "id": "solarized-dark",
        "label": "Solarized Dark",
        "appearance": "dark",
        "tokens": {
          "--color-base": "0 43 54",
          "--color-surface": "7 54 66",
          "--color-elevated": "13 65 78",
          "--color-panel": "0 36 46",
          "--color-border-subtle": "38 84 94",
          "--color-border-default": "48 104 117",
          "--color-primary": "238 232 213",
          "--color-secondary": "147 161 161",
          "--color-dim": "101 123 131",
          "--color-accent": "38 139 210",
          "--color-accent-bg": "7 54 66",
          "--color-success": "133 153 0",
          "--color-warning": "181 137 0",
          "--color-danger": "220 50 47"
        }
      }
    ]
  }
}
```

The built-in themes are `tokyo-night-light` and `tokyo-night-dark`. Legacy stored preferences `light` and `dark` still resolve to those built-ins.

## Dependencies

Extensions declare Node dependencies in their own `package.json`, not in `extension.json`. The manifest describes host contributions and capability intent.

### Dependency resolution during build

The build system uses esbuild to bundle extension code. Third-party dependencies are **bundled into the output** at build time — they are not resolved at runtime.

Resolution order:

1. The extension's own `node_modules/` (`pnpm install` in the extension directory)
2. The app's own `node_modules/` (fallback — any dep the app already has is available)
3. Custom build (if you need a different build setup, build the dist files yourself)

This means:

- **Host packages** (`@neon-pilot/extensions`, subpath imports, `react`) are always available — marked external in the esbuild config, resolved from the host at runtime.
- **If a dep is already in the app** (like `zod`, `date-fns`, `nanoid`), you can import it without any setup — it resolves through the fallback path.
- **If you need a dep the app doesn't have**, run `pnpm add <pkg>` in the extension directory before building.
- **If you need a custom build** (different bundler, plugins, externals), build `dist/` yourself. The app loads whatever `dist/frontend.js` and `dist/backend.mjs` exist.

### package.json

```json
{
  "type": "module",
  "dependencies": {
    "@neon-pilot/extensions": "*",
    "some-runtime-lib": "^1.2.3"
  }
}
```

`@neon-pilot/extensions` is the host SDK — listed to document the contract, not for npm resolution.

### Agent workflow for extensions with deps

```bash
# 1. Create the extension (or place it in ~/.local/state/neon-pilot/extensions/{id}/)
# 2. If you need a dep the app doesn't already ship:
pnpm --dir ~/.local/state/neon-pilot/extensions/my-ext add zod
# 3. Build
pnpm run extension:build -- ~/.local/state/neon-pilot/extensions/my-ext
# 4. Reload (from Extension Manager UI or app restart)
```

If you omit `pnpm install`, esbuild falls back to the app's `node_modules/`. If the dep isn't there either, the build fails — add it with `pnpm add`.

## Public imports

Use these modules as the paved road:

```ts
import type { ExtensionBackendContext, ExtensionManifest, ExtensionSurfaceProps } from '@neon-pilot/extensions';
import {
  AppPageLayout,
  AppPageIntro,
  AppPageSection,
  EmptyState,
  ToolbarButton,
  IconButton,
  SegmentedControl,
  DataTable,
  DataTableActionGroup,
  RuntimePage,
  RuntimeHeaderControls,
  RailSubsection,
  ExtensionChatRail,
  ChatView,
  ResourcePickerDialog,
} from '@neon-pilot/extensions/ui';
import { api, timeAgo, useAppData } from '@neon-pilot/extensions/data';
import { WorkbenchBrowserTab, WorkspaceExplorer } from '@neon-pilot/extensions/workbench';
import { SettingsPage } from '@neon-pilot/extensions/settings';
```

### Frontend UI components

Extension frontend code should treat `@neon-pilot/extensions/ui` as the public design-system entrypoint. Do not import `@neon-pilot/ui` directly from extension code; the host exposes the compatible facade through this package.

Start with the smallest shared primitive that fits the job, then compose upward:

- Page chrome: `AppPageLayout`, `AppPageIntro`, `AppPageSection`, `AppPageEmptyState`
- Actions: `Button`, `ToolbarButton`, `IconButton`, `TextButton`, `CheckButton`
- Forms: `Field`, `TextInput`, `TextAreaInput`, `SelectInput`, `CheckboxInput`, `SegmentedControl`, `Switch`, `ToggleRow`
- Feedback: `LoadingState`, `ErrorState`, `EmptyState`, `InlineStatus`, `StatusBadge`
- Lists and tables: `DataTable`, `DataTableEmptyRow`, `DataTableActionGroup`, `ResourceList`, `ResourceListRow`
- Runtime pages: `RuntimePage`, `RuntimeStatusStrip`, `RuntimeHeaderControls`, `MetricTile`, `DashboardGrid`
- Rails, sidebars, and settings panels: `RailSubsection`, `SidebarSection`, `SidebarActionHeader`, `SidebarList`, `SidebarTemplateList`, `SidebarRow`, `SidebarMessage`, `SidebarTreeSection`, `ActivityTreeView`, `SettingsPanel`, `SettingsRow`, `SettingsField`, `Switch`, `Select`, `TextInput`, `Textarea`, `ToolbarButton`
- Chat and files: `ChatView`, `ChatRailComposer`, `ExtensionChatRail`, `ResourcePickerDialog`

Use local markup for product-specific layout and content, but extract repeated chrome, action groups, pickers, chat surfaces, table actions, runtime summaries, and settings rows into shared UI instead of creating extension-local lookalikes. See [Design system](../../docs/design-system.md) and [`packages/ui`](../ui/README.md) for the full component catalog, Storybook guidance, and replacement checklist.

Settings components are not standalone app pages. When contributing `contributes.settingsComponent`, import from `@neon-pilot/extensions/settings` and render compact `SettingsPanel` groups containing `SettingsRow` controls. The host owns the page title, outer width, scroll anchor, and section spacing. Normal preferences should autosave on change, blur, or debounce; reserve visible buttons for explicit commands such as refresh, install, sync, test connection, or destructive actions.

Prefer returning `SettingsPanel` elements directly from the settings component instead of wrapping the whole component in a generic layout div. The Settings host normalizes direct panels into the shared row-list visual grammar, including spacing, borders, and padding.

System backend extensions can also import deliberate backend primitives through the backend seam:

```ts
import { createScheduledTask } from '@neon-pilot/extensions/backend';
```

Prefer focused backend subpaths for narrow primitives so extension bundles do not pull in unrelated host seams:

```ts
import { saveConversationCommitCheckpoint } from '@neon-pilot/extensions/backend/checkpoints';
import { compactConversation } from '@neon-pilot/extensions/backend/compaction';
```

Extensions that need a host-owned one-shot agent can use the agent seam instead of importing Pi directly:

```ts
import { runAgentTask } from '@neon-pilot/extensions/backend/agent';

const result = await runAgentTask({ prompt: 'Summarize this image', images, tools: 'none', timeoutMs: 30_000 }, ctx);
```

The host owns model lookup, auth storage, session creation, timeout cleanup, and runtime policy. Extension code owns only the workflow request and result handling. When `allowedToolNames` is set, `runAgentTask` can continue through multiple allowlisted tool calls and stops early only if a tool result returns `terminate: true`. Extensions must declare `agent:run` before using this seam.

For multi-turn agent work, use extension-owned conversations:

```ts
import {
  createAgentConversation,
  sendAgentMessage,
  streamAgentMessage,
  listAgentConversations,
  disposeAgentConversation,
} from '@neon-pilot/extensions/backend/agent';

const conversation = await createAgentConversation({ title: 'Research worker', tools: 'none' }, ctx);
const reply = await sendAgentMessage({ conversationId: conversation.id, text: 'Inspect this state.' }, ctx);
await disposeAgentConversation({ conversationId: conversation.id }, ctx);

const visible = await createAgentConversation(
  {
    title: 'Saved research worker',
    visibility: 'visible',
    persistence: 'saved',
  },
  ctx,
);
```

Extension-owned conversations support two modes: hidden+ephemeral for private worker sessions, and visible+saved for host conversation sessions that appear in the normal conversation system. They are scoped to the owning extension id and require `agent:conversations`. Use `runAgentTask` when you only need create → send → dispose.

Use `streamAgentMessage` from an SSE `backend.routes` handler when an extension owns a private chat interface and needs token/tool streaming. It returns a route-ready `{ stream: 'sse', events }` response with normalized chat events. Visible+saved conversations should use the host live-session events endpoint instead because they are normal app conversations. Frontend chat surfaces should render shared `ChatView` and `ChatRailComposer` from `@neon-pilot/extensions/ui`.

Extensions can record fire-and-forget app telemetry through the dedicated telemetry seam:

```ts
import { recordTelemetryEvent } from '@neon-pilot/extensions/backend/telemetry';

recordTelemetryEvent({ source: 'agent', category: 'my_extension', name: 'action_completed', durationMs: 42 });
```

Backend action handlers can also use `ctx.telemetry.record(...)`, which automatically annotates metadata with the current extension id. These events are stored as local JSONL first under `<state-root>/logs/telemetry/`, then indexed into SQLite best-effort for the Telemetry page and extension diagnostics. See [Telemetry](../../docs/telemetry.md) for storage paths, event shape, retention, and debugging guidance.

If a system extension needs a host primitive that is not exported here, add it deliberately to this package as a reusable SDK capability. Do not punch through into app internals, and do not hardcode one-off product behavior in the app shell.

### Backend API seam rules

The backend seam is a public SDK contract with a host implementation:

- Public stubs live in `packages/extensions/src/backend/*.ts` and are exported from `packages/extensions/package.json` as `@neon-pilot/extensions/backend/{name}`.
- Host implementations live in `packages/desktop/server/extensions/backendApi/{name}.ts` and are swapped in by the extension build/runtime alias.
- Extension source may import only the SDK seam, never `packages/desktop/server/...`, `@neon-pilot/core`, `@neon-pilot/daemon`, or agent-runtime internals directly.
- Host backend API modules must stay narrow. If a capability needs desktop runtime, daemon, routes, conversations, gateways, or other heavy app internals, lazy-load that implementation inside the called function instead of importing it at module scope.
- Prefer focused subpaths over the broad `@neon-pilot/extensions/backend` barrel so a small extension does not bundle unrelated seams.

`pnpm run check:extensions:quick` runs `scripts/check-extension-backend-api.mjs`, which verifies every SDK backend subpath has a matching host implementation, every host backend API module is exported by the SDK, and backend API modules do not statically import known heavy/runtime internals. If this check fails, fix the seam instead of widening the allowlist. Yes, this is intentionally annoying; annoying beats shipping a signed app with surprise noodle imports.

## Frontend surfaces

A frontend surface exports a React component referenced by `contributes.views[].component`:

```tsx
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { AppPageLayout, EmptyState, ToolbarButton } from '@neon-pilot/extensions/ui';

export function AgentBoardPage({ pa, context }: ExtensionSurfaceProps) {
  return (
    <AppPageLayout title="Agent Board" summary={`Conversation: ${context.conversationId ?? 'none'}`}>
      <ToolbarButton onClick={() => pa.extension.invoke('createTask', { conversationId: context.conversationId })}>New task</ToolbarButton>
      <EmptyState title="No tasks yet" body="Create a task from a conversation or start one here." />
    </AppPageLayout>
  );
}
```

Surface components receive props. Do not read globals like `window.PA`; it makes tests and reload behavior worse.

The host provides `pa` for stable app capabilities: backend action invocation, extension storage, workspace files, runs, automations, browser state, and lightweight UI prompts. Prefer PA components for common app chrome, but use normal React and scoped CSS for custom product UI.

Every extension renders under a host root such as `<section data-extension-id="agent-board">`. Keep CSS scoped to the extension and avoid global shell-looking selectors.

## Backend actions

Backend entries are separate from frontend entries. Keep browser React code and Node capability code apart.

Extensions can also expose host-launched stdio protocols via `backend.protocolEntrypoints`, for example an ACP server behind `neon-pilot protocol acp`. These handlers receive `ExtensionProtocolContext`, which extends the normal backend context with `protocolId`, `stdio`, and `signal` for long-lived protocol sessions.

Backend extensions export handlers referenced by `backend.actions[].handler`:

```ts
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export async function createTask(input: { title?: string; conversationId?: string }, ctx: ExtensionBackendContext) {
  const id = crypto.randomUUID();
  const task = {
    id,
    title: input.title ?? 'Untitled task',
    conversationId: input.conversationId ?? null,
    createdAt: new Date().toISOString(),
  };

  await ctx.storage.put(`tasks/${id}`, task);
  return task;
}
```

Frontend code calls backend actions through the host seam:

```ts
await pa.extension.invoke('createTask', { title: 'Write docs' });
```

Do not import backend handlers directly into frontend components. Browser/Node boundary lies are expensive and stupid.

Backend actions receive capability namespaces through `ctx`, including extension storage and backend-only capabilities such as workspace, git, shell, executions, automations, conversations, transcript block writing, and secrets where available. Use those seams instead of importing app internals. Frontend surfaces also receive `pa.selection` for shared text/message/file/transcript-range selection state.

File-mutating actions should return standard `details.fileChanges` metadata when they can identify the exact mutation. The host transcript renders this shape as an inline Pierre diff for any tool result:

```ts
return {
  text: 'Updated src/app.ts.',
  details: {
    fileChanges: [
      {
        path: 'src/app.ts',
        previousPath: 'src/old-app.ts', // only for renames/moves
        status: 'renamed',
        additions: 4,
        deletions: 2,
        patch: 'diff --git a/src/old-app.ts b/src/app.ts\n...',
      },
    ],
  },
};
```

Use `truncated: true` and omit `patch` for huge diffs instead of stuffing giant blobs into transcript state.

Use `ctx.executions` / `pa.executions` for durable async work. An execution is the product/API object for background commands, subagents, scheduled attempts, and other durable work. Durable runs are runtime storage plumbing; `ctx.runs` / `pa.runs` remain compatibility aliases for older extensions and should not be used for new code. Declare `executions:read`, `executions:start`, and/or `executions:cancel` permissions for new extension features.

## Composer slash commands

Use `contributes.slashCommands` when an extension needs custom code behind a `/command` in the conversation composer. The command points at a backend action, so no frontend component is required.

```json
{
  "backend": {
    "entry": "dist/backend.mjs",
    "actions": [{ "id": "createTask", "handler": "createTask", "worker": { "enabled": true } }]
  },
  "contributes": {
    "slashCommands": [{ "name": "task", "description": "Create a task", "action": "createTask" }]
  }
}
```

The backend action receives `{ commandName, argument, text, conversationId, cwd, draft }`. Return a string, `{ prompt }`, or `{ text }` to send a generated prompt; `{ replaceComposerText }` or `{ appendComposerText }` to edit the composer; `{ notice: { text, tone } }` to show feedback; or any other result to mark the command handled without sending.

This is separate from `pi.registerCommand(...)` in an agent lifecycle extension. `registerCommand` runs inside a live agent session and does not automatically add a composer slash-menu item.

## Agent lifecycle hooks

Backend-only extensions can contribute a pi agent extension factory for lifecycle-level behavior such as provider request rewriting, session compaction hooks, or other `pi.on(...)` event work that has no UI surface.

Declare the exported factory in the backend manifest:

```json
{
  "backend": {
    "entry": "dist/backend.mjs",
    "agentExtension": "default"
  }
}
```

The backend module exports a normal pi extension factory:

```ts
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function agentLifecycleExtension(pi: ExtensionAPI): void {
  pi.on('session_before_compact', async (event, ctx) => {
    // Return pi-compatible lifecycle results here.
  });
}
```

Enabled extension agent factories are discovered from manifests and appended to live session startup. Do not wire a system extension directly into runtime files when `backend.agentExtension` is the right seam.

## Mentions, quick open, and prompt references

Extensions can add items to composer `@` mentions, command-palette quick open, and hidden prompt-context resolution. Keep these three pieces aligned when they represent the same domain object.

Mention providers run in the frontend and return selectable `@` menu items:

```json
{
  "contributes": {
    "mentions": [
      {
        "id": "agent-board-cards",
        "title": "Agent Board cards",
        "kinds": ["card"],
        "provider": "buildAgentBoardMentionItems"
      }
    ]
  }
}
```

Quick-open providers also run in the frontend and add extension-owned command palette tabs:

```json
{
  "contributes": {
    "quickOpen": [
      {
        "id": "agent-board-cards",
        "provider": "agentBoardQuickOpenProvider",
        "title": "Cards",
        "section": "agent-board-cards",
        "order": 20
      }
    ]
  }
}
```

The provider export can implement `list()` for empty-query browsing and `search(query, limit)` for content search. Returned items include `title`, optional `subtitle`/`meta`/`keywords`, and an action such as `{ "kind": "navigate", "to": "/ext/agent-board" }` or `{ "kind": "openFile", "fileId": "notes/example.md" }`. Omit item `section` to use the contribution's tab; set it only when deliberately returning items for another quick-open surface.

Prompt reference resolvers run in the backend during prompt submission. Use them when an `@` mention should inject hidden context into the agent turn:

```json
{
  "backend": {
    "entry": "dist/backend.mjs",
    "actions": [{ "id": "resolvePromptReferences", "handler": "resolvePromptReferences" }]
  },
  "contributes": {
    "promptReferences": [{ "id": "agent-board-cards", "handler": "resolvePromptReferences" }]
  }
}
```

The handler receives `{ text, mentionIds }` and returns `{ contextBlocks, references }`. Context blocks are appended to hidden prompt context; references are echoed in prompt submission metadata when relevant.

## Selection, transcript blocks, services, subscriptions, and dependencies

Use `contributes.selectionActions` for actions on selected text, messages, files, or transcript ranges. Selection actions support compact `icon` labels and static `args`; transcript selection menus merge those args with the active selection when invoking host composer actions like `composer.replyToSelection`. Frontend surfaces can read and publish shared selection with `pa.selection.get()`, `pa.selection.set(...)`, and `pa.selection.subscribe(...)`; the host also emits `host:selection` events for subscription consumers.

Use `contributes.transcriptBlocks` plus `ctx.conversations.appendTranscriptBlock(...)` / `ctx.conversations.updateTranscriptBlock(...)` for extension-owned durable visible transcript blocks. This is the preferred seam for product-specific interactive blocks instead of baking new block types into core. Frontend components can use `pa.transcript.targetProps(target)` and `pa.transcript.spotlight(target)` to mark extension-owned transcript anchors and later scroll/focus/flash them; supported targets are `block`, `tool_call`, `background_run`, and `extension`.

Use `ctx.conversations.metadata` for small extension-owned facts attached to conversations. Metadata is namespaced by extension by default and can be queried by namespace, which is the right shape for board/task state, badges, and other lightweight conversation indexes. Store large documents in extension storage or a dedicated host document API instead.

For conversation reads, prefer indexed conversation APIs such as `ctx.conversations.list()`, `ctx.conversations.getMeta(...)`, `ctx.conversations.getBlocks(...)`, and backend helpers `getConversationMeta(...)` / `getConversationBlocks(...)`. Raw session helpers are deprecated escape hatches; do not use transcript/session-file readers for global list, search, ranking, or startup paths.

Use `ctx.conversations.getWorkspace()` and `ctx.conversations.updateWorkspace(...)` when an extension needs to mirror or control the shared conversation workspace. The workspace includes `openConversationIds`, `pinnedConversationIds`, `archivedConversationIds`, `activeConversationId`, and workspace paths. Workspace open/close/focus is presentation state; keep it separate from archive/unarchive lifecycle and live/running runtime state.

Use `ctx.conversations.create({ allowedToolNames })` when an extension-created conversation needs a runtime-enforced tool allowlist instead of the normal default tool surface:

```ts
await ctx.conversations.create({ title: 'Web-only research', allowedToolNames: ['web_search', 'web_fetch'] });
```

This is the right boundary for restricted agent modes; prompt instructions alone are not a tool policy.

Use `contributes.draftConversationCreate` when an enabled extension needs to modify a user-created draft conversation before it exists. The `prepareAction` runs from the new conversation screen and may return create options such as `{ createOptions: { allowedToolNames }, applyAfterCreate: true }`; when `applyAfterCreate` is true, the optional `applyAction` runs after the host creates the conversation. Keep workflow state and tool names in the extension rather than hardcoding them in the core conversation page.

Use `ctx.conversations.runTurn(conversationId, text, { onEvent })` when an extension needs to drive a visible conversation and stream the resulting turn. `runTurn` atomically resumes the conversation, subscribes to live events, sends the prompt, and resolves only after `turn_end` or `error`; prefer it over separately calling `ensureLive` + `subscribe` + `sendMessage` when the caller needs reliable remote/client streaming. Worker-backed actions can use `onEvent`; the host bridges live events across the worker boundary. CLI actions should forward those events through `ctx.toolContext?.onUpdate` when the command supports `--follow` or `--format jsonl`.

Use `backend.services` for long-lived backend work. The host starts enabled services at startup, calls returned stop functions on shutdown/disable/reload, runs declared health checks, and applies `restart: "always" | "on-failure"` when health fails. Extension Manager reports live service state alongside manifest declarations.

Use `contributes.turnContextProviders` when an extension needs per-turn hidden context without mutating the system prompt. Providers run during prompt preparation and can return `{ contextMessages }` or `{ blocks }`.

Use `contributes.runtimeProviders` to advertise local or remote runtime targets such as SSH hosts. The first API surface is discovery/health via `ctx.runtimes`; actual non-local conversation execution must go through host-owned runtime routing.

Use `contributes.gatewayProviders` to register an external messaging gateway provider ID for shared gateway state. The extension runtime owns credentials, transport, and provider-specific setup UI; do not rely on Telegram Gateway as a generic provider switcher. Gateway runtimes should use `@neon-pilot/extensions/backend/gateways` to create/update connections, attach conversations, detach conversations, and record events.

```json
{
  "contributes": {
    "gatewayProviders": [
      {
        "id": "discord",
        "label": "Discord",
        "description": "Route Discord messages into Neon Pilot.",
        "configurationLocation": "extension",
        "setupRoute": "/ext/discord-gateway",
        "docsUrl": "https://discord.com/developers/docs/intro",
        "order": 30
      }
    ]
  }
}
```

Use `contributes.subscriptions` for host-owned event sources. Current built-in producers include `workspaceFiles` (`host:workspaceFiles`), `settings` (`host:settings`), and shared selection changes (`host:selection`). Subscription handlers run in the backend through the extension event bus.

Use `contributes.searchProviders` for backend-powered global search scopes. Provider actions receive `{ query, limit, providerId }` and return either an array or `{ items }` with result rows.

Use `contributes.conversationLifecycle` for state-aware conversation banners or inline UI. Components receive `{ pa, lifecycleContext }`, where the event can be `before-run`, `after-run-start`, `blocked`, `waiting-for-user`, `model-error`, `tool-error`, `goal-active`, or `compaction-available`. Backend extensions can also subscribe to `source: "conversation"` lifecycle patterns such as `tool.started`, `tool.ended`, `tool.failed`, `run.started`, `run.ended`, `model.error`, `compaction.started`, and `compaction.ended`.

Use `contributes.composerAttachmentProviders` for composer attachment/context buttons. Provider actions receive `{ conversationId, cwd, composerText }`; returning a string or `{ text }` appends to the composer. `composerAttachmentRenderers` and `composerAttachmentResolvers` declare extension-owned attachment chip/render and backend-resolution seams.

Use `contributes.activityTreeItemActions` for compact inline thread/activity row buttons. Actions receive `{ itemId, kind, title, conversationId, cwd }`.

Use top-level `dependsOn` for extension dependencies:

```json
{
  "dependsOn": ["system-knowledge", { "id": "agent-board", "optional": true, "version": "^1.0.0" }]
}
```

Missing required dependencies block enabling an extension. Optional dependencies should still be checked at runtime with `pa.extensions.getStatus(...)` or `ctx.extensions.getStatus(...)` before calling into them.

## Agent skills and tools

Extensions can contribute agent skills and agent tools. These are runtime-mounted from the enabled extension package; they are not copied into the knowledge base.

Use extension skills for local instructions that explain how to use the extension, its tools, or its domain model:

```json
{
  "contributes": {
    "skills": [
      {
        "id": "agent-board",
        "title": "Agent Board",
        "description": "Use when planning or executing Agent Board tasks.",
        "path": "skills/agent-board/SKILL.md"
      }
    ]
  }
}
```

Use extension tools when the agent needs executable runtime behavior backed by extension code:

```json
{
  "backend": { "entry": "dist/backend.mjs", "actions": [{ "id": "createTask", "handler": "createTask", "worker": { "enabled": true } }] },
  "contributes": {
    "tools": [
      {
        "id": "create-task",
        "title": "Create Agent Board task",
        "description": "Create a task on the Agent Board.",
        "action": "createTask",
        "inputSchema": {
          "type": "object",
          "properties": { "title": { "type": "string" } },
          "required": ["title"],
          "additionalProperties": false
        }
      }
    ]
  }
}
```

The runtime registers a stable generated tool name: `extension_{extensionId}_{toolId}` with non-identifier characters normalized to underscores. Keep tools coarse and useful; do not expose every button click as an agent tool.

Tool prompt guidance should be rare and short. The model already receives the tool `description`, JSON-schema `inputSchema`, and parameter descriptions, so do not duplicate action lists or parameter docs in `promptGuidelines`. Use `promptGuidelines` only for behavior the schema cannot encode — safety boundaries, when not to use the tool, or required follow-up behavior — and default to one short sentence. Put longer operational workflows in an extension skill.

Prompt assembly providers and hooks are the advanced escape hatch for extensions that need to generate or filter runtime prompt capabilities. Prefer static `skills` and `tools` unless the contribution is genuinely dynamic. Provider and hook handlers are indexed by the registry, run through the central prompt assembly diagnostics surface, and should be treated as privileged runtime behavior:

```json
{
  "contributes": {
    "skillProviders": [{ "id": "generated-skills", "handler": "listGeneratedSkills", "title": "Generated Skills" }],
    "toolProviders": [{ "id": "generated-tools", "handler": "listGeneratedTools" }],
    "promptTemplateProviders": [{ "id": "generated-prompts", "handler": "listGeneratedPrompts" }],
    "instructionProviders": [{ "id": "runtime-instructions", "handler": "listRuntimeInstructions" }],
    "promptAssemblyHooks": [{ "id": "filter-runtime-context", "handler": "filterRuntimeContext", "phase": "before-injection" }]
  }
}
```

Prompt assembly providers are isolated: failures, timeouts, and malformed items become diagnostics and do not block the rest of assembly. Instruction providers return inspectable layers (`{ "layers": [...] }`) instead of silently mutating the system prompt. Hooks are powerful and should require clear user-facing diagnostics. Do not use hooks to silently rewrite the system prompt; contribute instruction/context through first-class providers instead. The built-in Prompt Assembly page at `/prompt-assembly` is the inspection and management surface.

## Surfaces and contribution choices

Pick the smallest surface that matches the product shape. Do not use a tab-local rail as a junk drawer.

| Surface                | Use for                                                                | Avoid using for                  |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| Main page view         | Durable app-level workflows with their own route                       | Tiny contextual helpers          |
| Left nav item          | Primary destinations users should see every day (`section: 'primary'`) | Settings subpanels               |
| Nav item (settings)    | Settings/configuration destinations (`section: 'settings'`)            | Product workflows                |
| Right-rail panel       | Compact contextual companions inside a workbench tab                   | Wide editors or log/diff viewers |
| Workbench detail view  | Large detail rendering paired to a tab-local rail selector             | Standalone app-level workflows   |
| Settings contribution  | Configuration and preferences                                          | Product workflows                |
| Command                | Fast one-shot actions or opening a surface                             | Persistent UI                    |
| Slash command          | Conversation-authored actions that affect prompt context               | Global app navigation            |
| Top bar element        | Status indicator icon/badge in the top bar                             | Full UI surfaces                 |
| Message action         | Hover-reveal action button on a message block                          | Persistent UI elements           |
| Toolbar action         | Icon button in the composer toolbar row                                | Text-heavy actions               |
| Composer shelf         | Info/status section above the composer input                           | Full-page workflows              |
| Conversation decorator | Badge/indicator on a conversation list item                            | Interactive UI                   |
| Context menu           | Right-click menu item on message or sidebar item                       | Primary navigation               |
| Thread header action   | Compact button beside the Threads sidebar header                       | Wide/persistent workflows        |
| Status bar item        | Label in the status bar below the composer                             | Interactive controls             |
| Theme                  | Color theme via CSS variable tokens                                    | Layout or UI changes             |

### Composer host boundary

Composer APIs are intent APIs. Extensions may request host actions such as `insertText(text)`, `appendText(text)`, `addFiles(files)`, or `openFilePicker()`, but the host owns composer state, attachment ingestion, selection, focus, and caret restoration.

Rules:

- Extensions must not query or mutate host DOM to affect the composer.
- Host code must not directly mutate controlled composer input values; text changes flow through React state/helpers.
- Imperative DOM is acceptable only for browser-owned UI state: focus, caret/selection, scroll, measurement, and the hidden file input reset that lets users pick the same file twice.
- If a new composer action needs state changes, add a host-owned intent method instead of passing refs or DOM handles across the extension boundary.

Right-rail views are tab-local extension rails. They may point at a paired workbench detail view with `detailView`:

```json
{
  "contributes": {
    "views": [
      {
        "id": "runs-rail",
        "title": "Runs",
        "location": "rightRail",
        "scope": "conversation",
        "component": "RunsRail",
        "detailView": "runs-detail"
      },
      {
        "id": "runs-detail",
        "title": "Run detail",
        "location": "workbench",
        "component": "RunsWorkbench"
      }
    ]
  }
}
```

## Commands and keybindings

Commands are the shared action substrate for app navigation, hardware controls, command palette entries, and extension-owned actions. Extensions contribute user-facing commands with metadata, then keybindings or code execute those command ids. Meaningful user-reachable actions should be commands first, including page buttons, toolbar actions, navigation, workflow operations, and actions that may later need a shortcut or hardware trigger. Keep one-off local handlers only for tiny control internals that are not useful from the command palette, automation, or a hotkey.

```json
{
  "contributes": {
    "commands": [
      {
        "id": "toggleDictation",
        "title": "Toggle Dictation",
        "category": "Dictation",
        "action": "toggleDictation",
        "enablement": "dictation.available"
      }
    ],
    "keybindings": [
      {
        "id": "new-chat",
        "title": "New chat",
        "keys": ["ctrl+alt+n"],
        "command": "app.navigate",
        "args": { "to": "/conversations/new" }
      }
    ]
  }
}
```

Built-in host commands include:

- `app.navigate` with `{ "to": "/path" }`
- `palette.open` with `{ "scope": "threads" }`
- `rail.open` with `{ "extensionId": "...", "surfaceId": "..." }`
- `layout.set` with `{ "mode": "compact" | "workbench" }` for hiding/showing the workbench panel
- `layout.toggle`, `layout.toggleSidebar`, and `layout.toggleRightRail`
- `page.find`
- `conversation.new`
- `conversation.open` with `{ "conversationId": "..." }`
- `conversation.next` / `conversation.previous`
- `conversation.close`, `conversation.reopenClosed`, `conversation.togglePinned`, `conversation.toggleArchived`, `conversation.rename`, and `conversation.editCwd`
- `workbench.newTab`, `workbench.closeActiveTab`, `workbench.closeActiveFile`, `workbench.refreshActiveFile`, `workbench.toggleExplorer`, and `workbench.toggleDiff`
- `composer.focus` / `composer.submit`
- `dictation.toggle`
- `sidebar.focus`
- `focus.next` / `focus.previous`
- `selection.activate`

Extension command contributions may point at a backend action or at a built-in host command via `action`, with default `args` and optional `argsSchema` when needed. Backend-triggered host commands wait briefly for a renderer acknowledgement and return whether the command was handled. Command executions are recorded as renderer telemetry under `commands/execute` for debugging keybindings, palette invocations, and hardware integrations.

The Extension Manager includes a command inspector for listing commands, running them with JSON args, and editing/resetting contributed keybindings.

Add keybinding contributions for high-frequency actions and for actions where the UI implies keyboard operation. Prefer user-editable keybindings through command metadata over hardcoded shortcut listeners, and avoid shipping action surfaces that cannot be hot-keyed when they are part of a repeated workflow.

Legacy string commands still work for compatibility: `navigate:/path`, `commandPalette:threads|files|commands|search`, `rightRail:{extensionId}/{surfaceId}`, `layout:compact|workbench`, and desktop shortcut aliases such as `core.newConversation`, `core.settings`, `core.findOnPage`, `core.toggleSidebar`, and `core.toggleRightRail`.

Frontend extensions can call `pa.commands.execute(id, args)`, `pa.commands.list()`, and `pa.commands.setContext(key, value)`. Backend actions can call `ctx.commands.execute(id, args)` for extension-contributed commands and built-in host commands; host command execution is delivered to the renderer over the app event stream.

Enablement is intentionally tiny: a command can set `enablement` to a context key (`speechmic.connected`), negated key (`!conversation.isStreaming`), equality (`layout.mode == workbench`), or inequality (`layout.mode != compact`). Frontend `setContext` namespaces keys under the extension id.

Do not install global `window` listeners for app-level shortcuts.

## CLI commands

Core owns the `neon-pilot` CLI shell. Extensions can add administrative commands to that surface with `contributes.cliCommands`; enabled extensions are discovered at runtime, and the CLI invokes the declared backend action through the extension host boundary.

```json
{
  "backend": {
    "actions": [{ "id": "manageTasks", "handler": "manageTasks" }]
  },
  "contributes": {
    "cliCommands": [
      {
        "id": "tasks-list",
        "command": "tasks list",
        "description": "List tasks.",
        "usage": "tasks list [--json]",
        "examples": ["neon-pilot tasks list", "neon-pilot tasks list --json"],
        "argsSchema": { "type": "array", "items": { "type": "string" } },
        "flagsSchema": {
          "type": "object",
          "properties": { "json": { "type": "boolean" } },
          "additionalProperties": true
        },
        "mode": "read",
        "requiresApp": false,
        "idempotent": true,
        "outputModes": ["text", "json"],
        "smoke": { "argv": ["tasks", "list"] },
        "action": "manageTasks",
        "jsonDefault": true
      }
    ]
  }
}
```

The backend action receives `{ action, cli: { command, rawArgv, args, flags, json, quiet, verbose, color, cwd } }`, where `action` defaults to the final command token as a convenience hint. Return `{ text }` for human-readable output and structured fields for `--json`; `cli.json` is true only when the caller passes `--json`. Keep CLI commands coarse and workflow-oriented. Agents should use human command/help output for task selection, use `--json` only for scripts or stable machine parsing, and use extension CLI commands for Neon Pilot administration instead of editing runtime files directly. First-party self-administration commands include `extensions ...`, `settings ...`, and `conversations ...`. CLI handlers run through the extension host permission boundary; do not expose secret reads or raw host file mutation.

Every command should have a `description`; add `usage` and `examples` for commands with arguments or flags so `neon-pilot help <command>` is useful to humans. Run `pnpm run check:cli:surface` after changing CLI contributions.

System extension commands must declare `argsSchema`, `flagsSchema`, `mode`, `requiresApp`, `idempotent`, and `outputModes`. The core shell validates declared args and flags before dispatch. Mutating commands must support `--dry-run`; the core CLI shell returns a dry-run result before invoking the backend action. Destructive commands require interactive confirmation or `--yes`, which the shell adds to destructive command contracts. Streaming commands should declare `mode: "streaming"`, include `jsonl` in `outputModes`, document `--follow`, `--format`, and interrupt behavior when supported, and emit real updates through `ctx.toolContext?.onUpdate`.

## Storage

Extensions should use app-owned document storage, scoped per extension:

```ts
await pa.storage.put('tasks/123', task, { expectedVersion });
const task = await pa.storage.get('tasks/123');
const tasks = await pa.storage.list('tasks/');
await pa.storage.delete('tasks/123');
```

Backend actions use `ctx.storage` against the same per-extension document store. One extension cannot read another extension's state unless a future shared-state API explicitly allows it.

For relational state, backend actions can open app-owned SQLite databases:

```ts
const db = await ctx.database.open('main', {
  migrations: [
    {
      version: 1,
      description: 'create tasks',
      up: (database) => database.exec('CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)'),
    },
  ],
});

db.prepare('INSERT INTO tasks (id, title) VALUES (?, ?)').run(id, title);
```

Database files are scoped to the extension under `<state-root>/extension-data/{extension-id}/databases/`. Use `ctx.storage` for small JSON documents and settings-like state; use `ctx.database` when the extension owns relational data, indexes, queues, or query-heavy state.

For larger files and blobs, use the filesystem buckets:

```ts
const files = await ctx.filesystem.app();
await files.writeText('exports/report.md', markdown);

const cache = await ctx.filesystem.cache();
await cache.writeJson('remote-index.json', index);
```

`ctx.filesystem.app()` is durable extension-owned file storage, `ctx.filesystem.cache()` is disposable extension-owned cache storage, `ctx.filesystem.temp()` creates a temporary workspace, and `ctx.filesystem.workspace()` requests permissioned workspace access.

## Trust and permissions

V1 native extensions are trusted local code. They are not sandboxed.

That is acceptable because Neon Pilot already runs local agent tools with broad authority. The goal is not fake security theater; the goal is a clear contract and review surface.

Extension backend code still must not be able to take down the host process. Backend module import and handler execution are host-owned through the `ExtensionBackendRunner` boundary. The current runner is in-process and guards extension backend imports, actions, services, subscriptions, protocol handlers, self-test smoke actions, and agent lifecycle factories against direct process termination APIs. Future per-extension workers should replace this runner instead of changing product runtime callers or extension capability adapters.

Host implementation code should not call extension backend handlers under one-off process guards. Add the needed operation to the runner boundary, then call it from the host-facing orchestrator. Calls such as `process.exit(...)`, `process.abort()`, or `process.kill(process.pid, ...)` from guarded extension code are blocked, reported as extension health errors, and the extension is disabled when the attempt happens from a runtime action path so it cannot create an app-start boot loop.

Repeated backend infrastructure failures trip a per-extension circuit breaker. Three failures in a rolling ten-minute window disables the extension and shows a diagnostic in Extension Manager. This covers backend load/import failures, health checks, service startup, and similar host-level failures; normal action handler errors are returned to the caller and do not quarantine the extension. Backend health loads and service startup get one short retry before recording a failure, so transient worker startup hiccups do not immediately count toward quarantine. On clean startup, the runtime clears its extension startup marker after backend health checks, startup actions, services, and subscriptions are installed; while startup work is running, the marker records the active extension. If the previous launch left that marker behind, extension safe mode disables the active runtime/user extension when known. If no active extension was recorded, safe mode reports the stale marker without disabling extensions. Re-enabling an extension clears its quarantine entry and any stale startup marker so the recovery action does not immediately retrigger safe mode.

Rules:

- Declare permissions in `extension.json`.
- Keep permissions aligned with what the extension can actually do.
- The Extension Manager displays permissions and should highlight permission expansion.
- Do not expose raw SQLite handles, Express routers, Electron main process objects, arbitrary app internals, or the full process environment as extension APIs.

## Packaging and import/export

Exported extensions should include the package root: manifest, source, package metadata, README, skills, and built `dist` output. Keep generated output available so imported extensions can run without archaeology.

If an imported extension needs rebuilding, its `package.json` must declare the dependencies needed for the build. Host-provided packages stay external; third-party runtime libraries belong in `dependencies`.

## References while building

Useful files to inspect when the schema or SDK shape matters:

- `packages/extensions/src/index.ts` — public SDK types.
- `packages/desktop/server/extensions/extensionManifest.ts` — manifest parsing/types.
- `packages/desktop/server/extensions/extensionRegistry.ts` — loading and registry behavior.
- `packages/desktop/server/extensions/extensionLifecycle.ts` — create/import/export lifecycle.
- `extensions/system-extension-manager/README.md` — product-level extension manager behavior.
- `extensions/system-*` — first-party examples using the same contract.

If the SDK lacks a host primitive needed by a first-party extension, add it deliberately to `packages/extensions` rather than importing app internals.
