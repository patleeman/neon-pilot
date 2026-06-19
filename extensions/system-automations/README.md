# Automations Extension

This extension owns the product behavior documented below. Keep extension-specific user and agent docs here so the implementation and documentation move together.

---

# Automations

Automations is the desktop UI for inspecting and managing event-driven background work. Navigate to `/automations` to see meaningful automation events flowing through the activity stream, inspect the selected event's causal trace, and administer the publisher or reaction that caused work.

Scheduled tasks are still backed by the daemon scheduler, but the default UI presents them as event-native activity:

```
schedule producer -> event -> reaction -> agent/thread/script/published event
```

The timeline intentionally does not show every possible emitted event. It focuses on events that caused or attempted work, plus scheduler/publisher states that need user attention.

## Activity Timeline

The Automations page opens on a timeline-first view with two main regions:

- **Event Stream** — compact chronological events with event name, source, relative time, status, and match count.
- **Inspector** — selected event status, source, consumer, causal trace, and direct actions.

Reaction lanes show the kind of consumer an event flowed into:

- Agent
- Script
- Thread
- Published Event

The default actions are:

- **Re-emit Event** — trigger the selected automation now using the current runtime rules.
- **Create Reaction** — open the automation editor for a new or selected reaction.
- **Open Thread** — jump to the bound conversation when the selected reaction targets a thread.
- **Pause Publisher** — disable the selected scheduled publisher without deleting it.

Past-due, failed, running, disabled, and scheduled automations appear as event activity rather than separate table sections.

## Detail View

Click an automation to open its detail page. Shows:

**Configuration:**

- Title and ID
- Schedule (cron or one-time)
- Target type and thread binding
- Prompt to execute
- Model override (if any)
- Working directory
- Timeout setting

**Activity history:**

A chronological log of every execution:

| Column  | Description                       |
| ------- | --------------------------------- |
| Time    | When it ran                       |
| Outcome | Success, failure, or timeout      |
| Error   | Error message (if failed)         |
| Run ID  | Associated run for log inspection |

**Actions:**

- Run now — trigger immediate execution
- Enable/disable — toggle without deleting
- Edit — modify configuration
- Delete — remove the automation

## Creating an Automation

From the list view, click "New Automation" or run **New Automation** from the command palette. The editor uses the Settings page layout with a right-side "On this page" rail and five sections:

- **General** — automation name, recurring instruction, and enabled state
- **Schedule** — recurring vs one-time scheduling, human-readable schedule presets, and a preview
- **Policies** — attached first-party run rules such as catch-up, overlap handling, and once-per-period limits
- **Delivery** — background/conversation target plus thread binding; existing threads are selected from a dropdown
- **Runtime** — optional working directory with folder picker, model dropdown, thinking level, and timeout

The UI avoids raw cron entry for common creation/editing paths; selected presets are translated to scheduler syntax internally.

## Inspecting Runs

The timeline shows the automation-level trace. Durable background run logs still live in the Runs extension. See [Runs](../system-runs/README.md) for run reference.

## Relationship to the Daemon

Automations are stored in the daemon's automation store (SQLite database at `<state-root>/daemon/`). The daemon scheduler checks for due automations and executes them. The UI communicates with the daemon through the tasks API.

---

# Scheduled Tasks

Scheduled tasks are persistent automations managed by the daemon. They run on a schedule (cron or one-time) and can execute as background agents or post to conversation threads.

## Task Definition

Each scheduled task has these fields:

| Field                  | Type                                     | Description                                                   |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `title`                | string                                   | Human-readable name                                           |
| `cron`                 | string                                   | Cron expression for recurring schedule                        |
| `at`                   | string                                   | ISO timestamp or natural language for one-time                |
| `targetType`           | `"background-agent"` or `"conversation"` | Where the task executes                                       |
| `prompt`               | string                                   | Prompt to execute when the task fires                         |
| `model`                | string                                   | Optional model override                                       |
| `cwd`                  | string                                   | Working directory                                             |
| `timeoutSeconds`       | number                                   | Per-run timeout                                               |
| `catchUpWindowSeconds` | number                                   | Missed-run catch-up window; cron tasks default to 900 seconds |
| `policies`             | array                                    | First-party run policies persisted with the automation        |
| `threadMode`           | `"dedicated"`, `"existing"`, or `"none"` | Thread binding                                                |
| `threadConversationId` | string                                   | Existing conversation ID for thread binding                   |
| `enabled`              | boolean                                  | Whether the task is active                                    |

## Schedule Formats

### Cron expressions

Standard 5-field cron: `minute hour day month weekday`

```
"0 9 * * 1-5"    Every weekday at 9:00
"*/15 * * * *"   Every 15 minutes
"0 0 * * *"      Daily at midnight
```

### One-time

ISO timestamps or natural language:

```
"2026-06-01T09:00:00Z"
"tomorrow 8pm"
"now+1d@20:00"
```

## Thread Modes

| Mode        | Behavior                                                           |
| ----------- | ------------------------------------------------------------------ |
| `dedicated` | Creates a new conversation for each execution with a unique ID     |
| `existing`  | Posts to a specific existing conversation (`threadConversationId`) |
| `none`      | Runs without conversation interaction (background agent only)      |

## Catch-Up Window

If the daemon was offline when a scheduled time passed, the catch-up policy controls whether the missed execution fires when the daemon restarts. Set its window in seconds. Cron automations default to 15 minutes (`900`) so a short app restart, laptop wake, or daemon restart does not silently skip the run. A 5-minute window (`300`) means: if the daemon was offline for less than 5 minutes past the scheduled time, the task runs on restart.

## Policies

Automation policies are first-party rules attached to a scheduled automation. The scheduler currently enforces:

- `catch_up` — run the latest missed cron slot if it is still inside the policy window.
- `overlap` — skip a due run while the previous run is still active.
- `once_per_period` — allow at most one successful run in a day, week, or month. Use this with a broad recurring schedule when the automation should run once per period and the exact eligible minute does not matter.

## Execution Flow

```
Scheduler tick ──► Check due tasks ──► For each due task:
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                        background-agent  conversation  conversation
                                          dedicated     existing
                              │            │            │
                              ▼            ▼            ▼
                         Run prompt    New thread    Post to thread
```

## Task Activity

Skipped and missed scheduler decisions are recorded as automation activity:

| Field              | Description                              |
| ------------------ | ---------------------------------------- |
| `createdAt`        | When the scheduler recorded the decision |
| `outcome`          | `skipped` or `catch-up-started`          |
| `count`            | Number of missed scheduled slots         |
| `firstScheduledAt` | First missed scheduled slot              |
| `lastScheduledAt`  | Latest missed scheduled slot             |

Activity is viewable in the Automations UI. Skipped cron slots outside the catch-up window and overlap skips also raise an active alert so missed automations are visible instead of silent. Normal executions still write durable run records and logs.

The Automations page also shows scheduler health from the daemon scheduler state. If the scheduler has not checked schedules within the stale window, the UI surfaces a warning and raises an active alert. Automation detail pages show the latest expected scheduled slot next to the actual recorded result, so a missing run is visible without spelunking through logs. Failures that happen before a durable run can be created are recorded as automation activity and alerted separately.

## Heartbeats

A heartbeat is a recurring conversation-target scheduled task for agent self-administration. It is not a separate product store: it uses the scheduled task daemon, an existing conversation thread binding, and the standard overlap skip policy so due ticks coalesce when the thread is already running.

Heartbeats are managed through the unified Neon Pilot admin surface, backed by the same automation schema/service as scheduled tasks:

```sh
neon-pilot heartbeats start <heartbeat-id> --interval-minutes 5 --conversation-id <conversation-id> --prompt "Wake up, check whether work remains, and stop this heartbeat when done." --json
neon-pilot heartbeats list --json
neon-pilot heartbeats stop <heartbeat-id> --json
```

Internal agents use the `neon_pilot` tool with `heartbeat_start`, `heartbeat_list`, and `heartbeat_stop`. `--interval-minutes N` is stored as the cron wrapper `*/N * * * *`; use scheduled task cron automation for cadences that do not fit that form. The callback stops itself through the admin surface when its done condition is met.

## Agent Tool Reference

The `scheduled_task` tool manages tasks from within a conversation:

| Action     | Description                 |
| ---------- | --------------------------- |
| `list`     | List tasks                  |
| `get`      | Get a task by ID            |
| `save`     | Create or update a task     |
| `delete`   | Delete a task               |
| `validate` | Validate task configuration |
| `run`      | Trigger immediate execution |

## Managing Tasks

Tasks are managed through the `scheduled_task` agent tool or the Automations UI. See [Automations](README.md) for the desktop UI.

---

# Follow-up Queue

Follow-up queue entries resume the current conversation later. They are conversation-bound and are the only user-facing tool for same-thread delayed continuation.

Use the the unified conversation deferred-resume admin command from within a conversation for explicit wait/resume requests. Do not use `bash` + `sleep` as a timer.

## Actions

| Action   | Description                                    |
| -------- | ---------------------------------------------- |
| `add`    | Queue a follow-up after this turn or at a time |
| `list`   | List queued follow-ups for this conversation   |
| `cancel` | Cancel a queued follow-up by listed `id`       |

## Add by delay

```json
{
  "action": "add",
  "trigger": "delay",
  "delay": "30s",
  "prompt": "Check if the build finished",
  "title": "Build check"
}
```

## Add by absolute time

```json
{
  "action": "add",
  "trigger": "at",
  "at": "tomorrow 8pm",
  "prompt": "Check whether the release is ready",
  "title": "Release check"
}
```

## Add after current turn

```json
{
  "action": "add",
  "trigger": "after_turn",
  "prompt": "Continue with the next step"
}
```

Supported time formats match scheduled tasks: ISO timestamps, natural language, and explicit forms like `now+1d@20:00`.

## Relationship to scheduled tasks

|             | Follow-up queue          | Scheduled tasks                  |
| ----------- | ------------------------ | -------------------------------- |
| Scope       | Current conversation     | App-wide                         |
| Trigger     | After-turn, delay, time  | Cron or one-time                 |
| Target      | Always this conversation | Background agent or conversation |
| Persistence | Deferred resume state    | Automation store                 |

Use the unified conversation deferred-resume admin command when this conversation should continue later. Use `scheduled_task` when unattended work should run on a schedule.
