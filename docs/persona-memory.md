# Persona Memory

Persona memory is the durable context loaded for the directly summoned user-facing persona. It is not worker context.

## Desktop root files

The current Phase 4 prototype reads persona memory markdown files from:

```text
<desktop-root>/agents/*.md
```

`AGENTS.md`, hidden files, directories, non-markdown files, and symlinks are excluded. `AGENTS.md` is loaded through the shared instruction-layer path, while the remaining markdown files are treated as persona memory documents.

## Prompt loading boundary

Persona memory is queued as prompt context only when the direct user-facing chat path explicitly opts in:

- Desktop local API chat creation.
- Desktop local API chat prompt submission.
- Desktop local API resumed conversation message submission.
- HTTP live-session prompt route.

The shared live-session capability defaults to no persona memory. Extension conversation APIs, background/deferred resumes, parallel prompts, and other programmatic worker paths must not set the persona-memory opt-in flag.

This preserves the Phase 4 rule: one persona identity, many worker executions. Workers can read ordinary referenced context when explicitly attached or mentioned, but they do not inherit the user's persona memory bundle.
