# Legacy knowledge files

Knowledge files are legacy durable reference material. Use [Memory](memory.md) for agent-owned standing behavior, workspace scopes, skills, Git history, remote setup, and sync.

The optional Knowledge extension, when installed, can browse and edit reference files beside conversations. It is not the GA source of truth for agent memory.

## What to store

Good legacy knowledge content is stable, useful across conversations, and safe to keep in files:

- Repo or project notes that help the agent orient quickly.
- Reference material that should be searched or explicitly attached.
- Decisions or summaries you want future conversations to find.

Do not store API keys, tokens, passwords, private credentials, or one-off scratch output that does not need to be durable.

## Migration to Memory

Open **Memory** and use **Import knowledge** to create `memory/scopes/imported-knowledge/memory.md`.

The imported scope uses `inject: false`. Review it, move durable behavior into `memory/system.md` or a scoped `memory.md`, and keep pure reference material outside injected memory.

Configure the Memory remote from the Memory page when you want Git-backed sync between machines.

## Related docs

- [Getting Started](getting-started.md) — first-run app and provider verification
- [Configuration](configuration.md) — state, config, and root paths
- [Extension distribution](extension-distribution.md) — installing optional Knowledge-related extension surfaces
