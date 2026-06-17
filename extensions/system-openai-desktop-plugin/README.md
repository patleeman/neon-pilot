# OpenAI Desktop Plugin

Installs and manages the portable `neon-pilot` Codex/OpenAI Desktop plugin from Neon Pilot Settings.

This system extension is enabled by default so the Settings section is available, but it does not install anything automatically. Use Settings -> OpenAI Desktop Plugin to install, reinstall, remove, and refresh status.

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

Install and reinstall run the equivalent of:

```sh
codex plugin marketplace add --json ~/.local/share/neon-pilot/codex-plugin-marketplace
codex plugin add --json neon-pilot@neon-pilot-local
codex mcp add neon-pilot -- node ~/.local/share/neon-pilot/codex-plugin-marketplace/plugins/neon-pilot/mcp/neon-pilot-subagent.mjs
```

The plugin manifest also declares `.mcp.json`, but the explicit `codex mcp add` entry is intentional: Codex Desktop surfaces user MCP config entries more reliably than plugin-bundled MCP declarations in its settings/status UI. The MCP entry points at the generated plugin source so reinstall can refresh the server script in place.

Remove runs `codex mcp remove neon-pilot` plus the matching `codex plugin remove` and `codex plugin marketplace remove` commands before deleting the generated files. Uninstalling the extension invokes that cleanup hook.

The MCP tools map onto the existing Neon Pilot CLI protocol:

| MCP tool | CLI operation |
| --- | --- |
| `neon_pilot_delegate` | `neon-pilot protocol neon-pilot-agent start ... --json` |
| `neon_pilot_list_delegates` | `neon-pilot protocol neon-pilot-agent runs list --kind subagent --json` |
| `neon_pilot_get_delegate` | `neon-pilot protocol neon-pilot-agent runs get <runId> --json` |
| `neon_pilot_wait_any_delegate` | `neon-pilot protocol neon-pilot-agent runs wait-any --run-ids <id1,id2,...> ... --json` |
| `neon_pilot_delegate_logs` | `neon-pilot protocol neon-pilot-agent runs logs <runId> ...` |
| `neon_pilot_follow_up` | `neon-pilot protocol neon-pilot-agent runs follow-up <runId> ... --json` |
| `neon_pilot_cancel_delegate` | `neon-pilot protocol neon-pilot-agent runs cancel <runId> --json` |

Keep additional Neon Pilot operations in the skill as CLI guidance unless there is a clear reason to expose a new, bounded MCP operation.

## Workbench sidecar

The extension contributes a Codex Desktop webapp sidecar at `codex-home-neon-pilot.localhost`. It is a lightweight Workbench launcher that discovers other extension webapps through `/.neon/api/extensions/webapps` and opens the sidecar surfaces that make sense inside Codex Desktop, currently Drawing and Scratchpad.

## Validation

From the repo root:

```sh
pnpm run extension:build -- extensions/system-openai-desktop-plugin
python3 /Users/patrick/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py /tmp/generated-neon-pilot-plugin
pnpm exec vitest run extensions/system-openai-desktop-plugin/src/backend.test.ts
```
