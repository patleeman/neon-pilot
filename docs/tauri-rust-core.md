# Tauri/Rust Core

This document describes the production desktop host architecture. Neon Pilot's desktop app is a Tauri shell with Rust-owned host authority and a supervised JS sidecar for the existing local API, agent runtime, and JS extension backend execution.

## Architecture

```text
Tauri shell
  └─ Rust host kernel
       ├─ native app/window lifecycle
       ├─ JS sidecar supervision
       ├─ embedded Workbench Browser webview ownership
       ├─ host-owned authority boundaries: app preferences, extension package validation/install/import
       ├─ scoped filesystem and SQLite migration primitives
       ├─ process and PTY execution authority
       ├─ secret persistence primitives
       ├─ packaged runtime resource resolution
       ├─ host-core RPC server for JS sidecar authority calls
       └─ JS sidecar boundary
            ├─ existing desktop local API server
            ├─ Pi integration, agent, prompt, conversation, and workflow behavior
            └─ JS/TS extension backend execution through Rust-owned host authority
```

Rust owns stable authority and lifecycle boundaries. JS/TS remains the product runtime and extension runtime behind public extension contracts.

## Current Implementation

- `packages/tauri/host-core` is the Rust host-kernel primitive library.
- `packages/tauri/desktop-shell/src-tauri` is the production Tauri shell.
- `packages/desktop` contains the React renderer, bundled server assets, and JS sidecar entry points consumed by Tauri.
- Host-core owns JS sidecar supervision, repo/state-root path resolution, Tauri desktop app preferences and window state, extension package validation/install/import, scoped filesystem operations, SQLite migrations, process execution authority, PTY execution authority, and secret storage primitives.
- The Tauri shell owns native lifecycle parity (close hides, reopen shows, quit confirmation, macOS activation policy), native menus/accelerators, native bridge commands for environment, navigation state, opening paths/URLs, clipboard writes, folder picking, app preferences, update status, extension package validation/install/import, scoped filesystem operations, SQLite migrations, secret access, Workbench Browser webviews, and product API dispatch.
- The React API client detects Tauri and sends product API requests through the Rust `dispatch_local_api` command, which forwards to the supervised JS sidecar.
- The React desktop bridge detects Tauri and maps desktop-native calls to Tauri commands. Tauri-only host-core primitives are available under `bridge.hostCore`.
- Before launching the JS sidecar, Tauri starts a localhost Rust host-core RPC server and passes `NEON_PILOT_TAURI_HOST_CORE_PORT` plus `NEON_PILOT_TAURI_HOST_CORE_TOKEN` into the sidecar environment.
- Tauri also starts a localhost Workbench Browser bridge for the JS sidecar and passes `NEON_PILOT_TAURI_BROWSER_BRIDGE_URL` plus `NEON_PILOT_TAURI_BROWSER_BRIDGE_TOKEN` so browser agent tools can target the Rust-owned embedded browser session.
- The JS sidecar reports `hostCore: "tauri-rust"` from `/health` when the Rust host-core RPC bridge is available.
- Extension shell `exec`, pipe-backed `spawn`, PTY-backed `spawn`, process writes, process resize, and process kill route through the Rust host-core RPC bridge under Tauri.
- `scripts/prepare-tauri-resources.mjs` stages packaged backend resources into the Tauri bundle before `pnpm run tauri:build`; packaged sidecars resolve the runtime from `Contents/Resources/resources`.
- The Browser workbench tab uses Tauri child webviews. Browser UI navigation, tab visibility, state sync, text snapshots, and screenshots are Tauri-native. Raw Chromium CDP commands are not available in the Tauri WKWebView backend.

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
`tauri:build` stages the backend bundle, bundled server modules, and system extensions into `packages/tauri/desktop-shell/src-tauri/resources` before invoking the Tauri bundler.

## Migration Rules

- New host-authority APIs must go through Rust host-core RPC or a typed Tauri command.
- Extension backend code stays in JS/TS behind `@neon-pilot/extensions` and narrow `@neon-pilot/extensions/backend/*` subpaths.
- Extension runtime code must not import desktop, core, or Tauri internals directly.
- Product data should flow over the desktop HTTP data plane and WebSocket realtime plane; native shell channels are for native host capabilities.
- Release packaging uses Tauri artifacts from `pnpm run tauri:build`.

## Remaining Platform Debt

- Synchronous TypeScript secret helpers remain as non-Tauri compatibility for legacy tests and non-host execution. Active Tauri secret reads/writes in routes, model provider auth, and extension backend secrets use the async host-core RPC contract.
- Raw Chromium CDP command execution is not available in the Tauri WKWebView backend. Browser agent tools should prefer `browser_snapshot` and `browser_screenshot`; autonomous development validation should use the agent-browser CLI.
