# Conversations

Conversations are live or saved agent threads. Each conversation has a transcript, a composer, access to tools, and full message history.

## Starting a Conversation

Create a new conversation from the sidebar (`+` button) or navigate to `/conversations/new`. The composer appears at the bottom of the transcript pane.

Type a message and press Enter to send it to the agent. The agent processes the prompt, calls tools as needed, and streams the response.

## Composer

The composer is the text input area at the bottom of the conversation view. Image attachments are read into the draft as soon as they are added, so temporary screenshots can still be sent after their original files are cleaned up.

| Feature            | How                                                           |
| ------------------ | ------------------------------------------------------------- |
| Send message       | Enter                                                         |
| New line           | Shift+Enter                                                   |
| File / note / task | Type `@` to fuzzy-search files, notes, automations, or skills |
| Slash commands     | Type `/` to open the command menu                             |
| Run bash command   | Type `!<command>` to run a shell command inline               |
| Image paste        | Ctrl+V or drag image into composer                            |
| Binary attachment  | Drag file into composer                                       |
| Reply quoting      | Select text in a message, then click "Reply" to quote it      |
| Clear composer     | Ctrl+C when composer is focused                               |
| Recall history     | ↑/↓ cycles through recent prompts                             |

## Conversation Lifecycle

Conversations are saved automatically. Every message, tool call, and tool result is persisted. Past conversations appear in the left sidebar. Click any conversation to resume it.

| State      | Behavior                              |
| ---------- | ------------------------------------- |
| Active     | Agent is processing a prompt          |
| Compacting | Context is being summarized/trimmed   |
| Idle       | Waiting for user input                |
| Saved      | Persisted to disk, visible in sidebar |

Threads can be locked from the sidebar context menu or command palette. A locked thread stays visible with a lock marker and cannot be closed or archived until it is unlocked.

Live conversations emit explicit `compaction_start` and `compaction_end` stream events. The desktop reducer uses them to show and clear the compaction state, while successful compactions also surface as compaction summary blocks in the transcript.

Long saved conversations open on their latest transcript segment. When earlier history is hidden, the transcript renders an inline cutoff marker with the visible percentage range and a small **Load previous** action; implementation counts such as block totals and windowed chunks stay out of the main UI.

Saved-conversation summaries are cache-first. UI and suggested-context reads only return summaries already present in the local conversation context DB; they must not generate missing summaries on the request path. New closed conversations enqueue summary generation immediately. Older missing/stale summaries are discovered by a delayed, metered background queue after startup grace, processed one at a time with a short gap between jobs, and skipped for live/running conversations. This keeps old profiles useful over time without turning app launch or list rendering into a whole-profile summarization burst.

Conversation read models live in `<state-root>/sync/pi-agent/conversations.db`. JSONL transcript files remain the append-only source of truth for recovery/export, but list/search/summary/detail request paths should use the SQLite read models instead of scanning transcript files.

### Sidebar and Hydration

The backend is the source of truth for sidebar conversation state. The desktop UI hydrates the sidebar from `GET /api/sidebar/conversations`, which returns one coherent projection: open IDs, pinned IDs, archived IDs, locked IDs, active ID, workspace metadata, and the session rows needed to render them. The projection filters stale workspace IDs that no longer resolve to known conversations, so the frontend must not create durable ghost rows for unknown IDs. Temporary optimistic UI is allowed only while a new conversation is being reserved or sent.

The backend is also the source of truth for durable conversation runtime state such as whether a conversation is running. Backend publishers emit revisioned `conversation_state_changed` records for running state; `session_meta_changed` only signals metadata refresh and must not carry or author running state. Frontend live-stream hooks may render transcript deltas and local loading affordances, but they must not author global conversation state. Running indicators in the sidebar, command palette, activity tree, and conversation chrome read backend-published state from the shared conversation projection. A derived conversation activity status may combine that backend runtime record with backend task/execution snapshots for background-work badges, but it is presentation-only and cannot mark a conversation itself as running.

Conversation workspace writes go through `/api/conversation-workspace` and `/api/conversation-workspace/operation`. The older `/api/ui/open-conversations` route has been removed; new code must use the semantic workspace routes.

The renderer may keep presentation-only seeds such as saved workspace path labels for first paint, but those seeds must be refreshed from the sidebar projection and must not decide whether a conversation exists or is open.

Opening a conversation is a read. The frontend asks for conversation state/bootstrap by ID and the backend decides whether the conversation is already live, can be read from transcript state, or is missing. If a requested conversation ID is unknown, the UI should show the conversation error state instead of redirecting to `/conversations/new`.

Sending or explicitly resuming a saved conversation is semantic from the frontend's perspective. The UI calls the conversation message/resume API; the backend may hydrate a live session from the transcript internally when needed. Frontend code should not call recovery/hydration endpoints or branch on recovery details.

Conversation-adjacent UI should keep this same split:

- Conversation content state is read through the shared conversation-state hooks or backend projections. Extension chat rails should not perform their own delayed hydration loops after sending; the hook owns refresh/reconnect behavior.
- Sidebar presentation preferences such as grouping, sorting, collapsed groups, manual group order, and custom labels are local presentation state. Locks are backend-owned workspace state because they change whether a conversation can be closed or archived.
- App-wide event handling should derive snapshot refreshes from event topics before touching stores. A `runs` or `executions` invalidation refreshes both projections because the visible execution list is derived from run state.
- Workspace/file-tree request lifecycles should invalidate stale async responses by generation or request id when the workspace, selected file, or directory expansion changes.

Runtime code should not import `conversations/sessions.js` directly. Normal callers use `conversationService.ts` and extension-facing capabilities. The only allowed direct transcript seams are:

- `conversationService.ts` — read-model service boundary with targeted transcript fallback and cache writes.
- `conversationTranscriptOps.ts` — explicit raw transcript operations for import/export, live topology metadata, and bounded indexer/reconciler scans.
- `conversationDisplayBlocks.ts` — display-block conversion compatibility seam.
- `conversationTypes.ts` — type-only compatibility seam.

The storage-boundary guard (`scripts/check-conversation-storage-boundary.mjs`) enforces that new product/extension code does not add direct `sessions.js` imports.

## Branching

Conversations support tree-style branching. Each turn creates a node in the conversation tree.

Conversation files also keep file-level lineage. When a saved conversation is branched, forked, rewound, duplicated, or created as a side/subagent conversation, its metadata can point at the parent conversation and source message. The left sidebar renders that file-level lineage inline: parent conversations with child branches get an expander, child conversations appear nested under the parent, and the conversation context menu includes **Go to Parent Conversation** when a parent is available.

The transcript treats explicit branch actions (`fork`, `rewind`, `duplicate`) as timeline landmarks anchored after the source message when known. Tool-created side work stays with the tool call that created it: subagents, artifacts, checkpoints, prompts, and visual captures are pinned as compact rows inside the **Internal work** shelf so they remain visible even when low-level tool-call plumbing is collapsed.

### /fork

Create a new conversation from a previous user message. The new conversation starts fresh but carries the context up to that point.
From the transcript action buttons, forking a user prompt opens a child conversation with that prompt restored in the composer; forking an assistant reply keeps the transcript through that reply.

```
Original conversation:

  ┌─ msg1 ─ msg2 ─ msg3 ─ msg4 (current)

Fork from msg2:

  ┌─ msg1 ─ msg2 (forked)
                └─ msg5 ─ msg6 (new conversation)
```

### /tree

Navigate the conversation tree to any previous point and continue from there without creating a new file.
Transcript rewind actions create a new conversation file at the selected point. Rewinding from an assistant reply cuts before the reply and restores the preceding user prompt in the composer so it can be resent or edited.

```
  ┌─ msg1 ─ msg2 ─ msg3 ─ msg4 (branch A, current)
  │
  └─ msg5 ─ msg6 (branch B)

/tree navigates to msg5, continue from there.
```

### /clone

Duplicate the current active branch into a new conversation file. Useful before making experimental changes.

## Send Modifiers

The send button changes behavior based on streaming state and modifier keys. You can also hold a modifier when pressing Enter.

| Modifier                 | While idle                          | While streaming                     |
| ------------------------ | ----------------------------------- | ----------------------------------- |
| Enter (no modifier)      | Send message                        | Steer (interrupts current turn)     |
| **Alt+Enter**            | Follow-up (queues after completion) | Follow-up (queues after completion) |
| **Ctrl+Enter / ⌘+Enter** | Send/steer (same as Enter)          | Send/steer (same as Enter)          |

The button label reflects the current mode: **Send** → **Steer** → **Follow up**.

## Async Follow-Through

While the agent is processing, you can queue additional messages. The composer remains active during streaming.

| Mode      | How to send                                                  | What happens                                                                                                                                          |
| --------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Steer     | Press Enter while the agent is streaming                     | Queues guidance for the current turn. It is injected after the current assistant turn finishes its tool calls, before the next LLM call.              |
| Follow-up | Hold Option/Alt and press Enter while the agent is streaming | Queues a new prompt after the agent completes all current work. Use this when the next instruction should not interrupt the current chain of thought. |

When the run mode has a pending continuation (Nudge/Mission/Loop), normal submits become follow-ups.

Queued steer and follow-up prompts appear in the queue shelf above the composer. Use `restore` to pull a queued prompt back into the composer. Press Escape to abort the active response, clear local queued steer/follow-up prompts, and restore their text to the composer; agent-created queued text is annotated with `[Queued by agent]` so it is not mistaken for user-authored draft text. Press Alt+Up to retrieve queued messages back.

Deferred resumes (`/resume`, `/defer`) also appear in the activity shelf above the composer. They are tied to the saved conversation and can be fired now, cancelled, or auto-resumed when the conversation is reopened.

Interrupted prompts are not replayed automatically after an app restart. Durable run state is used for status and explicit recovery surfaces only; startup recovery must not silently resend the last prompt.

## Provider transport

Desktop conversations force pi's provider transport to SSE at session creation. pi's OpenAI Codex `auto` mode prefers cached WebSockets, but intermittent mid-turn 1006 closes can happen after tools have already run; at that point replaying through SSE is unsafe because it can duplicate side effects. SSE is slower than cached WebSockets, but it keeps conversation/tool execution reliable.

## Goal mode / Auto Mode

The composer exposes a run-mode selector with four states:

| Mode    | Behavior                                                                             |
| ------- | ------------------------------------------------------------------------------------ |
| Manual  | No automatic continuation.                                                           |
| Nudge   | Hidden review turn decides whether useful work remains.                              |
| Mission | Goal-driven mode with an AI-managed task list via the `run_state` tool.              |
| Loop    | Fixed-count mode. The same prompt is repeated until the iteration counter reaches N. |

See [Auto Mode](../extensions/system-auto-mode/README.md) for the full nudge, mission, and loop flows.

### Goal Mode (legacy)

The `goal` tool provides the legacy goal-mode path. Continuations are scheduled only after `agent_end`, Stop pauses an active goal instead of completing it, and repeated `goal { status: "complete" }` calls are idempotent. This is separate from the run-mode selector; only one loop controller can drive a conversation at a time.

## Slash Commands

Type `/` in the composer to open the command menu. Slash commands are intercepted by the UI. Some run local UI actions; others convert into prompts sent to the agent.

| Command           | Action                                                           |
| ----------------- | ---------------------------------------------------------------- |
| `/compact`        | Manually compact conversation context (optionally pass guidance) |
| `/export [path]`  | Export conversation to HTML file                                 |
| `/name <title>`   | Set conversation display name                                    |
| `/run <cmd>`      | Send "Run this shell command: …" to the agent                    |
| `/search <query>` | Send "Search the web for: …" to the agent                        |
| `/summarize`      | Send "Summarize our conversation so far" to the agent            |
| `/think [topic]`  | Send "Think step-by-step about: …" to the agent                  |
| `/copy`           | Copy the last agent message to clipboard                         |

Several of these send a prompt to the agent instead of executing locally: `/run`, `/search`, `/summarize`, `/think`.

Commands accessible through dedicated desktop UI rather than the `/` menu include: `/model` (model picker in composer preferences row), `/fork` (message action menu), `/new` (sidebar + button), `/reload` (Extension Manager), `/clear` (Escape to cancel), `/image` (attachment button), `/draw` (composer input tool), `/session` (info display).

## Bash Commands

The composer supports inline bash execution. The entire input line must start with `!` or `!!`.

| Syntax        | Behavior                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------- |
| `!<command>`  | Runs the shell command. Output streams into the conversation.                             |
| `!!<command>` | Same, but excludes the command and output from the agent's context (reduces token usage). |

Examples:

```
!git status
!!npm test
```

Bash commands create or reuse a live session in the conversation's working directory.

These direct `!` / `!!` commands render as terminal-style transcript output. Regular agent-selected `bash` tool calls stay grouped with the rest of the agent's internal work, and expanding that cluster shows the normal tool disclosure card for the bash step.

## Mention Menu

Type `@` in the composer to search and reference items. The menu surfaces:

- **Files** — workspace files by path
- **Notes** — memory documents by title
- **Tasks** — named automations by ID
- **Skills** — registered skills

Select an item to insert its reference (`@<id>`). The referenced content is injected into the agent's context when the message is sent.

## Reply Quoting

Select any portion of text in a conversation message. A **Reply** action appears that quotes the selection into the composer as a blockquote, making it easy to reference or respond to specific parts of a response.

## Conversation Inspect

The agent can read other conversation transcripts using the `conversation` action `inspect` tool. This provides read-only access to message history, tool calls, and results across conversations. Live and running scopes include other currently active conversations, not just persisted conversation files. See [Conversation Inspect](../extensions/system-conversation-tools/README.md).

## Keyboard Shortcuts

| Action                   | Shortcut              |
| ------------------------ | --------------------- |
| New conversation         | `Cmd+N`               |
| Hide workbench           | `F1`                  |
| Show workbench           | `F2`                  |
| Toggle sidebar           | `Cmd+/` (or `Ctrl+/`) |
| Toggle workbench         | `Cmd+\` (or `Ctrl+\`) |
| Submit message           | Enter                 |
| New line in composer     | Shift+Enter           |
| Cancel agent response    | Escape                |
| Retrieve queued messages | Alt+Up                |

Default desktop shortcuts are configurable in Settings → Desktop. Host and extension command keybindings are configurable in Settings → Commands.

## Routes

The desktop app and system extensions register these routes:

| Route                | Page                  |
| -------------------- | --------------------- |
| `/conversations`     | Conversation list     |
| `/conversations/new` | New conversation      |
| `/conversations/:id` | Existing conversation |
| `/settings`          | Settings page         |
| `/knowledge`         | Knowledge browser     |
| `/automations`       | Automation list       |
| `/automations/:id`   | Automation detail     |
| `/telemetry`         | Telemetry traces      |
| `/gateways`          | Gateway connections   |
