# Conversation Tools Extension

This extension owns the product behavior documented below. Keep extension-specific user and agent docs here so the implementation and documentation move together.

---

# Ask User Question

The `ask_user` tool presents interactive prompts to the user through the desktop UI. It supports one or more structured questions with radio and checkbox styles.

## Question Styles

| Style                | Behavior                   | Output                   |
| -------------------- | -------------------------- | ------------------------ |
| `radio`              | Single choice from options | One selected value       |
| `check` / `checkbox` | Multiple choice            | Array of selected values |

## Parameters

| Parameter   | Type     | Description                        |
| ----------- | -------- | ---------------------------------- |
| `details`   | string   | Context or description             |
| `questions` | object[] | Question prompts (max 8 questions) |

### Question object

When using `questions[]`, each question has:

| Field     | Type                               | Description                            |
| --------- | ---------------------------------- | -------------------------------------- |
| `id`      | string                             | Stable identifier for tracking answers |
| `label`   | string                             | User-facing question                   |
| `details` | string                             | Supporting context                     |
| `style`   | `"radio"`, `"check"`, `"checkbox"` | Input style                            |
| `options` | array                              | Available answers (max 12)             |

### Option object

Options can be simple strings or objects:

```typescript
// Simple string
"red"

// Object with details
{
  "value": "red",
  "label": "Red Theme",
  "details": "Warm color scheme with high contrast"
}
```

## Examples

### Single question

```json
{
  "question": "What color scheme?",
  "details": "Choose the theme color for the new dashboard",
  "options": ["red", "green", "blue"]
}
```

### Radio question

```json
{
  "questions": [
    {
      "id": "theme",
      "label": "Theme color",
      "style": "radio",
      "options": [
        { "value": "light", "label": "Light", "details": "Light background" },
        { "value": "dark", "label": "Dark", "details": "Dark background" }
      ]
    }
  ]
}
```

### Multi-question form

```json
{
  "questions": [
    {
      "id": "layout",
      "label": "Layout style",
      "style": "radio",
      "options": ["compact", "comfortable"]
    },
    {
      "id": "features",
      "label": "Enable features",
      "style": "check",
      "options": [
        { "value": "search", "label": "Web Search" },
        { "value": "images", "label": "Image Generation" },
        { "value": "browser", "label": "Browser" }
      ]
    }
  ],
  "details": "Configure your workspace preferences"
}
```

## Limits

| Limit                    | Value |
| ------------------------ | ----- |
| Max questions per call   | 8     |
| Max options per question | 12    |

## Desktop UI Rendering

In the desktop app, questions render as a modal dialog:

- **Radio** — radio buttons with one selection
- **Check/checkbox** — checkboxes with multiple selection

The user must respond before the agent continues. The response is returned to the agent as structured data.

---

# Change Working Directory

The `neon-pilot conversations cwd` CLI command switches the conversation's working directory. After the change, all tool calls (file reads, shell commands, file writes) execute relative to the new directory.

## Parameters

| Parameter        | Type   | Required | Description                                                                                                                                                                    |
| ---------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cwd`            | string | yes      | Target directory. Relative paths resolve from the current conversation cwd, or from the target conversation cwd when a `conversationId` is supplied through the admin/CLI form |
| `conversationId` | string | no       | Target conversation id for the `conversation_admin` / `neon-pilot conversations cwd` form; defaults to the calling conversation                                                |
| `continuePrompt` | string | no       | Prompt to execute automatically after the directory switch                                                                                                                     |

## Behavior

1. The tool validates that the target directory exists
2. If the calling conversation is not currently live, the tool returns an unavailable/no-op result instead of a tool error
3. If valid, the conversation's cwd is updated
4. All subsequent tool calls use the new cwd as their working directory
5. If `continuePrompt` is provided, that prompt is queued as a follow-up

```json
// Change to a subdirectory
{ "cwd": "packages/core/src" }

// Change to an absolute path and continue working
{ "cwd": "/Users/me/other-project", "continuePrompt": "Review the README" }
```

## Scope

- The split `change_working_directory` tool affects only the calling conversation
- The admin/CLI form can target another conversation by id
- Other conversations retain their own working directories
- The change persists for the lifetime of the conversation
- If `continuePrompt` is provided, it runs in the new directory automatically

## Validation

| Condition                          | Result                            |
| ---------------------------------- | --------------------------------- |
| Target directory exists            | Cwd is updated                    |
| Target directory does not exist    | Error returned, cwd unchanged     |
| Target is a file (not a directory) | Error returned                    |
| Relative path with no current cwd  | Error returned                    |
| Calling session is not live        | Unavailable result, cwd unchanged |

## Use Cases

- **Deep navigation** — move from project root to `packages/core/src` for focused work
- **Multi-project sessions** — switch between projects without starting a new conversation
- **Build operations** — change to a subdirectory to run build commands
- **File operations** — navigate to the directory containing the files being edited

## Compared to @ references

|          | `neon-pilot conversations cwd`          | `@` file reference          |
| -------- | --------------------------------------- | --------------------------- |
| Scope    | All subsequent tool calls               | Single message              |
| Cwd      | Permanently changed                     | Unchanged                   |
| Use case | Working in a different part of the tree | Referencing a specific file |

---

# Conversation Inspect (CLI/Admin)

The `neon-pilot conversations inspect` CLI command and canonical `neon_pilot` admin surface give agents read-only access to other conversation transcripts. It can list, search, query, outline, and diff conversations without modifying any state. Live and running scopes include other currently active conversations, not just persisted session files.

## Actions

### list

List conversations with optional filters:

| Parameter        | Type                                         | Description                                       |
| ---------------- | -------------------------------------------- | ------------------------------------------------- |
| `scope`          | `"all"`, `"live"`, `"running"`, `"archived"` | Filter by conversation state                      |
| `cwd`            | string                                       | Filter by working directory                       |
| `query`          | string                                       | Filter by metadata text                           |
| `includeCurrent` | boolean                                      | Include the calling conversation (default: false) |

### search

Search transcript text across conversations:

| Parameter    | Type                                  | Description               |
| ------------ | ------------------------------------- | ------------------------- |
| `query`      | string                                | Text to search for        |
| `scope`      | string                                | Conversation scope filter |
| `cwd`        | string                                | Working directory filter  |
| `searchMode` | `"phrase"`, `"allTerms"`, `"anyTerm"` | How to match the query    |

### query

Query specific blocks within a single conversation:

| Parameter        | Type              | Description            |
| ---------------- | ----------------- | ---------------------- |
| `conversationId` | string            | Target conversation    |
| `types`          | string[]          | Block types to include |
| `roles`          | string[]          | Roles to include       |
| `tools`          | string[]          | Tool names to filter   |
| `text`           | string            | Text content filter    |
| `afterBlockId`   | string            | Start after this block |
| `beforeBlockId`  | string            | End before this block  |
| `order`          | `"asc"`, `"desc"` | Sort order             |
| `limit`          | number            | Max blocks to return   |

### outline

Get an outline of a conversation with anchors for navigation:

| Parameter        | Type   | Description         |
| ---------------- | ------ | ------------------- |
| `conversationId` | string | Target conversation |

Returns anchor points including the first user prompt, recent prompts, and key structural markers.

### diff

Compare two snapshots of a conversation to find what changed between calls.

### read_window

Read a context window around a specific block:

| Parameter        | Type   | Description                    |
| ---------------- | ------ | ------------------------------ |
| `conversationId` | string | Target conversation            |
| `aroundBlockId`  | string | Center block ID                |
| `window`         | number | Context lines before and after |

## Block Types

Blocks are structural units in a conversation transcript:

| Type       | Content                          |
| ---------- | -------------------------------- |
| `user`     | User messages                    |
| `text`     | Assistant text responses         |
| `tool_use` | Tool calls made by the assistant |
| `image`    | Image attachments                |
| `error`    | Tool execution errors            |
| `context`  | Context injections               |
| `summary`  | Conversation summaries           |

Roles: `user`, `assistant`, `tool`, `context`, `summary`, `image`, `error`.

## Search Modes

| Mode       | Behavior                                               |
| ---------- | ------------------------------------------------------ |
| `phrase`   | Match the exact phrase (default)                       |
| `allTerms` | Match blocks containing all whitespace-separated terms |
| `anyTerm`  | Match blocks containing any whitespace-separated term  |

## Read-Only Guarantee

The inspect tool cannot create, modify, or delete conversation state. It is strictly for reading transcripts, tool calls, results, and metadata across threads. No conversation state is altered.

## Use Cases

- The agent checks a related conversation for context before answering
- The agent searches past conversations for similar problems
- The agent reviews tool output from another thread
- The agent finds a specific piece of information across all conversations

---

# Conversation Admin (CLI/Admin)

Conversation administration is exposed through `neon-pilot conversations ...` externally and the canonical `neon_pilot` tool internally. It includes the read-only inspect, ask, title, cwd, and deferred-resume behaviors above, plus cross-conversation write/control actions backed by the host `ctx.conversations` API.

Before targeting an unclear conversation, use `action: "inspect"` with `inspectAction: "list"` or `inspectAction: "search"` to find the right `conversationId`.

## Admin Actions

| Action                    | Required fields                                  | Behavior                                                                                                                                             |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create`                  | none                                             | Creates a conversation. Supports `title`, `cwd`, `live`, `prompt`, `initialPrompt`, `model`, `thinkingLevel`, `serviceTier`, and `allowedToolNames`. |
| `ensure_live`             | `conversationId`                                 | Resumes a persisted conversation into the live registry. Optional `cwd`.                                                                             |
| `send_message`            | `conversationId`, `text`                         | Sends a prompt/follow-up/steer into a live conversation. Supports `steer` and `images`.                                                              |
| `run_turn`                | `conversationId`, `text`                         | Ensures the target is live, sends the message, and waits for turn completion. Supports `cwd`, `steer`, `images`, and `timeoutMs`.                    |
| `abort`                   | `conversationId`                                 | Aborts a live conversation turn. Host live-state errors are returned directly.                                                                       |
| `set_title`               | `title`                                          | Sets the current conversation title, or another conversation when `conversationId` is provided.                                                      |
| `compact`                 | `conversationId`                                 | Triggers compaction on a live conversation. Optional `customInstructions`.                                                                           |
| `fork`                    | `conversationId`                                 | Forks a live conversation. Supports `targetCwd`, `cwd`, and `title`.                                                                                 |
| `set_active_tools`        | `conversationId`, `toolNames`                    | Replaces active tools for a live conversation.                                                                                                       |
| `workspace_get`           | none                                             | Reads open, pinned, archived, active, workspace path, and remote-controlled conversation state.                                                      |
| `workspace_update`        | any workspace field                              | Updates only provided workspace fields: open, pinned, archived, active, paths, or remote-controlled ids.                                             |
| `workspace_open_update`   | `operation`                                      | Ergonomic CLI-only open/sidebar mutation for add, remove, pin, unpin, active, archive, and unarchive.                                                |
| `append_transcript_block` | `conversationId`, `blockType`, `data`            | Appends an extension-owned visible transcript block. Optional `title`, `blockId`.                                                                    |
| `update_transcript_block` | `conversationId`, `blockType`, `blockId`, `data` | Updates an extension-owned visible transcript block.                                                                                                 |
| `rollback`                | `conversationId`                                 | Rolls back a live conversation by `count` turns. Defaults to `1`.                                                                                    |

Use `neon-pilot ask` for one-shot external delegation: it creates a normal conversation, runs one turn, and returns the answer plus conversation id. Use `run_turn`/`neon-pilot conversations run-turn` when the caller already has a conversation id and needs to wait for the remote conversation to finish. Use `send_message` for fire-and-forget steering or follow-up delivery. Use the unified deferred-resume admin command for time-based continuation; do not run sleeping shell commands as timers.

## Examples

Use `workspace_get` for open/sidebar thread state. Do not use `scope: "running"` as a synonym for open threads; running/live scopes describe runtime execution state, not sidebar membership.

```json
{ "action": "workspace_get" }
```

```json
{ "action": "send_message", "conversationId": "conv-123", "text": "Please summarize your current state.", "steer": true }
```

```json
{
  "action": "run_turn",
  "conversationId": "conv-123",
  "text": "Finish the validation pass and report the result.",
  "timeoutMs": 180000
}
```

```json
{
  "action": "workspace_update",
  "openConversationIds": ["conv-123"],
  "remoteControlledConversationIds": ["conv-123"]
}
```

## CLI

The `neon-pilot conversations ...` CLI maps onto the same admin action backend. Prefer the CLI for Neon Pilot self-administration from shell or agent workflows:

```sh
neon-pilot conversations list --scope all --json
neon-pilot conversations inspect <id> outline --json
neon-pilot conversations ensure-live <id> --json
neon-pilot conversations send <id> --text "message" --json
neon-pilot conversations run-turn <id> --text "prompt" --timeout-ms 120000 --json
neon-pilot ask --model opencode-go/deepseek-v4-flash --cwd /repo "prompt"
neon-pilot conversations workspace --json
neon-pilot conversations workspace update --open conv-a,conv-b --active conv-b --json
neon-pilot conversations open list --json
neon-pilot conversations open add conv-a conv-b --json
neon-pilot conversations open pin conv-a --json
neon-pilot conversations open active --json
neon-pilot conversations open active conv-b --json
neon-pilot conversations open active --clear --json
neon-pilot conversations archive conv-old --json
neon-pilot conversations unarchive conv-old --json
neon-pilot conversations delete conv-old --json
neon-pilot conversations retention prune --older-than 180d --archived-only --dry-run --json
neon-pilot conversations transcript append <id> --type text --data '{"text":"note"}' --json
```
