# Desktop App

The Tauri desktop app is the primary Neon Pilot operator UI. It hosts the React renderer, supervises the JS sidecar, and keeps host-owned authority in Rust.

## Starting

```bash
pnpm run desktop:start
pnpm run desktop:dev
pnpm run desktop:demo
```

`desktop:start` and `desktop:dev` now use the Tauri shell in `packages/tauri/desktop-shell`. The `packages/desktop` package remains the renderer/server/sidecar asset package, not the native app shell.

Tauri dev loads the renderer from `http://127.0.0.1:5173`. The desktop dev UI launcher reuses an already-running Vite server on that port, so rerunning `pnpm run desktop:dev` does not fail when a previous renderer server is still active.

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
    │       ├── embedded Workbench Browser webviews
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

- Tauri owns the app shell, close/reopen/quit behavior, native menus, window state, and native commands.
- Rust host core owns durable host-authority boundaries.
- The JS sidecar remains for product API compatibility, daemon/runtime behavior, and JS extension execution.
- New host-authority APIs should be added to Rust host core and exposed to the sidecar through host-core RPC.
- The renderer uses Tauri-dispatched HTTP product APIs, sidecar-hosted realtime WebSockets, and the Tauri desktop bridge for native OS operations.

## Layout

| State          | Shortcut | Description                          |
| -------------- | -------- | ------------------------------------ |
| Workbench off  | `F1`     | Single-pane layout with left sidebar |
| Workbench open | `F2`     | Conversation plus tabbed workbench   |

Toggle the left sidebar with `Cmd+/` (or `Ctrl+/`). Toggle the workbench with `Cmd+\` (or `Ctrl+\`).

## Workbench Browser

The Browser workbench tab is backed by Tauri child webviews owned by the Rust shell. The renderer reports the browser host bounds through the Tauri desktop bridge; Rust creates one child webview per browser tab session key, shows/hides it with the workbench tab, and keeps URL/title/loading state synchronized back to the React UI.

The JS sidecar receives a localhost Workbench Browser bridge from Tauri so browser agent tools can resolve active tabs, text snapshots, and screenshots from the same embedded browser session. Raw Chromium CDP command execution is not available in the Tauri WKWebView bridge; browser UI, navigation, tab state, text snapshots, and screenshot capture no longer depend on Electron.
