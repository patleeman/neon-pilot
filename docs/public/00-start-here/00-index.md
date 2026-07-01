# Overview

Neon Pilot is a local macOS app for running AI agents. It is built around a self-extensible harness: your agent can help build, install, inspect, modify, and run extensions for the same app it works inside.

Use Neon Pilot when you want an agent workspace that is local first, provider-flexible, open source, and customizable.

## What you can do

| Task                                          | Start here                                         |
| --------------------------------------------- | -------------------------------------------------- |
| Install Neon Pilot on your Mac                | [Getting Started](getting-started.md)              |
| Let another coding agent install it for you   | [Install with another agent](agent-bootstrap.md)   |
| Configure models and API keys                 | [Providers and models](providers-and-models.md)    |
| Start and manage agent conversations          | [Conversations](conversations.md)                  |
| Attach files, screenshots, and context        | [Context and attachments](conversation-context.md) |
| Understand the app layout                     | [Desktop app](desktop-app.md)                      |
| Build a workflow-specific extension           | [Build an extension](build-an-extension.md)        |
| Read the extension manifest and SDK reference | [Extension authoring](extensions.md)               |

## Core ideas

### Self-extensible

Traditional extensible software asks you to install packages or write a large amount of framework code yourself. Neon Pilot takes the Pi idea further: the agent can build extensions for its own harness, then you can enable, inspect, modify, and keep using them locally.

Extensions can add pages, workbench panels, settings, commands, tools, storage, setup checks, transcript renderers, provider-aware behavior, and background services.

### Local first

Neon Pilot runs as a macOS desktop app. Conversations, settings, installed extensions, runtime state, and extension data live on your machine.

The app uses the network only through the model providers, MCP servers, tools, and integrations you configure.

### Provider-flexible

Neon Pilot uses the providers supported by Pi. Bring your own API keys, choose the model you want, and switch providers without moving your work into a different harness.

### Open source

Neon Pilot is MIT licensed. You can audit it, fork it, change it, and use it as the base for your own agent harness.

## Common workflows

### Work in a conversation

Start a conversation, attach the files or screenshots the agent needs, and ask for the task. Neon Pilot keeps the transcript, tool calls, outputs, and branch state locally so you can return to the work later.

### Continue work in the background

Longer tasks can continue as background runs, follow-ups, scheduled tasks, or extension-owned services. You can inspect visible run state instead of losing work when a single chat reply ends.

### Turn repeated work into an extension

If you repeat a workflow, ask the agent to build an extension. A small extension might add a tool. A larger one might add a full page, settings panel, command palette actions, storage, and backend automation.

### Use Neon Pilot from another agent

If you already use Claude Code, Codex, or another local coding agent, use [Install with another agent](agent-bootstrap.md). That page gives you a prompt and commands to let the other agent install Neon Pilot, configure it, and verify that it works.

## Where to go next

- [Getting Started](getting-started.md) for a human install path.
- [Providers and models](providers-and-models.md) to connect your model provider.
- [Build an extension](build-an-extension.md) to create your first self-extensible workflow.
