# ADR 0001: Rust Host Kernel And TypeScript Product Runtime

## Status

Accepted.

## Context

Neon Pilot used to treat the desktop backend, host authority, product orchestration, and extension backend runtime as one broad TypeScript/Electron layer. That made it hard to tell which code was trusted host infrastructure and which code was product behavior around Pi and extensions.

The Tauri migration is the point where that boundary becomes explicit.

## Decision

Neon Pilot's final desktop shape is:

- Rust/Tauri is the **host kernel**.
- TypeScript is the **product runtime** and JS extension host.
- Pi remains integrated from the TypeScript product runtime.
- Extensions stay in JavaScript/TypeScript behind `@neon-pilot/extensions` and narrow backend subpaths.

The Rust host kernel owns desktop lifecycle, JS sidecar supervision, process execution including PTY, scoped filesystem authority, persistence primitives, secret primitives, extension package validation/install/import, packaged-resource resolution, and release/update plumbing.

The TypeScript product runtime owns Pi integration, prompt assembly, conversations, workflow orchestration, local API composition, extension backend execution, and product-specific behavior.

## Consequences

- New native authority must be exposed as a typed Tauri command or host-core RPC endpoint.
- JS extension backends may request shell, filesystem, persistence, and package operations, but active Tauri execution routes those operations through Rust host-core.
- TypeScript may keep product and Pi orchestration code, but it should not grow new direct native authority bypasses.
- Synchronous Pi/model compatibility surfaces can continue to use existing TypeScript adapters until the upstream contract can become async; new secret authority belongs in the Rust host-kernel contract.
