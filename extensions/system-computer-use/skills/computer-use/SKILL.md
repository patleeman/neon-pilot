---
name: computer-use
description: Use when controlling native desktop applications through Cua Driver. Prefer browser tools for web-only tasks.
metadata:
  id: computer-use
  title: Computer Use
  status: active
---

# Computer Use

Use `computer_use` for native desktop apps when browser automation is not enough.

Rules:

- Prefer Workbench Browser or agent-browser for web-only tasks.
- Start with `computer_use(action="capture")` or `computer_use(action="status")`.
- Use `window_state` for a specific `pid` and `window_id` before clicking UI elements.
- Re-capture after state-changing actions; element indices are stale after UI changes.
- Never type passwords, recovery codes, API keys, or other secrets.
- Never click OS permission prompts, payment confirmations, destructive deletion prompts, or login/logout/lock actions without explicit user instruction.
- If the accessibility tree is sparse, use screenshot coordinates carefully or stop and ask.

Troubleshooting:

- macOS needs Accessibility and Screen Recording permissions for the app/terminal running Neon Pilot.
- Windows over SSH may not have an interactive desktop; use an RDP/console session or Cua Driver's autostart pattern.
- Linux needs a reachable display server and AT-SPI.
