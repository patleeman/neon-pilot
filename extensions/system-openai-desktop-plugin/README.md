# OpenAI Desktop Plugin

Installs and manages the portable `neon-pilot` Codex/OpenAI Desktop plugin from inside Neon Pilot.

The generated plugin intentionally stays small:

- one Agent Skill that explains when and how to use the `neon-pilot` CLI;
- one MCP server with a narrow delegated-agent surface inspired by Codex's native subagent tools;
- no broad Neon Pilot administration MCP, settings editor, or app control plane.

## Plugin shape

The managed plugin is installed into the default personal Codex marketplace layout:

```text
~/.agents/plugins/
  marketplace.json
  plugins/neon-pilot/
    .codex-plugin/plugin.json
    .mcp.json
    skills/neon-pilot/SKILL.md
    mcp/neon-pilot-subagent.mjs
```

The MCP tools map onto the existing Neon Pilot CLI protocol:

| MCP tool | CLI operation |
| --- | --- |
| `neon_pilot_delegate` | `neon-pilot protocol neon-pilot-agent start ... --json` |
| `neon_pilot_list_delegates` | `neon-pilot protocol neon-pilot-agent runs list --kind subagent --json` |
| `neon_pilot_get_delegate` | `neon-pilot protocol neon-pilot-agent runs get <runId> --json` |
| `neon_pilot_delegate_logs` | `neon-pilot protocol neon-pilot-agent runs logs <runId> ...` |
| `neon_pilot_follow_up` | `neon-pilot protocol neon-pilot-agent runs follow-up <runId> ... --json` |
| `neon_pilot_cancel_delegate` | `neon-pilot protocol neon-pilot-agent runs cancel <runId> --json` |

Keep additional Neon Pilot operations in the skill as CLI guidance unless there is a clear reason to expose a new, bounded MCP operation.

## Validation

From the repo root:

```sh
pnpm run extension:build -- extensions/system-openai-desktop-plugin
python3 /Users/patrick/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py /tmp/generated-neon-pilot-plugin
```

