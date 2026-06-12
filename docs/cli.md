# Neon Pilot CLI

The `neon-pilot` command is the local control plane for Neon Pilot administration.

Core owns the shell and built-in commands. Extensions add product commands with `contributes.cliCommands`, and enabled extension commands are discoverable at runtime:

```bash
neon-pilot commands --json
```

Use `neon-pilot help` for the core shell and `neon-pilot help <command>` for a specific command:

```bash
neon-pilot help
neon-pilot help settings list
neon-pilot help conversations run-turn
```

CLI output is human-first. Commands should return `{ text }` or `{ message }` when they can explain the result directly, and callers use `--json` when they need structured output for automation.
Global flags are shell-owned and work across core and extension commands:

```bash
neon-pilot commands --quiet
neon-pilot doctor --verbose
neon-pilot paths --json --no-color
```

Errors are human-readable by default and structured under `--json`:

```json
{
  "ok": false,
  "error": {
    "code": "unknown_command",
    "category": "not_found",
    "message": "Unknown Neon Pilot command: nope",
    "recoverable": true
  }
}
```

## Audiences and command shape

The CLI has two overlapping audiences:

- Humans and external agents use `neon-pilot` as a public control plane for common product tasks: ask Neon Pilot to do work, continue conversations, inspect background work, manage extensions, configure settings, and verify runtime health.
- Internal agents, scripts, and extension authors use the same executable as a machine-readable control plane: discover live command contracts, inspect schemas, verify runtime paths, and reach advanced escape hatches when no first-class command exists.

The default human surface should teach the runtime model, not only enumerate commands. `neon-pilot commands` may show many commands, but it should make command families and intent clear enough that a caller can choose the right entrypoint without guessing from nouns.

Use this decision model for command copy, examples, generated docs, and future command metadata:

```text
Use `ask` for normal one-off agent work from the CLI.
Use `conversations run-turn` to send a prompt to an existing conversation.
Use `background-commands` for detached shell commands with logs/status/cancel/rerun.
Use subagent commands to inspect or manage delegated background agent work, not for ordinary prompting.
Use scheduled-task commands, currently `tasks ...`, for scheduled recurring behavior.
Use `extensions` and `settings` for product administration.
Use `app-commands` and `protocol` only as advanced escape hatches when no first-class CLI command fits; they are hidden from default human discovery and appear under `commands --verbose`.
```

The most important ambiguity to avoid is `ask` versus subagents. A one-off shell request like "run an agent to review this repo" should become `neon-pilot ask ...`. Subagent commands are for delegated background agent records created by the runtime/conversation workflow; they are not the default way for an external caller to start normal agent work.

For humans and external agents, organize command help around task families. This is the target shape for `commands`/help output; command names should use the current CLI contract where it differs, such as `tasks ...` for scheduled automation commands.

```text
Start Here
  ask                           Ask Neon Pilot to do one task in a new conversation
  doctor                        Check whether the runtime is ready
  help <command>                Show focused help for one command

Conversation Work
  ask                           Create a conversation, run one turn, and print the result
  conversations list            List conversations
  conversations search          Search conversations
  conversations run-turn        Send a turn to an existing conversation
  conversations get             Inspect one conversation

Background Work
  background-commands start     Run a shell command in the background
  background-commands list      List background shell commands
  background-commands logs      Read background command logs
  background-commands cancel    Cancel a background command

Delegated Agent Work
  subagents list                List delegated background agents
  subagents get                 Inspect a delegated background agent
  subagents cancel              Cancel a delegated background agent

Automations
  tasks list                    List user-managed scheduled behaviors
  tasks get                     Inspect a scheduled behavior
  tasks run                     Run a scheduled behavior now
  tasks save                    Create or update a scheduled behavior
  tasks delete                  Delete a scheduled behavior

Runtime Setup
  bootstrap doctor              Check external-agent setup
  bootstrap configure           Configure provider/default runtime setup
  bootstrap defaults set        Set default provider, model, cwd, and preferences
  cli status                    Show CLI shell link status
  cli install                   Install the user-shell CLI link
  cli uninstall                 Remove the user-shell CLI link

Extensions and Settings
  extensions list               List installed extensions
  extensions install            Install an extension
  extensions enable             Enable an extension
  extensions disable            Disable an extension
  extensions update             Update an extension
  settings list                 List settings
  settings get                  Read one setting
  settings set                  Update one non-secret setting
  settings reset                Reset settings
```

For internal agents and automation, keep deeper control-plane details in skills and expose them from the CLI only when requested:

```text
Discovery
  commands                      Browse task-oriented command families
  commands --verbose            Include advanced/internal escape hatches
  commands --json               List live command contracts for scripts
  schema --json                 Export full machine-readable command schema for generated references
  help <command>                Show human usage for one command
  paths                         Show local runtime paths
  version                       Show CLI and runtime version
  doctor                        Check CLI/runtime readiness

Preferred Agent Entry Points
  ask                           Start a new conversation and run one turn
  conversations run-turn        Send a turn to an existing conversation
  conversations list            Discover conversation ids
  conversations get             Inspect one conversation
  background-commands start     Start detached shell work
  background-commands list      Inspect detached shell work
  subagents list                Inspect delegated background agents when that surface is available
  tasks list                    Inspect scheduled behavior

Runtime Administration
  bootstrap doctor              Validate external-agent control setup
  bootstrap configure           Configure external-agent entrypoints
  bootstrap defaults set        Configure default provider/model/cwd
  cli status                    Inspect user-shell CLI symlink state
  paths                         Locate state/config/runtime roots

Extension Administration
  extensions list               List installed extensions
  extensions inspect            Inspect one extension
  extensions install            Install an extension
  extensions enable             Enable an extension
  extensions disable            Disable an extension
  extensions validate           Validate extension manifest/runtime wiring
  settings schema               Read declared settings contracts
  settings list                 Read merged settings
  settings set                  Mutate declared non-secret settings

Advanced Escape Hatches
  app-commands list             List command-palette/app commands
  app-commands run              Run a command-palette/app command by id
  protocol <protocol-id> ...    Invoke raw extension protocol entrypoint
```

When command contracts grow beyond the current schema, prefer first-class metadata over prose-only hints. Useful fields include `intent`, `audience`, `stability`, `recommendedFor`, `notFor`, and `preferredOver`. Agents should rank public commands above advanced/internal commands for user-facing tasks, and should use `app-commands` or `protocol` only when the user explicitly asks for those surfaces or no first-class command exists. Use `--json` for scripts, generated references, and stable machine parsing; do not make it the default agent-reading format.

## Availability

Neon Pilot creates a channel-local launcher at:

```text
<state-root>/bin/neon-pilot
```

App-managed agent shells automatically prepend that directory to `PATH`. Normal user shells can opt into a global link:

```bash
neon-pilot cli status --json
neon-pilot cli install
neon-pilot cli uninstall
```

All runtime channels stay in the `neon-pilot*` namespace (`neon-pilot`, `neon-pilot-rc`, `neon-pilot-dev`, `neon-pilot-testing`), but the command users and agents run is still `neon-pilot`.

## Running App Discovery

When the desktop app is running, it writes a protected runtime discovery record under the active state root. A normal terminal invocation uses that record to call the live extension host after verifying its health. Environment variables remain supported only for app-managed child processes and compatibility:

```text
NEON_PILOT_EXTENSION_HOST_BASE_URL
NEON_PILOT_EXTENSION_HOST_TOKEN
```

If no running app is discoverable, built-in commands such as `neon-pilot cli status` still work; extension-contributed commands need the live extension host.

## Core Commands

Core owns the CLI shell and offline runtime inspection commands:

```bash
neon-pilot help
neon-pilot commands
neon-pilot schema --json
neon-pilot doctor
neon-pilot paths --json
neon-pilot version
neon-pilot cli status
```

Aliases are part of the command contract. Current core aliases include `ls` for `commands`, `commands schema` for `schema`, `runtime doctor`, `runtime paths`, and `-v`/`--version` for `version`.

## First-Party Commands

```bash
neon-pilot extensions list
neon-pilot settings list
neon-pilot settings get conversation.pinnedToolCalls
neon-pilot settings set conversation.pinnedToolCalls false
neon-pilot app update --json
neon-pilot bootstrap doctor
neon-pilot bootstrap configure --secrets-provider keychain --provider openai-codex --model gpt-5.4
printf '%s' "$OPENAI_API_KEY" | neon-pilot bootstrap provider set-key openai --stdin
neon-pilot conversations list
neon-pilot conversations search "query text"
```

Agents should prefer `--json` for inspection and automation, list or inspect before mutating, and use CLI commands instead of editing runtime files directly when a command exists.

## Ownership

The CLI shell is core-owned: parsing, command matching, help, command discovery, result formatting, install/status management, and raw protocol dispatch live in the core/host CLI layer. Product commands stay with the owner of the product capability:

- Extension-owned features expose CLI verbs from their owning extension with `contributes.cliCommands`.
- Core/runtime administration uses built-in commands.
- A command should move only when feature ownership moves; do not create a CLI-only extension just to add a command.

## Command Contracts

`neon-pilot commands --json` returns command contracts for scripts, generated references, and machine parsing:

- `argsSchema` and `flagsSchema`
- `mode`: `read`, `write`, `destructive`, `background`, or `streaming`
- `requiresApp`, `idempotent`, `destructive`, `startsBackgroundWork`, and `supportsDryRun`
- `outputModes`: `text`, `json`, and where supported `jsonl`
- `streaming` and `smoke` metadata when applicable

Mutating extension commands must support `--dry-run`. The core shell handles declared dry-runs before invoking the backend action, so dry-run checks are no-side-effect by construction.
The shell validates declared `argsSchema` and `flagsSchema` before dispatch. Unknown flags, missing required positionals, unsupported `--format` values, and unsupported `--dry-run` fail before the extension action runs.

Destructive commands require confirmation. In interactive terminals the shell prompts the user; in non-interactive use callers must pass `--yes`. Use `--dry-run` first when a destructive command supports it.

Streaming commands should document `--follow`, `--format text|json|jsonl`, and interrupt behavior. The shell accepts `--format json` and `--format jsonl` only when the command contract declares those output modes.
For `jsonl`, each line is an event object:

```json
{"event":"update","data":{"content":[{"type":"text","text":"partial"}]}}
{"event":"result","data":{"accepted":true}}
```

## Agent Bootstrap

External agents can install and configure Neon Pilot through the packaged installer and bootstrap commands. See [Agent bootstrap](agent-bootstrap.md) for the end-to-end flow.

Provider credentials must not be passed in command arguments. Use `--stdin`, Keychain-backed storage, OAuth/device flows, or environment fallback where explicitly configured.

## Security

CLI commands route through the same extension host boundary as UI actions. Extension-contributed commands must obey extension permissions, should avoid raw runtime-file mutation, and must not expose secret reads. Settings mutation is limited to manifest-declared non-secret settings.

## Validation

Run the CLI surface audit after changing command parsing, command metadata, extension CLI contributions, or docs:

```bash
pnpm run check:cli:surface
pnpm run check:cli:surface -- --repeat 3
pnpm run check:cli:fixtures
pnpm run docs:cli
pnpm run check:cli:docs
pnpm run check:cli
```

The audit invokes the real `neon-pilot` command, validates human help for every discovered command, checks JSON mode for discovery/status, and confirms system extension CLI contributions are discoverable.
The fixture check runs the source CLI with a temporary state/config root and verifies offline built-ins, quiet output, and structured JSON errors without depending on the user's live app state.
The generated [CLI reference](cli-reference.md) is derived from `neon-pilot commands --json`; update it with `pnpm run docs:cli` whenever command contracts change.
