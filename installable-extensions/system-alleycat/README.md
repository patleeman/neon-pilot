# Alleycat Remote Host

Neon Pilot-owned remote host for Kitty Litter / Alleycat-compatible clients.

## Intent

This extension should replace external `kittylitter` process management for Neon Pilot users:

- run a PA-managed Alleycat-compatible host
- advertise **only** `neon-pilot`
- show pairing payload / QR in Settings
- expose Neon Pilot conversations through the Codex-shaped JSON-RPC API Kitty expects

## Setup / QA

The same setup instructions are shown in the extension settings panel so users do not need to read this file.

Do **not** install or run `npx kittylitter` for Neon Pilot pairing. That starts the upstream Kitty Litter host and advertises its built-in agents.

Use the PA extension instead:

1. Build/reload the default-disabled `system-alleycat` system extension.
2. Enable it in Neon Pilot; the companion host starts automatically while the extension is enabled.
3. Open Neon Pilot Settings → **Kitty Litter Mobile Pairing**, or the Kitty Litter page.
4. In Kitty Litter, scan the QR code shown by Neon Pilot.
5. Select **Neon Pilot**. It should be the only advertised agent.

For cwd QA:

- Existing PA conversations should show their real desktop cwd in `thread/list`.
- Starting a thread with an explicit cwd should create the PA conversation in that cwd.
- If Kitty sends its local default `/root`, PA maps that to the desktop default repo/root cwd instead of creating useless `/root` sessions.
- File/cwd picker calls can use the fuzzy file search bridge; pass desktop roots such as `/Users/patrick/workingdir`.

## Automated E2E coverage

Run the focused mobile bridge checks before shipping compatibility changes:

```bash
pnpm run test:alleycat
```

These tests cover the hookable surface Kitty uses without requiring the native mobile app:

- JSONL bridge auth rejects bad clients cleanly and accepts sidecar-authenticated clients.
- WebSocket bearer auth behaves the same way for compatibility clients.
- `initialize` plus follow-up JSON-RPC calls are serialized on one connection, matching mobile startup behavior.
- Discovery/config/model/account/skills/app surfaces return renderable shapes.
- Filesystem picker and shell/process hooks execute through the extension-facing APIs.
- Unsupported upstream Codex hooks fail explicitly instead of returning fake success shapes that make Kitty spin.
- The Rust sidecar validates Alleycat request framing, token/protocol rejection, single-agent advertisement, and connect session acknowledgements.
- A Rust iroh loopback test mirrors upstream `alleycat probe`: it dials the sidecar endpoint, sends `list_agents`, opens `connect`, verifies the JSONL auth line sent to the local bridge, and round-trips a JSON-RPC `initialize` frame over the proxied stream.

Manual phone QA is still required for native app release confidence: scan the QR code, verify only **Neon Pilot** is advertised, start a thread, send a prompt, verify desktop workspace/open-thread state updates, use file picker roots, and interrupt/steer a running turn.

## Current implementation state

The extension runs a PA-owned Rust iroh sidecar and forwards `connect` streams to a local JSONL Neon Pilot bridge. Its local bridge implements the Kitty-compatible conversation protocol directly:

- `initialize`
- `thread/list`
- `thread/loaded/list` (mirrors PA's shared open/pinned conversation workspace)
- `thread/open` / `thread/close` (workspace open/close and active thread state, not archive)
- `thread/archive` / `thread/unarchive` (shared workspace archive state; archive also removes open/pinned/remote-control markers)
- `workspace/read` / `workspace/update` (shared open/pinned/archived/active/remote-control workspace state)
- `thread/start`
- `thread/read`
- `thread/resume`
- `thread/fork`
- `thread/archive` / `thread/unarchive`
- `thread/name/set`
- `thread/metadata/update`
- `thread/compact/start`
- `thread/rollback`
- `thread/inject_items`
- `thread/unsubscribe`
- `thread/shellCommand`
- `thread/goal/*`
- `turn/start`
- `turn/steer`
- `turn/interrupt`
- `model/list`
- `account/read`
- `account/rateLimits/read`
- `config/read`
- `configRequirements/read`
- `skills/list`
- filesystem / command / process compatibility handlers used by Codex clients

Compatibility notes:

- `thread/loaded/list` is intentionally workspace state, not runtime liveness. Open/close controls what appears in the shared desktop/mobile workspace; `activeConversationId` controls focused conversation; archive/unarchive controls workspace archive state and removes archived threads from open/pinned/remote-control sets; live/running status remains separate.
- `model/list` maps PA model metadata into Codex fields. Reasoning effort options use Codex's object shape; if PA metadata is unavailable the bridge returns deterministic PA model defaults so Kitty's model picker can render.
- Tool calls are emitted as Codex `dynamicToolCall` items under the `neon-pilot` namespace so Kitty can render them instead of seeing opaque PA events.
- `turn/start` uses the extension conversation `runTurn` boundary so resume, live-event subscription, prompt dispatch, and terminal event handling are one atomic operation. It opens the thread in the shared desktop workspace and marks it with a visible remote-control note the first time Kitty drives it. `turn/start` and `turn/steer` preserve Kitty image input items and forward them as PA prompt images. Supported forms are data URLs, base64 fields with image MIME metadata, and local/file URLs readable by the desktop host.
- `thread/start`, `thread/resume`, and `thread/read` return hydrated turns from the PA transcript. Do not return metadata-only thread payloads for reopened threads; mobile clients may render that as a blank conversation instead of issuing a second read.
- Compatibility endpoints must either be PA-backed or fail with a clear unsupported error. Do not add silent `not_implemented` placeholders; Kitty often spins forever on fake success shapes.
- If Kitty adds stricter Codex rendering assumptions, update the protocol mapper here rather than changing PA conversation internals.

## Compatibility boundary and trust model

The bridge treats a paired Kitty client as a trusted remote control surface for this desktop profile. After QR pairing, the client can exercise the same broad local capabilities Neon Pilot exposes to agents through this extension: read/write/remove/copy host files by absolute path and run shell commands through the extension shell boundary. Do not share the QR/token with untrusted clients; rotate the token from Settings if a device is lost.

Compatibility handlers fall into three buckets:

- **PA-backed:** conversations, workspace open/close/archive state, turns, steering/interruption, transcript reads, model/config/account discovery, skills, filesystem, command execution, and process spawn/output notifications.
- **Probe-safe disabled:** endpoints Kitty may probe to decide whether to render optional UI, such as realtime sessions and remote-control status, return explicit disabled/status shapes rather than pretending the feature is active.
- **Unsupported:** endpoints Neon Pilot cannot honestly back, such as MCP tool calls through Kitty, marketplace/plugin install, feedback upload, Windows sandbox setup, file watching, and interactive PTY stdin/resize, throw a stable unsupported error so mobile does not spin on fake success.

## Transport

`sidecar/` contains the Rust host process. The backend launches the packaged `bin/neon-pilot-alleycat-host-<platform>-<arch>` through `ctx.shell`, passes it the Neon Pilot Alleycat token/secret and local JSONL port, then reads the sidecar ready event for the real iroh pair payload.

The sidecar waits for Iroh to report an online, relay-backed endpoint before emitting the ready event used for the pairing QR. This prevents Kitty from scanning a node/token payload that has no dialable addressing information yet.

The sidecar implements Alleycat host ops:

- `list_agents` returns only `neon-pilot`
- `restart_agent` is accepted only for `neon-pilot`
- `connect` returns a session ack, then byte-proxies the iroh stream to the local PA JSONL bridge

Do not reintroduce ACP or hijack a named external agent slot such as Devin.
