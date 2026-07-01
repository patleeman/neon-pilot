# Computer Use

First-party extension that exposes a `computer_use` tool backed by [Cua Driver](https://github.com/trycua/cua/tree/main/libs/cua-driver).

Cua Driver runs as an MCP server over stdio (`cua-driver mcp`) and lets agents capture and control native desktop apps without moving the real cursor or stealing focus.

## Usage

- Run **Computer Use: Check Computer Use status** to verify Cua Driver is reachable.
- Run **Computer Use: Install Cua Driver** if missing.
- Run **Computer Use: Run Computer Use doctor** after install and grant OS permissions.
- Agent tool: `computer_use`.

Telemetry is disabled for Cua Driver calls by setting `CUA_DRIVER_RS_TELEMETRY_ENABLED=0`.

The extension does not package Cua Driver or auto-install it on first use. The install command runs Cua's upstream installer and then verifies the installed `cua-driver --version`. The driver version tested for the current public workflow is `cua-driver 0.6.8`.

The extension contributes a setup readiness item for Cua Driver. The readiness item offers Install when the driver is missing, offers Run Doctor when the driver is installed but permissions need attention, and reports ready after the health check passes.

On macOS, the installer creates `/Applications/CuaDriver.app`. Neon Pilot resolves that app bundle directly as well as common PATH locations, so the agent can still use Cua Driver when the app process was launched before shell PATH changes were visible.

Setup flow for users:

1. Run **Computer Use: Install Cua Driver**.
2. Run **Computer Use: Run Computer Use doctor**.
3. Grant macOS **Accessibility** and **Screen Recording** permissions for Cua Driver when prompted.
4. Rerun doctor until the permission checks pass.

On macOS, Cua sends input directly to the target process and intentionally does not bring apps to the foreground. Use `capture`/`window_state` to find `pid`, `window_id`, and element indices, then prefer element clicks for app controls. Use `type` for text fields and `key` for single keys or hotkeys.

## Build

```bash
pnpm run extension:build -- extensions/system-computer-use
```
