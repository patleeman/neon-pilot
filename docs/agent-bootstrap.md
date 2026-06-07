# Agent Bootstrap

Neon Pilot must be installable, configurable, and verifiable by an external agent without manual file edits.

## Install

Use the packaged macOS installer script. It installs the signed app from GitHub releases, launches it once, installs the CLI when available, and reports machine-readable status.

```bash
curl -fsSL https://raw.githubusercontent.com/patleeman/neon-pilot/main/install.sh | bash -s -- --install-cli --bootstrap --json
```

Use `--channel rc` for release-candidate builds.

## Configure

Run bootstrap commands through the live app CLI. Prefer JSON output for automation.

```bash
neon-pilot bootstrap configure \
  --secrets-provider keychain \
  --provider openai-codex \
  --model gpt-5.4 \
  --cwd "$HOME/workingdir" \
  --json
```

Provider keys must not be passed in argv. Use stdin:

```bash
printf '%s' "$OPENAI_API_KEY" | neon-pilot bootstrap provider set-key openai --stdin --json
```

Custom providers and models can be created from the CLI:

```bash
neon-pilot bootstrap provider save openrouter --base-url https://openrouter.ai/api/v1 --api openai --json
neon-pilot bootstrap provider model openrouter openai/gpt-5.4 --context-window 272000 --json
```

## Verify

An agent should not report setup complete until these checks pass:

```bash
neon-pilot cli status --json
neon-pilot commands --json
neon-pilot bootstrap doctor --json
neon-pilot protocol neon-pilot-agent capabilities --json
neon-pilot protocol neon-pilot-agent run --prompt "Reply with ready." --tools none --json
```

The MCP configuration for Hermes or another orchestrator is:

```json
{
  "mcpServers": {
    "neon-pilot": {
      "command": "neon-pilot",
      "args": ["protocol", "neon-pilot-agent-mcp"]
    }
  }
}
```

## Rules For Agents

- Prefer CLI commands over editing runtime files directly.
- Use `--json` for inspection and automation.
- Never put provider API keys in command arguments, logs, transcripts, or config files.
- Use `--stdin`, Keychain, or OAuth/device login for credentials.
- Use `neon-pilot bootstrap doctor --json` after every install or settings change.
- Report exactly which verification commands passed or failed.
