---
name: ds4-local-agent
description: Use when the selected model is local DeepSeek V4 Flash served by ds4-server and DS4-compatible tools are active.
---

# DS4 Local Agent

Use this skill when the active model is `ds4/deepseek-v4-flash`.

DS4 is local DeepSeek V4 Flash served by `ds4-server`. It is optimized for coding-agent workflows but local decoding is slower than hosted frontier models, so keep tool loops deliberate:

- Prefer `search` to locate compact anchors before reading large files.
- Use `read` with `start_line` and `max_lines` for focused windows. Use `more` only when the previous read says more context is needed.
- Use `list` for compact directory inspection.
- Use `edit` for exact targeted replacements after reading the surrounding anchor text. For large replacements, use `old` with `[upto]` between unique head and tail anchors.
- Use `write` for new files or deliberate whole-file replacement.
- Use `bash` for validation and repository inspection. Keep long commands bounded with `timeout_sec`; for long-running commands pass `refresh_sec`, then inspect with `bash_status` or stop with `bash_stop`.
- Use `google_search` for web search and `visit_page` for a known URL when current external context is needed.
- Do not paste large file contents into assistant text when a tool result already captured them.
