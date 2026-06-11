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

`neon-pilot commands --json` returns command contracts for agents and scripts:

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
