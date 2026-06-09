# Embedded Personal Agents

This note turns the OpenClaw/Hermes-style "single entity you can talk to anywhere" idea into a Neon Pilot product shape. The feature should live as a system extension unless a missing shared boundary needs to be added to core.

## External Feature Sweep

Sources checked on June 9, 2026:

- OpenClaw GitHub and docs: https://github.com/openclaw/openclaw and https://openclawdoc.com/. Local-first gateway, many chat channels, multi-agent routing, live canvas, voice wake/talk mode, skills, host/sandbox split, DM pairing, and channel allowlists.
- Hermes Agent GitHub and docs: https://github.com/NousResearch/hermes-agent and https://hermes-agent.nousresearch.com/docs/. Self-improving memory/skills, session search, messaging gateway, scheduled automations, subagents, RPC/script delegation, terminal backends, model switching, OpenClaw migration, and profiles.

High-signal ideas to bring into Neon Pilot:

- A durable **personal agent** object, not just a conversation or background run.
- One primary **soul document** per personal agent for persona and behavioral policy.
- Multiple personal agents, each with its own model/runtime defaults, tools, skills, memory scope, gateway bindings, automations, and visible conversations.
- A left-sidebar destination that shows personal agents as selectable entities, then shows that agent's conversations, automations, gateway status, and recent work.
- Gateway delivery through existing or future gateway extensions, beginning with Telegram because Neon Pilot already has Telegram test inventory and gateway backend seams.
- Natural-language automations bound to a personal agent, with delivery to the agent's default conversation, a dedicated conversation, or an external channel.
- Cross-session recall from selected conversations and knowledge directories, implemented through prompt assembly/context providers rather than runtime system-prompt mutation.
- Skill creation/import as explicit behavior assets. Hermes' OpenClaw migration list maps cleanly to Neon Pilot assets: soul documents, memory files, skills, command/tool approval policy, gateway settings, and workspace instructions.
- Multi-agent routing where inbound channel/account/peer rules select a personal agent, then route into that agent's active or dedicated conversation.
- Safety defaults from the start: paired/allowlisted senders, per-agent tool permissions, sandbox policy for channel-originated work, visible gateway status, and transcript/audit history for remote-triggered actions.

## Product Shape

Build a `system-personal-agents` extension with:

- Main route: `/agents`
- Left sidebar view while `/agents` is active, similar to Knowledge's `sidebarView`.
- Main page list for personal agents with status, default channel, model/runtime, last activity, and quick actions.
- Agent detail page with tabs for conversation, soul document, memory/context, skills, automations, gateways, and activity.
- "New personal agent" flow that creates an agent profile, a soul document, and an initial visible conversation.

Each personal agent should appear as its own entity in the sidebar. The sidebar row should open the agent detail route, not pretend the agent is a normal conversation. The agent's active conversation can be shown underneath in the extension-owned sidebar view, while global conversation rows stay flat in the normal activity tree.

## Core Boundaries To Add Only If Needed

Keep the first version extension-owned, but add small general-purpose API surfaces when the extension cannot stay clean:

- Agent profile storage and prompt assembly provider registration if profiles need to affect normal conversation creation.
- Gateway identity routing if Telegram or other channel adapters need to target personal agents instead of raw conversations.
- Activity-tree item support for extension-owned durable entities if the existing extension sidebar view is not enough.
- Per-agent permission/sandbox policy if current tool permission surfaces are conversation-only.

Do not hardcode Hermes/OpenClaw behavior in desktop core. Core should expose durable profiles, routing, prompt inputs, and policy hooks; the product workflow belongs in the extension.

## Implemented Small Core

The bundled `system-personal-agents` extension ships default-off and implements the first small core:

- Create/read/update/delete personal agents in extension storage.
- Create and edit the agent's soul document in the agent details panel.
- Start or resume a visible saved conversation for a selected personal agent.
- Inject the soul document, selected memory scopes, skill references, and tool policy through a turn-context provider for that agent's conversations.
- Show an `Agents` nav item when enabled, with an extension-owned agent sidebar and an agents-only details panel.
- Provide a gateway-ready routing action that sends allowed sender/channel/account messages into the agent's default conversation.

The first version deliberately keeps gateway setup and automations pluggable. Telegram, scheduled work, voice, and external channel adapters should remain separate extensions that call the Personal Agents routing actions.

## Later Versions

- Gateway connectors: Telegram first, then Discord/Slack/WhatsApp/Signal-style adapters as separate gateway extensions.
- Voice memo transcription and TTS responses through optional extensions.
- Agent-to-agent routing and delegation policies.
- Skills import from OpenClaw/Hermes/Codex skill formats.
- Self-review loop for suggesting memory and skill updates, with explicit user approval.
- Live canvas/artifact surface for visual collaboration.
- Remote/runtime backends for local, Docker, SSH, and serverless workers.
- Migration wizard for OpenClaw/Hermes assets.

## Validation Notes

When this feature is implemented, validate the user path through the desktop app:

- Open `/agents` from the left sidebar.
- Create a personal agent and confirm it appears in the extension sidebar.
- Edit the soul document and confirm a new agent conversation receives it through prompt assembly diagnostics.
- Create an automation bound to the agent and run it once.
- If Telegram is wired, send one message from an allowed sender and confirm it lands in the expected agent conversation with visible gateway status and transcript output.
