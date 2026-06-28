# Gateways

Gateways is a bundled system extension that provides the `/gateways` setup page for external chat integrations.

The first bundled provider is Telegram. The extension contributes the `telegram` gateway provider metadata and uses the desktop gateway routes for token storage, connection state, runtime status, and Telegram allowlists. The host keeps the runtime and credentials boundary; this extension owns the user-facing setup surface.

## Telegram setup

1. Create a Telegram bot with BotFather.
2. Paste the bot token into `/gateways`.
3. Test the token.
4. Add approved Telegram user IDs or chat IDs before sharing the bot.

Saving a token creates and enables the Telegram gateway connection. Removing the token disables the connection and stops the runtime.

## Telegram conversation commands

One Telegram chat has one active Neon Pilot conversation binding. Use `/threads` to list conversations currently visible in the sidebar, then tap a thread or send `/switch <number|title|id>` to make that conversation active for the Telegram chat. Numbered choices are resolved against the last list shown in that Telegram chat so `/switch 2` keeps matching what the user saw.

When a Telegram chat is bound to a Neon Pilot conversation and replies are enabled, the conversation is mirrored both ways. Telegram messages are submitted into the desktop conversation, and desktop-originated prompts plus assistant replies are sent back to Telegram. Telegram-originated prompts are not echoed back as duplicate `Desktop:` messages.

Use `/peek [number|title|id]` to preview a conversation without switching. Sending `/peek` with no target asks which active sidebar conversation to preview. Use `/tail [count]` for a short catch-up view of the current conversation and `/transcript [count]` or `/export [count]` for a longer bounded transcript output.

Archived conversations are separate from the active thread picker. Use `/archives [search]` or `/archived [search]` to find archived conversations and preview them before switching.
