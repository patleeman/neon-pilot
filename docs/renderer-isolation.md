# Renderer isolation architecture

Neon Pilot treats the desktop renderer as a presentation surface, not a product runtime. The renderer must stay responsive while conversations load, stream, and accept typing.

## Process ownership

- **Electron main** owns native shell/bootstrap/control only: windows, app protocol, OS dialogs, screenshots, and native integrations.
- **Backend/local API/daemon lane** owns product work: transcript reads, filesystem scans, session/run/todo/extension state, prompt assembly, telemetry persistence, and transcript projection.
- **Renderer** owns local UI state and paint: composer input, optimistic rows, rendering immutable view models, and applying small realtime patches.

No hot UI path should depend on Electron IPC product calls, synchronous filesystem work, SQLite indexing, extension providers, or raw transcript shaping in React render.

## Critical lanes

### Input lane

Composer typing is local and isolated. Keystrokes must not recompute transcripts, refresh sessions, invoke extensions, list durable runs, or write telemetry indexes.

### Submit lane

Submit appends an optimistic user row and sends a prompt envelope. The acknowledgement path must not wait for prompt-context providers, related conversation reads, durable-run scans, session-list refreshes, or transcript reloads.

### Route paint lane

Opening a conversation should render the app shell and a small transcript viewport first. The backend returns a bounded transcript snapshot with precomputed render items. Older history, heavy content, extension shelves, and side rails load later.

### Realtime lane

Streaming uses small deltas and reducers. Token/title/run/checkpoint events must not trigger broad `sessions` reloads.

### Background lane

Backfill, search indexing, summaries, telemetry indexing, extension snapshots, todo/run shelves, and heavy content hydration run off the interactive lanes.

## Transcript contract

The renderer should not shape long raw transcripts. Backend transcript responses include:

- `blocks`: bounded display blocks for compatibility and message actions.
- `renderItems`: render-ready transcript rows/clusters for immediate paint.
- `blockOffset`/`totalBlocks`: window position.
- deferred heavy-content markers and explicit block hydration endpoints.

The renderer may fall back to local shaping only when the transcript is locally mutated after load, such as stream deltas, explicit hydration, pending prompts, or append-only merges.

## Banned critical-path operations

For open-thread, type, send, and stream paths, do not add:

- synchronous filesystem scans
- SQLite writes/indexing
- durable-run list scans
- extension provider execution
- global session refreshes
- large raw transcript JSON payloads
- React render-time transcript clustering/window construction
- Electron IPC product reads/mutations

If a feature needs one of these, move it behind a cached backend snapshot or a background event.
