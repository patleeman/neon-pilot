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

2. Prefer JSON for inspection and automation. Pick the conversation surface by intent:

   ```sh
   neon-pilot extensions list --json
   neon-pilot settings list --json
   neon-pilot conversations workspace --json      # open/sidebar state, usually what "active threads" means
   neon-pilot conversations open list --json      # ergonomic open/sidebar view
   neon-pilot conversations list --json           # persisted conversation history page, not open/active threads
   neon-pilot cli status --json
   ```

3. Inspect before mutating shared state. For conversation/sidebar state, read the workspace first:

   ```sh
   neon-pilot conversations workspace --json
   neon-pilot conversations workspace update --open conv-a,conv-b --active conv-b --json
   ```

4. For extension work, use the lifecycle CLI and validate/reload after edits:

   ```sh
   neon-pilot extensions list --json
   neon-pilot extensions catalog --json
   neon-pilot extensions install system-example --json
   neon-pilot extensions validate system-example
   neon-pilot extensions reload system-example
   neon-pilot extensions delete system-example --json
   ```

5. Use normal shell commands for repository work such as `pnpm`, `git`, `rg`, and file validation.

## Conversation administration

Use `conversations ...` commands for agent-side conversation management.

Important distinction:

- `conversations workspace` / `conversations open ...` = current workspace/sidebar state.
- `conversations list` = persisted conversation history, paginated; `--scope all` can return hundreds of historical conversations and does **not** mean active/open.
- `conversations search` = historical transcript/metadata search.

```sh
neon-pilot conversations workspace --json
neon-pilot conversations open list --json
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

For sidebar/open-thread state, use workspace/open commands, not `conversations list --scope all` and not `scope=running`:

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

- **open/sidebar** — conversations visible in the Threads sidebar / workspace state. Use `conversations workspace` or `conversations open list`.
- **active** — the currently selected sidebar conversation (`activeConversationId`), not every open conversation.
- **history/persisted** — all saved conversations. Use `conversations list`/`search`; `--scope all` means all historical persisted conversations.
- **live/executing** — conversations with a live runtime or active turn.
- **archived** — hidden from the normal sidebar list.
- **running** — avoid this term unless a command explicitly defines it; it does not mean open/sidebar.

## Extension, settings, and app command control

Use extension lifecycle commands before falling back to lower-level tools:

```sh
neon-pilot extensions list --json
neon-pilot extensions catalog --json
neon-pilot extensions create system-example --name "Example" --json
neon-pilot extensions install <catalog-id> --json
neon-pilot extensions update <catalog-id> --json
neon-pilot extensions install-url <bundle-url> --expected-id <id> --json
neon-pilot extensions install-marketplace <source> --type skill --json
neon-pilot extensions enable <id> --json
neon-pilot extensions disable <id> --json
neon-pilot extensions snapshot <id> --json
neon-pilot extensions delete <id> --json
```

Settings are schema-backed. Read schema before writes; use JSON values for `set`:

```sh
neon-pilot settings schema --json
neon-pilot settings get <key> --json
neon-pilot settings set <key> 'true' --json
neon-pilot settings set <key> '"string value"' --json
neon-pilot settings reset <key> --json
```

App/command-palette commands are available as an escape hatch. Prefer specific CLI commands when they exist; inspect before running command IDs with side effects:

```sh
neon-pilot app-commands list --json
neon-pilot app-commands run <command-id> --args '{"some":"json"}' --json
```

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
- `app-commands run` triggers extension/app commands by ID and is a broad escape hatch; prefer narrower lifecycle/settings/conversation/runs CLI commands for predictable JSON behavior.
- Built-in system extensions contribute the primary self-administration surfaces: `extensions ...`, `settings ...`, and `conversations ...`.
- The agent shell receives Neon Pilot's channel-local CLI bin directory automatically. User shell installation is opt-in through `neon-pilot cli install`.
- Do not edit internal runtime files directly when an extension-contributed CLI command exists for the same operation.
- If the CLI lacks a needed Neon Pilot admin operation, add a narrow CLI command to the owning extension instead of teaching agents to depend on hidden files or ad hoc scripts.
