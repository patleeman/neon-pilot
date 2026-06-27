# Automations Extension

This extension owns scheduled, thread-owned automations.

## Product model

Automations are schedule-first and always auditable from a conversation thread:

- Every automation has one owner thread.
- No automation runs invisibly or without a thread.
- When a schedule fires, the backend opens/unarchives the owner thread in persisted workspace state without stealing frontend focus.
- The run is recorded in the owner thread transcript as a collapsed `Automation run` context entry.
- The conversation shelf and sidebar use backend task state; enabled or running automations keep their owner thread visibly marked.
- The Automations page is a single table: status, automation, schedule, next run, last run, owner thread, and actions.

The old durable event-bus product path is no longer part of Automations. Schedules run directly through the daemon task scheduler instead of emitting durable `schedule.due` events and dispatching subscriptions.

## Creating an automation

From `/automations`, click **New automation**. Choose:

| Field             | Description                                    |
| ----------------- | ---------------------------------------------- |
| Name              | User-facing automation name.                   |
| Owner thread      | Existing thread where runs are audited.        |
| Schedule          | Recurring cron or one-time ISO/natural time.   |
| Instructions      | Prompt the agent runs when the schedule fires. |
| Working directory | Optional cwd for the run.                      |
| Timeout seconds   | Per-run timeout from 1 second to 7 days.       |
| Enabled           | Whether the schedule is active.                |

Creating from chat through the `scheduled_task` tool defaults to the current conversation when available; otherwise it creates a dedicated owner thread. Creating from the Automations page requires selecting an existing owner thread.

## Scheduled task tool

Use `scheduled_task` for persistent one-time or recurring automations.

Important behavior:

- New tasks default to `targetType: "conversation"`.
- `threadMode: "none"` is rejected.
- `threadMode` supports `"existing"` and `"dedicated"`.
- Every fire that starts an agent writes a collapsed owner-thread transcript context entry.
- Failure notifications are raised through alerts; success notifications are not shown by default.

## Schedule formats

### Cron

Standard 5-field cron:

```text
*/15 * * * *     Every 15 minutes
0 9 * * 1-5      Weekdays at 9:00
0 17 * * 5       Fridays at 17:00
```

### One-time

ISO timestamps or supported natural-language inputs:

```text
2026-06-01T09:00:00Z
tomorrow 8pm
now+1d@20:00
```

## Runtime behavior

1. Scheduler tick finds due tasks.
2. Backend resolves/creates the owner thread.
3. Backend opens/unarchives that thread in saved workspace state.
4. If the live conversation runtime is available, the prompt is delivered there.
5. If only the standalone runner is available, it runs without writing a hidden session branch and the captured result is appended as an automation transcript entry.
6. Durable run logs and status are still written for inspection.
7. Task snapshots update the shelf/table/sidebar.

On startup, the scheduler recovers interrupted durable scheduled-task runs by task id even if the crash happened before the runtime state persisted the active run id.

## Missed, skipped, and failed runs

- Catch-up policies can run the latest missed cron slot if it is still inside the catch-up window.
- Overlapping runs are skipped and surfaced.
- Failures before durable run creation are recorded as automation activity and alerted.
- Failed runs write a collapsed owner-thread transcript context entry with the error and log path when available.

## CLI

Use scheduled task commands:

```sh
neon-pilot tasks list --json
neon-pilot tasks save release-watch --cron '*/15 * * * *' --thread-mode existing --thread-conversation-id <thread-id> --prompt 'Check release status' --json
neon-pilot tasks run release-watch --json
neon-pilot tasks delete release-watch --json
```
