# Conversations

Conversations are saved agent threads. Each conversation has a transcript, a composer, tools, attachments, model settings, and local history.

## Start a conversation

Create a new conversation from the sidebar, then type a message in the composer.

Press Enter to send. The agent can respond, call tools, create files, inspect context, and stream progress into the transcript.

## Composer basics

| Action                   | How                                                    |
| ------------------------ | ------------------------------------------------------ |
| Send message             | Enter                                                  |
| Add a new line           | Shift+Enter                                            |
| Mention files or context | Type `@`                                               |
| Open slash commands      | Type `/`                                               |
| Attach an image or file  | Drag it into the composer or use the attachment button |
| Paste an image           | Paste from the clipboard                               |
| Cancel active work       | Escape                                                 |

## Choose a model

Use the model controls in the composer or Settings to choose the provider and model for the conversation.

Neon Pilot supports Pi-backed provider configuration, so you can bring your own API keys and use the provider that fits the work.

See [Providers and models](providers-and-models.md).

## Add context

You can add context in several ways:

- reference files with `@`;
- attach files, images, PDFs, or videos;
- attach folders when a task needs a workspace;
- add standing instructions through your project files;
- use extension-provided context tools.

See [Context and attachments](conversation-context.md).

## Queue follow-up work

While the agent is working, you can queue another message.

| Mode      | How to use it                                       | What it does                                            |
| --------- | --------------------------------------------------- | ------------------------------------------------------- |
| Steer     | Send while the agent is still working               | Adds guidance to the current turn when possible.        |
| Follow-up | Hold Option/Alt and send while the agent is working | Queues the next prompt after the current work finishes. |

Queued messages appear above the composer so you can inspect or restore them.

## Branch and revisit work

Conversations are saved locally. You can reopen them from the sidebar.

When you want to try a different path, use conversation actions such as fork, rewind, or duplicate when available. These actions keep the original work intact while giving you a new place to continue.

## Inline shell commands

For quick local checks, start a composer message with `!`:

```text
!git status
```

Use `!!` when you want the command output to stay out of the agent's context:

```text
!!npm test
```

Normal agent-selected shell tool calls still appear as tool output in the transcript.

## Slash commands

Type `/` to open the command menu. Commands can compact context, export a conversation, rename a conversation, run a local action, or send a structured prompt to the agent depending on what is installed.

Extensions can add their own commands.

## Keyboard shortcuts

| Action                | Shortcut     |
| --------------------- | ------------ |
| New conversation      | `Cmd/Ctrl+N` |
| Submit message        | Enter        |
| New line in composer  | Shift+Enter  |
| Cancel agent response | Escape       |
| Hide workbench        | `F1`         |
| Show workbench        | `F2`         |
| Toggle sidebar        | `Cmd/Ctrl+/` |
| Toggle workbench      | `Cmd/Ctrl+\` |

## Related pages

- [Desktop app](desktop-app.md)
- [Context and attachments](conversation-context.md)
- [Providers and models](providers-and-models.md)
