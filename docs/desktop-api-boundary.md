# Desktop API Boundary

Neon Pilot's desktop app uses three process boundaries with one clear ownership rule:

> Product APIs do not use Electron IPC. IPC is a native capability adapter. HTTP is the product data plane. WebSocket is the realtime plane.

## Protocol split

### HTTP: product data and mutations

Use HTTP for renderer, companion, extension, and future remote clients that request product data or perform bounded mutations.

Examples:

- sessions, session metadata, transcript/detail/bootstrap reads, blocks, search, and summaries
- conversation assets: artifacts, checkpoints, attachments, attachment downloads, review context, and diffs
- scheduled tasks, durable runs, execution projections, task/run logs, cancel/rerun/attention mutations
- models, providers, provider auth, default cwd, open conversation tabs, title settings, conversation model preferences
- knowledge/workspace trees, files, searches, diffs, and explicit file mutations
- extension routes, extension manager operations, OAuth callbacks, downloads, webhooks, and companion APIs

HTTP responses must be bounded, paginated, or streamed. Large binary/text payloads should flow as bytes/streams instead of deeply nested objects.

### WebSocket: realtime events and control

Use WebSocket for long-lived realtime flows and bidirectional control. The desktop realtime endpoint is `/api/realtime`; clients send typed `subscribe` / `unsubscribe` messages for stream paths and receive small `stream`, `app_event`, `subscribed`, `unsubscribed`, and `error` messages. When the Electron renderer is loaded through the `neon-pilot://app` custom protocol, Chromium cannot resolve `ws://app`; the shell uses the desktop protocol's `text/event-stream` adapter for stream subscriptions instead of opening that WebSocket URL.

Examples:

- live conversation events: agent start/stop, message deltas, tool calls/results, context usage, queue state, parallel jobs, title updates, presence, stale/hidden turn state, and turn end
- user controls for active live sessions: submit prompt, queue steer/follow-up, abort, takeover, approvals, and parallel-job actions
- app-wide invalidations and small events: sessions changed, tasks/runs changed, daemon status changed, notifications, extension commands, session running state, and live titles
- optional background execution realtime events such as log tails or status deltas

WebSocket messages should be small deltas, invalidations, or control messages. Do not routinely broadcast full sessions lists, transcripts, logs, artifacts, or other large snapshots over WebSocket.

### Electron IPC: native/bootstrap only

Use IPC only when the renderer needs Electron or OS capability, or to bootstrap HTTP/WebSocket access.

Allowed IPC surfaces:

- `getConnectionInfo` / bootstrap data: HTTP base URL, WebSocket URL, auth token, runtime channel, and host metadata
- native file/folder pickers
- clipboard read/write
- open external URLs and reveal/open local paths
- window/app controls, popouts, menu shortcuts, and shell navigation owned by Electron
- screenshots, screen picker, app update checks, and native Workbench Browser embedding when required

IPC payloads should be small. Do not send sessions, transcripts, search results, logs, artifacts, runs/task lists, or app-event snapshots through IPC.

## Renderer client rule

Renderer product code should depend on typed clients:

- `api` / HTTP client for product reads and mutations
- realtime/WebSocket client for subscriptions and live controls through the typed endpoint configuration
- desktop native bridge for bootstrap and native OS/Electron operations only

Do not add new product-data methods to the Electron preload bridge. If product data is only available through an internal module, expose it through an HTTP route or WebSocket event/control message instead.

## Extension API rule

Extensions should use the public `@neon-pilot/extensions` SDK and host-provided clients/capabilities. Extension code must not import desktop internals or depend on Electron IPC channels.

Extension frontend code should treat host APIs as product HTTP/realtime capabilities surfaced through the SDK. Extension backend code should use backend context capabilities and shared server modules through stable SDK seams. When an extension needs a missing host capability, add a reusable SDK primitive rather than adding an extension-specific IPC channel.

## Performance guardrails

- IPC messages should remain control-plane sized; target less than 64KB.
- WebSocket app events should be deltas/invalidations; target less than 64KB except explicit chunk protocols.
- Large data must be fetched by HTTP with pagination, byte streaming, range support, or explicit size limits.
- Renderer clients should coalesce in-flight large reads where practical.
- App invalidations should be debounced before triggering HTTP refetches.
- Desktop perf smoke should cover startup, large session fixtures, long transcript open, search, and idle CPU.

## Migration policy

When touching a desktop renderer API method:

1. If it is product data or a bounded mutation, route it through HTTP.
2. If it is realtime stream/control, route it through WebSocket.
3. If it is native OS/Electron functionality, keep it in IPC.
4. Delete obsolete IPC product handlers and preload bridge methods.
5. Add/keep tests that enforce payload size and protocol ownership where practical.

The desired end state is a renderer with no Electron IPC dependency for product APIs. IPC remains a small native adapter and bootstrap seam.
