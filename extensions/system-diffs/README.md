# Diffs Extension

The Diffs extension owns checkpoint creation plus checkpoint transcript rendering.

Checkpoints create targeted git commits tied to a conversation. They capture selected files at a specific point so work can be reviewed or recovered through normal git history.

## Creating a checkpoint

Use the checkpoint tool from a conversation:

```json
{
  "action": "save",
  "message": "Refactor auth middleware",
  "paths": ["packages/core/src/auth.ts", "packages/core/src/auth.test.ts"]
}
```

Each checkpoint produces a real git commit in the repository.

## Viewing checkpoint diffs

Checkpoint saves stay pinned under collapsed internal-work groups, but the checkpoint card itself starts collapsed. Expanding the card reveals the inline diff view.

The extension no longer contributes a right-rail Diffs panel or paired workbench detail view.

## Checkpoint data

Each checkpoint stores:

| Field       | Description                                         |
| ----------- | --------------------------------------------------- |
| `id`        | Unique checkpoint identifier                        |
| `title`     | Checkpoint name or commit message                   |
| `commitSha` | Git commit hash                                     |
| `createdAt` | ISO timestamp                                       |
| `files`     | Array of tracked files with additions and deletions |
| `anchor`    | Conversation message that triggered the checkpoint  |

## Git integration

Checkpoint commits appear in the repo's git history alongside manually created commits. They can be pushed, pulled, branched, and reverted using normal git commands outside the app.

If git is not available, checkpoint creation will not function. The rest of the app works normally.
