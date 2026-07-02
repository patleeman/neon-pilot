# Getting Started

Install Neon Pilot, connect a model provider, and send your first message.

## Install the app

Download the latest signed macOS build:

[Download the latest DMG](https://github.com/patleeman/neon-pilot/releases/download/v0.11.39/Neon-Pilot-0.11.39-mac-arm64.dmg)

Open the `.dmg`, then drag **Neon Pilot.app** into **Applications**.

You can also install and bootstrap from Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/patleeman/neon-pilot/master/install.sh | bash -s -- --install-cli --bootstrap
```

Use the Terminal command when you want the CLI installed at the same time, or when you want another local agent to run the install for you.

## Open Neon Pilot

Open **Neon Pilot.app** from Applications.

On first launch, Neon Pilot starts a short guided tour over the real app. The app also starts and manages its local background services for you.

## Connect a model provider

Open **Settings**, then choose the provider and model you want to use.

Neon Pilot supports the providers available through Pi. Bring your own API keys and store them through the app. Do not paste API keys into chat messages or command history.

For more detail, see [Providers and models](providers-and-models.md).

## Send a first message

Create a new conversation and send a small prompt:

```text
Summarize what Neon Pilot is and suggest one useful next step.
```

The setup is working when the conversation loads and the agent replies.

## Add useful context

When the agent needs local context, add it from the composer:

- Type `@` to reference workspace files.
- Drag files or screenshots into the composer.
- Attach a folder when the task needs a whole project.
- Use the workbench to inspect files, artifacts, browser views, terminal output, and extension surfaces beside the conversation.

See [Context and attachments](conversation-context.md) for the full guide.

## Build your first extension

Neon Pilot is self-extensible. If you repeat a workflow, ask your agent to turn it into an extension.

Start with [Build an extension](build-an-extension.md).

## Next steps

- [Desktop app](desktop-app.md) explains the main app layout.
- [Conversations](conversations.md) explains messages, follow-ups, branches, and shortcuts.
- [Install with another agent](agent-bootstrap.md) shows how to delegate setup to Claude Code, Codex, or another local coding agent.
