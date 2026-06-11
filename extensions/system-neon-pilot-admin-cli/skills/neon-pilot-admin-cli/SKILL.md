---
name: neon-pilot-admin-cli
description: Use the unified Neon Pilot CLI/control plane for self-administration, delegated agent control, conversations, workspace/sidebar state, runs, automations, extensions, settings, and extension-contributed administration surfaces.
---

# Neon Pilot CLI

Use the unified Neon Pilot CLI surface instead of direct runtime-file edits, standalone model tools, or MCP. External/other agents use the `neon-pilot` CLI; internal Neon Pilot agents use the `neon_pilot` tool. These are dual interfaces over the same control-plane command semantics.

## Workflow

1. Discover commands before using an unfamiliar surface. From an external shell, use the CLI:

   ```sh
   neon-pilot commands --json
   neon-pilot control-plane doctor --json
   neon-pilot help conversations
   ```

   From an internal Neon Pilot conversation, use the canonical tool for the same command surface:

   ```json
   { "command": "list_admin_commands" }
   ```

2. Prefer JSON for inspection and automation. Pick the conversation surface by intent:

   ```sh
   neon-pilot extensions list --json
   neon-pilot settings list --json
   neon-pilot conversations workspace --json      # open/sidebar state, usually what "active threads" means
   neon-pilot conversations open list --json      # ergonomic open/sidebar view
   neon-pilot conversations list --json           # persisted conversation history page, not open/active threads
   neon-pilot cli status --json
   neon-pilot control-plane doctor --json
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
neon-pilot ask --model opencode-go/deepseek-v4-flash --cwd /repo "prompt"
neon-pilot conversations create --title "Thread" --cwd /repo --json
neon-pilot conversations ensure-live <id> --json
neon-pilot conversations send <id> --text "message" --json
neon-pilot conversations run-turn <id> --text "prompt" --timeout-ms 120000 --json
neon-pilot conversations abort <id>
neon-pilot conversations compact <id>
neon-pilot conversations fork <id> --title "Fork" --json
neon-pilot conversations tools <id> bash read edit
neon-pilot conversations rollback <id> 1 --json
neon-pilot conversations archive <id...> --json
neon-pilot conversations unarchive <id...> --json
neon-pilot conversations delete <id...> --json
neon-pilot conversations retention prune --older-than 90d --archived-only --dry-run --json
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
neon-pilot conversations archive conv-old --json
neon-pilot conversations unarchive conv-old --json
neon-pilot conversations delete conv-old --json
neon-pilot conversations retention prune --older-than 180d --archived-only --dry-run --json
```

Vocabulary:

- **open/sidebar** — conversations visible in the Threads sidebar / workspace state. Use `conversations workspace` or `conversations open list`.
- **active** — the currently selected sidebar conversation (`activeConversationId`), not every open conversation.
- **history/persisted** — all saved conversations. Use `conversations list`/`search`; `--scope all` means all historical persisted conversations.
- **live/executing** — conversations with a live runtime or active turn.
- **archived** — hidden from the normal sidebar/history views. Use `conversations archive` / `conversations unarchive`.
- **delete** — permanent conversation deletion. Use `conversations delete`; never delete session files directly.
- **retention prune** — bulk deletion by age. Start with `--dry-run`; use `--archived-only` unless explicitly asked to prune all old conversations.
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
neon-pilot subagents start --task-slug code-review --prompt "Review the diff" --cwd /repo --json
neon-pilot subagents follow-up <run-id> --prompt "Continue" --json
neon-pilot subagents logs <run-id> --tail 200 --json

neon-pilot tasks list --json
neon-pilot tasks save --title "Daily check" --cron "0 9 * * *" --prompt "Summarize status" --json
neon-pilot tasks run <task-id> --json
neon-pilot tasks delete <task-id> --json

neon-pilot heartbeats start <heartbeat-id> --interval-minutes 5 --conversation-id <conversation-id> --prompt "Wake up, check whether work remains, and stop this heartbeat when done." --json
neon-pilot heartbeats list --json
neon-pilot heartbeats stop <heartbeat-id> --json
```

## Delegated agent control

The same CLI surface also controls Neon Pilot as a delegated agent runtime. For a one-shot external delegation, prefer `neon-pilot ask`; it creates a normal conversation, runs one turn, and returns the answer plus conversation id. Use `subagents` only for durable background/offshoot runs that need lifecycle operations such as logs, follow-up, rerun, or cancel.

```sh
neon-pilot bootstrap doctor --json
neon-pilot bootstrap configure --provider openai-codex --model gpt-5.4 --json
neon-pilot bootstrap defaults set --provider openai-codex --model gpt-5.4 --cwd "$PWD" --json
neon-pilot ask --model opencode-go/deepseek-v4-flash --cwd "$PWD" "Reply with ready."
neon-pilot protocol neon-pilot-agent capabilities --json
neon-pilot protocol neon-pilot-agent run --prompt "Reply with ready." --tools none --json
neon-pilot protocol neon-pilot-agent start --prompt "Investigate this issue." --cwd "$PWD" --json
neon-pilot protocol neon-pilot-agent runs list --kind subagent --json
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
- `control-plane doctor` runs non-destructive smoke checks for command discovery, conversation APIs, retention dry-run, runtime repo root, and extension storage.
- `app-commands run` triggers extension/app commands by ID and is a broad escape hatch; prefer narrower lifecycle/settings/conversation/runs CLI commands for predictable JSON behavior.
- Built-in system extensions contribute the primary self-administration surfaces: `extensions ...`, `settings ...`, and `conversations ...`.
- The agent shell receives Neon Pilot's channel-local CLI bin directory automatically. User shell installation is opt-in through `neon-pilot cli install`.
- Do not edit internal runtime files directly when an extension-contributed CLI command exists for the same operation.
- If the unified CLI surface lacks a needed Neon Pilot operation, add it to the shared command registry/service and expose it through both `neon-pilot` CLI and `neon_pilot` tool instead of adding a one-off tool, MCP endpoint, hidden-file workflow, or ad hoc script.
