# Daemon

The daemon is a long-lived background process that owns durable runtime behavior. The desktop app manages it automatically — start and stop happen with the app lifecycle.

## What the Daemon Owns

| Component       | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| Background work | Detached commands and subagents, started from conversations, inspected later  |
| Scheduled tasks | Recurring or one-time automations with cron or natural-language schedules     |
| Wakeups         | Conversation callbacks triggered by completed background work and automations |
| Follow-up queue | Tell-me-later wakeups that resume a specific conversation                     |

## Lifecycle

The desktop app starts a backend child process after the first window has a chance to paint. That backend child owns the daemon runtime in-process and sends SIGTERM-equivalent shutdown through the daemon lifecycle when the app quits. The daemon still communicates over a local Unix socket for daemon-client APIs inside the backend boundary.

```
Desktop app/menu shell ←──→ Backend child process
                              │
                              └── Daemon runtime
                                    │
                                    ├── Runtime DB (SQLite)
                                    ├── Automation store
                                    ├── Run logs
```

If the backend child crashes or is killed, the desktop app marks the local runtime unavailable and can restart it automatically through the local host controller.

## Durable Agent Runs

Subagents and scheduled agent tasks run through the daemon's internal background agent runner. The daemon still spawns a child process for isolation, logs, cancellation, and replay, but that child imports the same server-side agent session stack used by live conversations instead of shelling out to the `pi` or `pa` CLI binaries.

## Daemon State API

| Endpoint      | Method | What it returns                          |
| ------------- | ------ | ---------------------------------------- |
| `/api/daemon` | GET    | Current daemon runtime status and uptime |

### State response

```json
{
  "running": true,
  "pid": 82341,
  "uptimeMs": 2845000
}
```

## State Storage

The daemon stores its state in `<state-root>/daemon/` by default. If `NEON_PILOT_DAEMON_NAMESPACE` is set, daemon runtime files live in `<state-root>/daemon-<namespace>/`; the namespace is sanitized for path safety. Dev/test desktop processes set a unique namespace per invocation unless one is explicitly provided, so multiple dev/test apps can run without sharing sockets, pid locks, runtime DBs, or logs. If `NEON_PILOT_DAEMON_SOCKET_PATH` is set, daemon runtime files live beside that explicit socket path instead and the namespace is ignored; this lets dev hosts pin a specific isolated runtime DB.

| Path         | Content                                                      |
| ------------ | ------------------------------------------------------------ |
| `runtime.db` | SQLite database for durable runs, scheduled tasks, reminders |
| `socket`     | Local Unix socket for desktop app communication              |
| `logs/`      | Background work output logs                                  |

On startup, the runtime DB is integrity-checked before schema setup. If SQLite reports corruption, the app tries to recover it with `sqlite3 .recover`, quarantines the original files under `.corrupt/`, and recreates a healthy DB if recovery is unavailable.

## Configuration

Daemon settings are part of the main config.json:

```json
{
  "daemon": {}
}
```

Most daemon settings are managed through the desktop Settings UI and do not require manual config file edits.
