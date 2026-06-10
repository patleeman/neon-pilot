# Neon Pilot Agent

This system extension exposes Neon Pilot as a delegated worker for other agents through the `neon-pilot` CLI/protocol entrypoint.

```bash
neon-pilot protocol neon-pilot-agent run --prompt "Review this diff" --cwd . --tools default --json
neon-pilot protocol neon-pilot-agent start --prompt "Investigate flaky tests" --cwd . --task-slug flaky-tests --json
neon-pilot protocol neon-pilot-agent runs list --kind subagent --json
neon-pilot protocol neon-pilot-agent runs logs <runId> --tail 200
neon-pilot protocol neon-pilot-agent conversation create --title "Research worker" --cwd . --json
neon-pilot protocol neon-pilot-agent conversation send <conversationId> --prompt "Continue"
neon-pilot protocol neon-pilot-agent conversation close <conversationId>
```

Neon Pilot self-administration is not exposed through MCP. External agents should use `neon-pilot` commands; internal agents should use the canonical `neon_pilot` tool.
