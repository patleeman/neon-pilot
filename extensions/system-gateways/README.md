# Gateways

Gateways owns the user-facing page for connecting external messaging channels to Neon Pilot conversations.

## Scope

- The extension contributes the primary **Gateways** route at `/gateways`.
- The **Gateways** nav item also owns the left sidebar body through `gateways-sidebar`, which lists active gateway routes as conversation rows.
- The page should lead with an actual setup flow, not host implementation terms: choose a provider, configure credentials, route an external chat to a conversation, then inspect active routes and recent activity.
- Bound conversations should be treated as the main working object. The sidebar is the quick route picker; the main page is for setup, route editing, and recent activity.
- Gateway providers render from `contributes.gatewayProviders`. The system Gateways extension declares the built-in `telegram` and `slack_mcp` providers; other extensions can declare additional provider IDs and use the shared gateway backend API for state.
- The desktop gateway routes under `/api/gateways` own shared host infrastructure, runtime startup, Telegram delivery, and gateway state persistence.
- The Telegram bot token is declared as the extension secret `telegramBotToken` and stored through the shared secrets backend. `TELEGRAM_BOT_TOKEN` can be used as an environment fallback when no stored value exists.

## Provider extensions

An extension adds a provider by declaring it in `extension.json`:

```json
{
  "contributes": {
    "gatewayProviders": [
      {
        "id": "discord",
        "label": "Discord",
        "description": "Route Discord messages into Neon Pilot.",
        "configurationLocation": "extension",
        "setupRoute": "/ext/discord-gateway",
        "order": 30
      }
    ]
  }
}
```

Provider runtimes should import `@neon-pilot/extensions/backend/gateways` and call `ensureGatewayConnection`, `updateGatewayConnectionStatus`, `attachGatewayConversation`, `detachGatewayConversation`, and `recordGatewayEvent` instead of importing desktop gateway state modules directly.

## Validation

When changing the page, validate that `/gateways` loads through the desktop app, the left sidebar renders active routes, provider contributions appear in the channel list, the conversation picker loads sessions, and token read/write actions hit the real `/api/gateways/telegram/token` route.
