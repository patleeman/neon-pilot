# Views

Neon Pilot routes use one shell model:

- **Global left navigation** — persistent app navigation at the top and bottom.
- **Contextual left area** — route-owned selection/navigation content, blank when undeclared while the global top/bottom nav remains.
- **Main page** — the primary route surface.
- **Right sidebar** — optional route-owned context rail, hidden when undeclared.

Chat uses the contextual left area for Threads and the right sidebar for Workbench. Other routes can declare their own contextual left area and right sidebar through extension nav bindings.

## Chat View

Chat is the conversation route. It owns the Threads contextual left area, transcript/composer main page, and Workbench right sidebar.

- **Global left navigation** — app routes and settings remain visible.
- **Contextual left area** — Threads conversation list, toggle with `Cmd+/` (or `Ctrl+/`).
- **Main page** — transcript and composer.
- **Right sidebar** — Workbench, toggle with the right-side top-bar button or `Cmd+\` (or `Ctrl+\`).

## Workbench

Workbench is Chat's right-sidebar content: a tabbed panel for working alongside a conversation. It is available on conversation routes, not as a generic name for every route's right sidebar.

The new tab page includes:

| Tab           | Shows when                           |
| ------------- | ------------------------------------ |
| File Explorer | Always — working directory file tree |
| Artifacts     | Conversation has rendered artifacts  |
| Browser       | Opened by user                       |
| Chat          | Opened by user                       |
| Terminal      | Opened by user                       |
| Knowledge     | Opened by user                       |

Extension-contributed workbench tools can appear on the new tab page.

For extension authors, a tab-local workbench rail is for compact contextual tools inside a workbench tab. If a feature needs the rail to select something and the main area to render the large detail view, pair the rail view with a `location: "workbench"` detail view.

Route-owned right sidebars are different: declare a `views[].location: "rightRail"` view with `placement: "primary"` and bind it from `nav[].rightSidebarView`. Use route-owned context rails for selected-object details, inspectors, setup output, logs, previews, validation, and secondary actions beside a main page. See [Extension route shell regions](extensions.md#route-shell-regions).

### Workbench Behavior

- Panes are resizable by dragging the divider
- The File Explorer shows the workspace file tree
- Checkpoint diffs render inline in the transcript checkpoint card
- Artifacts render inline (HTML, Mermaid, LaTeX)
- Background commands and subagents render as inline transcript execution cards
- Browser loads pages alongside the conversation

## Extension Route Shells

Extension routes should declare only the regions they own:

- A `main` view with a route is required.
- A `sidebar` view can be bound with `sidebarView` when the route has a natural selector or navigator.
- A `rightRail` view with `placement: "primary"` can be bound with `rightSidebarView` when the route needs contextual details beside the main page.

`placement` and `scope` are side-region fields; do not put them on `main` views.

If a route omits `sidebarView`, the middle-left area stays blank rather than showing Threads. If a route omits `rightSidebarView`, the right-sidebar toggle is hidden for that route.

Main pages that own row or object selection should publish route context with `pa.selection.set({ kind: "resource", resource: { type, id, label, source, data } })`. The route-owned right sidebar should render that selected object's details, inspector, setup output, logs, preview, validation, or secondary actions. Use modals for blocking or transient flows, not normal object inspection.

## Layout Shortcuts

| Action                         | Shortcut              |
| ------------------------------ | --------------------- |
| Hide workbench / right sidebar | `F1`                  |
| Show workbench / right sidebar | `F2`                  |
| Toggle left sidebar            | `Cmd+/` (or `Ctrl+/`) |
| Toggle route right sidebar     | `Cmd+\` (or `Ctrl+\`) |

Default desktop shortcuts are configurable in Settings → Desktop. Host and extension command keybindings are configurable in Settings → Commands.
