# Views

Neon Pilot has two view modes. Switch between them with `F1`/`F2` or the dropdown in the top bar.

## Conversation View (F1)

The default layout. A single conversation pane with the left sidebar for conversation navigation.

- **Left sidebar** — conversation list, toggle with `Cmd+/` (or `Ctrl+/`)
- **Center** — transcript and composer
- Use this for focused single-thread work

## Workbench View (F2)

A multi-pane layout for working alongside knowledge and tools. Available on conversation routes.

The right rail nav tabs include:

| Tab           | Shows when                           |
| ------------- | ------------------------------------ |
| File Explorer | Always — working directory file tree |
| Artifacts     | Conversation has rendered artifacts  |
| Browser       | Opened by user                       |
| Knowledge     | Primary page with right rail         |

Knowledge appears as a left-sidebar route (not a workbench tab). Extension-contributed tool panels also appear in the nav. Toggle the right rail (in compact mode) with `Cmd+\` or toggle the workbench explorer (in workbench mode) with `Cmd+\`.

For extension authors, the right rail is for compact contextual tools. If a feature needs the rail to select something and the center pane to render the large detail view, pair the rail view with a `location: "workbench"` detail view. See [Extensions](../extensions/system-extension-manager/README.md#surface-selection) for the surface decision guide.

### Rail pane behavior

- Panes are resizable by dragging the divider
- The File Explorer shows the workspace file tree
- Checkpoint diffs render inline in the transcript checkpoint card
- Artifacts render inline (HTML, Mermaid, LaTeX)
- Background commands and subagents render as inline transcript execution cards
- Browser loads pages alongside the conversation

## Layout Shortcuts

| Action                      | Shortcut              |
| --------------------------- | --------------------- |
| Conversation mode (compact) | `F1`                  |
| Workbench mode              | `F2`                  |
| Toggle left sidebar         | `Cmd+/` (or `Ctrl+/`) |
| Toggle right rail           | `Cmd+\` (or `Ctrl+\`) |

Default shortcuts are configurable in Settings → Keyboard.
