# Neon Pilot Agent

This system extension exposes Neon Pilot as a delegated worker for other agents.

It has two protocol entrypoints:

```bash
neon-pilot protocol neon-pilot-agent run --prompt "Review this diff" --cwd . --tools default --json
neon-pilot protocol neon-pilot-agent start --prompt "Investigate flaky tests" --cwd . --task-slug flaky-tests --json
neon-pilot protocol neon-pilot-agent runs list --kind subagent --json
neon-pilot protocol neon-pilot-agent runs logs <runId> --tail 200
neon-pilot protocol neon-pilot-agent conversation create --title "Research worker" --cwd . --json
neon-pilot protocol neon-pilot-agent conversation send <conversationId> --prompt "Continue"
neon-pilot protocol neon-pilot-agent conversation close <conversationId>
```

The MCP entrypoint is:

```bash
neon-pilot protocol neon-pilot-agent-mcp
```

The MCP server exposes the same small orchestration surface: run one-shot tasks, create/send/close agent conversations, start/follow-up/cancel subagents, and inspect durable runs/logs. It intentionally does not expose raw app internals, settings mutation, arbitrary filesystem APIs, or shell APIs.
