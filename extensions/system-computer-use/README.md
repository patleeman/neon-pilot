# Computer Use

First-party extension that exposes a `computer_use` tool backed by [Cua Driver](https://github.com/trycua/cua/tree/main/libs/cua-driver).

Cua Driver runs as an MCP server over stdio (`cua-driver mcp`) and lets agents capture and control native desktop apps without moving the real cursor or stealing focus.

## Usage

- Run **Computer Use: Check Computer Use status** to verify `cua-driver` is on PATH.
- Run **Computer Use: Install Cua Driver** if missing.
- Run **Computer Use: Run Computer Use doctor** after install and grant OS permissions.
- Agent tool: `computer_use`.

Telemetry is disabled for Cua Driver calls by setting `CUA_DRIVER_RS_TELEMETRY_ENABLED=0`.

The extension does not package Cua Driver; the install command runs Cua's upstream installer and then verifies the installed `cua-driver --version`. The driver version tested for the current public workflow is `cua-driver 0.6.8`.

On macOS, Cua sends input directly to the target process and intentionally does not bring apps to the foreground. Use `capture`/`window_state` to find `pid`, `window_id`, and element indices, then prefer element clicks for app controls. Use `type` for text fields and `key` for single keys or hotkeys.

## Build

```bash
pnpm run extension:build -- extensions/system-computer-use
```
