# Install with another agent

Use this page when you want Claude Code, Codex, or another local coding agent to install Neon Pilot for you.

The primary reader is you. The copy-paste prompt is for the agent.

## Copy-paste prompt

Paste this into your current coding agent:

```text
Install Neon Pilot on this Mac.

Use the packaged installer script:

curl -fsSL https://raw.githubusercontent.com/patleeman/neon-pilot/master/install.sh | bash -s -- --install-cli --bootstrap

After install, open or verify the app, check that the CLI is available, and tell me exactly what passed or failed. Do not put provider API keys in command arguments, logs, transcripts, or config files. If a provider key is needed, ask me to enter it through Neon Pilot Settings or through a stdin-based command.
```

## What the agent should do

The agent should:

1. Run the installer script.
2. Confirm that **Neon Pilot.app** is installed.
3. Confirm that the `neon-pilot` CLI is available when the CLI install succeeds.
4. Run a health check when the CLI is available.
5. Ask you to configure a provider in the app, or use a safe stdin-based command if you explicitly want terminal setup.
6. Report what worked and what still needs your attention.

## Useful commands

The installer command is:

```bash
curl -fsSL https://raw.githubusercontent.com/patleeman/neon-pilot/master/install.sh | bash -s -- --install-cli --bootstrap
```

When the CLI is installed, the agent can check readiness with:

```bash
neon-pilot bootstrap doctor
```

Use JSON only when the agent is writing a script or needs machine-readable output:

```bash
neon-pilot bootstrap doctor --json
```

## Provider keys

Provider keys should not appear in command arguments or chat transcripts.

Use one of these paths instead:

- Enter the key in **Settings** inside Neon Pilot.
- Pipe the key through stdin when you intentionally use the CLI.
- Use OAuth or device login when the provider supports it.
- Use macOS Keychain-backed storage when available.

Example stdin pattern:

```bash
printf '%s' "$OPENAI_API_KEY" | neon-pilot bootstrap provider set-key openai --stdin
```

## When to use the normal install page

If you are installing Neon Pilot yourself, use [Getting Started](getting-started.md). It skips automation details and focuses on the human setup path.
