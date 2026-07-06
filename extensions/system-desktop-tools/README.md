# Desktop Tools

First-party system extension that exposes agent-facing tools over Neon Pilot's own Windowed OS desktop.

## Tools

- `desktop_state` returns the latest sanitized semantic desktop snapshot: window ids, titles, routes, bounds, focus, z-order, minimized/maximized state, parent window ids, workspace cwd, and route metadata.
- `desktop_control` sends a semantic command to the active Windowed OS renderer and waits for acknowledgement. Supported actions are `open`, `focus`, `move`, `resize`, `snap`, `minimize`, `restore`, and `close`.

This extension is semantic-first: it does not expose screenshots, DOM snapshots, raw pixels, or host-OS windows. The renderer owns the canonical window model, and `desktop_control` is executed by `WindowedLayout` through the same window actions available to the user. Future Phase 5 slices should add `desktop_screenshot`, attribution marking for agent-touched windows, symmetric user-action events, and the final `desktop:control` permission gate.

## Build

```bash
pnpm run extension:build -- extensions/system-desktop-tools
```
