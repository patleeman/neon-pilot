# System Terminal

`system-terminal` owns the built-in Workbench terminal panel. The panel renders with xterm.js, while desktop core owns PTY lifecycle through the shared terminal session service and `node-pty`.

## Runtime Model

- `terminalCreate` is a bounded backend action that creates a host-owned terminal session for the active workspace cwd.
- Terminal output uses the extension backend SSE route at `/api/extensions/system-terminal/routes/stream?id=<terminal-id>`.
- Input, resize, and close remain bounded backend actions because they are short control operations.
- `terminalDrain` remains a backend capability for compatibility and diagnostics, but the UI must not poll it for normal output.

The stream route is handled in the extension host process, which is the same process that owns the in-memory terminal sessions. This avoids cross-process session lookups and avoids attempting to open a WebSocket from the `neon-pilot://app` custom protocol.

## Validation

After changing the terminal:

```bash
pnpm --dir packages/desktop exec vitest run server/app/realtime.test.ts server/extensions/terminalSessions.test.ts
pnpm run extension:build -- extensions/system-terminal
pnpm run check:extensions:static
```

For user-visible changes, open the Terminal workbench tool in the app, run a representative command, resize the rail, and confirm output appears without `terminalDrain` errors.
