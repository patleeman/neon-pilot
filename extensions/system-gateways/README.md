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

One Telegram chat has one active Neon Pilot conversation binding. Use `/threads [search]` to list or search conversations currently visible in the sidebar, then tap a thread or send `/switch <number|title|id>` to make that conversation active for the Telegram chat. Numbered choices are resolved against the last list shown in that Telegram chat so `/switch 2` keeps matching what the user saw.

When a Telegram chat is bound to a Neon Pilot conversation and replies are enabled, the conversation can be mirrored both ways. Telegram messages are submitted into the desktop conversation, and desktop-originated activity follows the chat's mirror mode. Use `/mirror all` to send desktop prompts plus assistant replies, `/mirror notify` to send assistant replies only, or `/mirror muted` to stop desktop-originated delivery to Telegram. Telegram-originated prompts are not echoed back as duplicate `Desktop:` messages.

Use `/peek [number|title|id]` to preview a conversation without switching. Sending `/peek` with no target asks which active sidebar conversation to preview. Use `/tail [count]` for a short catch-up view of the current conversation, `/summary [count]` for an extractive recent-activity summary, `/transcript [count]` for a longer bounded transcript output, or `/export [count]` to receive the bounded transcript as a text file.

Archived conversations are separate from the active thread picker. Use `/archives [search]` or `/archived [search]` to find archived conversations and preview them before switching.

Telegram has a separate pin list for faster switching. Use `/pin [number|title|id]` to pin the current or selected conversation, `/unpin [number|title|id]` to remove it, and `/pins` to list pinned conversations. Pinned conversations are shown first in Telegram thread lists.

Run and gateway controls are available from Telegram. Use `/cancel` to stop the currently running agent turn, `/pause` to stop Telegram-submitted prompts from receiving replies, `/resume` to re-enable replies, `/diagnostics` to inspect recent gateway delivery status, and `/status` for the current thread, run state, reply state, and mirror mode.

Use `/defaults`, `/defaultmodel [model|clear]`, and `/defaultcwd [path|clear]` to set per-chat defaults for newly-created Telegram conversations. Telegram supports text, photos, voice messages, and image documents as prompt input; non-image document uploads are rejected with a clear message. Transcript exports are delivered as Telegram document attachments.
