# Self Preservation

Blocks the agent from killing its own process via the `bash` tool.

## What it blocks

### `kill` command

- `kill <agent_pid>`
- `kill -9 <agent_pid>`
- `kill -SIGTERM <agent_pid>`
- `sudo kill <agent_pid>`
- `/bin/kill <agent_pid>`

### `pkill` / `killall` / `killall5`

Targets matching (case-insensitive):

- `neon-pilot` (covers RC, testing, any variant)
- `pi-coding-agent`
- `node`

## How it works

Uses the `tool_call` agent lifecycle hook to intercept bash commands before execution. Returns `{ block: true, reason }` to veto the call.

## Tests

```bash
npx vitest run installable-extensions/system-self-preservation/src/backend.test.ts
```
