# Views

Neon Pilot has a conversation layout with an optional workbench panel. Toggle the workbench with the right-side top-bar button or `Cmd+\` (or `Ctrl+\`).

## Conversation View

The default layout when the workbench is hidden. A single conversation pane with the left sidebar for conversation navigation.

- **Left sidebar** — conversation list, toggle with `Cmd+/` (or `Ctrl+/`)
- **Center** — transcript and composer
- Use this for focused single-thread work

## Workbench

A tabbed panel for working alongside knowledge and tools. Available on conversation routes.

The new tab page includes:

| Tab           | Shows when                           |
| ------------- | ------------------------------------ |
| File Explorer | Always — working directory file tree |
| Artifacts     | Conversation has rendered artifacts  |
| Browser       | Opened by user                       |
| Knowledge     | Opened by user                       |

Knowledge also appears as a left-sidebar route. Extension-contributed workbench tools can appear on the new tab page.

For extension authors, an extension rail is for compact contextual tools inside a workbench tab. If a feature needs the rail to select something and the main area to render the large detail view, pair the rail view with a `location: "workbench"` detail view. See [Extensions](../extensions/system-extension-manager/README.md#surface-selection) for the surface decision guide.

### Workbench Behavior

- Panes are resizable by dragging the divider
- The File Explorer shows the workspace file tree
- Checkpoint diffs render inline in the transcript checkpoint card
- Artifacts render inline (HTML, Mermaid, LaTeX)
- Background commands and subagents render as inline transcript execution cards
- Browser loads pages alongside the conversation

## Layout Shortcuts

| Action              | Shortcut              |
| ------------------- | --------------------- |
| Hide workbench      | `F1`                  |
| Show workbench      | `F2`                  |
| Toggle left sidebar | `Cmd+/` (or `Ctrl+/`) |
| Toggle workbench    | `Cmd+\` (or `Ctrl+\`) |

Default shortcuts are configurable in Settings → Keyboard.
