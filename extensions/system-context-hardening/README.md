# Context Hardening Extension

Backend-only extension that keeps agent context from being poisoned by oversized tool outputs.

## Runtime behavior

- Truncates text tool-result blocks before Pi persists the message or sends the next provider request.
- Caps OpenAI Responses `function_call_output` payloads as a second line of defense.
- Marks truncated tool-result messages with metadata so UI/history can indicate truncation.

This protects overflow recovery from pathological outputs such as sourcemap lines or large command dumps.
