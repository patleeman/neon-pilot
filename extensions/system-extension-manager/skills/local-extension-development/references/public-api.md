# Packaged public API reference

This is the callable contract available to user extensions. Imports are limited to `@neon-pilot/extensions`, `@neon-pilot/extensions/ui`, `@neon-pilot/extensions/settings`, and documented `@neon-pilot/extensions/backend/*` modules. Never import host, desktop, core, Electron, or Node process modules.

## Frontend surface

Every manifest component names an exported function with this shape:

```tsx
import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';

export function ItemsPage({ pa, context, surface, params }: ExtensionSurfaceProps) {
  // context: { extensionId, surfaceId, route, pathname, search, hash,
  //   conversationId?, cwd?, instanceId? }
  return null;
}
```

The frontend client supports:

```ts
pa.extension.invoke<T>(actionId, input?)
pa.extension.getManifest()
pa.extension.listSurfaces()
pa.storage.get<T>(key)
pa.storage.put(key, value, { expectedVersion? })
pa.storage.delete(key)
pa.storage.list<T>(prefix?)
pa.ui.toast(message, 'info' | 'warning' | 'error')
pa.ui.notify({ message, type?, details?, source? })
pa.ui.confirm({ title?, message }) // Promise<boolean>
pa.ui.subscribeInvalidations(({ topics }) => {}) // returns { unsubscribe }
pa.commands.execute(command, args?)
pa.commands.list()
pa.commands.setContext(key, value)
pa.events.publish(event, payload)
pa.events.subscribe(pattern, ({ event, payload }) => {}) // returns { unsubscribe }
pa.extensions.callAction(extensionId, actionId, input?)
pa.extensions.listActions()
pa.extensions.getStatus(extensionId)
```

Prefer `pa.extension.invoke` plus backend `ctx.storage` for shared durable product state. Frontend `pa.storage` is appropriate only for lightweight extension-owned UI state.

## Backend action

```ts
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export async function addItem(input: unknown, ctx: ExtensionBackendContext) {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  if (!title) throw new Error('Title is required.');
  const items = (await ctx.storage.get<Array<{ id: string; title: string }>>('items')) ?? [];
  const item = { id: crypto.randomUUID(), title };
  await ctx.storage.put('items', [...items, item]);
  ctx.ui.invalidate(['items']);
  return { ok: true, item };
}
```

Actions receive `(input, ctx)`, return JSON-serializable values, and must be listed in `backend.actions`. A frontend action normally declares `worker: { "enabled": true }`.

## Durable storage and secrets

```ts
ctx.storage.get<T>(key)                       // Promise<T | null>
ctx.storage.put(key, value, { expectedVersion? }) // Promise<{ ok: true }>
ctx.storage.delete(key)                      // Promise<{ ok: true, deleted: boolean }>
ctx.storage.list<T>(prefix?)                 // Promise<Array<{ key, value }>>
ctx.secrets.get(secretId)                    // string | undefined
```

Declare secret IDs in the manifest before using them. Never return or log a resolved secret. Request `storage:read`, `storage:write`, or `storage:readwrite` for the used operations and `secrets:read` for secret resolution.

## Scoped filesystem

Request a host-owned root, then use only relative paths within it:

```ts
const fs = await ctx.filesystem.app({ access: ['read', 'write'], reason: 'Store exported reports' });
await fs.writeText('reports/latest.md', markdown, { atomic: true });
const text = await fs.readText('reports/latest.md', { maxBytes: 1_000_000 });
const rows = await fs.list('reports', { depth: 2, excludeNames: ['.git'] });
await fs.createDirectory('archive');
await fs.move('reports/latest.md', 'archive/latest.md', { overwrite: true });
await fs.remove('archive/latest.md', { force: true });
```

Available root requests are `ctx.filesystem.workspace({ cwd?, access?, reason? })`, `.app(...)`, `.cache(...)`, `.temp({ ..., prefix? })`, and `.requestRoot({ kind, cwd?, access?, reason? })`. A root also supports `readBytes`, `writeBytes`, `readJson`, `writeJson`, `stat`, `copyIn`, and `createTempWorkspace`. Request `filesystem:read`, `filesystem:write`, or `filesystem:readwrite` as appropriate.

## Structured process execution

```ts
const result = await ctx.shell.exec({
  command: '/usr/bin/git',
  args: ['status', '--short'],
  cwd,
  timeoutMs: 30_000,
  maxBuffer: 1_000_000,
});
// result: { command, args, cwd?, stdout, stderr, executionWrappers }
```

Use an executable plus argument array; never build a shell command string. Long-lived interactive work may use `ctx.shell.spawn({ command, args?, cwd?, env?, pty?, onStdout?, onStderr?, onExit? })`, which returns `{ pid, usingPty, executionWrappers, kill, write, resize }`. Request `shell:execute`.

## Events and other extensions

```ts
await ctx.events.publish({ event: 'reading-list:changed', payload: { count } });
const subscription = ctx.events.subscribe('reading-list:*', async ({ event, payload, sourceExtensionId }) => {});
subscription.unsubscribe();

await ctx.extensions.callAction('another-extension', 'refresh', { force: true });
await ctx.extensions.listActions();
await ctx.extensions.getStatus('another-extension');
ctx.extensions.setEnabled('another-extension', true);
```

Use `extensions:read` for listing/status/calling declared public actions and `extensions:write` only for enable/disable management.

## Approval, notifications, and invalidation

The following example is for the **backend** `ctx` API. Its confirmation result is structured. In a frontend surface, `await pa.ui.confirm(...)` returns a boolean instead; use `if (!confirmed) return` and never read `.confirmed` from it.

```ts
const decision = await ctx.ui.confirm({
  title: 'Delete article?',
  message: 'This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Keep',
  timeoutMs: 60_000,
});
if (!decision.confirmed) return { ok: false, cancelled: true };

ctx.ui.invalidate(['articles']);
ctx.notify.toast('Article deleted', 'info');
ctx.notify.system({ title: 'Download complete', message: modelName });
```

Request `ui:confirm`, `ui:invalidate`, or `ui:notify` for the matching backend capability.

## Services

Declare a service in `backend.services` and export its handler:

```ts
export async function startSync(_input: unknown, ctx: ExtensionBackendContext) {
  // Start bounded long-lived work here and retain only worker-local state.
  return { started: true };
}

export async function stopSync() {
  // Stop timers, listeners, sockets, and interrupted work idempotently.
  return { stopped: true };
}
```

Declare the service with `"handler": "startSync"`, `"stopHandler": "stopSync"`, and `"worker": { "enabled": true }`. Request `network:listen`. Start and stop handlers must return serializable data or nothing; they must not return cleanup functions. Bound retries, make start/stop idempotent, and expose health where the manifest service contract supports it.

## Permissions

Common permission strings are `storage:read`, `storage:write`, `storage:readwrite`, `secrets:read`, `filesystem:read`, `filesystem:write`, `filesystem:readwrite`, `shell:execute`, `extensions:read`, `extensions:write`, `network:listen`, `ui:confirm`, `ui:invalidate`, and `ui:notify`. Start with `[]`; add only permissions used by reachable code. Validation rejects unknown or directly detectable missing permissions but cannot decide whether your scope is unnecessarily broad.
