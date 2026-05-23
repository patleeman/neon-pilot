---
name: agent-browser-tool
description: Use when automating browsers, web apps, iOS Safari, or CDP-connected Electron apps with the agent_browser tool.
metadata:
  id: agent-browser-tool
  title: Agent Browser Tool
  summary: Browser automation through the agent_browser extension tool.
  status: active
---

# Agent Browser Tool

Use the `agent_browser` tool instead of shelling out to `agent-browser` directly. Reference docs: https://agent-browser.dev

Core workflow:

1. Open or connect: `{ "command": "open", "args": ["https://example.com"] }`.
2. Snapshot: `{ "command": "snapshot", "args": ["-i"] }` to get refs like `@e1`.
3. Interact: click/fill/select/check/press using refs.
4. Re-snapshot after navigation, form submits, modals, or dynamic DOM changes. Refs expire.

Examples:

- Open URL: `command=open`, `args=["https://example.com"]`
- Snapshot interactive elements: `command=snapshot`, `args=["-i"]`
- Click ref: `command=click`, `args=["@e1"]`
- Fill ref: `command=fill`, `args=["@e2", "hello"]`
- Wait for network idle: `command=wait`, `args=["--load", "networkidle"]`
- Screenshot: `command=screenshot`, `args=["/tmp/page.png"]`
- CDP Electron: launch app with remote debugging, then `command=connect`, `args=["9222"]`.

Use `session` for parallel isolated browser sessions. Use `platform: "ios"` for iOS simulator flows.
