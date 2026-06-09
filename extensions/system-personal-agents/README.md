# Personal Agents

Personal Agents is a default-off system extension for durable agent identities.

When enabled, it contributes the **Agents** nav item at `/agents`. The route is chat-first:

- the route-local left column lists personal agents
- the center pane renders the standard Neon Pilot conversation transcript and composer
- the route-local right panel edits the selected agent profile

Each profile stores a name, description, soul document, default conversation, memory/scope references, skill refs, tool policy, and gateway bindings. The extension binds a profile to its default conversation through extension-scoped conversation metadata and injects the profile's soul document as hidden per-turn context.

## Gateway Contract

Gateway extensions should route normalized messages through `routeGatewayMessage`:

```json
{
  "gatewayId": "telegram",
  "accountId": "main",
  "senderId": "12345",
  "text": "What needs my attention?",
  "receivedAt": "2026-06-09T12:00:00.000Z",
  "trustLevel": "paired"
}
```

The extension matches enabled gateway bindings, ensures the target profile conversation exists, posts the message into that conversation, and records the route in the profile activity feed.

## Validation

```bash
pnpm run extension:build -- extensions/system-personal-agents
vitest run extensions/system-personal-agents/src/backend.test.ts extensions/system-personal-agents/src/frontend.test.tsx
```

For app-path QA, enable the extension in Settings -> Extensions, open `/agents`, create an agent, edit the soul document, and confirm the center pane renders the standard conversation UI while the right panel remains visible.
