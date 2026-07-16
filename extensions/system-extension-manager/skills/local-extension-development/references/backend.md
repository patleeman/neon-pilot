# Backend and capability reference

## Contents

- Action pattern
- Persistence and secrets
- Host capabilities
- Tools, services, and events
- Permissions and safety
- Failure behavior

## Action pattern

```ts
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export async function listItems(input: unknown, ctx: ExtensionBackendContext) {
  ctx.log.info('list items');
  const items = (await ctx.storage.get('items')) ?? [];
  return { ok: true, items };
}
```

Declare every action in `backend.actions`. Actions invoked from UI, commands, or tools should use a worker declaration unless the manifest contract explicitly says otherwise.

Validate unknown input before use. Return small serializable objects with stable fields. Do not return secrets, handles, class instances, or unbounded logs.

## Persistence and secrets

Use `ctx.storage` for extension-owned durable state. Namespace records by resource, workspace, or conversation when the product scope requires it.

Use the host secret/settings capability for credentials. Never save tokens in frontend storage, source, manifest, logs, or ordinary JSON state.

Define one authority for each datum. Do not maintain competing copies in frontend local storage and backend storage.

## Host capabilities

Use narrow context capabilities:

- `ctx.storage` for extension state.
- `ctx.filesystem` for scoped files.
- `ctx.shell` for approved process execution.
- `ctx.git` for repository operations.
- `ctx.events` for publish/subscribe.
- `ctx.extensions` for declared cross-extension actions and status.
- `ctx.conversations` for supported conversation operations and transcript blocks.
- `ctx.log` for structured diagnostics.
- `ctx.ui.confirm` when backend work requires user approval.

Do not import Neon Pilot internals. Do not use direct `child_process`, `worker_threads`, raw SQLite internals, or Electron.

## Tools, services, and events

Tools map a model-facing name and JSON input schema to a declared backend action. Keep them coarse, task-oriented, and safe. The tool description and schema already reach the model; add prompt guidance only for behavioral constraints the schema cannot express.

Long-lived services belong in `backend.services`. Declare `network:listen`, export a serializable start handler, and declare a separate exported `stopHandler`; worker services cannot return cleanup functions. Add health checks and restart policy for recoverable background work.

Use manifest subscriptions for supported host events and `ctx.events` for extension-owned events. Prefer event-driven frontend updates over polling when the backend can publish changes.

Use transcript block contributions for durable extension-owned results that users should inspect inside a conversation.

## Permissions and safety

Request only the permissions required by the implemented paths. The host enforces extension, filesystem, shell, network, and secret boundaries.

- Constrain filesystem roots and filenames.
- Treat external and file content as untrusted.
- Bound process time, output, and concurrency.
- Avoid shell string concatenation; pass structured commands through `ctx.shell`.
- Confirm destructive operations at the last responsible moment.
- Make retries idempotent or detect duplicates.
- Clean up services, subscriptions, temporary files, and interrupted work.

## Failure behavior

Return errors the frontend can present in user language. Log diagnostic detail without leaking secrets. Preserve prior durable state on failed updates. For long operations, expose pending/running/completed/failed state and a safe retry or cancellation path.
