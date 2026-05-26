# Desktop App

The Electron desktop app is the primary Neon Pilot operator UI. It hosts the React renderer, manages the local daemon lifecycle, and provides the full feature surface.

## Starting

```bash
# Stable production build
pnpm run desktop:start

# Development mode with hot reload
pnpm run desktop:dev

# Demo mode with seeded data
pnpm run desktop:demo
```

Both `desktop:start` and `desktop:dev` build the Electron shell and launch it through `packages/desktop/scripts/launch-dev-app.mjs`.

For packaged builds, launch `Neon Pilot.app` from the output directory. RC builds launch as `Neon Pilot RC.app` so they can coexist with the stable app.

## Runtime Model

```
Electron main process
    │
    ├── Renderer (React) ── neon-pilot://app/
    │       │
    │       ├── Conversation routes
    │       ├── Knowledge
    │       ├── Automations
    │       └── Settings
    │
    ├── Backend child process
    │       │
    │       ├── Local API
    │       ├── Session parsing and search
    │       ├── Git/checkpoint operations
    │       ├── Vault and knowledge-base reads/writes
    │       ├── Extension backend host
    │       └── Daemon runtime
    │             │
    │       ├── Scheduled tasks
    │       ├── Wakeups
    │       └── Follow-up queue
```

- Electron owns the UI surface through the `neon-pilot://app/` protocol
- Keep the startup path tiny: the main-process hot bundle should only create the window, register protocol/IPC, and schedule deferred work
- Freeze-prone local API work runs in the backend child process; do not import or execute heavy desktop server capabilities directly on the Electron main thread
- Avoid `spawnSync`/`execSync` in desktop main-process flows
- The daemon owns durable background behavior inside the backend child and starts after the renderer has had a chance to paint; user actions that need it can force-start it immediately
- The desktop app loads initial readonly snapshots first, then connects to server-pushed events for conversations, executions, automations, and daemon status after startup settles

## Layout Modes

| Mode         | Shortcut | Description                          |
| ------------ | -------- | ------------------------------------ |
| Conversation | `F1`     | Single-pane layout with left sidebar |
| Workbench    | `F2`     | Multi-pane layout with side rails    |

Toggle the left sidebar with `Cmd+/` (or `Ctrl+/`). Toggle the right rail with `Cmd+\` (or `Ctrl+\`).

## Workbench Rails

In Workbench mode, the right rail nav tabs include:

| Tab           | Description                   |
| ------------- | ----------------------------- |
| File Explorer | Project file tree browser     |
| Artifacts     | Rendered HTML, Mermaid, LaTeX |
| Browser       | Embedded webview              |

Knowledge is a primary left-sidebar page (not a workbench tab). Extension-contributed tool panels also appear in the nav. Tabs are context-sensitive — Artifacts appear when the conversation has rendered artifacts. Checkpoint diffs and background work render inline in the transcript. Heavy workbench panels are lazy-loaded so they do not inflate the initial renderer bundle.

## Keyboard Shortcuts

All desktop shortcuts are configurable in Settings → Keyboard. Defaults:

| Action            | Default               |
| ----------------- | --------------------- |
| New conversation  | `Cmd+N`               |
| Conversation mode | `F1`                  |
| Workbench mode    | `F2`                  |
| Toggle sidebar    | `Cmd+/` (or `Ctrl+/`) |
| Toggle right rail | `Cmd+\` (or `Ctrl+\`) |
| Settings          | `Cmd+,`               |

## Routes

| Route                | Page                  |
| -------------------- | --------------------- |
| `/conversations`     | Conversation list     |
| `/conversations/new` | New conversation      |
| `/conversations/:id` | Existing conversation |
| `/knowledge`         | Knowledge browser     |
| `/automations`       | Automation list       |
| `/automations/:id`   | Automation detail     |
| `/settings`          | Settings panel        |
| `/telemetry`         | Telemetry traces page |
| `/gateways`          | Gateway connections   |

## Demo Mode

`pnpm run desktop:demo` creates an isolated temporary state root with seeded conversations, automations, executions, and assets for UI development and testing. Seeded content includes conversations with artifacts, checkpoints, reminders, subagent demos, and pathological fixtures.
