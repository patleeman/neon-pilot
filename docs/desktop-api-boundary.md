# Desktop API Boundary

Neon Pilot is an Electron desktop app. The renderer must use one product API surface: the typed desktop bridge backed by Electron IPC/local-api.

## Canonical rule

Renderer product code must not add new HTTP routes or fetch-based fallbacks for desktop-only product controls.

Use the desktop bridge/local-api path for actions such as:

- creating, resuming, prompting, stopping, branching, forking, compacting, reloading, exporting, or destroying live conversations
- restoring or clearing queued steer/follow-up prompts
- changing conversation cwd, model preferences, or other conversation control state
- native desktop actions such as file/folder pickers, local model/provider settings, and window/app controls

HTTP is a transport edge, not the renderer's product API.

## Allowed HTTP surfaces

Keep HTTP when there is a real non-renderer or external consumer:

- extension-declared routes and extension-owned gateways, including Kitty/mobile pairing or future extension webhooks
- OAuth callbacks, webhooks, downloads/assets, or other browser/network protocol edges
- companion/daemon surfaces that are actually consumed outside the Electron renderer
- read-only diagnostics only when there is a concrete need and they are clearly namespaced/documented

Do not preserve HTTP endpoints for hypothetical future remote runtime support. If a remote runtime becomes real, add a remote transport behind the same typed desktop API contract.

## Migration policy

When touching a renderer API method:

1. Prefer an existing desktop bridge/local-api capability.
2. Add the smallest typed bridge/local-api capability if one is missing.
3. Remove renderer HTTP fallbacks for desktop-only controls.
4. Delete server routes that no remaining non-renderer caller uses.
5. If an endpoint remains for companion/gateway/extension use, keep it out of the renderer path and document why it remains.

## Current cleanup status

The Electron renderer now uses the typed desktop bridge/local-api path for desktop-only product controls, including live conversation control, conversation state, model/provider/default-cwd settings, open conversation tabs, scheduled tasks, durable-run reads/actions, native folder picking, and conversation artifacts/attachments/deferred resumes.

The remaining HTTP surfaces in these areas are intentional protocol edges, such as SSE streams (`/api/live-sessions/:id/events`, `/api/runs/:id/events`), binary/session image assets, OAuth event streams, extension/gateway/workspace routes, and companion-owned `/companion/v1/*` APIs.
