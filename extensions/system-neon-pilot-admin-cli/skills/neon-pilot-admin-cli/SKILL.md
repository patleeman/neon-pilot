---
name: neon-pilot-admin-cli
description: Use the Neon Pilot Admin CLI for self-administration of conversations, workspace/sidebar state, runs, automations, extensions, settings, and extension-contributed administration surfaces.
---

# Neon Pilot Admin CLI

Use the `neon-pilot` CLI as the primary Neon Pilot self-administration surface when it is available in the agent shell. Prefer CLI + JSON over direct runtime-file edits or lower-level tools.

## Workflow

1. Discover commands before using an unfamiliar surface:

   ```sh
   neon-pilot commands --json
   neon-pilot help conversations
   ```

2. Prefer JSON for inspection and automation:

   ```sh
   neon-pilot extensions list --json
   neon-pilot settings list --json
   neon-pilot conversations list --json
   neon-pilot conversations workspace --json
   neon-pilot cli status --json
   ```

3. Inspect before mutating shared state. For conversation/sidebar state, read the workspace first:

   ```sh
   neon-pilot conversations workspace --json
   neon-pilot conversations workspace update --open conv-a,conv-b --active conv-b --json
   ```

4. For extension work, validate and reload after edits:

   ```sh
   neon-pilot extensions validate system-example
   neon-pilot extensions reload system-example
   ```

5. Use normal shell commands for repository work such as `pnpm`, `git`, `rg`, and file validation.

## Conversation administration

Use `conversations ...` commands for agent-side conversation management:

```sh
neon-pilot conversations list --scope all --json
neon-pilot conversations search "query" --json
neon-pilot conversations inspect <id> outline --json
neon-pilot conversations create --title "Thread" --cwd /repo --json
neon-pilot conversations ensure-live <id> --json
neon-pilot conversations send <id> --text "message" --json
neon-pilot conversations run-turn <id> --text "prompt" --timeout-ms 120000 --json
neon-pilot conversations abort <id>
neon-pilot conversations compact <id>
neon-pilot conversations fork <id> --title "Fork" --json
neon-pilot conversations tools <id> bash read edit
neon-pilot conversations rollback <id> 1 --json
```

For sidebar/open-thread state, use workspace commands, not `scope=running`:

```sh
neon-pilot conversations workspace --json
neon-pilot conversations workspace update \
  --open conv-a,conv-b \
  --pinned conv-a \
  --active conv-b \
  --workspace-path /repo \
  --json
neon-pilot conversations open list --json
neon-pilot conversations open add conv-a conv-b --json
neon-pilot conversations open pin conv-a --json
neon-pilot conversations open active conv-b --json
```

Vocabulary:

- **open/sidebar** — conversations visible in the Threads sidebar / workspace state.
- **live/executing** — conversations with a live runtime or active turn.
- **archived** — hidden from the normal sidebar list.
- **running** — avoid this term unless a command explicitly defines it; it does not mean open/sidebar.

## Background work and automations

Use first-class CLI commands for durable work and scheduled automation:

```sh
neon-pilot background-commands list --json
neon-pilot background-commands start --command "pnpm test" --cwd /repo --json
neon-pilot background-commands logs <run-id> --tail 200 --json
neon-pilot background-commands cancel <run-id> --json

neon-pilot subagents list --json
neon-pilot subagents start --prompt "Review the diff" --cwd /repo --json
neon-pilot subagents follow-up <run-id> --prompt "Continue" --json
neon-pilot subagents logs <run-id> --tail 200 --json

neon-pilot tasks list --json
neon-pilot tasks save --title "Daily check" --cron "0 9 * * *" --prompt "Summarize status" --json
neon-pilot tasks run <task-id> --json
neon-pilot tasks delete <task-id> --json
```

## Sharp transcript operations

Transcript mutation commands are advanced recovery/admin tools. Inspect first and prefer safer conversation operations when possible.

```sh
neon-pilot conversations transcript append <id> --type text --data '{"text":"note"}' --json
neon-pilot conversations transcript update <id> <block-id> --type text --data '{"text":"replacement"}' --json
```

## Boundaries

- Core owns the `neon-pilot` CLI shell and built-in commands such as `commands`, `help`, `protocol`, and `cli status/install/uninstall`.
- Extensions contribute product-specific CLI commands through `contributes.cliCommands`.
- Built-in system extensions contribute the primary self-administration surfaces: `extensions ...`, `settings ...`, and `conversations ...`.
- The agent shell receives Neon Pilot's channel-local CLI bin directory automatically. User shell installation is opt-in through `neon-pilot cli install`.
- Do not edit internal runtime files directly when an extension-contributed CLI command exists for the same operation.
- If the CLI lacks a needed Neon Pilot admin operation, add a narrow CLI command to the owning extension instead of teaching agents to depend on hidden files or ad hoc scripts.
