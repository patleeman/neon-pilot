# Telegram Gateway

Telegram Gateway owns the user-facing page for connecting Telegram chats to Neon Pilot conversations. It is a bundled system extension, but it is not a required extension; disabling `system-gateways` removes the Telegram Gateway nav item, page, sidebar, provider contribution, and extension secret contribution.

## Scope

- The extension contributes the primary **Telegram Gateway** route at `/gateways`.
- The **Telegram Gateway** nav item also owns the left sidebar body through `gateways-sidebar`, which lists active Telegram routes as conversation rows.
- The page should lead with the Telegram setup flow, not host implementation terms: configure credentials, route a Telegram chat to a conversation, then inspect active routes and recent activity.
- Bound conversations should be treated as the main working object. The sidebar is the quick route picker; the main page is for setup, route editing, and recent activity.
- The extension declares only the built-in `telegram` provider. Do not add other channel setup UI here; create a separate extension for a separate messaging channel.
- The desktop gateway routes under `/api/gateways` own shared host infrastructure, runtime startup, Telegram delivery, and gateway state persistence. This infrastructure can remain available even when the Telegram Gateway UI extension is disabled.
- The Telegram bot token is declared as the extension secret `telegramBotToken` and stored through the shared secrets backend. `TELEGRAM_BOT_TOKEN` can be used as an environment fallback when no stored value exists.

## Provider extensions

The shared gateway backend API can still support other channel extensions, but those extensions should own their own setup pages and should not rely on Telegram Gateway as a generic provider switcher. A separate extension can declare its provider in `extension.json`:

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

When changing the page, validate that `/gateways` loads through the desktop app, the left sidebar renders active Telegram routes, the conversation picker loads sessions, and token read/write actions hit the real `/api/gateways/telegram/token` route.
