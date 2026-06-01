# Product Runtime And Extension Host Split

Neon Pilot is moving toward separate product runtime and extension host lanes inside the Electron app. The goal is to isolate extension execution from conversation orchestration and the Pi/Codex adapter without requiring a shell rewrite.

## Ownership

Electron main owns native shell behavior, bootstrap, and child process supervision. It should not own product data or extension execution.

The product runtime owns conversations, prompt assembly, transcript persistence, daemon integration, model/provider selection, and the Pi/Codex adapter. Product HTTP and WebSocket APIs remain product runtime responsibilities.

The extension host owns extension registry loading, backend extension execution, actions, tools, services, subscriptions, extension diagnostics, and extension capability mediation.

Extension workers are the backend isolation layer. A worker runs one extension backend, or one trusted extension group, and talks only to the extension host.

Backend module import, export lookup, and handler execution go through the host-owned `ExtensionBackendRunner` seam. Production backend work should use the worker import runner and worker export dispatch; the in-process runner is only for narrow extension-host implementation tests and legacy migration gaps called out below.

The extension backend worker entrypoint provides wire-safe import, clear, export-availability, and export-execution operations. The worker import runner allocates a backend worker per extension and production action, route, service, and subscription execution must use worker exports once the manifest marks that surface worker-capable.

The backend worker transport is bidirectional: host requests use `ExtensionBackendWorkerRequest`, and worker-to-host capability calls use `ExtensionBackendWorkerCapabilityRequest` with `capability`, `operation`, and serializable `input` fields. The host dispatches those capability calls through narrow adapters and returns `ExtensionBackendWorkerCapabilityResponse`; workers must not import product runtime or Electron modules directly. The first worker-safe backend context capabilities are serialized `runtime` metadata plus host-owned runtime refresh operations such as `runtime.refreshSkillMcpConfig`, extension-scoped `log`, `events.publish`, narrow conversation handles (`conversations.get`, `create`, `ensureLive`, `sendMessage`, `abort`, `compact`, `fork`, `setTitle`, `setActiveTools`, `appendCustomEntry`, `appendTranscriptBlock`, `updateTranscriptBlock`, `getWorkspace`, `updateWorkspace`, `rollback`, and `metadata`), extension registry reads/enablement, host-owned `filesystem` scoped root handles, `git`, `models.list` plus host-owned provider/model writes, `notify`, `storage`, `secrets.get`, non-streaming `shell.exec`, `telemetry.record`, `ui.invalidate`, and the serialized `workspace` file API.

Worker execution is explicit. A backend action must declare `worker.enabled` in its manifest, and actions with mixed safe/unsafe code paths can declare `worker.inputActions` so only matching object inputs run in the worker. Backend routes must declare `worker.enabled`; non-streaming responses cross as serializable route responses, and SSE responses cross as host-owned streams fed by worker-emitted route stream events. Backend services must declare `worker.enabled` plus an explicit `stopHandler`, because returned stop functions cannot cross a worker boundary. Backend subscriptions dispatch serialized host events into workers.

The final invariant is:

- Extension backend code runs only in backend workers.
- The extension host may load manifests, registry metadata, permissions, diagnostics, worker protocol code, and host capability adapters.
- Production code must not call the in-process backend runner.
- Static checks must fail when a backend action, route, service, subscription, protocol entrypoint, or agent extension lacks a worker execution path.

Current transitional exceptions are intentionally narrow and should not expand:

- Agent extension factories still use the legacy host-side factory path until declarative contribution snapshots are generated in workers and cached before session construction.
- Protocol entrypoints still use the legacy host-side entrypoint path until stdio/control handles are represented on the worker protocol.

Worker-backed action coverage now includes product-critical system surfaces for artifacts, Automations scheduled-task/follow-up actions, Caffeinate process control, code mode, Codex apply-patch, conversation ask/inspect/title/cwd/deferred-resume/context-menu helpers, the worker-safe subset of the conversation tool (`inspect`, `create`, `set_title`, `change_working_directory`, `ensure_live`, `send_message`, `abort`, `compact`, `fork`, `set_active_tools`, `workspace_get`, `workspace_update`, `append_transcript_block`, `update_transcript_block`, and `rollback`), all extension manager actions, image probe agent tasks, knowledge state/sync/read/search/reference/memory/file mutation/import actions and all non-streaming Knowledge routes including binary assets, local dictation settings/model install/transcription, MCP settings/config/test/auth/logout actions and read-only tool inspection, onboarding bootstrap, prompt assembly inspection/toggles, skills inventory and enablement, telemetry aggregate reads, todos, web fetch, installable web search tools, installable local model lookup/discovery actions, installable DS4 provider/tool/runtime-control actions, Video Probe local runtime controls, Suggested Context cache warming, and background work (`system-runs`). Conversation inspection can cross because it uses serialized tool context metadata, public conversation backend subpaths, worker-local session snapshots, and best-effort host-side trace pointer persistence. Conversation cwd changes can cross because host backend APIs own path resolution, directory validation, live-session resources, and the queued working-directory mutation. Extension manager create/snapshot/reload/validate/catalog-install actions can cross because they call host-owned extension lifecycle, backend reload, doctor, and catalog shims through the public backend extension API; search-path writes and marketplace package extension wrappers can cross because host APIs own their settings-file and extension-package filesystem writes. Automations can cross the worker boundary because scheduled-task and deferred-resume handlers use public backend subpaths, serialized tool context metadata, and `ctx.ui.invalidate`; Skills enablement can cross because MCP config materialization and `MCP_CONFIG_PATH` mutation are now host-owned through `ctx.runtime.refreshSkillMcpConfig`; background work can cross for non-streaming action paths because it uses public backend subpaths, serialized tool context metadata, non-streaming shell execution, and `ctx.ui.invalidate`; Caffeinate can cross because `ctx.shell.spawn` now returns worker-side handles for host-owned process lifecycle methods and can deliver stdout/stderr/exit callbacks back to the worker. Live foreground streaming still stays on the host runner when a tool update callback or live agent abort context is present.

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

The extension host interface is now a product-runtime client boundary. Product code talks to the host through `ExtensionHostClient` request objects:

```text
Product runtime caller
  -> ExtensionHostClient
  -> ExtensionHostRequest
  -> RpcExtensionHostClient
  -> extension host process
```

The in-process request handler remains an implementation and test harness for extension-host code, not a product runtime fallback:

```text
Extension host implementation/test
  -> In-process request handler
  -> extension backend implementation
```

The RPC adapter must only carry wire-safe data. Product action paths pass serializable server and tool context snapshots where possible. Existing action paths that depend on function-bearing `serverContext` or richer live agent objects must first move those operations behind capability channels.

The desktop build already emits an `extension-host-child.js` entrypoint for this lane. The local backend configures an RPC client whose product runtime traffic goes to the extension host child process. Extension backend routes use a dedicated host route transport so abort signals and SSE responses can cross the process boundary without being squeezed through JSON RPC. Streaming tool actions use a dedicated host action transport that forwards `toolContext.onUpdate` over SSE and recreates action abort signals inside the child process. Stdio protocol entrypoints use a dedicated localhost protocol channel that carries stdin, stdout, stderr, abort, and completion frames.

Product runtime modules must depend on `ExtensionHostClient` and the public host protocol/context types. They must not import `extensionBackend` directly, including for route, action, telemetry, reload, startup, self-test, or protocol-entrypoint operations.

Manifest-declared tools also invoke backend actions through `ExtensionHostClient`; they pass serializable agent metadata and tool context snapshots through the host action transport. Richer live agent capabilities must use explicit handles before they can cross the process boundary.

## Extension Host Audit

Extension host permission checks use the host-owned `extensionPermissions` module. Capability adapters should call `assertExtensionPermission(extensionId, permission, capability)` instead of reading manifest permissions directly, so permission denial shape and audit metadata stay centralized.

Extension host request handling and permission denials record metadata-only audit events at the host boundary. These events include request type, stable request name, success/failure, duration, timestamp, and error text for failed requests. They must not record request bodies, route bodies, action inputs, prompt text, or extension payloads.

Action telemetry is still the action-level diagnostic stream. Host audit events are the process-boundary diagnostic stream and are read through `ExtensionHostClient`, so diagnostics do not import extension-host implementation modules or scatter audit logic through product runtime call sites.

## Current Product Fallbacks

The product runtime no longer routes extension-host calls to the in-process fallback. Keeping this true is part of the product-runtime/extension-host seam: new product callers should use snapshots, serializable inputs, dedicated transports, or explicit capability channels instead of live function-bearing host objects.

Startup actions, backend routes, and backend actions are no longer allowed to fall back when they carry live functions. Product callers must pass `serverContextSnapshot`, tool context snapshots, serializable route/action data, and normal abort signals so dispatch stays on the extension host child process.

The public `ExtensionHostClient` input types expose `serverContextSnapshot`, not live `serverContext`. Live server contexts are reserved for the in-process request handler and extension-host implementation tests, and `check-product-extension-host-seam.mjs` rejects product-runtime client calls that try to pass `serverContext` directly. The RPC transport accepts `ExtensionHostWireRequest`, which strips live server contexts from the request union before anything is serialized.

`getExtensionHostClient()` fails closed when no client is configured. Product runtime startup must install the RPC client from the supervised extension host process; only extension-host implementation code and narrow tests should construct the in-process request handler directly.

## Migration Phases

1. Add the product runtime / extension host terminology and the `ExtensionHostClient` seam.
2. Route narrow product runtime call sites through the host client boundary.
3. Add an extension host child process and RPC adapter.
4. Move product runtime dispatch onto the extension host process.
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
