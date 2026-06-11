# Scratchpad

Scratchpad adds a conversation-scoped markdown note pane plus an agent tool. It is for durable thread-local working state: assumptions, decisions, open questions, current plan details, and handoff notes that should survive compaction and restarts.

Scratchpads are stored in conversation metadata under the historical `threadScratchpad` namespace, keyed by conversation id. That preserves scratchpads created before this feature moved out of Conversation Tools.

Do not store secrets, credentials, private keys, tokens, or unrelated long-term knowledge in scratchpads.

## User Surface

- Workbench right rail: open **Scratchpad** from the workbench tool rail, command palette command **Scratchpad: Open Scratchpad**, or `Cmd/Ctrl+Shift+S`.
- Scope: one scratchpad per conversation.
- Enable/disable: this is a normal system extension (`system-scratchpad`) with `defaultEnabled: true`; disable or re-enable it from Settings → Extensions when available for non-required system extensions.

## Agent Tool

The extension contributes the `scratchpad` tool:

```json
{ "action": "get" }
{ "action": "set", "content": "## Current state\n..." }
{ "action": "append", "content": "Validation passed." }
{ "action": "prepend", "content": "Important assumption." }
{ "action": "clear" }
```

`conversationId` is optional for agents running inside a conversation; it defaults to the current tool context. External callers can pass `conversationId` explicitly.

The extension also contributes a conversation-scoped turn context provider. When the scratchpad is non-empty, its content is injected before each submitted turn as **Conversation Scratchpad** context so the active agent can use it without manually calling `scratchpad get` every turn.

## CLI

```sh
neon-pilot conversations scratchpad get <id> --json
neon-pilot conversations scratchpad set <id> --content "## Plan" --json
neon-pilot conversations scratchpad patch <id> --operation append --content "Validation passed" --json
```

## Development

Build from the repo root:

```sh
pnpm run extension:build -- extensions/system-scratchpad
```

Focused checks:

```sh
pnpm --dir extensions/system-scratchpad test
pnpm run check:extensions:static
```
