# Todos

Conversation-scoped execution todos for Neon Pilot.

Todos are short-lived working plans shared by the user and agent. They are not projects, schedules, or durable knowledge. Goal mode owns continuation; this extension only tracks what remains.

## Tool

Use the `todo` tool to list, add, update, delete, clear, or atomically replace todos.

Agents should prefer Codex-style full-plan updates for multi-step work or multiple status changes:

```json
{
  "action": "update_plan",
  "plan": [
    { "step": "Inspect relevant files", "status": "completed" },
    { "step": "Implement focused change", "status": "in_progress" },
    { "step": "Run validation", "status": "pending" }
  ]
}
```

`set` also replaces the full list with `items: [{ "text", "status", "note" }]`. Item-level `add`, `update`, and `delete` remain available for one-off edits, but agents should not run parallel item-level updates to mark multiple todos done.

## UI

When enabled, the extension renders a compact composer shelf above the input. The shelf starts collapsed, shows the open-todo count, expands to show only open todos, keeps a small max height with scrolling, and lets the user mark items done or delete items. Completed todos are removed from conversation state automatically.
