# Tauri/Rust Core

This document describes the production desktop host architecture. Neon Pilot's desktop app is a Tauri shell with Rust-owned host authority and a supervised JS sidecar for the existing local API, agent runtime, and JS extension backend execution.

## Architecture

```text
Tauri shell
  └─ Rust host core
       ├─ native app/window lifecycle
       ├─ process supervision
       ├─ host-owned authority boundaries: app preferences, extension package validation/install
       ├─ scoped filesystem and SQLite migration primitives
       ├─ file-backed secret persistence
       ├─ host-core RPC server for JS sidecar authority calls
       └─ JS sidecar boundary
            ├─ existing desktop local API server
            ├─ agent/prompt/runtime behavior
            └─ JS/TS extension backend execution through Rust-owned host authority
```

Rust owns stable authority and lifecycle boundaries. JS/TS remains the extension and agent-behavior runtime behind public extension contracts until those contracts are moved deliberately.

## Current Implementation

- `packages/tauri/host-core` is the Rust host-owned runtime primitive library.
- `packages/tauri/desktop-shell/src-tauri` is the production Tauri shell.
- `packages/desktop` contains the React renderer, bundled server assets, and JS sidecar entry points consumed by Tauri.
- Host-core owns JS sidecar supervision, repo/state-root path resolution, Tauri desktop app preferences, extension package validation/install/import, scoped filesystem operations, SQLite migrations, process execution authority, and file-backed secret storage.
- The Tauri shell owns native bridge commands for environment, navigation state, opening paths/URLs, clipboard writes, folder picking, app preferences, update status, extension package validation/install/import, scoped filesystem operations, SQLite migrations, secret access, and product API dispatch.
- The React API client detects Tauri and sends product API requests through the Rust `dispatch_local_api` command, which forwards to the supervised JS sidecar.
- The React desktop bridge detects Tauri and maps desktop-native calls to Tauri commands. Tauri-only host-core primitives are available under `bridge.hostCore`.
- Before launching the JS sidecar, Tauri starts a localhost Rust host-core RPC server and passes `NEON_PILOT_TAURI_HOST_CORE_PORT` plus `NEON_PILOT_TAURI_HOST_CORE_TOKEN` into the sidecar environment.
- The JS sidecar reports `hostCore: "tauri-rust"` from `/health` when the Rust host-core RPC bridge is available.
- Extension shell `exec` and non-PTY `spawn` route through the Rust host-core RPC bridge under Tauri. PTY-backed shell sessions remain JS/node-pty until a Rust PTY boundary is implemented.
- The old native embedded browser surface is not part of the production shell. The Tauri app fails closed for that capability until a Tauri-native webview strategy is chosen.

## Commands

Use Node 22 for desktop development. The repo's current native dependency set installs cleanly with Node 22; newer Node majors can require native dependency upgrades.

```bash
pnpm run build:ts
pnpm --dir packages/desktop run build:deps
pnpm --dir packages/desktop run build:main
pnpm run tauri:smoke:sidecar
pnpm run tauri:check
pnpm run tauri:dev
pnpm run tauri:build
```

`build:deps` is required before launching because the Tauri sidecar entry points at `packages/desktop/dist/backend/local-backend-child.js`.
`build:ts` is required first because the desktop sidecar bundle resolves the public `@neon-pilot/extensions` SDK dist files.

## Migration Rules

- New host-authority APIs must go through Rust host-core or a typed Tauri command.
- Extension backend code stays in JS/TS behind `@neon-pilot/extensions` and narrow `@neon-pilot/extensions/backend/*` subpaths.
- Extension runtime code must not import desktop, core, or Tauri internals directly.
- Product data should flow over the desktop HTTP data plane and WebSocket realtime plane; native shell channels are for native host capabilities.
- Release packaging uses Tauri artifacts from `pnpm run tauri:build`.

## Remaining Platform Debt

- PTY-backed extension shell sessions still use JS/node-pty.
- The file-backed Tauri secret store should be replaced or backed by a production keychain implementation.
- The native embedded browser capability needs a Tauri-native design before it can return to the production shell.
