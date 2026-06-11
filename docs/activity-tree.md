# Activity tree

The activity tree is the shared model for showing conversations, executions, terminals, artifacts, and other work items in one sidebar tree.

Neon Pilot's left sidebar is moving toward an activity tree instead of a conversation-only list. The tree consumes the product-facing **Execution** projection for background work. Durable runs remain the daemon/runtime storage record for logs, checkpoints, recovery, and compatibility; product UI should not infer visible background work from raw run records.

## Item model

Activity items use stable prefixed IDs so different systems can share the same tree without ID collisions:

- `conversation:<conversationId>` for conversations
- `execution:<executionId>` for background commands, subagents, and other execution records

Each item carries a `kind`, `title`, optional `parentId`, `status`, `route`, and small metadata payload. The model intentionally stays data-only; UI components and extensions should decorate rows rather than own routing, selection, or keyboard behavior.

## Current implementation

The adapter lives at `packages/desktop/ui/src/activity/activityTree.ts` and currently supports:

- working directory group items
- conversation items
- conversation lineage metadata remains available to transcript/topology views, but the left sidebar intentionally renders conversations as flat rows under their working directory group
- execution items projected by `packages/desktop/server/executions/executionService.ts`
- execution nesting via `execution.conversationId`
- normalized status values: `idle`, `running`, `queued`, `failed`, `done`

`packages/desktop/ui/src/activity/activityTreePaths.ts` converts activity items into stable tree paths, and `ActivityTreeView.tsx` is the reusable native React renderer. The left sidebar renders working directory groups, flat conversation rows, and linked execution records through the shared tree, decorates running/failed/done rows, and exposes working directory actions plus conversation actions for open, pin/unpin, close, archive, copy, duplicate, and extension-provided conversation-list context menu items.

Do not nest conversation rows in the sidebar. Parent/child branch topology belongs in the transcript itself: explicit branch actions render as timeline landmarks, while tool-created side work (subagents, artifacts, checkpoints, prompts, and visual captures) is pinned inside internal-work shelves instead of becoming loose transcript cards. Sidebar interactions should stay one-row-in/one-row-out: closing, dragging, archiving, and reordering a conversation must not implicitly act on its children or parent.

## Execution boundary

Use executions for product UI freshness:

- sidebar pending/running indicators
- activity tree rows
- conversation background-work rail
- background-work detail actions (`cancel`, `rerun`, `follow-up`)

The conversation background-work shelf is a backend-truth view. It consumes the conversation activity projection and uses app-wide execution snapshots only as refresh hints. Do not derive shelf rows from the global renderer execution cache; stale cache entries can make completed background commands or subagents look live. The backend endpoint owns active-status filtering and durable-run reconciliation before returning rows as active.

Use durable runs only inside low-level detail/log plumbing, daemon recovery, and agent-facing `background_bash`/`subagent` APIs. Any durable-run mutation that can affect visible background work must invalidate the `executions` topic; invalidating `runs` alone is not enough.

## Conversation activity

The conversation composer shelf is backed by a shared backend **conversation activity** projection at
`/api/conversations/:id/activity`. It is the thread-level registry for connected work such as active executions, queued
prompts, deferred resumes, and linked scheduled tasks.

Use this projection when a frontend surface, CLI command, or extension needs to answer “what is attached to this
conversation right now?” Do not reconstruct shelf state from raw durable runs, task files, live queue internals, or
renderer stores in each consumer. Add new providers to the backend projection so every consumer gets the same item IDs,
statuses, visibility, and actions.

Conversation activity items use stable prefixed IDs:

- `execution:<executionId>` for background commands, subagents, and execution-backed work
- `queued-prompt:<queueType>:<promptId>` for live queued steer/follow-up prompts
- `deferred-resume:<resumeId>` for deferred conversation wakeups
- `scheduled-task:<taskId>` for automations linked to the conversation
