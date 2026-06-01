---
name: ds4-local-agent
description: Use when the selected model is local DeepSeek V4 Flash served by ds4-server and DS4-compatible tools are active.
---

# DS4 Local Agent

Use this skill when the active model is `ds4/deepseek-v4-flash`.

DS4 is local DeepSeek V4 Flash served by `ds4-server`. It is optimized for coding-agent workflows but local decoding is slower than hosted frontier models, so keep tool loops deliberate and preserve prompt-cache stability.

- Core tools are stable: `bash`, `read`, and `edit`.
- Prefer `bash` for ordinary repo inspection instead of adding specialized tools. Useful patterns:
  - List files: `find . -maxdepth 2 -type f | sed 's#^\./##' | sort | head -200`
  - Search text: `rg -n --hidden --glob '!node_modules' --glob '!dist' 'pattern' path`
  - Inspect git state: `git status --short && git diff --stat`
  - Fetch a known URL when needed: `python3 - <<'PY'\nimport urllib.request\nprint(urllib.request.urlopen('https://example.com', timeout=10).read().decode('utf-8', 'replace')[:20000])\nPY`
- Use `read` with `start_line` and `max_lines` for focused file windows.
- Use `edit` for exact targeted replacements after reading the surrounding anchor text. For large replacements, use `old` with `[upto]` between unique head and tail anchors.
- Use shell redirection or scripts through `bash` for new files or deliberate whole-file replacement when `edit` is not the right fit.
- Keep long commands bounded with `timeout_sec`.
- Do not paste large file contents into assistant text when a tool result already captured them.
