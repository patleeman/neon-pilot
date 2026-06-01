---
name: ds4-local-agent
description: Use when the selected model is local DeepSeek V4 Flash served by ds4-server and DS4-compatible tools are active.
---

# DS4 Local Agent

Use this skill when the active model is `ds4/deepseek-v4-flash`.

DS4 is local DeepSeek V4 Flash served by `ds4-server`. It is optimized for coding-agent workflows but local decoding is slower than hosted frontier models, so keep tool loops deliberate:

- Start with the core tools only: `ds4_capabilities`, `bash`, `read`, and `edit`.
- Use `ds4_capabilities` to enable extra tool groups only when the task requires them:
  - `inspect` enables `list` and `search`.
  - `web` enables `google_search` and `visit_page`.
  - `files` enables `write` and `more`.
  - `async_shell` enables `bash_status` and `bash_stop`.
- Use `read` with `start_line` and `max_lines` for focused windows. Use `more` only when the previous read says more context is needed.
- Prefer `bash` for ordinary repo inspection. Enable `inspect` only when compact structured `list` or `search` output would save context.
- Use `edit` for exact targeted replacements after reading the surrounding anchor text. For large replacements, use `old` with `[upto]` between unique head and tail anchors.
- Use `write` for new files or deliberate whole-file replacement.
- Use `bash` for validation and repository inspection. Keep long commands bounded with `timeout_sec`; for long-running commands pass `refresh_sec`, then inspect with `bash_status` or stop with `bash_stop`.
- Use `google_search` for web search and `visit_page` for a known URL when current external context is needed.
- Do not paste large file contents into assistant text when a tool result already captured them.
