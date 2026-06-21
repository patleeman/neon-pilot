# Knowledge base sync

The knowledge base is durable agent memory backed by a git repository. Use it for instruction files, reusable notes, project context, and workflow knowledge that should survive app reinstalls or move between machines.

## What to store

Good knowledge base content is stable, useful across conversations, and safe to keep in git:

- Repo or project notes that help the agent orient quickly.
- Personal workflow preferences and recurring task checklists.
- Reusable instructions, skills, and reference material.
- Decisions or summaries you want future conversations to find.

Do not store API keys, tokens, passwords, private credentials, or one-off scratch output that does not need to be durable.

## Repository setup

The knowledge base can be backed by any git repository that `git clone` can read.

The repository setting accepts SSH remotes, HTTPS remotes, and local repository paths. Local paths are useful when the remote is already configured with the right authentication, because Neon Pilot clones from that path into its managed runtime mirror instead of guessing a GitHub URL or credential mode.

Typical setup path:

1. Create or choose a private git repository for durable knowledge.
2. Make sure the machine can clone it from a terminal using the same account that runs Neon Pilot.
3. Open **Settings** and configure the knowledge repository.
4. Run sync, then confirm the latest files appear in the Knowledge surface or managed mirror.
5. Add a small note, sync again, and confirm the git remote receives the change.

## How sync works

The Knowledge extension stores its managed mirror under the runtime state directory and syncs it through extension backend actions. Git operations run through the extension backend context so process policy stays host-owned while Knowledge-specific state and behavior remain extension-owned.

Keep edits in the app or in the repository cleanly synced before switching machines. If a sync reports a git conflict, resolve it in the repository or managed mirror like a normal git conflict, then run sync again.

## Related docs

- [Getting Started](getting-started.md) — first-run app and provider verification
- [Configuration](configuration.md) — state, config, and knowledge root paths
- [Extension distribution](extension-distribution.md) — installing optional Knowledge-related extension surfaces
