# OpenAI Desktop Plugin

Installs and manages the portable `neon-pilot` Codex/OpenAI Desktop plugin from inside Neon Pilot.

This system extension is enabled by default. On Neon Pilot startup, and again when the extension is re-enabled, it idempotently writes the local marketplace, registers that marketplace with `codex plugin marketplace add`, and installs/enables `neon-pilot@neon-pilot-local` with `codex plugin add`. Patrick should not need to copy files or run Codex commands by hand.

The generated plugin intentionally stays small:

- one Agent Skill that explains when and how to use the `neon-pilot` CLI;
- one MCP server with a narrow delegated-agent surface inspired by Codex's native subagent tools;
- no broad Neon Pilot administration MCP, settings editor, or app control plane.

## Plugin shape

The managed plugin is installed into a Neon Pilot-owned local Codex marketplace root, then registered and installed with the Codex CLI:

```text
~/.local/share/neon-pilot/codex-plugin-marketplace/
  .agents/plugins/marketplace.json
  plugins/neon-pilot/
    .codex-plugin/plugin.json
    .mcp.json
    skills/neon-pilot/SKILL.md
    mcp/neon-pilot-subagent.mjs
```

Startup install runs the equivalent of:

```sh
codex plugin marketplace add ~/.local/share/neon-pilot/codex-plugin-marketplace --json
codex plugin add neon-pilot@neon-pilot-local --json
```

Remove runs the matching `codex plugin remove` and `codex plugin marketplace remove` commands before deleting the generated files. Uninstalling the extension invokes that cleanup hook.

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
pnpm exec vitest run extensions/system-openai-desktop-plugin/src/backend.test.ts
```
