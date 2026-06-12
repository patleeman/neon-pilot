# Getting Started

Install the packaged Neon Pilot app and verify the setup.

## Install the app

Download the latest macOS `.dmg` from [GitHub Releases](https://github.com/patleeman/neon-pilot/releases/latest), open it, and drag **Neon Pilot.app** into Applications.

For agent-driven setup, use the packaged installer script:

```bash
curl -fsSL https://raw.githubusercontent.com/patleeman/neon-pilot/master/install.sh | bash -s -- --install-cli --bootstrap
```

Use `--channel rc` when you want the release-candidate app.

## Configure and verify

Open **Neon Pilot.app**. The desktop app manages the local daemon automatically.

If you installed the CLI, configure provider defaults and verify the runtime:

```bash
neon-pilot bootstrap configure --secrets-provider keychain --provider openai-codex --model gpt-5.4
printf '%s' "$OPENAI_API_KEY" | neon-pilot bootstrap provider set-key openai --stdin
neon-pilot bootstrap doctor
```

Provider keys must not be passed in command arguments. Use stdin, Keychain, OAuth/device login, or another configured secrets backend.

## Important paths

- `<state-root>` — machine-local runtime state. Default: `$XDG_STATE_HOME/neon-pilot` when `XDG_STATE_HOME` is set, otherwise `~/.local/state/neon-pilot`
- `<config-root>` — machine-local config. Default: `$XDG_CONFIG_HOME/neon-pilot` when set, otherwise `<state-root>/config`
- `<knowledge-root>` — durable knowledge root. See [Configuration](configuration.md) for override order and channel-specific state roots.

## Verify the install

The desktop app starts and loads the conversation view. Create a new conversation and send a message to verify the agent responds.

## First run checklist

1. Open **Settings** and confirm your model provider and default model.
2. Start a new conversation.
3. Attach a file or folder when the task needs project context.
4. Ask for a small first task, such as summarizing a file, explaining a code path, or drafting a plan.
5. Use the Workbench to inspect files, artifacts, browser views, extensions, and other surfaces beside the conversation.

## What to try next

- Ask Neon Pilot to inspect a local repo and explain its structure.
- Attach a folder and ask for a bug fix or documentation update.
- Queue a follow-up while the agent is working.
- Install an optional extension from **Settings -> Extensions**.
- Ask the agent to build a small extension for a repeated workflow.

For source builds and repo development, use [Development workflow](development.md).

## Next steps

- [Views](views.md) — understand Conversation and Workbench layout modes
- [Conversations](conversations.md) — how to work with agent conversations
- [Desktop App](desktop-app.md) — Electron shell and shortcuts
- [Knowledge base sync](knowledge-base.md) — git-backed durable knowledge setup and sync
- [Configuration](configuration.md) — config files and environment variables
