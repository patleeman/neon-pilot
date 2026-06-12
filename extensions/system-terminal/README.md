# System Terminal

`system-terminal` owns the built-in Workbench terminal panel. The panel renders with xterm.js, while desktop core owns PTY lifecycle through the shared terminal session service and `node-pty`.

## Runtime Model

- `terminalCreate` is a bounded backend action that creates a host-owned terminal session for the active workspace cwd.
- Interactive I/O uses the desktop realtime WebSocket at `/api/realtime`.
- The terminal panel sends `terminal_attach`, `terminal_input`, `terminal_resize`, and `terminal_close` messages over realtime.
- The host replies with `terminal_attached` and `terminal` output/exit messages.
- `terminalDrain` remains a backend capability for compatibility and diagnostics, but the UI must not poll it for normal output.

When running inside the packaged Electron app, the panel reads `getEnvironment().realtimeUrl` from the desktop bridge so it connects to the real local backend instead of trying to open `ws://app`.

## Validation

After changing the terminal:

```bash
pnpm --dir packages/desktop exec vitest run server/app/realtime.test.ts server/extensions/terminalSessions.test.ts
pnpm run extension:build -- extensions/system-terminal
pnpm run check:extensions:static
```

For user-visible changes, open the Terminal workbench tool in the app, run a representative command, resize the rail, and confirm output appears without `terminalDrain` errors.
