# Background Work Extension

This extension owns the UI and agent tools for detached background work.

Product-facing UI is moving to the **Execution** model. A durable run is the daemon/runtime storage record; an execution is the app-level projection used by routes, extension APIs, and conversation-scoped UI. Do not add new product UI that filters raw `/api/runs` records directly.

Background work has two user-facing shapes:

| Type               | Description                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Background command | A daemon-backed shell command with logs, status, cancel, and rerun behavior.                            |
| Subagent           | A daemon-backed agent delegation with prompt, model, transcript/result, follow-up, and cancel behavior. |

Product UI and agent-facing surfaces should say **Background commands** or **Subagents** instead of exposing a generic run abstraction.

## Lifecycle

```text
Created -> Queued -> Running -> Completed
                         |-> Failed
                         |-> Cancelled
```

## Tool guidance

- Use `bash` for shell commands. Set `background: true` when the command should run durably outside the current turn.
- Prefer the dedicated `subagent` tool for delegated agent work, including `get`, `logs`, `rerun`, `follow_up`, and `cancel` on subagent IDs.
- `subagent.allowedTools` accepts agent tool names, not shell commands. Use names like `bash`, `read`, `edit`, `web_fetch`, `conversation` action `inspect`, or `checkpoint`; for `rg`, `grep`, `find`, or `ls`, allow `bash` and run the command inside bash.
- Keep `scheduled_task` separate for persistent automations.
- `background_bash` is shell-only; it lists/inspects background commands and rejects subagent IDs with a hint to use `subagent`.
- Use the unified conversation deferred-resume admin command for “wait, then continue this conversation” requests. Do not use foreground `bash` with `sleep` as a timer.
- Do not pair `deliverResultToConversation: true` background work with a wakeup that only polls the same run. Completion delivery already resumes the conversation; use a wakeup only for a distinct time-based action. If a distinct action is genuinely needed, pass a clear `reason` to the unified conversation deferred-resume admin command.

## UI

Background work appears inline in the transcript:

- Background command starts and delivered completion callbacks render inline run cards with expandable status, metadata, and log tail.
- Subagent starts link to the child conversation when one exists.
- The core composer activity shelf surfaces active background work from the Execution projection while a conversation is in progress; the extension must not poll raw durable runs from renderer UI.

The extension no longer contributes a right-side Background work/Runs workbench panel.

Execution detail and actions use the execution API where a UI needs live execution data:

- `GET /api/executions/:id`
- `GET /api/executions/:id/log`
- `GET /api/executions/:id/events`
- `POST /api/executions/:id/cancel`
- `POST /api/executions/:id/rerun`
- `POST /api/executions/:id/follow-up`

The backend may still store executions as durable run records; that storage detail should not leak into product copy. Any durable-run mutation that affects visible background work must invalidate `executions` so the sidebar, activity tree, inline run cards, and activity shelf refresh from the product projection.
