# Extension Authoring Reference

The normal way to create a Neon Pilot extension is to ask your agent to build it for you. Start with [Build an extension with your agent](build-an-extension.md) for the user-facing workflow and copy-paste prompt.

This reference covers the extension package contract: manifests, frontend/backend entries, tools, skills, agent hooks, event bus, permissions, build behavior, and integration testing. Use it when implementing or debugging an extension, not as the first stop for a user who just wants a new feature.

## Contents

- [Agent-first workflow](#agent-first-workflow)
- [Core vs extensions](#core-vs-extensions)
- [Extension Structure](#extension-structure)
- [Manifest (`extension.json`)](#manifest-extensionjson)
- [Frontend (UI)](#frontend-ui)
- [Main page layout](#main-page-layout)
- [Styling guidance](#styling-guidance)
- [Backend (Server-side)](#backend-server-side)
- [Agent Lifecycle Hooks](#agent-lifecycle-hooks)
- [Conversation Write API](#conversation-write-api)
- [Inter-extension Communication](#inter-extension-communication)
- [Notifications and Badge](#notifications-and-badge)
- [Permissions](#permissions)
- [Development Workflow](#development-workflow)
- [Examples](#examples)

## Agent-first workflow

Users should usually describe the feature they want and let their agent create the extension:

```text
Build a Neon Pilot extension that [does what].

Use the extension manager/template if helpful. Pick the right surface:
- main page for a full app/workflow
- tab-local right rail for a compact conversation-specific tool panel inside the workbench
- workbench detail for split-pane workflows

Implement it with editable source files, build it, reload it, visually test it, and checkpoint the changes. Ask me only if a product decision blocks you.
```

The agent should create editable `src/` files, declare contributions in `extension.json`, build, validate, reload, inspect the UI when present, and checkpoint only touched files. Manual manifest/API details below are reference material.

### Production readiness checklist

Before calling an extension done, an agent must be able to answer each item with evidence from the repo or app:

- **Surface chosen**: the extension has one clear primary surface for the first version: main page, workbench rail/detail, Settings component, backend action/tool, composer/control contribution, or theme.
- **Boundary clean**: extension runtime code imports from `@neon-pilot/extensions`, `@neon-pilot/extensions/ui`, or narrow `@neon-pilot/extensions/backend/*` SDK subpaths, not core, desktop, or package-internal app modules.
- **Manifest wired**: every declared component/action/tool/skill/settings entry points to an existing source export or file, and every frontend `pa.actions.call(...)` action id is declared in `backend.actions`.
- **Runtime built**: `dist/` files are current, because packaged desktop runtimes load built bundles and do not compile extension source at install time.
- **Diagnostics clean**: `neon-pilot-extension doctor <extension-dir>` is clean when available; boundary work also runs `pnpm run check:extensions:static`.
- **User path validated**: the route, rail, Settings section, command, composer control, or tool invocation was opened or invoked through the app/extension host.
- **States covered**: UI surfaces show useful loading, empty, error, and success states; backend-only extensions return useful error text/details for malformed input.
- **Docs local**: the extension has or updates a `README.md` with build, reload, validation, and usage notes for the next agent.

## Core vs extensions

Neon Pilot core is the small, stable platform: agent and conversation runtime, model/tool execution protocol, transcript/event stream, durable storage primitives, knowledge/system-prompt assembly, extension host/manifest/API/permissions, security boundaries, desktop/web shell, routing, install/update plumbing, and shared UI primitives.

Everything user-facing, domain-specific, or workflow-specific should be an extension: pages, panels, tool renderers, slash/command surfaces, integrations, context providers, automations, import/export flows, diagnostics views, settings sections, and opinionated UX built on top of the platform.

When a feature cannot be built cleanly as an extension, add a general-purpose extension API or SDK primitive to core rather than hardcoding a one-off app feature. Core should make features possible; extensions should be where features live.

## Extension Structure

A minimal extension looks like:

```
my-extension/
├── extension.json      # Manifest
├── package.json        # Dependencies (optional)
├── src/
│   ├── frontend.tsx    # UI components (optional)
│   └── backend.ts      # Backend handlers / protocol entrypoints (optional)
└── dist/               # Built output
```

Create a new extension by asking your agent to build it. Under the hood, the agent should use Extension Manager actions or the packaged local-extension-development skill; renderer/extension UI should use the public extension SDK clients/capabilities instead of reaching into desktop internals.

Extension frontend code must not depend on Electron IPC channels. Product data flows through host-provided HTTP clients/capabilities, realtime updates flow through host-provided realtime subscriptions, and native OS/Electron operations remain host-owned capabilities. If an extension needs a missing product API, add a reusable SDK capability rather than adding an extension-specific IPC bridge.

## Packaging and distribution

Build before packaging. A packaged extension is a zip file containing one top-level extension directory with `extension.json`, source/docs/assets, and prebuilt `dist/` bundles. Do not include `node_modules`, transient `.dist.tmp-*` folders, or local build caches.

From the repo root:

```bash
pnpm run extension:build -- ~/.local/state/neon-pilot/extensions/agent-board
neon-pilot-extension doctor ~/.local/state/neon-pilot/extensions/agent-board
neon-pilot-extension pack ~/.local/state/neon-pilot/extensions/agent-board --out /tmp/agent-board.neon-extension.zip
```

`neon-pilot-extension pack` is a thin wrapper around `scripts/extension-pack.mjs`. It zips the package directory itself, excludes `node_modules`, `sidecar/target`, and `.dist.tmp-*`, and writes either `<extension-dir>.zip` or the path passed with `--out`.

Import/install expects the same shape: one safe top-level directory containing `extension.json`. The desktop runtime unzips into `<state-root>/extensions/{extension-id}` and loads the prebuilt `dist/` files. Packaged desktop releases do **not** compile extensions at install time.

Optional first-party extensions are distributed from the separate [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) repo as GitHub release artifacts. Use the same package format for local, catalog, and GitHub installs:

```bash
pnpm run extension:build -- <extension-dir>
neon-pilot-extension doctor <extension-dir>
neon-pilot-extension pack <extension-dir> --out <extension-id>-<version>.neon-extension.zip
```

See [Extension Distribution](extension-distribution.md) for GitHub repo manifests, release catalogs, compatibility metadata, and publishing guidance.

## Manifest (`extension.json`)

The manifest declares what your extension contributes:

```json
{
  "schemaVersion": 2,
  "id": "my-extension",
  "name": "My Extension",
  "description": "What it does",
  "version": "0.1.0",
  "permissions": ["storage:readwrite"],
  "frontend": {
    "entry": "dist/frontend.js",
    "styles": []
  },
  "backend": {
    "entry": "src/backend.ts",
    "actions": [
      {
        "id": "ping",
        "handler": "ping",
        "title": "Ping"
      }
    ],
    "protocolEntrypoints": [
      {
        "id": "acp",
        "handler": "runAcpProtocol",
        "title": "Agent Client Protocol"
      }
    ]
  },
  "contributes": {
    "views": [],
    "nav": [],
    "commands": [],
    "tools": [],
    "skills": [],
    "themes": []
  }
}
```

**`packageType`**: derived by the loader from install location: repo/app-bundled extensions are `"system"`; runtime-installed extensions are `"user"`. The manifest field is accepted for compatibility but is not authoritative.

**`defaultEnabled`**: set to `false` for extensions that should install disabled until the user explicitly enables them.

**`permissions`**: See [Permissions](#permissions).

### Contribution Types

| Field                         | Purpose                                                                                       | Docs                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `views`                       | UI surfaces (pages, panels, sidebar replacements)                                             | See `docs/views.md`                                                                       |
| `nav`                         | Left sidebar navigation items; can reference a sidebar view with `sidebarView`                 |                                                                                           |
| `commands`                    | Extension actions invokable by command IDs                                                    | See [Commands and keybindings](../packages/extensions/README.md#commands-and-keybindings) |
| `cliCommands`                 | Product administration commands contributed to the `neon-pilot` CLI                           | [See below](#cli-commands-clicommands)                                                    |
| `keybindings`                 | Keyboard shortcuts that execute commands                                                      | See [Commands and keybindings](../packages/extensions/README.md#commands-and-keybindings) |
| `slashCommands`               | `/command` in composer                                                                        |                                                                                           |
| `tools`                       | Agent-callable tools                                                                          |                                                                                           |
| `skillProviders`              | Dynamic Prompt Assembly skill providers                                                       | [See below](#prompt-assembly)                                                             |
| `toolProviders`               | Dynamic Prompt Assembly tool providers                                                        | [See below](#prompt-assembly)                                                             |
| `promptTemplateProviders`     | Dynamic Prompt Assembly template providers                                                    | [See below](#prompt-assembly)                                                             |
| `instructionProviders`        | Dynamic Prompt Assembly instruction layers                                                    | [See below](#prompt-assembly)                                                             |
| `promptAssemblyHooks`         | Privileged Prompt Assembly hooks                                                              | [See below](#prompt-assembly)                                                             |
| `modelProfiles`               | Enabled extension runtime profiles matched by provider/model globs                            |                                                                                           |
| `mentions`                    | @-mention providers                                                                           |                                                                                           |
| `skills`                      | Agent Skills (markdown)                                                                       |                                                                                           |
| `themes`                      | Color themes                                                                                  |                                                                                           |
| `backend.protocolEntrypoints` | Extension-owned stdio protocols launched by the host CLI                                      | [See below](#protocol-entrypoints-backendprotocolentrypoints)                             |
| `transcriptRenderers`         | Custom tool result rendering; set `standalone: true` to render outside internal-work clusters |                                                                                           |
| `promptReferences`            | @-mention resolvers                                                                           |                                                                                           |
| `turnContextProviders`        | Ordered per-turn context injection                                                            | [See below](#turn-context-providers-turncontextproviders)                                 |
| `promptContextProviders`      | Prompt Assembly context diagnostics/providers                                                 | [See below](#prompt-context-providers-promptcontextproviders)                             |
| `selectionActions`            | Actions available for selected transcript/composer text                                       | [See below](#selection-actions-selectionactions)                                          |
| `transcriptBlocks`            | Extension-owned transcript block renderers                                                    | [See below](#transcript-blocks-transcriptblocks)                                          |
| `subscriptions`               | Backend event subscriptions                                                                   | [See below](#backend-event-subscriptions-subscriptions)                                   |
| `secrets`                     | Secret declarations surfaced in Settings                                                      | [See below](#settings)                                                                    |
| `activityTreeItemElements`    | Custom content in thread/activity tree rows                                                   | [Activity tree](activity-tree.md)                                                         |
| `activityTreeItemStyles`      | Custom row styling for thread/activity tree items                                             | [Activity tree](activity-tree.md)                                                         |
| `quickOpen`                   | Command palette surfaces/tabs backed by extension providers                                   | [See below](#quick-open-surfaces-quickopen)                                               |
| `searchProviders`             | Backend-powered global search providers                                                       | [See below](#global-search-providers-searchproviders)                                     |
| `runtimeProviders`            | Extension-advertised local/remote runtime targets                                             | [See below](#runtime-providers-runtimeproviders)                                          |
| `settings`                    | Settings schema contributions                                                                 | [See below](#settings)                                                                    |
| `settingsComponent`           | Component panel in Settings                                                                   | [See below](#settings-component-settingscomponent)                                        |
| `topBarElements`              | Top bar indicator icons                                                                       | [See below](#top-bar-elements-topbarelements)                                             |
| `conversationHeaderElements`  | Badges in conversation header                                                                 | [See below](#conversation-header-elements-conversationheaderelements)                     |
| `messageActions`              | Hover buttons on messages                                                                     | [See below](#message-actions-messageactions)                                              |
| `composerShelves`             | Sections above the composer                                                                   | [See below](#composer-shelves-composershelves)                                            |
| `newConversationPanels`       | Panels on the new conversation page                                                           | [See below](#new-conversation-panels-newconversationpanels)                               |
| `composerControls`            | Component controls in the composer bottom row                                                 | [See below](#composer-controls-composercontrols)                                          |
| `composerButtons`             | Legacy composer controls                                                                      | [See below](#composer-buttons-composerbuttons)                                            |
| `composerInputTools`          | Component tools beside composer controls                                                      | [See below](#composer-input-tools-composerinputtools)                                     |
| `toolbarActions`              | Icon buttons in composer toolbar                                                              | [See below](#toolbar-actions-toolbaractions)                                              |
| `conversationDecorators`      | Badges on conversation list items                                                             | [See below](#conversation-decorators-conversationdecorators)                              |
| `contextMenus`                | Right-click menu items                                                                        | [See below](#context-menus-contextmenus)                                                  |
| `threadHeaderActions`         | Component buttons in the Threads header                                                       | [See below](#thread-header-actions-threadheaderactions)                                   |
| `statusBarItems`              | Labels in the composer status bar                                                             | [See below](#status-bar-items-statusbaritems)                                             |
| `conversationLifecycle`       | Conversation-state banners/inline UI                                                          | [See below](#conversation-lifecycle-conversationlifecycle)                                |
| `composerAttachmentProviders` | Buttons that add/derive composer attachment context                                           | [See below](#composer-attachments)                                                        |
| `composerAttachmentRenderers` | Renderers for extension-owned composer attachment chips                                       | [See below](#composer-attachments)                                                        |
| `composerAttachmentResolvers` | Backend resolvers for extension-owned attachment refs                                         | [See below](#composer-attachments)                                                        |
| `activityTreeItemActions`     | Inline action buttons on thread/activity tree rows                                            | [See below](#activity-tree-item-actions-activitytreeitemactions)                          |

### Standard file change metadata

File-mutating tools should return standard `details.fileChanges` metadata when they can identify the exact mutation they performed. The desktop transcript renders this shape as an inline Pierre diff for any tool block, without requiring a tool-specific renderer.

```ts
type FileChange = {
  path: string;
  previousPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unmerged' | 'changed';
  additions: number;
  deletions: number;
  patch?: string; // unified diff for this exact tool call
  truncated?: boolean;
};

return { text: 'Updated file.', details: { fileChanges: [change] } };
```

Omit `patch` and set `truncated: true` when the inline diff would bloat transcript state.

### Model Profiles

Model profiles let an enabled extension declare that it provides model-specific runtime behavior. They are intentionally small: the profile only says which provider/model refs it matches. The extension implements behavior through normal extension mechanisms such as agent hooks, tools, tool replacements, context providers, or backend actions.

Models do **not** declare profiles. Disabled extensions do **not** secretly activate for matching models. If no enabled profile matches, the session uses normal default behavior.

```json
{
  "backend": {
    "entry": "src/backend.ts",
    "agentExtension": "default"
  },
  "contributes": {
    "modelProfiles": [
      {
        "id": "codex-compatible",
        "title": "Codex Compatible",
        "description": "Codex-shaped runtime behavior for GPT coding models.",
        "match": ["openai-codex/*", "*/gpt-5.5"],
        "priority": 100
      }
    ],
    "tools": [
      {
        "id": "apply-patch",
        "name": "apply_patch",
        "description": "Apply a Codex-style patch.",
        "action": "applyPatch"
      }
    ]
  }
}
```

`match` patterns are simple `*` globs over the canonical ref:

```text
<provider>/<model>
```

Examples:

- `openai-codex/*` matches every model from the `openai-codex` provider.
- `*/gpt-5.5` matches `gpt-5.5` from any provider.
- `opencode-go/qwen*-coder*` matches Qwen Coder-like models from `opencode-go`.

Profile resolution is deliberately boring:

1. Only enabled extensions contribute model profiles.
2. Matching profiles are sorted by `priority` descending; missing priority is `0`.
3. Exactly one highest-priority profile wins.
4. If multiple profiles tie at the highest priority, the match is ambiguous and no profile behavior should be assumed.

The profile contribution itself does not define tools or instructions. For example, the Codex Compatibility extension contributes a `modelProfiles` match for `openai-codex/*`, contributes the `apply_patch` tool, and uses its `backend.agentExtension` hooks to switch active tools to `bash` and `apply_patch` when a matching model is active. Explicit per-run tool allowlists still take precedence over extension profile behavior.

Profiles for local runtimes may declare `startupAction`, naming a backend action in the same extension. When that profile is the resolved match for the selected model, Neon Pilot invokes the action before the provider request is sent. Use this for idempotent runtime preparation such as starting a local server; the action should return quickly when the runtime is already healthy and surface setup errors clearly.

For `session_start` and `model_select` handlers, the desktop host augments the lifecycle context with:

```ts
type ModelProfileContext =
  | { kind: 'none'; modelRef: string | null }
  | { kind: 'resolved'; modelRef: string; profile: { id: string; extensionId: string; title?: string; match: string[]; priority: number } }
  | { kind: 'ambiguous'; modelRef: string; profiles: Array<{ id: string; extensionId: string; match: string[]; priority: number }> };

ctx.modelProfile: ModelProfileContext;
ctx.setActiveTools(toolNames: string[]): void;
```

`ctx.setActiveTools` is only available on these lifecycle contexts. Global `pi.setActiveTools` is blocked by the desktop runtime.

### Views

Views are the primary way to add UI. Three locations:

- **`main`**: Full-page view at a custom route (`/ext/your-id`).
- **`rightRail`**: Tab-local rail inside the workbench, usually used as a compact selector/context panel.
- **`workbench`**: Detail pane, optionally paired with a tab-local rail view.

```json
{
  "id": "my-panel",
  "title": "My Panel",
  "location": "rightRail",
  "component": "MyComponent",
  "scope": "conversation",
  "icon": "app",
  "activation": "on-open"
}
```

**`activation`** controls when the component loads:

- `"on-route"` — loads when the route is active (for main pages).
- `"on-open"` — loads when the user opens the panel.
- `"on-demand"` — loads lazily when needed.
- `"always"` — always mounted.

**`scope`** for rightRail views:

- `"conversation"` — one instance per conversation.
- `"workspace"` — one per workspace/cwd.
- `"global"` — single instance.

### Message Actions (`messageActions`)

Add hover-reveal text buttons on messages, inline with copy/fork/rewind.
Action-based — no frontend entry needed.

```json
{
  "id": "summarize-message",
  "title": "Summarize",
  "action": "summarizeHandler",
  "when": "role:assistant && hasText",
  "priority": 10
}
```

**`when`** predicates:

- `role:assistant` — only on assistant messages
- `role:user` — only on user messages
- `hasText` — message has text content

Backend handler receives:

```typescript
{
  messageText: string;
  messageRole: 'user' | 'assistant';
  blockId: string;
  conversationId: string;
}
```

### Global Search Providers (`searchProviders`)

Use `searchProviders` for app-level search backed by extension backend actions. The provider appears as a command palette scope; when the user searches that scope, the backend action receives `{ query, limit, providerId }`.

```json
{
  "backend": {
    "actions": [{ "id": "searchTickets", "handler": "searchTickets" }]
  },
  "contributes": {
    "searchProviders": [
      {
        "id": "tickets",
        "title": "Tickets",
        "action": "searchTickets",
        "kinds": ["ticket"],
        "priority": 10
      }
    ]
  }
}
```

Return either an array of items or `{ "items": [...] }`. Items support `title`, `subtitle`, `snippet`/`meta`, `keywords`, `order`, and optional `action`. Supported actions today are `{ "kind": "navigate", "to": "/path" }` and `{ "kind": "command", "command": "extension.command", "args": {} }`.

### Conversation Lifecycle (`conversationLifecycle`)

Add React UI for conversation state transitions such as waiting for user input, blocked/takeover state, model or tool errors, active goal mode, compaction, or an active run.

```json
{
  "contributes": {
    "conversationLifecycle": [
      {
        "id": "approval-banner",
        "component": "ApprovalBanner",
        "events": ["waiting-for-user", "blocked"],
        "slot": "banner",
        "priority": 10
      }
    ]
  }
}
```

Components receive `{ pa, lifecycleContext }`, where `lifecycleContext` includes `conversationId`, `cwd`, `event`, `isStreaming`, `hasGoal`, `isCompacting`, and optional `error`.

For backend automation, subscribe to `source: "conversation"` and patterns like `tool.started`, `tool.ended`, `tool.failed`, `run.started`, `run.ended`, `model.error`, `compaction.started`, or `compaction.ended`. Handlers receive `{ subscriptionId, event, payload, sourceExtensionId }`; `payload.type` is the lifecycle event name.

### Prompt Context Providers (`promptContextProviders`)

Use `promptContextProviders` when an extension needs to expose prompt-assembly diagnostics or suggested hidden context that can be inspected from the Prompt Assembly page. New provider implementations should document what context they add and whether the user can disable it.

```json
{
  "contributes": {
    "promptContextProviders": [{ "id": "suggested-context", "handler": "provide-prompt-context", "title": "Suggested context" }]
  }
}
```

### Turn Context Providers (`turnContextProviders`)

Use `turnContextProviders` when an extension needs to add scoped hidden context before each submitted turn without mutating the system prompt. Providers are ordered by `priority` and invoked during prompt preparation.

```json
{
  "contributes": {
    "turnContextProviders": [{ "id": "reminders", "handler": "provideTurnReminders", "title": "Turn reminders", "priority": 50 }]
  }
}
```

Handlers receive `{ prompt, conversationId, currentCwd, relatedConversationIds }` and may return legacy `{ contextMessages }` or `{ blocks }`. Blocks are converted into extension turn-context messages.

### Runtime Providers (`runtimeProviders`)

Runtime providers advertise conversation execution targets such as SSH remotes. This is the registry/health boundary only; routing a conversation to a non-local runtime still requires host runtime support.

```json
{
  "contributes": {
    "runtimeProviders": [{ "id": "ssh", "title": "SSH Remote Runtime", "handler": "listSshRuntimes" }]
  }
}
```

Handlers return `{ runtimes: [...] }`, where each runtime includes `id`, `title`, `kind`, `status`, optional `version`, `workspaceRoots`, `capabilities`, and `metadata`. Backend actions can inspect providers through `ctx.runtimes.list()`, `ctx.runtimes.get(id)`, and `ctx.runtimes.healthCheck(id)`.

### Composer Attachments

Use `composerAttachmentProviders` for buttons above the composer attachment shelf. The provider action receives `{ conversationId, cwd, composerText }`; returning a string or `{ "text": "..." }` appends text to the composer. `composerAttachmentRenderers` and `composerAttachmentResolvers` reserve the manifest/API seam for extension-owned attachment refs.

```json
{
  "contributes": {
    "composerAttachmentProviders": [{ "id": "attach-ticket", "title": "Attach Ticket", "action": "attachTicket", "icon": "🎫" }],
    "composerAttachmentRenderers": [{ "id": "ticket-chip", "type": "jira-ticket", "component": "TicketAttachment" }],
    "composerAttachmentResolvers": [{ "id": "ticket-resolver", "type": "jira-ticket", "action": "resolveTicket" }]
  }
}
```

### Activity Tree Item Actions (`activityTreeItemActions`)

Add compact inline buttons to thread/activity tree rows. The action receives `{ itemId, kind, title, conversationId, cwd }`.

```json
{
  "contributes": {
    "activityTreeItemActions": [{ "id": "summarize-thread", "title": "Summarize", "action": "summarizeThread", "icon": "Σ" }]
  }
}
```

### Slash Commands (`slashCommands`)

Add `/command` entries to the conversation composer. Slash commands are listed in the composer slash menu and execute an extension backend action before the prompt is sent.

```json
{
  "backend": {
    "entry": "dist/backend.mjs",
    "actions": [{ "id": "createTask", "handler": "createTask" }]
  },
  "contributes": {
    "slashCommands": [
      {
        "name": "task",
        "description": "Create a task from composer input.",
        "action": "createTask"
      }
    ]
  }
}
```

The backend action receives:

```typescript
{
  commandName: string;
  argument: string;
  text: string;
  conversationId: string | null;
  cwd: string;
  draft: boolean;
}
```

The action can return a string, `{ prompt }`, or `{ text }` to send a generated prompt; `{ replaceComposerText }` or `{ appendComposerText }` to update the composer without sending; `{ notice: { text, tone } }` to show feedback; or any other object/empty result to mark the command handled.

Use `slashCommands` for composer-triggered extension code. Use `pi.registerCommand(...)` inside `backend.agentExtension` only when the command must run inside the live agent session runtime; that does not automatically make the command appear in the composer slash menu.

### CLI Commands (`cliCommands`)

Core owns the `neon-pilot` CLI shell. Extensions contribute product-specific verbs with `contributes.cliCommands`; the CLI discovers enabled extensions and routes matching commands to the declared backend action through the extension host boundary.

```json
{
  "backend": {
    "actions": [{ "id": "manageExample", "handler": "manageExample" }]
  },
  "contributes": {
    "cliCommands": [
      {
        "id": "example-list",
        "command": "example list",
        "description": "List example records.",
        "action": "manageExample",
        "jsonDefault": true
      }
    ]
  }
}
```

The action receives `{ action, cli: { command, rawArgv, args, flags, json, cwd } }`, where `action` defaults to the final command token as a convenience hint. Return `{ text }` for human output and structured fields for `--json`. Keep CLI commands coarse and administrative; do not expose every UI button as a command. Agents should discover commands with `neon-pilot commands --json` and prefer extension-contributed CLI commands over direct runtime file edits. System extensions use this surface for `extensions ...`, `settings ...`, and `conversations ...` administration. CLI commands route through the same extension host and permission boundary as UI actions; do not expose secret reads or raw host file mutation through CLI handlers.

### Quick-open surfaces (`quickOpen`)

Add a top-level tab to the command palette. Each quick-open contribution registers one extension-owned surface.
The palette uses `section` as the stable tab/surface id, `title` as the visible tab label, and `provider` as the frontend export that returns items.

```json
{
  "contributes": {
    "quickOpen": [
      {
        "id": "knowledge-files",
        "provider": "knowledgeQuickOpenProvider",
        "title": "Knowledge",
        "section": "knowledge",
        "order": 10
      }
    ]
  }
}
```

Provider items can omit `section`; omitted values are assigned to the contribution's `section` (or `id` if no section is set).
Items with a different section are ignored by that tab. Providers may expose `list()` for default results and `search(query, limit)` for content-backed search.
`order` is optional and controls tab ordering after the built-in Threads tab.

Keybindings can open a quick-open surface directly with legacy `commandPalette:<section>` or the first-class command form `command: "palette.open", args: { "scope": "knowledge" }`.

### Settings Component (`settingsComponent`)

Add one component-backed section to the main Settings page.

```json
{
  "contributes": {
    "settingsComponent": {
      "id": "dictation",
      "component": "DictationSettingsPanel",
      "sectionId": "settings-dictation",
      "label": "Dictation",
      "description": "Enable local dictation via Whisper.cpp for the composer mic button.",
      "order": 30
    }
  }
}
```

The component receives `pa` and `settingsContext`. Use this for rich settings UIs; use `settings` for simple scalar settings managed by the built-in extension settings form.

### Composer Controls (`composerControls`)

Add component-backed controls in the composer bottom row. Core owns the row layout and passes composer state/actions through `controlContext`; extensions own visible controls such as attachments, model preferences, dictation, and goal mode.

```json
{
  "id": "dictation",
  "component": "DictationButton",
  "title": "Dictation",
  "slot": "preferences",
  "when": "!streamIsStreaming",
  "priority": 100
}
```

Slots are `leading`, `preferences`, and `actions`. Controls sort by `priority` ascending, then extension id, then contribution id. The component receives `pa`, `controlContext`, and the legacy alias `buttonContext`. `controlContext.renderMode` is `inline` or `menu`; `insertText(text)` inserts at the current composer selection; `appendText(text)` inserts at the end when available; `openFilePicker()` opens the core-owned attachment input; and model/goal fields expose the current composer preference state.

### Composer Buttons (`composerButtons`)

Legacy alias for composer controls. Existing `placement: "afterModelPicker"` maps to `slot: "preferences"`; `placement: "actions"` maps to `slot: "actions"`. New extensions should use `composerControls`.

### Composer Input Tools (`composerInputTools`)

Add component-backed tools beside the attachment button in the composer input row. Use this for input-producing tools such as drawing editors or file-producing widgets, not submit-adjacent actions.

```json
{
  "id": "draw",
  "component": "DrawButton",
  "title": "Create drawing",
  "when": "!streamIsStreaming",
  "priority": 10
}
```

The component receives `pa` and `toolContext`. `toolContext.addFiles(files)` routes files through the normal composer attachment pipeline. `toolContext.upsertDrawingAttachment(payload)` adds an Excalidraw-compatible drawing payload to the composer. Excalidraw tools should import shared serialization helpers from `@neon-pilot/extensions/excalidraw` instead of duplicating preview/source generation.

### Prompt Assembly

Prompt Assembly is the single runtime surface for deciding what the agent sees before a turn starts. It inventories and explains skills, tools, prompt templates, prompt context provider blocks, and diagnostics from providers, hooks, validation, and runtime policy. The built-in Prompt Assembly page at `/prompt-assembly` is the inspection and management surface.

Use static manifest contributions first:

```json
{
  "contributes": {
    "skills": [{ "id": "agent-board", "path": "skills/agent-board/SKILL.md" }],
    "tools": [{ "id": "create-task", "description": "Create a task.", "action": "createTask" }]
  }
}
```

Use dynamic providers only when a contribution is generated, external, or conditional at runtime:

```json
{
  "contributes": {
    "skillProviders": [{ "id": "generated-skills", "handler": "listGeneratedSkills", "title": "Generated Skills" }],
    "toolProviders": [{ "id": "generated-tools", "handler": "listGeneratedTools" }],
    "promptTemplateProviders": [{ "id": "generated-prompts", "handler": "listGeneratedPrompts" }],
    "instructionProviders": [{ "id": "runtime-instructions", "handler": "listRuntimeInstructions" }]
  }
}
```

Provider handlers may return either an array or an object keyed by the contribution kind, for example `{ "skills": [...] }`, `{ "tools": [...] }`, `{ "templates": [...] }`, or `{ "layers": [...] }`. Providers are isolated: failures, timeouts, and malformed items become diagnostics and do not block the rest of assembly.

`promptAssemblyHooks` are the break-glass escape hatch for filtering or mutating the assembled plan:

```json
{
  "contributes": {
    "promptAssemblyHooks": [{ "id": "filter-runtime-context", "handler": "filterRuntimeContext", "phase": "before-injection" }]
  }
}
```

Hooks are powerful. Prefer providers. Do not silently rewrite system instructions through hooks; use instruction/context providers once available, and expose clear diagnostics for any mutation.

### Toolbar Actions (`toolbarActions`)

Add simple action-backed icon buttons in the composer toolbar row.
Action-based — no frontend entry needed.

```json
{
  "id": "open-browser",
  "title": "Open browser",
  "icon": "browser",
  "action": "openBrowserBackend",
  "when": "!streamIsStreaming",
  "priority": 10
}
```

**`when`** predicates:

- `composerHasContent` — input has text
- `streamIsStreaming` — agent is streaming
- `!streamIsStreaming` — agent is idle

### Composer Shelves (`composerShelves`)

Add sections in the scrollable area above the composer input.
Component-based — requires a frontend entry with a named component export.

```json
{
  "id": "status-shelf",
  "component": "StatusShelf",
  "title": "Status",
  "placement": "bottom"
}
```

**`placement`**: `"top"` (before built-in shelves) or `"bottom"` (after).

The component receives:

```typescript
{
  pa: NeonPilotClient;
  shelfContext: {
    conversationId: string;
    isStreaming: boolean;
    isLive: boolean;
  }
}
```

### New Conversation Panels (`newConversationPanels`)

Add panels to the new conversation empty state, below the workspace selector and above the composer. Use this for draft-only guidance or prompt preparation UI that should not live inside the composer chrome.

```json
{
  "id": "suggested-context",
  "component": "SuggestedContextPanel",
  "title": "Suggested Context",
  "priority": 100
}
```

The component receives:

```typescript
{
  pa: NeonPilotClient;
  panelContext: {
    conversationId: string;
  }
}
```

### Conversation Decorators (`conversationDecorators`)

Add badges, icons, or indicators on conversation tab items in the sidebar.
Component-based — requires a frontend entry.

```json
{
  "id": "gateway-badge",
  "component": "GatewayBadge",
  "position": "after-title",
  "priority": 10
}
```

**`position`**: `"before-title"`, `"after-title"`, or `"subtitle"` (below title).

The component receives:

```typescript
{
  pa: NeonPilotClient;
  session: SessionMeta; // conversation metadata
}
```

### Activity Tree Item Elements (`activityTreeItemElements`)

Add small component-backed elements to the shared activity tree rows used for conversations, executions, and future work items. Core owns row layout, routing, selection, and keyboard behavior; extensions only fill safe slots.

```json
{
  "id": "thread-color-dot",
  "component": "ThreadColorDot",
  "slot": "leading",
  "priority": 10
}
```

**`slot`**: `"leading"`, `"before-title"`, `"after-title"`, `"subtitle"`, or `"trailing"`.

### Activity Tree Item Styles (`activityTreeItemStyles`)

Register backend providers for data-only row styling metadata such as accent colors, backgrounds, or tooltip text. Providers are sorted by `priority`; higher priority runs first.

```json
{
  "id": "thread-color-style",
  "provider": "getThreadColorStyle",
  "priority": 10
}
```

The host will pass activity item metadata to the provider once the activity tree UI integration is enabled. Providers should return sanitized data, not arbitrary DOM or CSS ownership.

### Context Menus (`contextMenus`)

Add right-click menu items. Action-based — no frontend entry needed.

```json
{
  "id": "copy-deeplink",
  "title": "Copy Deeplink",
  "action": "copyDeeplinkHandler",
  "surface": "conversationList"
}
```

**`surface`**: `"message"` (on message blocks) or `"conversationList"` (on sidebar items).

Conversation list backend handler receives:

```typescript
{
  conversationId: string;
  sessionTitle: string;
  cwd: string;
}
```

### Thread Header Actions (`threadHeaderActions`)

Add compact component buttons beside the left sidebar conversation header. Use this for conversation-list actions such as importing a session.

```json
{
  "id": "import-session",
  "component": "ImportSessionButton",
  "title": "Import Session",
  "priority": 10
}
```

The component receives `{ pa, actionContext }`; `actionContext` includes `activeConversationId` and `cwd` when available.

### Sidebar Views (`views[].location: "sidebar"`)

Add a native extension surface that replaces the thread list area in the left sidebar while an extension nav item is active. Use this for extension-owned navigation models such as remote-agent sessions, external task lists, or project-specific explorers.

```json
{
  "views": [
    {
      "id": "sessions-sidebar",
      "title": "Hermes Sessions",
      "location": "sidebar",
      "component": "HermesSessionsSidebar"
    }
  ],
  "nav": [
    {
      "id": "hermes",
      "label": "Hermes",
      "icon": "sparkle",
      "route": "/ext/hermes",
      "sidebarView": "sessions-sidebar"
    }
  ]
}
```

The host still owns the fixed app navigation stack and bottom settings area. The sidebar view owns only the body below the nav item list, so it should render its own header, filters, empty/loading/error states, and row actions.

### Status Bar Items (`statusBarItems`)

Add labels in the status bar below the composer. Action-based — no frontend entry needed.

```json
{
  "id": "gateway-status",
  "label": "Gateway",
  "action": "openGatewayPanel",
  "alignment": "right",
  "priority": 10
}
```

**`alignment`**: `"left"` or `"right"`. **`priority`**: sort order (higher = closer to edge).
Items without an `action` are static labels. Items with an `action` are clickable.

### Composer host boundary

Composer contribution contexts expose intent methods such as `insertText(text)`, `appendText(text)`, `addFiles(files)`, and `openFilePicker()`. Extensions request these actions; the host owns composer state, attachment ingestion, selection, focus, and caret restoration.

Rules:

- Extensions must not query or mutate host DOM to affect the composer.
- Host code must not directly mutate controlled composer input values; text changes flow through React state/helpers.
- Imperative DOM is acceptable only for browser-owned UI state: focus, caret/selection, scroll, measurement, and the hidden file input reset that lets users pick the same file twice.
- If a new composer action needs state changes, add a host-owned intent method instead of passing refs or DOM handles across the extension boundary.

### Protocol entrypoints (`backend.protocolEntrypoints`)

Extensions can expose host-launched stdio protocols such as ACP. The host resolves these by protocol id and wires stdin/stdout/stderr into the backend handler.

```json
{
  "backend": {
    "entry": "dist/backend.mjs",
    "protocolEntrypoints": [
      {
        "id": "acp",
        "handler": "runAcpProtocol",
        "title": "Agent Client Protocol"
      }
    ]
  }
}
```

The handler receives `ExtensionProtocolContext`, which extends the normal backend context with:

- `protocolId`
- `stdio.stdin`
- `stdio.stdout`
- `stdio.stderr`
- `signal`

These entrypoints are intended for long-lived protocol sessions, not one-shot actions.

### Tools

Extensions can register agent-callable tools. The agent sees them as
`extension_{extensionId}_{toolId}` unless a custom `name` is given.

Tool registration is intentionally stable for the life of an agent session.
Register tools once and return a clear validation error from the handler when
the current app state does not support a call. Global `pi.setActiveTools` is
blocked by the desktop runtime; model profile extensions may use
`ctx.setActiveTools(...)` from `session_start` or `model_select` handlers to
choose a session-scoped active tool surface over already-registered tools.

The tool definition already gives the model the `description` and JSON-schema
`inputSchema`, including parameter descriptions. Keep `promptGuidelines`
high-signal: use them only for behavior the schema cannot express, such as when
not to use the tool, safety boundaries, or required follow-up behavior. One short
sentence is the default. If a workflow needs more than that, contribute an
extension skill instead of stuffing a mini manual into every prompt.

```json
{
  "id": "summarize",
  "name": "summarize_text",
  "description": "Summarize a block of text",
  "action": "summarizeHandler",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string" }
    },
    "required": ["text"]
  }
}
```

#### Overriding built-in tools

Extension tools can replace built-in tools using the `replaces` field.
When set, the tool registers under the built-in tool's name, overriding it.

```json
{
  "id": "my-bash",
  "description": "Safer bash execution with logging",
  "action": "bashHandler",
  "replaces": "bash",
  "inputSchema": {
    "type": "object",
    "properties": {
      "command": { "type": "string" }
    },
    "required": ["command"]
  }
}
```

Supported overridable tools: `bash`, `read`, `write`, `edit`, `grep`, `find`, `ls`, `notify`, `web_fetch`, `web_search`.

Use `when` to only register a tool for specific providers or models. This is the right shape for model-specific tool replacements, because unsupported models never see the replacement tool.

```json
{
  "id": "apply-patch-edit",
  "description": "Patch-based edit implementation for OpenAI models",
  "action": "applyPatchEdit",
  "replaces": "edit",
  "when": { "providers": ["openai", "openai-codex"], "models": ["gpt-5.2"] },
  "inputSchema": { "type": "object", "properties": { "patch": { "type": "string" } }, "required": ["patch"] }
}
```

`when.providers` matches provider/model refs such as `openai/gpt-5.2`; `when.models` matches either `gpt-5.2` or `openai/gpt-5.2`.

The replacement tool must accept the same input schema as the original
and return compatible output.

#### Streaming progress in tool handlers

Backend action handlers called from manifest-declared tools can stream
progress updates during execution using `ctx.toolContext?.onUpdate()`.

```typescript
export async function longRunningHandler(input: unknown, ctx: ExtensionBackendContext) {
  // Send progress updates back to the agent
  ctx.toolContext?.onUpdate?.({
    content: [{ type: 'text', text: 'Step 1 of 3 complete...' }],
  });

  const result = await doWork();

  // Final result
  return { content: [{ type: 'text', text: 'Done!' }] };
}
```

This is useful for tools that take multiple seconds to complete — the
agent sees intermediate progress instead of waiting silently.```

Actions invoked as manifest tools normally carry live-only agent context, including the abort signal and progress callback, so they stay in the host process by default. If an action only needs serializable `toolContext` fields and focused host capabilities, it may opt into worker execution with `worker: { "enabled": true, "ignoreLiveContext": true }`. Do not use this flag for actions that consume `ctx.agentToolContext`, rely on `ctx.toolContext.onUpdate`, or otherwise need live function-bearing context.

## Frontend (UI)

Your `src/frontend.tsx` exports React components referenced in the manifest. The desktop app loads the extension registry once at the app shell and shares it through context; do not add per-message or per-tool registry fetches in frontend hosts.

```tsx
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';

export function MyPanel({ pa, context }: ExtensionSurfaceProps) {
  return (
    <div>
      <button onClick={() => pa.ui.toast('Hello!')}>Test Toast</button>
    </div>
  );
}
```

The `pa` client provides:

- `pa.extension.invoke(actionId, input)` — call backend actions
- `pa.ui.toast(message, type)` — show toast notification
- `pa.ui.confirm(options)` — show confirmation dialog (`{ title?, message }`)
- `pa.ui.openModal(options)` — open a custom modal dialog (`{ title?, component, props?, size? }`). The `component` must be a named export from your extension's frontend entry. It receives `{ pa, props, close }`. Returns a promise that resolves when the modal is closed. Use `size: 'default'` or omit it for focused forms and confirmations, `size: 'large'` for resource pickers or detail editors, and `size: 'fullscreen'` for canvas/workspace tools such as drawing editors that need nearly the whole viewport.
- `pa.storage.*` — read/write extension state
- `pa.workspace.*` — workspace file operations
- `pa.browser.*` — browser control
- `pa.runs.*` — background run operations
- `pa.automations.*` — scheduled task management
- `pa.events.publish(event, payload)` — publish inter-extension events
- `pa.extensions.callAction(id, action, input)` — call another extension's action
- `pa.extensions.listActions()` — list available extension actions

See `packages/extensions/src/index.ts` for the full API.

Backend-only host APIs that should stay narrow can also be exposed through focused SDK subpaths such as `@neon-pilot/extensions/backend/artifacts`, `/automations`, `/browser`, `/compaction`, `/conversations`, `/images`, `/mcp`, `/runs`, `/runtime`, `/telemetry`, `/terminal`, and `/webContent`. Prefer a focused subpath over the broad backend barrel when bundling a system extension that only needs one backend service. Feature-specific data planes such as Knowledge should live inside their owning extension and use generic host capabilities (`ctx.storage`, `ctx.filesystem`, `ctx.shell`, `ctx.git`, events, and UI invalidation) rather than dedicated host subpaths. For daemon-backed shell work in a packaged system extension, keep the foreground path free of daemon imports and lazy-load background-run support only when the action actually starts or inspects background work.

The backend API is deliberately two-layered: public stubs under `packages/extensions/src/backend/*.ts`, and host implementations under `packages/desktop/server/extensions/backendApi/*.ts`. Extension source imports only `@neon-pilot/extensions/backend/{name}`. It must not import desktop server files, `@neon-pilot/core`, `@neon-pilot/daemon`, or agent-runtime internals directly. System extension source may use type-only Pi imports for extension hook types, but runtime value imports from Pi must go through a focused host seam. Host backend API modules should be thin adapters; lazy-load heavy desktop/runtime modules inside functions so packaged extension bundles do not accidentally drag in half the app. If a backend API wraps process-local host state and may run in the backend worker, it must use the worker capability bridge instead of importing that state directly in the worker. `pnpm run check:extensions` enforces this with `scripts/check-extension-backend-api.mjs` and packaged source/bundle checks before packaged bundle checks run.

Backend seam permission model: seams that run user-visible privileged workflows still require explicit extension permissions (`agent:run`, `agent:conversations`, etc.). Narrow host helpers such as `/compaction`, `/runtime`, and `/webContent` are trusted system-extension internals; they do not create standalone user-facing authority and should stay scoped to active hook/action context rather than growing into broad service APIs.

For model-backed extension workflows, use `@neon-pilot/extensions/backend/agent` instead of importing Pi directly. `runAgentTask` runs a host-owned one-shot hidden agent task with optional image inputs, `tools: 'none'`, and timeout cleanup; the host owns model lookup, auth storage, session creation, cancellation boundaries, and runtime policy. When `allowedToolNames` is provided, the task can execute those tool calls across multiple hidden turns; it stops early only when a tool result returns `terminate: true`. Extensions must declare `agent:run` to use this seam.

For extension-owned chat, use `createAgentConversation`, `sendAgentMessage`, `streamAgentMessage`, `getAgentConversation`, `listAgentConversations`, `abortAgentConversation`, and `disposeAgentConversation`; conversations support hidden+ephemeral private worker sessions and visible+saved host conversations that appear in the normal conversation system. Both modes are scoped to the owner extension id and require `agent:conversations`.

Use `streamAgentMessage` from a manifest-declared SSE `backend.routes` handler when an extension needs to render its own private chat UI. It returns the same shaped event stream extensions should render in chat surfaces: `user_message`, `agent_start`, `text_delta`, `thinking_delta`, tool events, `agent_end`, `turn_end`, and `error`. Visible+saved conversations should instead subscribe to the host live-session event endpoint for that conversation id; those are already first-class main-chat sessions. Frontend extensions should import `ChatView`, `ChatRailComposer`, and their props from `@neon-pilot/extensions/ui` rather than reimplementing transcript or composer chrome.

Backend extensions can record fire-and-forget app telemetry through the dedicated telemetry seam:

```ts
import { recordTelemetryEvent } from '@neon-pilot/extensions/backend/telemetry';

recordTelemetryEvent({ source: 'agent', category: 'my_extension', name: 'action_completed', durationMs: 42 });
```

Backend action handlers can also use `ctx.telemetry.record(...)`, which records the same event shape and adds the current extension id to metadata automatically.

## Main page layout

Main-route extension pages should use the shared app page primitives instead of hand-rolled widths or padding:

```tsx
<div className="h-full overflow-y-auto">
  <AppPageLayout shellClassName="max-w-[72rem]" contentClassName="space-y-10">
    <AppPageIntro title="Page title" summary="One sentence explaining what this page controls." actions={actions} />
    {/* page sections */}
  </AppPageLayout>
</div>
```

Use the same `max-w-[72rem]`, `space-y-10`, and `AppPageIntro` title/summary pattern for normal pages. Only use a wider shell for table-heavy management surfaces that genuinely need it.

## Styling guidance

Extension UIs should look native to Neon Pilot, not like embedded websites. Default to the shared primitives from `@neon-pilot/extensions/ui` and Tailwind utility classes that use app theme tokens.

```tsx
<section className="space-y-4 border-t border-border-subtle pt-6">
  <div className="flex items-baseline justify-between gap-4">
    <h2 className="text-[18px] font-semibold tracking-tight text-primary">Section title</h2>
    <span className="text-[12px] text-dim">Optional metadata</span>
  </div>
  <p className="max-w-3xl text-[13px] leading-6 text-secondary">Short explanatory copy.</p>
  <ToolbarButton>Action</ToolbarButton>
</section>
```

Guidelines:

- Use semantic theme tokens: `bg-base`, `bg-surface`, `bg-elevated`, `text-primary`, `text-secondary`, `text-dim`, `border-border-subtle`, `text-accent`, `text-success`, `text-warning`, and `text-danger`.
- Avoid hard-coded colors, custom shadows, gradients, decorative pills, and nested bordered cards. Spacing, typography, and alignment should do most of the hierarchy work.
- Keep typography consistent: page titles come from `AppPageIntro`; section titles are usually `text-[18px] font-semibold tracking-tight`; body copy is usually `text-[13px] leading-6 text-secondary`.
- Prefer shared UI from `@neon-pilot/extensions/ui` over local lookalikes. Common first choices are `ToolbarButton`/`IconButton` for actions, `EmptyState`/`LoadingState`/`ErrorState` for feedback, `AppPageEmptyState`/`AppPageSection` for page structure, `SegmentedControl` for mutually exclusive modes, `DataTableActionGroup` for row actions, `RuntimeHeaderControls` for runtime refresh/reset headers, `RailSubsection` for compact rails, `ResourcePickerDialog` for file/resource selection, and `ChatView`/`ExtensionChatRail` for chat surfaces.
- Right-rail and panel views are compact tools, not full pages. Use tighter padding, smaller type, and avoid page-scale headers there.

If a page needs a style that fights these defaults, first ask whether it should be a new shared primitive. One-off chrome is how UI entropy sneaks in wearing a fake mustache.

## Backend (Server-side)

The backend runs in the Node.js server process. It exposes actions
that the frontend can call via `pa.extension.invoke()`. A backend can also declare `onEnableAction` in `extension.json` to run an action immediately after the user enables the extension.

Desktop extension UI should use the PA client/action bridge (`pa.extension.invoke`, `pa.extensions.callAction`, or another typed `pa.*` capability) to communicate with backend code. The host backs these capabilities with the desktop HTTP data plane and WebSocket realtime plane, not Electron IPC. Extension HTTP routes are primarily integration surfaces for external or side-channel consumers: webhooks, OAuth callbacks, local protocol adapters, browser/webview callbacks, third-party tools that cannot use the typed PA SDK bridge, and long-lived streaming endpoints. If an extension UI needs backend push and no typed PA subscription exists, declare an SSE `backend.routes` entry with `stream: "sse"` and consume `/api/extensions/<extension-id>/<route-path>` with `EventSource`.

Backend extensions share the host process today, but backend module import, export lookup, and handler execution are host-owned through the `ExtensionBackendRunner` boundary. The current runner is in-process and applies the process-termination guard around imports, actions, services, subscriptions, protocol handlers, self-test smoke actions, and agent lifecycle factories. Future per-extension workers should replace this runner instead of changing product runtime callers or extension capability adapters.

The extension backend worker entrypoint currently supports wire-safe backend import/cache invalidation, export-availability checks, and narrow export execution with worker-safe context handles. The worker import runner uses a separate backend worker per extension for those operations. The worker transport also supports worker-to-host capability requests and host-to-worker capability events: a worker sends a typed capability name, operation name, and serializable input, the host returns a typed success or error response, and live host handles can publish callback events through the same worker channel. The first worker-safe backend context handles are serialized `ctx.runtime` metadata plus host-owned runtime refresh operations such as `ctx.runtime.refreshSkillMcpConfig`, `ctx.log`, `ctx.events.publish`, narrow conversation handles (`ctx.conversations.get`, `create`, `ensureLive`, `sendMessage`, `abort`, `compact`, `fork`, `setTitle`, `setActiveTools`, `appendCustomEntry`, `appendTranscriptBlock`, `updateTranscriptBlock`, `getWorkspace`, `updateWorkspace`, `rollback`, and `metadata`), extension registry reads/enablement through `ctx.extensions`, host-owned `ctx.filesystem` scoped root handles, `ctx.git`, `ctx.models.list` plus host-owned provider/model writes, `ctx.notify`, `ctx.storage`, `ctx.secrets.get`, non-streaming `ctx.shell.exec`, host-owned `ctx.shell.spawn` handles with stdout/stderr/exit callbacks, `ctx.telemetry.record`, `ctx.ui.invalidate`, and the serialized `ctx.workspace` file API. Product-critical system surfaces including artifacts, Automations scheduled-task/follow-up actions, Caffeinate process control, Codex apply-patch, conversation ask/inspect/title/cwd/deferred-resume/context-menu helpers, the worker-safe subset of the conversation tool (`inspect`, `create`, `set_title`, `change_working_directory`, `ensure_live`, `send_message`, `abort`, `compact`, `fork`, `set_active_tools`, `workspace_get`, `workspace_update`, `append_transcript_block`, `update_transcript_block`, and `rollback`), all extension manager actions, image probe agent tasks, knowledge state/sync/read/search/reference/memory/file mutation/import actions and all non-streaming Knowledge routes including binary assets, local dictation settings/model install/transcription, MCP settings/config/test/auth/logout actions and read-only tool inspection, onboarding bootstrap, prompt assembly inspection/toggles, skills inventory and enablement, telemetry aggregate reads, todos, web fetch, installable web search tools, installable local model lookup/discovery actions, installable DS4 provider/tool/runtime-control actions, Video Probe local runtime controls, Suggested Context cache warming, and background work (`system-runs`) run their declared worker-safe actions through this lane; broader backend handler execution still runs through the in-process runner until the remaining live capabilities are implemented on top of those capability handles.

Backend actions can opt into worker execution with `worker.enabled: true` when every code path they expose only needs worker-safe context handles. If only some object inputs are worker-safe, add `worker.inputActions` with the allowed string values for the input object's `action` field. Inputs outside that allowlist continue to run through the in-process runner.

Backend routes can opt into worker execution with `worker.enabled: true` when the route is non-streaming and only needs serializable request fields plus worker-safe context handles. The worker receives `method`, `path`, `query`, `params`, and `body`; live abort signals and SSE event streams stay on the in-process runner for now.

Host implementation code should not call extension backend handlers under one-off process guards. Add the needed operation to the runner boundary, then call it from the host-facing orchestrator. If guarded extension code calls `process.exit(...)`, `process.abort()`, or `process.kill(process.pid, ...)`, the call is blocked, surfaced as an extension health error, and runtime action paths disable the extension to prevent startup boot loops.

Repeated backend infrastructure failures trip a circuit breaker: three failures in ten minutes disables the extension and adds an Extension Manager diagnostic. This covers backend load/import failures, health checks, service startup, and similar host-level failures; normal action handler errors are returned to the caller and do not quarantine the extension. Startup also has a safe-mode marker. If the previous launch did not finish extension backend health checks, startup actions, service startup, and subscription installation, the next launch disables the active runtime/user extension when the marker identifies one. If the marker does not identify an active extension, safe mode reports the stale marker without disabling extensions. Re-enabling an extension clears its quarantine entry and any stale startup marker so the recovery action does not immediately retrigger safe mode.

```typescript
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export async function ping(_input: unknown, ctx: ExtensionBackendContext) {
  ctx.log.info('ping received');
  return { ok: true, at: new Date().toISOString() };
}
```

### Settings

Extensions can declare user-facing settings in their manifest. These appear
in the Settings UI (under "Extensions") grouped by the `group` field — no
React code required for basic types.

```json
{
  "contributes": {
    "settings": {
      "myExt.timeout": {
        "type": "number",
        "default": 30,
        "description": "Timeout in seconds",
        "group": "My Extension",
        "order": 1
      },
      "myExt.featureEnabled": {
        "type": "boolean",
        "default": true,
        "description": "Enable the new feature",
        "group": "My Extension",
        "order": 2
      },
      "myExt.mode": {
        "type": "select",
        "default": "auto",
        "enum": ["auto", "manual", "off"],
        "description": "Operation mode",
        "group": "My Extension",
        "order": 3
      }
    }
  }
}
```

Each setting key is a dot-separated path (e.g. `myExt.timeout`).
The Settings UI renders the appropriate control based on `type`:

| Type      | Control      |
| --------- | ------------ |
| `string`  | Text input   |
| `boolean` | Checkbox     |
| `number`  | Number input |
| `select`  | Dropdown     |

All settings are stored in a single `<stateRoot>/settings.json` file.

| Property      | Description                                   | Required   |
| ------------- | --------------------------------------------- | ---------- |
| `type`        | `string`, `boolean`, `number`, or `select`    | Yes        |
| `default`     | Default value                                 | No         |
| `description` | Shown next to the field in the Settings UI    | No         |
| `group`       | Groups settings together. Default `"General"` | No         |
| `enum`        | Allowed values for `select` type              | For select |
| `placeholder` | Placeholder text for string inputs            | No         |
| `order`       | Sort order within group. Default 0.           | No         |

Backend extensions that need manifest-declared settings should import the
settings backend API instead of reaching into desktop internals:

```ts
import { readExtensionSettings } from '@neon-pilot/extensions/backend/settings';

const settings = await readExtensionSettings();
const enabled = settings['myExt.featureEnabled'] === true;
```

#### Settings vs Extension Storage

Extensions have two storage mechanisms for different purposes:

| Mechanism    | Location                                               | Purpose                                            |
| ------------ | ------------------------------------------------------ | -------------------------------------------------- |
| **Settings** | `<stateRoot>/settings.json` (shared)                   | User-facing non-secret config declared in manifest |
| **Storage**  | SQLite-backed, per-extension                           | Internal runtime state (caches, session)           |
| **Database** | `<stateRoot>/extension-data/{id}/databases/`           | Extension-owned relational data and indexes        |
| **Files**    | `<stateRoot>/extension-data/{id}/files/` and `/cache/` | Extension-owned blobs, exports, and caches         |

- Use **settings** for non-secret values the user configures through the Settings UI.
- Use **storage** (`ctx.storage` / `pa.storage`) for internal state like
  cached API responses, session tokens, or counter values.
- Use **database** (`ctx.database`) for extension-owned SQLite tables,
  migrations, indexes, queues, and query-heavy state.
- Use the [Filesystem Authority](filesystem-authority.md) for extension-owned files/blobs, workspace files, temp workspaces, artifacts, and any path addressed by a user, agent, archive, or external protocol.
- Settings are discoverable (all extensions contribute to a unified schema);
  storage is private to each extension.

### Backend Context (`ctx`)

The `ExtensionBackendContext` provides:

| Property            | Purpose                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `ctx.storage`       | Persistent key-value store per extension (SQLite-backed)                                                |
| `ctx.database`      | Extension-owned SQLite databases with optional versioned migrations                                     |
| `ctx.attention`     | Enqueue/list/cancel async conversation attention events (wakeups, callbacks)                            |
| `ctx.automations`   | Scheduled task management                                                                               |
| `ctx.runs`          | Background run management                                                                               |
| `ctx.conversations` | Conversation read/write operations                                                                      |
| `ctx.filesystem`    | Scoped filesystem authority for workspace, extension file storage, temp, artifact, and other host roots |
| `ctx.workspace`     | Workspace file operations (read, write, list); convenience wrapper over the filesystem authority        |
| `ctx.knowledge`     | Knowledge base operations                                                                               |
| `ctx.git`           | Git status, diff, log                                                                                   |
| `ctx.shell`         | Shell command execution                                                                                 |
| `ctx.notify`        | Toast, system notifications, badge (see below)                                                          |
| `ctx.events`        | Inter-extension event pub/sub                                                                           |
| `ctx.extensions`    | Call actions on other extensions                                                                        |
| `ctx.ui`            | Invalidate UI state topics                                                                              |
| `ctx.log`           | Structured logging                                                                                      |

## Attention events

Use `ctx.attention` when an extension has async work that should resume or notify a conversation later. Extensions submit intent; core owns batching, ordering, retries, and delivery.

```typescript
await ctx.attention.enqueue({
  prompt: 'The import finished. Summarize the result for the user.',
  title: 'Import finished',
  delivery: { mode: 'batchable', priority: 'normal' },
});
```

Delivery modes:

- `batchable` — combine with other ready wakeups when possible.
- `sequential` — preserve order as a distinct follow-up.
- `isolated` — do not batch; use for approvals/ack-required events.

`ctx.attention.enqueue` uses the active conversation session when called from a tool/action context. Outside an active conversation, pass `sessionFile` and optionally `conversationId`.

**Permissions:** `attention:write` for `enqueue`/`cancel`, `attention:read` for `list`.

## Conversation Write API

The `conversations` object in the backend context now supports
write operations in addition to reads.

```typescript
// Send a message into a live conversation
await ctx.conversations.sendMessage(
  conversationId,
  'Your message here',
  { steer: true }, // or { steer: false } for followUp
);

// Update the conversation title
await ctx.conversations.setTitle(conversationId, 'New Title');

// Trigger compaction
await ctx.conversations.compact(conversationId);

// Read operations (pre-existing)
await ctx.conversations.list();
await ctx.conversations.getMeta(conversationId);
await ctx.conversations.get(conversationId, { tailBlocks: 20 });
await ctx.conversations.searchIndex(sessionIds);
```

**Permission required:** `conversations:readwrite` for write operations.

The `conversations` capability also exposes first-class lifecycle helpers:

```typescript
const created = await ctx.conversations.create({ title: 'Research thread', cwd, initialPrompt: 'Start here' });
const forked = await ctx.conversations.fork({ conversationId, title: 'Bug bash branch' });
```

`ctx.conversations.create(...)` accepts `allowedToolNames` for extension-created sessions that need a runtime-enforced tool allowlist:

```typescript
await ctx.conversations.create({
  title: 'Web-only research',
  allowedToolNames: ['web_search', 'web_fetch'],
});
```

Use this for purpose-built conversations that must not receive the default local tool surface. The runtime applies the allowlist when the live session is created; do not rely on prompt instructions alone for tool restrictions.

**Limitations:**

- Most mutating operations still require the source conversation to be live (in-memory).

## Selection actions, transcript blocks, services, and subscriptions

Extensions can declare selection-aware actions for selected text, files, messages, or transcript ranges. Selection actions can include compact `icon` labels and static `args`; transcript selection menus merge those args with the active selection for composer actions such as `composer.replyToSelection`. The frontend SDK exposes `pa.selection.get()`, `pa.selection.set(...)`, and `pa.selection.subscribe(...)`; hosts and extensions publish the current selection through the same shared model.

```json
{
  "contributes": {
    "selectionActions": [
      {
        "id": "reply-agree",
        "title": "Agree / proceed",
        "action": "composer.replyToSelection",
        "kinds": ["text", "transcriptRange"],
        "icon": "👍",
        "args": { "draftText": "👍 Agree" }
      }
    ]
  }
}
```

Extensions can declare custom durable transcript block renderers and write extension-authored blocks from backend code. Blocks get stable `extensionBlockId` metadata; updates mutate the live transcript block and fail if the block id is not found.

```json
{
  "contributes": {
    "transcriptBlocks": [{ "id": "approval", "component": "ApprovalBlock", "schemaVersion": 1 }]
  }
}
```

```typescript
await ctx.conversations.appendTranscriptBlock({ conversationId, blockType: 'approval', data: { status: 'pending' } });
await ctx.conversations.updateTranscriptBlock({ conversationId, blockId, blockType: 'approval', data: { status: 'approved' } });
```

Frontend extension components can mark and spotlight transcript targets without depending on host DOM internals. Use `pa.transcript.targetProps(...)` on the element that should receive focus, and `pa.transcript.spotlight(...)` to scroll it into view and flash a temporary border.

```tsx
function ApprovalBlock({ pa, approvalId }) {
  const target = { kind: 'extension', extensionId: 'my-extension', targetId: approvalId };
  return (
    <button {...pa.transcript.targetProps(target)} onClick={() => pa.transcript.spotlight(target)}>
      Review approval
    </button>
  );
}
```

Supported spotlight targets are `block`, `tool_call`, `background_run`, and `extension`.

Long-lived backend services are declared under `backend.services` so the host can own lifecycle, health, and restart policy. Enabled extension services are started during extension startup; a service handler may return a stop function that the host calls on shutdown, disable, reload, or restart. Extension Manager shows declared services plus live runtime state (`running`, `stopped`, start time) from the host.

```json
{
  "backend": {
    "entry": "dist/backend.mjs",
    "services": [{ "id": "sync", "handler": "startSync", "healthCheck": "checkSync", "restart": "on-failure" }],
    "onDisableAction": "stopSync",
    "onUninstallAction": "cleanup"
  }
}
```

Event subscriptions are declared under `contributes.subscriptions` for host-owned event sources such as workspace files, knowledge files, settings, conversations, routes, and selection changes. The host dispatches these through the extension event bus as `host:{source}` events; `pattern` narrows the event name. Current built-in producers include `host:workspaceFiles` for workspace writes/deletes/renames/moves, `host:settings` for settings updates, frontend `host:selection` notifications when shared selection changes, and `host:conversation:*` lifecycle events for live transcript/stream state.

```json
{
  "contributes": {
    "subscriptions": [{ "id": "watch-notes", "source": "knowledgeFiles", "pattern": "notes/**", "handler": "onKnowledgeChange" }]
  }
}
```

Secrets are public manifest API, not an internal convention:

```json
{
  "contributes": {
    "secrets": {
      "apiKey": { "label": "API key", "env": "MY_EXTENSION_API_KEY" }
    }
  },
  "permissions": ["secrets:read"]
}
```

Resolve them in backend code with `ctx.secrets.get('apiKey')`. Stored values take precedence; environment variables declared by the extension are used as a fallback when no stored value exists. Do not store API keys, bearer tokens, refresh tokens, bot tokens, or other reusable credentials in extension settings, `ctx.storage`, cache JSON, or extension-owned config files; keep those stores for non-secret preferences and state.

Extensions can declare dependencies on other extensions:

```json
{
  "dependsOn": ["system-knowledge", { "id": "agent-board", "optional": true, "version": "^1.0.0" }]
}
```

Missing required dependencies are surfaced in Extension Manager diagnostics and block enabling the dependent extension. Optional dependencies are documentation/discovery contracts and should be checked with `pa.extensions.getStatus(...)` or `ctx.extensions.getStatus(...)` before use.

## Inter-extension Communication

Extensions can communicate with each other through a shared event bus
and by calling each other's actions.

### Event Bus

Publish events that other extensions subscribe to:

```typescript
// In extension A — backend.ts
await ctx.events.publish({
  event: 'task:completed',
  payload: { taskId: '123', result: 'success' },
});
```

Subscribe to events from other extensions:

```typescript
// In extension B — backend.ts
const sub = ctx.events.subscribe('task:*', async (event) => {
  console.log(`Received ${event.event} from ${event.sourceExtensionId}`);
  // event.payload, event.publishedAt
});

// Later, to unsubscribe:
sub.unsubscribe();
```

**Pattern syntax:**

- `"*"` — matches all events
- `"task:*"` — matches `task:completed`, `task:failed`, etc.
- `"task:completed"` — exact match only

### Cross-extension Action Calls

Call an action exposed by another extension:

```typescript
const result = await ctx.extensions.callAction('other-extension', 'someAction', { key: 'value' });
```

List available extension actions:

```typescript
const actions = await ctx.extensions.listActions();
// Returns: [{ extensionId, extensionName, actions: [{ id, title, description }] }]
```

## Notifications and Badge

Extensions can send notifications and set dock badges:

```typescript
// In-app toast
ctx.notify.toast('Hello!', 'info'); // "info" | "warning" | "error"

// System notification (macOS notification centre)
ctx.notify.system({
  title: 'Task Complete',
  message: 'Your background task finished.',
  subtitle: 'Optional subtitle',
  persistent: true, // stays until acknowledged
});

// Dock badge count (accumulated across all extensions)
ctx.notify.setBadge(5); // Set badge to 5
ctx.notify.clearBadge(); // Clear this extension's badge

// Check if system notifications are available
const available = ctx.notify.isSystemAvailable();
```

## Permissions

Extensions must declare the permissions they need. The system currently
enforces permissions for storage and conversation operations.

```json
{
  "permissions": [
    "storage:read",
    "storage:write",
    "storage:readwrite",
    "attention:read",
    "attention:write",
    "conversations:read",
    "conversations:readwrite",
    "knowledge:read",
    "knowledge:write",
    "knowledge:readwrite",
    "runs:read",
    "runs:start",
    "runs:cancel",
    "ui:notify"
  ]
}
```

Custom permissions are also supported: `"${string}:${string}"`.

## Agent Lifecycle Hooks

Desktop manifest extensions can hook into the agent's lifecycle by
exporting an `ExtensionFactory` function via the `backend.agentExtension` field.

```typescript
// backend.ts — exported as the value referenced by agentExtension
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function (pi: ExtensionAPI) {
  // Subscribe to agent lifecycle events
  pi.on('before_agent_start', async (event, ctx) => {
    // Modify the system prompt before each turn
    return {
      systemPrompt: event.systemPrompt + '\nExtra instructions for this turn...',
    };
  });

  pi.on('tool_call', async (event, ctx) => {
    // Block or modify tool calls
    if (event.toolName === 'bash' && event.input.command?.includes('rm -rf')) {
      return { block: true, reason: 'Dangerous command blocked by extension' };
    }
  });

  pi.on('tool_result', async (event, ctx) => {
    // Post-process results
    if (event.toolName === 'read') {
      return { content: [{ type: 'text', text: event.content + '\n— End of file' }] };
    }
  });

  pi.on('session_start', async (event, ctx) => {
    ctx.ui.notify(`Session started: ${event.reason}`, 'info');
  });

  // Register custom tools
  pi.registerTool({
    name: 'my_tool',
    label: 'My Tool',
    description: 'A custom tool',
    parameters: { type: 'object', properties: {} },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return { content: [{ type: 'text', text: 'Done!' }] };
    },
  });

  // Override a built-in tool
  pi.registerTool({
    name: 'bash', // Same name as built-in → replaces it
    label: 'Safe Bash',
    description: 'Bash with guardrails',
    parameters: { type: 'object', properties: { command: { type: 'string' } } },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Custom implementation
      return { content: [{ type: 'text', text: params.command }] };
    },
  });
}
```

Then in your manifest:

```json
{
  "backend": {
    "entry": "src/backend.ts",
    "agentExtension": "default"
  }
}
```

The `agentExtension` field names the exported function that receives
the `ExtensionAPI`. If set to `"default"`, the default export is used.

**All pi-coding-agent events are available:**

| Event                      | When                                | Use Case                             |
| -------------------------- | ----------------------------------- | ------------------------------------ |
| `before_agent_start`       | Before the agent processes a prompt | Inject context, modify system prompt |
| `input`                    | User input received                 | Intercept or transform input         |
| `context`                  | Before LLM call                     | Modify messages                      |
| `tool_call`                | Before tool execution               | Block/modify tool calls              |
| `tool_result`              | After tool execution                | Post-process results                 |
| `session_start`            | Session loaded                      | Initialize state                     |
| `session_shutdown`         | Session ending                      | Clean up resources                   |
| `session_before_compact`   | Before compaction                   | Customize compaction                 |
| `message_start/update/end` | Message lifecycle                   | Custom rendering                     |
| `turn_start/end`           | Turn lifecycle                      | Track progress                       |
| `agent_start/end`          | Agent cycle lifecycle               | Track agent activity                 |

For the full list of Pi lifecycle events and signatures, inspect the installed
`@earendil-works/pi-coding-agent` package docs that match the pinned dependency version.

## Development Workflow

### Building

Extensions need to be built before they can be loaded:

```bash
# From the repo for a local extension directory:
pnpm run extension:build -- /path/to/my-extension
```

Frontend builds bundle the authoring SDK UI modules (`@neon-pilot/extensions/ui`, `/host`, `/workbench`, `/data`, and `/settings`) into `dist/frontend.js`. The desktop host serves that built file as an extension bundle resource, so frontend dist output must not leave `@neon-pilot/extensions/*` as bare runtime imports.

### Hot Reload

After changing backend code, use Extension Manager's **Reload** button or restart the app. The frontend is re-evaluated on page load.

### Testing Integration

Run the extension integration smoke tests to catch cross-extension issues
before starting the app (manifest validation, route conflicts, missing
backend/frontend entries, handler export mismatches, and packaged-runtime
backend import failures):

```bash
# Run the full extension gate: static extension checks plus focused extension smoke tests
pnpm run check:extensions

# Run only the focused extension smoke tests
pnpm run test:extensions

# Or include in the full test suite
pnpm test
```

`pnpm run check:extensions` first runs
`scripts/check-extension-backend-api.mjs` to keep the SDK backend subpath list and
host backend API implementation list in lockstep, and to block backend API seams
from statically importing known heavy/runtime internals. It also runs
`scripts/check-filesystem-authority.mjs` and `scripts/check-packaged-extensions.mjs`. That packaged check imports every bundled system
extension backend from its built `dist` output, verifies backend
action handler exports, smoke-calls known safe tool surfaces such as `scheduled_task`, and runs product-critical smoke calls for Knowledge,
Automations, and Diffs extension actions. It fails on forbidden bare imports
that are not available inside the packaged desktop app, such as
`@earendil-works/pi-coding-agent`, `@neon-pilot/core`,
`@neon-pilot/daemon`, `jsdom`, and `@sinclair/typebox`. It also rejects
absolute or `file:` imports, forbidden bundled runtime path fragments, and backend
bundles over their explicit byte budget. The packaged-extension hardening knobs
live in `scripts/extension-hardening-config.mjs`, so smoke inputs and size budgets
are explicit instead of being buried in the checker. This catches release-temp
paths, accidental daemon bundling, runaway backend API seams, and the “works from
repo node_modules, breaks in the signed app” class of extension bug before
release.

The desktop server also runs an enabled-extension backend health check on startup.
Failures are logged, surfaced as extension diagnostics, and shown by Extension
Manager instead of silently making tools or actions disappear. System extension
diagnostics are release blockers: the integration smoke suite fails when a system
extension has registry errors, diagnostics, stale `dist/` output, missing exports,
forbidden imports, or backend import crashes. Extension builds write
`dist/build-manifest.json` with output files, byte sizes, and remaining external
imports. Use Extension Manager UI actions for local
extension authoring: list, create, snapshot, build, validate, and reload. Run
validate after each build to check manifest references, dist files, stale output,
frontend/backend exports, tool schemas, skill files, forbidden process imports,
non-portable bundled imports, and backend import crashes for one extension. The
release publisher reruns the packaged-extension check against the built `.app`
before notarization/upload.

The integration suite covers these categories:

| Category                  | What it validates                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest structure        | JSON parses, schemaVersion, version field, required fields, permissions format, routes, startup action validity, backend/no-backend consistency           |
| Tool schema               | `inputSchema` has `type:object` + `properties`, `replaces` targets valid built-ins                                                                        |
| Action references         | All `action` fields in context menus, commands, toolbar actions, nav badge actions reference known backend handlers or valid system patterns              |
| Settings/Secrets          | Setting type/default consistency, select enum values, dot-separated key format, secret env var format                                                     |
| Frontend components       | Every component field in views/buttons/shelves/panels exists in the frontend bundle                                                                       |
| Cross-extension conflicts | Duplicate IDs, routes, tool names, commands, keybindings, settings, secrets, env variables, mention ids, prompt reference/context provider/quick open ids |
| Registry sanity           | All bundled system extensions registered, routes point to real extensions                                                                                 |
| Backend files             | `dist/backend.mjs` exists, source files present, handler names match                                                                                      |
| Frontend files            | `dist/frontend.js` exists, style files present                                                                                                            |
| Agent extensions          | Registration listing, export names, backend entry references                                                                                              |
| Skills                    | File existence, valid Agent Skills frontmatter                                                                                                            |
| Summary report            | Printed overview with counts across 21 registration categories                                                                                            |

### Debugging

- Backend logs appear in the server console with `[extension:my-ext]` prefix.
- Frontend errors appear in the web console.
- Use `ctx.log.info/warn/error()` for structured logging.
- Check the extension manager UI for diagnostics.

### State

Extensions get persistent key-value storage:

```typescript
// Write
await ctx.storage.put('my-key', { count: 42 });

// Read
const data = await ctx.storage.get('my-key');

// List
const items = await ctx.storage.list('prefix-');

// Delete
await ctx.storage.delete('my-key');
```

State is SQLite-backed and survives app restarts.

For relational state, use app-owned SQLite databases:

```typescript
const db = await ctx.database.open('main', {
  migrations: [
    {
      version: 1,
      description: 'create tasks',
      up: (database) => database.exec('CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)'),
    },
  ],
});

db.prepare('INSERT INTO tasks (id, title) VALUES (?, ?)').run('task-1', 'Build the thing');
```

For extension-owned files, use durable app files, disposable cache files, or temp workspaces:

```typescript
const appFiles = await ctx.filesystem.app();
await appFiles.writeText('exports/report.md', markdown);

const cacheFiles = await ctx.filesystem.cache();
await cacheFiles.writeJson('remote-index.json', index);
```

## Examples

See bundled system extensions in `extensions/` and optional first-party extensions in [`patleeman/neon-pilot-extensions`](https://github.com/patleeman/neon-pilot-extensions) for practical examples:

- **`system-artifacts`** — Tools + views + transcript renderer + skills
- **`system-agent-browser`** — agent-browser CLI tool integration (`patleeman/neon-pilot-extensions/system-agent-browser`)
- **`system-browser`** — Experimental browser automation tool + views (`patleeman/neon-pilot-extensions/system-browser`)
- **`system-writing-studio`** — Document-first writing surface with hosted chat, file tree sidebar, and structured annotation tools (`patleeman/neon-pilot-extensions/system-writing-studio`)
- **`system-automations`** — Scheduled tasks, follow-up queues, and the Automations page
- **`system-conversation-tools`** — Agent lifecycle hooks + contextMenus
- **`system-extension-manager`** — Extension management UI + nav
- **`system-runs`** — Background runs + composer shelf (ActivityShelf)
- **`system-settings`** — Settings panels + nav

Each extension has a complete `extension.json` manifest and
`src/backend.ts` + optionally `src/frontend.tsx`.

Bundled system extensions keep source next to their built output for development. Backend `dist/` output is authoritative by default in both dev and packaged runtimes: if `backend.entry` points at source (`src/backend.ts`), normal app startup loads sibling `dist/backend.mjs`; source recompilation is reserved for explicit extension-authoring mode (`NEON_PILOT_EXTENSION_AUTHORING=1`). If `backend.entry` already points at built output such as `dist/backend.mjs`, both dev and packaged builds load that file directly. System extension frontends are bundled into the desktop renderer from source so they share the app's React singleton; their `dist/frontend.js` bundles are still built and validated as release artifacts.

Optional extension repo packages are not bundled or auto-loaded. Users install released optional extensions from **Settings → Extensions → Install**, which downloads `.neon-extension.zip` artifacts from GitHub releases. After install, check the unified list in Settings → Extensions to enable and inspect the extension. For local development, build with `pnpm run extension:build -- <extension-dir>`, validate with `neon-pilot-extension doctor <extension-dir>`, and import the resulting zip or copy the built package into runtime state.
