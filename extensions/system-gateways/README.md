# Gateways

Gateways owns the user-facing page for connecting external messaging channels to Neon Pilot conversations.

## Scope

- The extension contributes the primary **Gateways** route at `/gateways`.
- The page should lead with an actual setup flow, not host implementation terms: connect the Telegram bot, route a Telegram chat to a conversation, then inspect active routes and recent activity.
- The desktop gateway routes under `/api/gateways` own shared host infrastructure, runtime startup, Telegram delivery, and gateway state persistence.
- The Telegram bot token is declared as the extension secret `telegramBotToken` and stored through the shared secrets backend. `TELEGRAM_BOT_TOKEN` can be used as an environment fallback when no stored value exists.

## Validation

When changing the page, validate that `/gateways` loads through the desktop app and that token read/write actions hit the real `/api/gateways/telegram/token` route.
