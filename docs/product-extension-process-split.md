# Product Runtime And Extension Host Split

Neon Pilot is moving toward separate product runtime and extension host lanes inside the Electron app. The goal is to isolate extension execution from conversation orchestration and the Pi/Codex adapter without requiring a shell rewrite.

## Ownership

Electron main owns native shell behavior, bootstrap, and child process supervision. It should not own product data or extension execution.

The product runtime owns conversations, prompt assembly, transcript persistence, daemon integration, model/provider selection, and the Pi/Codex adapter. Product HTTP and WebSocket APIs remain product runtime responsibilities.

The extension host owns extension registry loading, backend extension execution, actions, tools, services, subscriptions, extension diagnostics, and extension capability mediation.

Extension workers are a later isolation layer. A worker runs one extension backend, or one trusted extension group, and talks only to the extension host.

## Process Graph

Allowed communication:

```text
Renderer -> Product runtime HTTP/WebSocket
Renderer -> Electron native bridge for bootstrap/native operations

Electron main -> Product runtime process
Electron main -> Extension host process

Product runtime -> Extension host protocol
Product runtime -> Pi/Codex adapter
Product runtime -> daemon/runtime internals

Extension host -> Product runtime capability protocol
Extension host -> extension backend modules/workers

Extension worker -> Extension host
```

Disallowed communication:

```text
Extension backend -> Pi/Codex raw client
Extension backend -> packages/desktop/server internals
Extension backend -> packages/core internals
Extension backend -> Electron IPC
Extension worker -> Product runtime directly
Extension worker -> Electron main directly
Renderer product code -> Electron IPC product methods
```

## Interface Direction

Extensions contribute capabilities. The product runtime composes those capabilities into agent runs. Only the product runtime owns the effective prompt, conversation lifecycle, transcript/session persistence, and Pi/Codex execution.

The extension host interface starts in-process and then becomes an RPC adapter:

```text
Product runtime caller
  -> ExtensionHostClient
  -> InProcessExtensionHostClient
  -> existing extension backend implementation
```

The later adapter swaps only the final hop:

```text
Product runtime caller
  -> ExtensionHostClient
  -> RpcExtensionHostClient
  -> extension host process
```

The RPC adapter must only carry wire-safe data. Product action paths pass serializable server and tool context snapshots where possible. Existing action paths that depend on function-bearing `serverContext`, streaming `onUpdate` callbacks, abort signals, stdio protocol entrypoints, or live agent objects must first move those operations behind capability channels.

The desktop build already emits an `extension-host-child.js` entrypoint for this lane. The local backend configures a hybrid client: wire-safe product runtime traffic goes to the extension host child process. Extension backend routes use a dedicated host route transport so abort signals and SSE responses can cross the process boundary without being squeezed through JSON RPC. Callback-bearing tool actions and stdio protocol entrypoints remain on the in-process fallback until capability channels exist.

Product runtime modules must depend on `ExtensionHostClient` and the public host protocol/context types. They must not import `extensionBackend` directly, including for route, action, telemetry, reload, startup, self-test, or protocol-entrypoint operations.

## Migration Phases

1. Add the product runtime / extension host terminology and the `ExtensionHostClient` seam.
2. Route narrow product runtime call sites through the in-process client.
3. Add an extension host child process and RPC adapter.
4. Move extension backend execution into the extension host process.
5. Replace direct backend API shims with capability adapters.
6. Add permission and audit enforcement at the extension host.
7. Move user extension backend execution into per-extension workers.
8. Delete legacy direct product-runtime-to-extension-backend paths.

## Validation

For extension/core seam work, run:

```bash
pnpm run check:extensions:static
node scripts/check-core-extension-boundary.mjs
node scripts/check-extension-backend-api.mjs
```

For process and startup changes, also run the relevant desktop backend tests and a desktop smoke/perf pass.
