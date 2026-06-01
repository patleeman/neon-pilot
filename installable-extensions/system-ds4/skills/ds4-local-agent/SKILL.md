---
name: ds4-local-agent
description: Use when the selected model is local DeepSeek V4 Flash served by ds4-server and DS4-compatible tools are active.
---

# DS4 Local Agent

Use this skill when the active model is `ds4/deepseek-v4-flash`.

DS4 is local DeepSeek V4 Flash served by `ds4-server`. It is optimized for coding-agent workflows but local decoding is slower than hosted frontier models, so keep tool loops deliberate and preserve prompt-cache stability.

- Core tools are stable: `bash`, `read`, `edit`, and `subagent`.
- Typical non-core tools are intentionally offloaded to the `ds4` CLI to keep the tool schema small and prompt-cache stable.
- Use `bash` to run `ds4 ...` instead of searching the repo to infer missing tools.
- The `ds4` CLI is a gateway to extension tools that are active for this runtime but intentionally absent from the DS4 model schema.
- If DS4 settings report RTK shell compression is enabled and `rtk gain` verifies the binary, simple supported bash commands are automatically run through RTK for compact output.
- Call `rtk ...` explicitly when you need a specific RTK mode such as `rtk test <command>`, `rtk err <command>`, `rtk gain`, or `rtk discover`.
- A `ds4` command is available inside DS4 `bash` sessions. Use it for progressive tool access without changing the model tool list:
  - `ds4 help`
  - `ds4 tools`
  - `ds4 tools --json`
  - `ds4 call web_search '{"query":"current docs","count":5}'`
  - `printf '%s' '{"url":"https://example.com"}' | ds4 call web_fetch --stdin`
- Prefer direct shell commands when they are shorter or more precise:
  - `rg -n --hidden --glob '!node_modules' --glob '!dist' 'pattern' path`
  - `git status --short && git diff --stat`
- Use `read` with `start_line` and `max_lines` for focused file windows.
- Use `edit` for exact targeted replacements after reading the surrounding anchor text.
- Use shell redirection or scripts through `bash` for new files or deliberate whole-file replacement when `edit` is not the right fit.
- Keep long commands bounded with `timeout_sec`.
- Do not paste large file contents into assistant text when a tool result already captured them.
