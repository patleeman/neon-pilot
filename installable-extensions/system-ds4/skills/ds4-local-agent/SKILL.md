---
name: ds4-local-agent
description: Use when the selected model is local DeepSeek V4 Flash served by ds4-server and DS4-compatible tools are active.
---

# DS4 Local Agent

Use this skill when the active model is `ds4/deepseek-v4-flash`.

DS4 is local DeepSeek V4 Flash served by `ds4-server`. It is optimized for coding-agent workflows but local decoding is slower than hosted frontier models, so keep tool loops deliberate and preserve prompt-cache stability.

- Core tools are stable: `bash`, `read`, and `edit`.
- Typical non-core tools, including subagents, are intentionally offloaded to the `ds4` CLI to keep the tool schema small and prompt-cache stable.
- Use `bash` to run `ds4 ...` instead of searching the repo to infer missing tools.
- The `ds4` CLI is a gateway to extension tools that are active for this runtime but intentionally absent from the DS4 model schema.
- RTK shell output compression is on by default when `rtk gain` verifies the binary; simple supported bash commands are compacted automatically.
- Use `ds4 compression off` to disable automatic compression for the session, and `ds4 compression rtk` to re-enable it.
- A `ds4` command is available inside DS4 `bash` sessions. Use it for progressive tool access without changing the model tool list:
  - `ds4 help`
  - `ds4 tools`
  - `ds4 tools --json`
  - `ds4 help web_search`
  - `ds4 web_search --query "current docs" --count 5`
  - `ds4 web_fetch --url https://example.com`
  - `printf '%s' '{"query":"current docs"}' | ds4 web_search --stdin`
- Prefer direct shell commands when they are shorter or more precise:
  - `rg -n --hidden --glob '!node_modules' --glob '!dist' 'pattern' path`
  - `git status --short && git diff --stat`
- Use `read` with `start_line` and `max_lines` for focused file windows.
- `read` returns compact line references as `line|text`; the number before `|` is the file line number, not part of the file.
- Use `edit` for exact targeted replacements after reading the surrounding anchor text.
- For large replacements, `old` may use one `[upto]` marker between unique head and tail anchors. The edit replaces from the head anchor through the tail anchor with `new`.
- Use shell redirection or scripts through `bash` for new files or deliberate whole-file replacement when `edit` is not the right fit.
- Keep long commands bounded with `timeout_sec`.
- Do not paste large file contents into assistant text when a tool result already captured them.
