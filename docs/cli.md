# Neon Pilot CLI

The `neon-pilot` command is the local control plane for Neon Pilot administration.

Core owns the shell and built-in commands. Extensions add product commands with `contributes.cliCommands`, and enabled extension commands are discoverable at runtime:

```bash
neon-pilot commands --json
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

## First-Party Commands

```bash
neon-pilot extensions list --json
neon-pilot settings list --json
neon-pilot settings get conversation.pinnedToolCalls --json
neon-pilot settings set conversation.pinnedToolCalls false
neon-pilot bootstrap doctor --json
neon-pilot bootstrap configure --secrets-provider keychain --provider openai-codex --model gpt-5.4 --json
printf '%s' "$OPENAI_API_KEY" | neon-pilot bootstrap provider set-key openai --stdin --json
neon-pilot conversations list --json
neon-pilot conversations search "query text" --json
```

Agents should prefer JSON for inspection and automation, list or inspect before mutating, and use CLI commands instead of editing runtime files directly when a command exists.

## Agent Bootstrap

External agents can install and configure Neon Pilot through the packaged installer and bootstrap commands. See [Agent bootstrap](agent-bootstrap.md) for the end-to-end flow.

Provider credentials must not be passed in command arguments. Use `--stdin`, Keychain-backed storage, OAuth/device flows, or environment fallback where explicitly configured.

## Security

CLI commands route through the same extension host boundary as UI actions. Extension-contributed commands must obey extension permissions, should avoid raw runtime-file mutation, and must not expose secret reads. Settings mutation is limited to manifest-declared non-secret settings.
