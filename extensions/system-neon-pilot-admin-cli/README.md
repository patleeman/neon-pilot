# Neon Pilot CLI

The Neon Pilot CLI extension owns the app-backed administration surface for external callers and the canonical internal `neon_pilot` agent tool.

## Ownership

This bundled required system extension contributes the unified control-plane tool and CLI-backed actions for app commands, control-plane health, app updates, heartbeats, bootstrap commands, conversation administration, delegated agent runs, and durable background runs.

Keep product administration here unless the command is core shell behavior. Do not add duplicate self-admin tools in other extensions; route internal agent administration through `neon_pilot` and external administration through `neon-pilot`.

## Surfaces

- Agent tool: `neon_pilot`
- CLI/protocol entrypoints: Neon Pilot admin and delegated-agent command handling
- Backend exports: `neonPilotAgent`, `neonPilotAgentCli`, settings read/update helpers, and admin action handlers
- Settings: controls whether the CLI entrypoint is enabled
- Setup Readiness: reports and repairs the user-shell `neon-pilot` link when it is missing

## Conversation identity

CLI-created conversations are user-addressable app threads. `conversation create` therefore creates a canonical visible, saved conversation by default and returns the canonical conversation id used by the sidebar, transcript routes, daemon live-run state, and follow-up commands. Hidden ephemeral agent handles are reserved for internal extension/tool flows and should not be used for CLI or MCP-style user thread creation unless the caller explicitly asks for hidden ephemeral behavior.

## Validation

```bash
pnpm run extension:build -- extensions/system-neon-pilot-admin-cli
pnpm exec vitest run extensions/system-neon-pilot-admin-cli/src/backend.test.ts extensions/system-neon-pilot-admin-cli/src/agentBackend.test.ts extensions/system-neon-pilot-admin-cli/src/manifest.test.ts
pnpm run check:cli
pnpm run check:extensions:static
```

For user-visible changes, invoke the affected `neon-pilot ...` command against a running app and invoke the matching `neon_pilot` tool path when one exists. Confirm structured `--json` output only for commands that automation depends on.
