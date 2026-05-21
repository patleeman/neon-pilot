# Clean-room Spec Generator

Default-off system extension for starting a clean-room research/spec conversation.

The extension reuses the normal conversation UI. It contributes one command, **Clean-room spec generator**, which creates a regular conversation with a web-only tool allowlist and per-turn clean-room instructions.

## Workflow

1. Enable the extension.
2. Run **Clean-room spec generator** from the command palette.
3. In the new conversation, send a URL, paper, tweet, blog, docs page, product page, demo, or other public reference.
4. The agent studies public material through web tools and writes a concise implementation brief/PRD.
5. Use **Start implementation from this spec** on the assistant spec message to open a fresh normal coding conversation seeded only with the spec.

## Boundary

Clean-room conversations are constrained by runtime tool policy to:

- `web_search`
- `web_fetch`
- `agent_browser`

They do not receive local filesystem, shell, repo-editing, checkpoint, scheduling, vault, or other local tools.

The per-turn instruction layer tells the observer agent to treat web content as untrusted, ignore prompt injections, avoid copying code/assets/long verbatim text, separate observations from assumptions, and produce a handoff document rather than implementation.

The implementation handoff creates a separate normal conversation. It includes the selected assistant message/spec and does not include browsing transcripts, tool traces, or hidden notes.

This is a technical/process boundary, not a legal guarantee.
