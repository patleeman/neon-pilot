---
name: ds4-local-agent
description: Use when the selected model is local DeepSeek V4 Flash served by ds4-server and DS4-compatible tools are active.
---

# DS4 Local Agent

Use this skill when the active model is `ds4/deepseek-v4-flash`.

DS4 is local DeepSeek V4 Flash served by `ds4-server`. It is optimized for coding-agent workflows but local decoding is slower than hosted frontier models, so keep tool loops deliberate and preserve prompt-cache stability.

- Core tools are stable: `bash`, `read`, `edit`, and `subagent`.
- If DS4 settings report RTK shell compression is enabled and `rtk gain` verifies the binary, simple supported bash commands are automatically run through RTK for compact output.
- Call `rtk ...` explicitly when you need a specific RTK mode such as `rtk test <command>`, `rtk err <command>`, `rtk gain`, or `rtk discover`.
- A `ds4` command is available inside DS4 `bash` sessions. Use it for DS4-shaped helpers without changing the model tool list:
  - `ds4 help`
  - `ds4 list [path]`
  - `ds4 search "pattern" [path] --glob .ts --context 2 --max-results 40`
  - `ds4 read path --start-line 20 --max-lines 120`
  - `printf '%s\n' "content" | ds4 write path`
  - `ds4 edit path --old-file /tmp/old --new-file /tmp/new`
  - `ds4 fetch https://example.com --max-bytes 20000`
- Prefer direct shell commands when they are shorter or more precise:
  - `rg -n --hidden --glob '!node_modules' --glob '!dist' 'pattern' path`
  - `git status --short && git diff --stat`
- Use `read` with `start_line` and `max_lines` for focused file windows.
- Use `edit` for exact targeted replacements after reading the surrounding anchor text.
- For large replacements, write old/new snippets to temp files and use `ds4 edit path --old-file /tmp/old --new-file /tmp/new`.
- Use shell redirection or scripts through `bash` for new files or deliberate whole-file replacement when `edit` is not the right fit.
- Keep long commands bounded with `timeout_sec`.
- Do not paste large file contents into assistant text when a tool result already captured them.
