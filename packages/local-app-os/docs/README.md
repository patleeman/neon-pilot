# Local App OS docs

Local App OS is a clean-slate product concept inside the Neon Pilot working directory.

It is a local desktop operating environment inside Electron. Users launch apps from a dock, open them as windows, and use a Builder app powered by Pi to create, install, modify, and package more apps.

Neon Pilot remains useful as prior art and a harness prototype. Local App OS should not inherit Neon Pilot's product model by default.

## Product summary

Local App OS is:

- a desktop app that contains its own app desktop
- a local app builder and runtime
- a packageable app platform
- a place where generated apps can keep running after the builder finishes

Local App OS is not:

- a chat app with pages
- a web dashboard inside Electron
- an IDE clone
- a thin wrapper around generated web apps

## Core primitives

- Desktop shell: owns the top bar, dock, desktop canvas, windows, notifications, and global commands.
- App: the user-facing unit. Apps have manifests, windows, commands, permissions, storage, jobs, and package metadata.
- Extension or module: an implementation unit that can contribute app capabilities.
- Builder app: the bootstrap app powered by Pi. It builds and changes apps.
- Control Panel app: manages providers, permissions, secrets, network policy, and system settings.
- App runtime: owns lifecycle, permissions, app services, events, jobs, logs, packaging, and persistence.
- Design system: gives the Builder safe primitives for simple applications, with an escape hatch for custom UI.

## Current MVP

The first MVP lives in `packages/local-app-os`.

It includes:

- Electron shell
- React renderer
- top bar
- dock
- draggable internal windows
- seed apps
- in-memory platform backend
- typed platform API skeletons

Run it with:

```bash
pnpm --dir packages/local-app-os run dev
```

Build it with:

```bash
pnpm --dir packages/local-app-os run build
```

## Decision records

Architecture decisions live in `docs/ADRs`.

Start a new ADR when a decision changes product shape, platform API, security model, packaging, persistence, process boundaries, or app authoring rules.
