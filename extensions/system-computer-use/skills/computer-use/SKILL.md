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
- On macOS, `focus_app` is informational only; Cua delivers input to the target pid without bringing the app to the foreground.
- Use `type` for text fields. For app controls such as calculator operators, prefer `click` on the AX element; use `key` for single keys and hotkeys.
- Never type passwords, recovery codes, API keys, or other secrets.
- Never click OS permission prompts, payment confirmations, destructive deletion prompts, or login/logout/lock actions without explicit user instruction.
- If the accessibility tree is sparse, use screenshot coordinates carefully or stop and ask.

Troubleshooting:

- macOS needs Accessibility and Screen Recording permissions for Cua Driver.
- Cua Driver is not bundled or auto-installed on first use. It is installed by the `Install Cua Driver` command, then verified with the `Run Computer Use doctor` command.
- The currently tested public workflow uses `cua-driver 0.6.8`.
- Windows over SSH may not have an interactive desktop; use an RDP/console session or Cua Driver's autostart pattern.
- Linux needs a reachable display server and AT-SPI.
