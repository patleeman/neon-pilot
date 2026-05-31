# Desktop App

The Tauri desktop app is the primary Neon Pilot operator UI. It hosts the React renderer, supervises the JS sidecar, and keeps host-owned authority in Rust.

## Starting

```bash
pnpm run desktop:start
pnpm run desktop:dev
pnpm run desktop:demo
```

`desktop:start` and `desktop:dev` now use the Tauri shell in `packages/tauri/desktop-shell`. The `packages/desktop` package remains the renderer/server/sidecar asset package, not the native app shell.

For packaged builds, launch `Neon Pilot.app` from `dist/release/mac-arm64`.

## Runtime Model

```text
Tauri Rust shell
    │
    ├── React renderer
    │       ├── Conversation routes
    │       ├── Knowledge
    │       ├── Automations
    │       └── Settings
    │
    ├── Rust host core
    │       ├── native app/window lifecycle
    │       ├── app preferences and native OS commands
    │       ├── scoped filesystem, SQLite, secrets, and extension package lifecycle
    │       ├── process execution authority
    │       └── host-core RPC for sidecar authority calls
    │
    └── JS sidecar
            ├── Local API
            ├── Extension backend host
            ├── Daemon runtime
            └── Agent/runtime behavior not yet moved to Rust
```

- Tauri owns the app shell and native commands.
- Rust host core owns durable host-authority boundaries.
- The JS sidecar remains for product API compatibility, daemon/runtime behavior, and JS extension execution.
- New host-authority APIs should be added to Rust host core and exposed to the sidecar through host-core RPC.
- The renderer uses HTTP/realtime product APIs and the Tauri desktop bridge for native OS operations.

## Layout

| State          | Shortcut | Description                          |
| -------------- | -------- | ------------------------------------ |
| Workbench off  | `F1`     | Single-pane layout with left sidebar |
| Workbench open | `F2`     | Conversation plus tabbed workbench   |

Toggle the left sidebar with `Cmd+/` (or `Ctrl+/`). Toggle the workbench with `Cmd+\` (or `Ctrl+\`).

## Workbench Browser

The old native embedded browser surface is no longer part of the production desktop shell. The Tauri app fails closed for that surface until a Tauri-native webview strategy is chosen. Browser automation and external browser integrations should remain extension-owned capabilities.
