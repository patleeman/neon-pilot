# Extension Data Conventions in Windowed OS

This doc explains how first-party extensions and app-style packages should use
the host-owned **documents store** as their durable app-data convention in the
Windowed OS desktop root. It is written for agents building or modifying
extensions that own user-visible or cross-app records.

## The documents store

The documents store is the canonical place for shared, user-visible, or
cross-app durable records. It lives under `<desktop-root>/data/documents`
in the desktop root layout (see
[Windowed OS filesystem inventory](windowed-os-filesystem-inventory.md)).

It is backed by a host-owned database that supports:

- **Owner-scoped collections** - each extension/app owns its collections
- **Structured records** - JSON bodies with typed metadata
- **Read/write grants** - owner-only, all-extensions, or explicit grant-based access
- **Change events** - document mutations publish events on the host event bus

The public backend API is exposed through `@neon-pilot/extensions/backend/documents-store`
and as `ctx.documents` on backend action contexts. Frontend code should call
backend actions to read/write documents; do not import the backend seam directly
from frontend components.

## When to use the documents store vs. extension-private storage

| Storage target                                              | Use for                                                                                                        | Scope                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Documents store** (`ctx.documents`)                       | User-visible records, cross-app data, durable domain objects (boards, tasks, notes, activity entries, exports) | Owned collections; grantable to other apps |
| **Per-extension KV storage** (`ctx.storage` / `pa.storage`) | Extension-private settings, small JSON blobs, cache, ephemeral working state                                   | Single extension only                      |
| **Per-extension SQLite** (`ctx.database`)                   | Relational query-heavy state, indexes, queues private to one extension                                         | Single extension only                      |
| **Per-extension filesystem** (`ctx.filesystem.app()`)       | Large files, blobs, exports, attachment caches private to one extension                                        | Single extension only                      |

**Rule of thumb:** If a record should survive extension reinstall, appear in the
user's Home/Inbox/Activity surfaces, be queryable from another app, or persist as
a user-owned artifact, put it in the documents store. If it is purely internal
configuration or derived cache, keep it in per-extension storage.

## Owner / collection / id conventions

Documents are addressed by a triple `(owner, collection, id)`:

### Owner

The **owner** is the extension or app `id` expressed in kebab-case.

- First-party system extensions: `"system-files"`, `"system-alerts"`, `"system-todo"`
- First-party optional extensions: `"system-knowledge"`, `"system-writing-studio"`
- App-style packages: `"inbox"`, `"activity"`, `"home"`
- User-extensions: use the extension `id` from `extension.json`

The owner string must be stable. Do not change an extension's `id` after it has
created collections. If a rename is unavoidable, migrate the documents to a new
collection under the new owner.

### Collection

The **collection** is a semantic grouping of records within an owner's scope.
Collection names are stable kebab-case strings.

Conventions for first-party apps:

| Owner           | Example collections                  | Contents                                                |
| --------------- | ------------------------------------ | ------------------------------------------------------- |
| `home`          | `dashboard-sections`, `pinned-items` | User-customizable dashboard layout and pinned shortcuts |
| `inbox`         | `inbox-items`                        | Host-owned attention queue records                      |
| `activity`      | `activity-entries`                   | App-wide event timeline entries                         |
| `system-alerts` | `alerts`                             | Alert records with kind, severity, status               |
| `system-todo`   | `todos`                              | Conversation-scoped todo entries                        |
| `system-files`  | `quick-access`                       | User-pinned file shortcuts                              |

Use a small number of stable collections per app. Choose collection names that
match the domain noun a user would recognize. Do not embed user or tenant IDs
in collection names - those belong in record-level metadata or grants.

### Id

The **document id** within a collection is a stable, human-readable string or UUID.

- Prefer descriptive slugs for user-visible records: `"getting-started-checklist"`,
  `"weekly-review-note-2026-07-01"`
- Use UUIDs only when there is no natural stable identifier: `crypto.randomUUID()`
- Do not encode hierarchy in ids - use a separate body field for parent refs
- Ids must be unique within `(owner, collection)`

## Permissions

Declare the required document grant in `extension.json`:

```json
{
  "permissions": ["documents:read"]
}
```

Available permissions:

| Permission            | Meaning                                           |
| --------------------- | ------------------------------------------------- |
| `documents:read`      | Read documents in any collection the grants allow |
| `documents:write`     | Write documents in owned collections              |
| `documents:readwrite` | Combined read + write grant                       |

An extension can always read and write its own collections. Reading another
extension's collections requires either the target collection's
`defaultGrantRead: "all"` or an explicit grant. See the backend store API docs
for grant management.

## API surface

### Backend action handlers

```ts
import type { ExtensionBackendContext } from '@neon-pilot/extensions';

export async function createTask(input: { title: string }, ctx: ExtensionBackendContext) {
  const id = `task-${Date.now()}`;
  const task = await ctx.documents.putDocument({
    owner: ctx.extensionId, // your extension id
    collection: 'tasks',
    id,
    body: { title: input.title, status: 'open', createdAt: new Date().toISOString() },
  });
  return task;
}

export async function listTasks(_input: unknown, ctx: ExtensionBackendContext) {
  const result = await ctx.documents.listDocuments({
    owner: ctx.extensionId,
    collection: 'tasks',
    limit: 50,
  });
  return result;
}

export async function getTask(input: { id: string }, ctx: ExtensionBackendContext) {
  return ctx.documents.getDocument({
    owner: ctx.extensionId,
    collection: 'tasks',
    id: input.id,
  });
}
```

### Direct seam import (backend modules)

```ts
import { listDocuments } from '@neon-pilot/extensions/backend/documents-store';

const results = await listDocuments('system-todo', 'todos', { limit: 50 }, extensionId);
```

Always pass `callerAppId` from your extension context. The host enforces
permission checks against that identity.

### What not to do

- Do not import `packages/desktop/server/extensions/backendApi/documents-store.ts`
  or any `packages/desktop/server/` path directly.
- Do not read or write documents store files by constructing filesystem paths
  under `<desktop-root>/data/documents/`. The database format is an
  implementation detail.
- Do not skip permission checks by using a host-level identity for cross-app
  reads unless the target collection explicitly allows it.

## Reading documents from other apps

If your extension needs to read data owned by another first-party app:

1. Check whether the target collection has `defaultGrantRead: "all"`.
2. If not, coordinate with the owning extension to add your extension id to
   the collection's explicit grant list.
3. Prefer the `ctx.documents` API with the correct owner and collection.
4. Declare `documents:read` in your manifest.

Do not hardcode access to another extension's storage or database.

## Cross-references

- [Storage section of packages/extensions/README.md](../packages/extensions/README.md#storage)
  - per-extension KV, SQLite, and filesystem storage
- [Windowed OS filesystem inventory](windowed-os-filesystem-inventory.md)
  - desktop root layout and migration plan
- `@neon-pilot/extensions/backend/documents-store` - SDK type definitions and
  stub implementation
- `packages/desktop/server/extensions/backendApi/documents-store.ts` - host
  implementation (for reference, not direct import)
