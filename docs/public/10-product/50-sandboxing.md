# Local data and permissions

Neon Pilot is local first. Conversations, settings, installed extensions, extension data, and runtime state live on your Mac.

Network access happens through the model providers, MCP servers, tools, and integrations you choose to configure.

## What stays local

Neon Pilot stores these on your machine:

- conversations and transcript history;
- app settings and local runtime state;
- installed extensions;
- extension settings and extension-owned data;
- local files and folders you attach or reference;
- generated artifacts and checkpoints;
- background work state.

Provider API keys should be stored through Settings, macOS Keychain, or another supported credential path.

## What can leave your machine

Model providers receive the prompt and context needed for the message you send. This can include conversation history, attached files, referenced files, images, screenshots, or tool results when they are part of the request.

Other configured tools may also use the network. For example:

- an MCP server may call a remote service;
- a browser tool may load a website;
- an extension may connect to an integration you enabled;

Review what you attach and which extensions you enable.

## Extension permissions

Extensions declare the capabilities they need. Depending on the extension, this can include storage, backend actions, tools, settings, commands, process execution, or provider-aware behavior.

Use the Extensions page to inspect installed extensions, enable or disable them, and review diagnostics.

## Process execution

Some agent work needs to run shell commands. Neon Pilot routes process execution through host-owned APIs so extensions and tools use the same visible execution boundary.

When a command runs, inspect the transcript or background-work surface to see what ran and what it returned.

## Filesystem access

The agent can work with files you attach, folders you select, and workspace paths you make available.

Keep sensitive files out of prompts unless the model provider and enabled tools are allowed to see them.

## Practical safety habits

- Store provider keys through Settings or a supported credential flow.
- Do not paste secrets into chat messages.
- Attach the smallest file set that solves the task.
- Inspect new extensions before enabling them.
- Disable extensions you are not using.
- Use local-only providers or tools when a task must not reach hosted services.

## Related pages

- [Providers and models](providers-and-models.md)
- [Context and attachments](conversation-context.md)
- [Build an extension](build-an-extension.md)
