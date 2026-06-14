---
name: neon-pilot
description: Use Neon Pilot from Codex/OpenAI Desktop for focused delegated agent work, and use the Neon Pilot CLI for broader app, conversation, extension, automation, and runtime administration.
---

# Neon Pilot

Use Neon Pilot when the user asks to delegate work, run a durable side investigation, continue Neon Pilot work from Codex, or operate the local Neon Pilot app through its CLI.

## Preferred surfaces

Use the MCP tools for focused delegated agent work:

- `neon_pilot_delegate` starts a durable Neon Pilot subagent-style run.
- `neon_pilot_list_delegates` lists delegated Neon Pilot runs.
- `neon_pilot_get_delegate` inspects one delegated run.
- `neon_pilot_wait_any_delegate` waits until any watched delegated run finishes or times out.
- `neon_pilot_delegate_logs` reads recent logs.
- `neon_pilot_follow_up` sends a follow-up prompt to an existing delegated run.
- `neon_pilot_cancel_delegate` cancels a delegated run.

Use the `neon-pilot` CLI for everything broader than delegated runs. Do not ask MCP to manage all of Neon Pilot; use shell commands and keep the transcript readable.

MCP is the preferred path for delegated workers. If the MCP path is unavailable or broken, fall back immediately to the equivalent `neon-pilot protocol neon-pilot-agent ...` CLI command instead of abandoning delegation.

## Delegation guidance

Delegate when the task is bounded, useful in parallel, and can be summarized back into the current Codex thread. Keep the prompt concrete and include the repository path or working directory when relevant.

For orchestrated worker pools:

- Keep at most 3 active delegated Neon Pilot jobs at once unless the user asks for a different cap.
- Prefer `neon_pilot_wait_any_delegate` when the orchestrator runs out of better local work and needs to wait for any worker to finish.
- Refill open slots after reviewing completed work.
- Treat missing MCP availability as a routing failure; switch to CLI control of the same delegated-run workflow.
- Require delegated workers to implement, add focused regression coverage when appropriate, and rigorously validate before returning.
- The orchestrator should review the returned diff, run final QA/user-path validation, and only then accept/checkpoint.

Do not use delegated runs for ordinary one-shot CLI prompting. For simple direct questions, use:

```sh
neon-pilot ask --cwd "$PWD" "Summarize this repository."
```

For durable delegated work through CLI:

```sh
neon-pilot protocol neon-pilot-agent start \
  --cwd "$PWD" \
  --task-slug investigate-auth-regression \
  --prompt "Investigate the auth regression and report root cause plus patch plan." \
  --json
```

Inspect or continue it:

```sh
neon-pilot protocol neon-pilot-agent runs list --kind subagent --json
neon-pilot protocol neon-pilot-agent runs get <runId> --json
neon-pilot protocol neon-pilot-agent runs wait-any --run-ids <id1,id2,...> --timeout-ms 60000 --json
neon-pilot protocol neon-pilot-agent runs logs <runId> --tail 200
neon-pilot protocol neon-pilot-agent runs follow-up <runId> --prompt "Check the failing test too." --json
neon-pilot protocol neon-pilot-agent runs cancel <runId> --json
```

## CLI administration

Use normal CLI commands for app and workflow administration:

```sh
neon-pilot commands
neon-pilot commands --brief
neon-pilot help <command>
neon-pilot cli status --json
neon-pilot bootstrap doctor --json
neon-pilot control-plane doctor --json
```

Conversation and sidebar state:

```sh
neon-pilot conversations workspace
neon-pilot conversations open list
neon-pilot conversations list --scope all
neon-pilot conversations search "query"
neon-pilot conversations run-turn <conversationId> --text "Continue."
```

Extensions and settings:

```sh
neon-pilot extensions list
neon-pilot extensions catalog
neon-pilot extensions enable <id>
neon-pilot extensions disable <id>
neon-pilot settings schema
neon-pilot settings get <key>
neon-pilot settings set <key> 'true'
```

Background work and automations:

```sh
neon-pilot background-commands start --command "pnpm test" --cwd "$PWD"
neon-pilot background-commands logs <runId> --tail 200
neon-pilot tasks list
neon-pilot tasks save --title "Daily check" --cron "0 9 * * *" --prompt "Summarize status"
```

## Boundaries

- MCP is intentionally narrow and delegation-oriented.
- Use CLI discovery before guessing advanced commands.
- Use `--json` only when parsing output mechanically.
- Never pass secrets in argv; use stdin or Neon Pilot bootstrap flows.
- Do not edit Neon Pilot runtime files directly when a CLI command exists.
