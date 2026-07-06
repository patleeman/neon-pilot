# Data Tools (system-data-tools)

Agent-facing tools over the host-owned Documents store.

## Tools

| Tool         | Description                                                               |
| ------------ | ------------------------------------------------------------------------- |
| `data_list`  | Discover document collections. Required so agents reuse schemas (D4).     |
| `data_read`  | Read documents from a collection — single doc by ID, or paginated list.   |
| `data_write` | Create or update a document (auto-creates the collection on first write). |
| `data_watch` | Block until a document change matches the watch criteria, or timeout.     |

## How it works

- All tools call the documents store through the extension host capability bridge
  (`ctx.documents`). The bridge supplies the real extension identity, so tool
  handlers cannot self-assert a different caller.
- Because `system-data-tools` is the locked host-owned agent broker, the bridge
  grants it trusted agent-level access to all collections, matching the agent tool
  contract where agents must be able to read/write across arbitrary owners.
- Ordinary extensions using `@neon-pilot/extensions/backend/documents-store` still pass
  `ctx.extensionId` as `callerAppId` and are subject to ownership/grant enforcement.
- `data_watch` uses the extension subscription system: the extension registers a
  `contributes.subscriptions` on source `documents`, and the document mutation
  route handlers or backend API seam call `publishExtensionHostEvent('documents', payload)`.
  The `onDocumentEvent` handler receives matching events and resolves the
  pending watch Promise in the same worker process (module-scoped state).

## Permission model

- **system-data-tools (host-owned agent tooling):** has full access to all collections
  across all owners through `ctx.documents`. This is what allows `data_write` to
  auto-create collections and write documents for any owner.
- **Regular extension callers** of `@neon-pilot/extensions/backend/documents-store` are
  subject to ownership and grant enforcement via their `callerAppId`. They can only read
  collections they own or have an explicit read grant for, and only write collections
  they own or have an explicit write grant for.
- Anonymous `@neon-pilot/extensions/backend/documents-store` calls are rejected.
  Host-owned agent access is only exposed through the capability bridge.

## data_watch design decision

`data_watch` is implemented cleanly using existing extension event APIs:

- `publishExtensionHostEvent('documents', payload)` from the route layer and
  backend API seam.
- `contributes.subscriptions` with source `documents` to receive events.
- Module-level WatchEntry Set shared between `dataWatch` (tool handler) and
  `onDocumentEvent` (subscription handler) in the same extension worker process.

No polling, no new runtime primitives.
