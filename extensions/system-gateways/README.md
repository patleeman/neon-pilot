# Gateways

Gateways is a bundled system extension that provides the `/gateways` setup page for external chat integrations.

The first bundled provider is Telegram. The extension contributes the `telegram` gateway provider metadata and uses the desktop gateway routes for token storage, connection state, runtime status, and Telegram allowlists. The host keeps the runtime and credentials boundary; this extension owns the user-facing setup surface.

## Telegram setup

1. Create a Telegram bot with BotFather.
2. Paste the bot token into `/gateways`.
3. Test the token.
4. Add approved Telegram user IDs or chat IDs before sharing the bot.

Saving a token creates and enables the Telegram gateway connection. Removing the token disables the connection and stops the runtime.
