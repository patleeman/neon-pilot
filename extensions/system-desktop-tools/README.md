# Desktop Tools

First-party system extension that exposes agent-facing tools over Neon Pilot's own Windowed OS desktop.

## Tools

- `desktop_state` returns the latest sanitized semantic desktop snapshot: window ids, titles, routes, bounds, focus, z-order, minimized/maximized state, parent window ids, workspace cwd, and route metadata.

This extension is semantic-first and read-only for now. It does not expose screenshots, DOM snapshots, raw pixels, or window-control verbs. Future Phase 5 slices should add `desktop_control` and `desktop_screenshot` here once those capabilities share the same code paths as user-facing window actions.

## Build

```bash
pnpm run extension:build -- extensions/system-desktop-tools
```
