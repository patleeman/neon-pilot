# Tauri/Rust Core Migration Track

This document describes the experimental Tauri/Rust host track. The current Electron desktop remains the production path.

## Target architecture

```text
Tauri shell
  └─ Rust host core
       ├─ native app/window lifecycle
       ├─ process supervision
       ├─ host-owned authority boundaries: app preferences, extension package validation/install
       ├─ scoped filesystem and SQLite migration primitives
       ├─ file-backed secret persistence for the Tauri track
       └─ JS sidecar boundary
            ├─ existing desktop local API server
            ├─ agent/prompt/runtime behavior during the migration
            └─ JS/TS extension backend execution
```

Rust should own stable authority and lifecycle boundaries first. JS/TS remains the extension and agent-behavior runtime until those contracts settle.

## Current scaffold

- `packages/tauri/host-core` is a Rust library for host-owned runtime primitives.
- `packages/tauri/desktop-shell/src-tauri` is the Tauri shell.
- Host-core currently owns JS sidecar supervision, repo/state-root path resolution, Tauri desktop app preferences, extension package validation/install, scoped filesystem operations, SQLite migrations, and file-backed secret storage.
- The Tauri shell owns native bridge commands for environment, navigation state, opening paths/URLs, clipboard writes, folder picking, app preferences, update status, extension package validation/install, scoped filesystem operations, SQLite migrations, secret access, and product API dispatch.
- The React API client detects Tauri and sends product API requests through the Rust `dispatch_local_api` command, which forwards to the supervised JS sidecar.
- The React desktop bridge detects Tauri and maps desktop-native calls to Tauri commands. Tauri-only host-core primitives are available under `bridge.hostCore`.
- Electron-only Workbench Browser embedding is explicitly unsupported in the Tauri shell until a native webview strategy is chosen.

The scaffold intentionally keeps the existing React UI and desktop server build artifacts. It does not replace the Electron release path yet.

## Commands

Use Node 22 for this track. The repo's current native dependency set installs cleanly with Node 22; Node 26 does not build `better-sqlite3@11.10.0`.

```bash
pnpm run build:ts
pnpm --dir packages/desktop run build:deps
pnpm --dir packages/desktop run build:main
pnpm run tauri:smoke:sidecar
pnpm --dir packages/tauri/desktop-shell run check
pnpm --dir packages/tauri/desktop-shell run dev
```

`build:deps` is required before launching because the Tauri sidecar entry points at `packages/desktop/dist/backend/local-backend-child.js`.
`build:ts` is required first because the desktop main bundle resolves the public `@neon-pilot/extensions` SDK dist files.

## Migration order

1. Keep Electron and Tauri building side by side.
2. Move host-owned process supervision into Rust. Current status: initial JS sidecar supervision is implemented.
3. Define a stable Rust-host to JS-sidecar RPC protocol. Current status: product API dispatch is routed through a typed Tauri command to the JS local API sidecar.
4. Move native shell capabilities into Rust. Current status: environment, path/URL open, clipboard write, folder picker, navigation state, update status, and Tauri app preferences are implemented.
5. Move extension package validation into Rust. Current status: initial package manifest/path validation is implemented in host-core and exposed through Tauri.
6. Move filesystem authority, secret storage, SQLite primitives, and extension install/update mutation flow into Rust one boundary at a time. Current status: scoped text/list/remove filesystem operations, SQLite migrations, file-backed secret persistence, and local package install copying are implemented in host-core and exposed through Tauri.
7. Keep extension backend code in JS/TS behind `@neon-pilot/extensions`.
8. Re-evaluate Workbench Browser parity before considering Electron removal.

## Non-goals for the first pass

- No production packaging or updater replacement.
- No full prompt/runtime rewrite in Rust.
- No direct extension import of Rust or desktop internals.
- No removal of Electron code.
- No claim of Workbench Browser parity. The Tauri shell fails closed for Electron-only native browser embedding.
- No claim that JS extension backend APIs are fully Rust-native yet. The Rust primitives are available through Tauri, while existing product extension APIs still run in the supervised JS sidecar during migration.
- The Tauri secret store is a local file-backed implementation for this track. It is not a production keychain replacement yet.
