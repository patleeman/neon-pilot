# Desktop app

Neon Pilot is a macOS desktop app for running and extending AI agent workflows.

The app gives you a local conversation workspace, a workbench beside the conversation, Settings, Extensions, and background work surfaces.

## Main areas

| Area            | What it is for                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Left navigation | Move between conversations, extensions, settings, and installed product surfaces.                            |
| Conversation    | Chat with the agent, attach files, inspect tool output, and continue saved work.                             |
| Composer        | Send prompts, attach files, choose models, queue follow-ups, and use commands.                               |
| Workbench       | Inspect files, artifacts, browser pages, terminal output, extension panels, and other side-by-side surfaces. |
| Settings        | Configure providers, models, app preferences, extensions, commands, and local readiness.                     |
| Extensions      | Enable, disable, inspect, install, or build app-grade capabilities.                                          |

## Conversation and workbench modes

Neon Pilot has two common layouts:

| State                | Shortcut | Description                                     |
| -------------------- | -------- | ----------------------------------------------- |
| Conversation focused | `F1`     | Single conversation pane with the left sidebar. |
| Workbench open       | `F2`     | Conversation plus a right-side workbench.       |

Toggle the left sidebar with `Cmd+/` or `Ctrl+/`.

Toggle the workbench with `Cmd+\` or `Ctrl+\`.

## Workbench

The workbench is the side-by-side space for context and outputs. Depending on what you have opened or installed, it can show:

- file explorer;
- rendered artifacts;
- browser pages;
- terminal views;
- knowledge or context views;
- extension-provided tools and panels.

Use the workbench when the agent's work needs inspection, files, previews, or controls beside the transcript.

## Settings

Use Settings to manage:

- model providers and default models;
- API keys and provider credentials;
- extension settings;
- keyboard shortcuts and command bindings;
- desktop preferences;
- local readiness items.

Provider keys should be stored through Settings or another safe credential path. Do not paste provider keys into conversations.

## Extensions

Extensions are first-class app capabilities. They can add pages, panels, tools, commands, settings, background services, setup checks, transcript renderers, and provider-aware behavior.

Neon Pilot ships with bundled system extensions. You can also install optional extensions or ask your agent to build one for your own workflow.

## Keyboard shortcuts

Default shortcuts:

| Action                    | Shortcut           |
| ------------------------- | ------------------ |
| Show Neon Pilot           | `Cmd/Ctrl+Shift+A` |
| New conversation          | `Cmd/Ctrl+N`       |
| Close tab                 | `Cmd/Ctrl+W`       |
| Reopen closed tab         | `Cmd+Shift+N`      |
| Previous conversation     | `Cmd/Ctrl+[`       |
| Next conversation         | `Cmd/Ctrl+]`       |
| Toggle pinned             | `Cmd/Ctrl+Alt+P`   |
| Archive / restore         | `Cmd/Ctrl+Alt+A`   |
| Rename conversation       | `Cmd/Ctrl+Alt+R`   |
| Focus composer            | `Cmd/Ctrl+L`       |
| Edit working directory    | `Cmd/Ctrl+Shift+L` |
| Find on page              | `Cmd/Ctrl+F`       |
| Settings                  | `Cmd/Ctrl+,`       |
| Quit                      | `Cmd/Ctrl+Q`       |
| Conversation mode         | `F1`               |
| Workbench mode            | `F2`               |
| New workbench tab         | `Cmd/Ctrl+T`       |
| Close workbench tab       | `Cmd/Ctrl+Shift+W` |
| Close workbench file      | `Cmd/Ctrl+Alt+W`   |
| Refresh workbench file    | `F5`               |
| Toggle workbench explorer | `Cmd/Ctrl+B`       |
| Toggle workbench diff     | `Cmd/Ctrl+Shift+D` |
| Toggle left sidebar       | `Cmd/Ctrl+/`       |
| Toggle right sidebar      | `Cmd/Ctrl+\`       |

Shortcuts are configurable in Settings when the owning command supports keybinding changes.

## Related pages

- [Conversations](conversations.md)
- [Context and attachments](conversation-context.md)
- [Build an extension](build-an-extension.md)
