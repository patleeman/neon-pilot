# System Terminal

`system-terminal` owns the built-in Workbench terminal panel. The panel renders with xterm.js, while desktop core owns PTY lifecycle through the shared terminal session service and `node-pty`.

## Runtime Model

- `terminalCreate` is a bounded backend action that creates a host-owned terminal session for the active workspace cwd.
- Terminal I/O normally uses the host realtime WebSocket returned by `terminalCreate`. The panel attaches with `terminal_attach`, sends keystrokes with `terminal_input`, forwards resize with `terminal_resize`, and closes with `terminal_close`.
- Terminal output falls back to the extension backend SSE route at `/api/extensions/system-terminal/routes/stream?id=<terminal-id>` if the realtime socket is unavailable. After a successful realtime attach, the panel suppresses duplicated fallback replay so reconnects do not print the same prompt/output twice.
- When the workbench is hidden or the user navigates to a route without workbench support, the terminal panel unmounts and the tab is retired instead of preserving a stale session handle.
- If the terminal falls back to degraded non-PTY mode, keystrokes queued before startup resolution are echoed once the mode is known so early input does not appear to disappear.
- Input, resize, and close fall back to bounded backend actions when realtime attach fails.
- `terminalDrain` remains a backend capability for compatibility and diagnostics, but the UI must not poll it for normal output.

The realtime socket uses the local backend loopback URL so keystrokes avoid the higher-latency extension action RPC path. The fallback stream route is bridged through the desktop local API stream layer for the `neon-pilot://app` custom protocol.

## Validation

After changing the terminal:

```bash
pnpm --dir packages/desktop exec vitest run server/app/realtime.test.ts server/extensions/terminalSessions.test.ts
pnpm run extension:build -- extensions/system-terminal
pnpm run check:extensions:static
```

For user-visible changes, open the Terminal workbench tool in the app, run a representative command, resize the rail, and confirm output appears without `terminalDrain` errors.
