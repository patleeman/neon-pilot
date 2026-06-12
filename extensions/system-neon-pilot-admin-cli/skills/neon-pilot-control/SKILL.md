---
name: neon-pilot-control
description: Use when installing, bootstrapping, configuring, verifying, or controlling Neon Pilot from an external agent through the neon-pilot CLI, including provider setup, headless setup, conversation control, subagent runs, and runtime readiness troubleshooting.
---

# Neon Pilot Control

Use the packaged app and unified `neon-pilot` CLI control plane. Do not build from source unless the user asks for development setup. Neon Pilot control is not exposed through MCP; internal agents use the canonical `neon_pilot` tool for the same command surface.

The public CLI is for humans and external agents. Choose the task-oriented command first, then inspect help if needed:

```bash
neon-pilot ask "Reply with ready."
neon-pilot conversations run-turn <conversationId> --text "Continue."
neon-pilot background-commands start --command "pnpm test"
neon-pilot commands
neon-pilot help ask
```

Use `--json` for install scripts, health gates, stable ids, and machine parsing. Do not use JSON just because the caller is an agent.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/patleeman/neon-pilot/master/install.sh | bash -s -- --install-cli --bootstrap --json
```

Use `--channel rc` only when the user wants the release-candidate channel.

## Configure Provider And Defaults

Never pass API keys in argv. Use stdin or OAuth/device flow.

```bash
neon-pilot bootstrap configure --secrets-provider keychain --provider openai-codex --model gpt-5.4 --cwd "$PWD"
printf '%s' "$OPENAI_API_KEY" | neon-pilot bootstrap provider set-key openai --stdin --json
neon-pilot bootstrap defaults set --provider openai-codex --model gpt-5.4 --cwd "$PWD"
```

For custom OpenAI-compatible providers:

```bash
neon-pilot bootstrap provider save openrouter --base-url https://openrouter.ai/api/v1 --api openai
neon-pilot bootstrap provider model openrouter openai/gpt-5.4 --context-window 272000
```

## Verify

Before reporting setup complete, run:

```bash
neon-pilot cli status --json
neon-pilot commands
neon-pilot bootstrap doctor --json
neon-pilot control-plane doctor --json
neon-pilot protocol neon-pilot-agent capabilities --json
neon-pilot protocol neon-pilot-agent run --prompt "Reply with ready." --tools none --json
```

If `bootstrap doctor` or `control-plane doctor` fails, fix the failed check before continuing. Common failures are: app not running, CLI not linked, no default provider/model, missing provider credential, stale extension discovery, or disabled Neon Pilot CLI settings.

## Operate

For normal one-shot work, use the public command:

```bash
neon-pilot ask --cwd "$PWD" "Investigate this issue."
```

Create a controlled conversation when you need stable conversation orchestration:

```bash
neon-pilot protocol neon-pilot-agent conversation create --title "External task" --cwd "$PWD" --tools default --json
```

Send a message:

```bash
neon-pilot protocol neon-pilot-agent conversation send <conversationId> --prompt "Continue." --json
```

Start and inspect durable agent work through the protocol control surface, not the public command list:

```bash
neon-pilot commands --verbose
neon-pilot protocol neon-pilot-agent start --prompt "Investigate this issue." --cwd "$PWD" --json
neon-pilot protocol neon-pilot-agent runs list --kind subagent --json
neon-pilot protocol neon-pilot-agent runs logs <runId> --tail 200
```

The protocol control surface is intentionally nested behind `protocol`/`commands --verbose`; do not present it as the normal user-facing way to ask Neon Pilot to work. Do not edit Neon Pilot runtime files directly when a CLI command exists.
