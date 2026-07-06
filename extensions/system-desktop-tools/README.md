# Desktop Tools

First-party system extension that exposes agent-facing tools over Neon Pilot's own Windowed OS desktop.

The extension declares `desktop:control`; the host enforces that permission before `desktop_control` or `desktop_screenshot` can reach the active renderer.

## Tools

- `desktop_state` returns the latest sanitized semantic desktop snapshot: window ids, titles, routes, bounds, focus, z-order, minimized/maximized state, parent window ids, workspace cwd, and route metadata.
- `desktop_control` sends a semantic command to the active Windowed OS renderer and waits for acknowledgement. Supported actions are `open`, `focus`, `move`, `resize`, `snap`, `minimize`, `restore`, and `close`.
- `desktop_screenshot` captures Neon Pilot's own Windowed OS renderer as PNG image content. Pass a `windowId` from `desktop_state` to capture one visible desktop window; omit it to capture the full renderer viewport.
- `desktop_window_events` returns recent user action events on agent-touched windows: focus, minimize, restore, close, move, resize, maximize, and snap. Pass `lastEventId` from a previous response and an optional `limit` to incrementally read new events without reprocessing old ones.

This extension is semantic-first: it does not expose DOM snapshots or host-OS windows. The renderer owns the canonical window model, `desktop_control` is executed by `WindowedLayout` through the same window actions available to the user, and `desktop_screenshot` is acknowledged by that renderer before returning image content.

## Build

```bash
pnpm run extension:build -- extensions/system-desktop-tools
```
