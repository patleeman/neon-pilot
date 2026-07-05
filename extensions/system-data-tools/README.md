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

- All tools call the documents store through `@neon-pilot/extensions/backend/documents-store`,
  which enforces the same caller-aware read/write grants as the HTTP route layer.
- The calling extension's `ctx.extensionId` is passed as the caller identity for
  authorisation.
- `data_watch` uses the extension subscription system: the extension registers a
  `contributes.subscriptions` on source `documents`, and the document mutation
  route handlers or backend API seam call `publishExtensionHostEvent('documents', payload)`.
  The `onDocumentEvent` handler receives matching events and resolves the
  pending watch Promise in the same worker process (module-scoped state).

## Permission model

Callers can only read collections they own or have an explicit read grant for.
Callers can only write collections they own or have an explicit write grant for.
The host (no callerAppId) has full access.

## data_watch design decision

`data_watch` is implemented cleanly using existing extension event APIs:

- `publishExtensionHostEvent('documents', payload)` from the route layer and
  backend API seam.
- `contributes.subscriptions` with source `documents` to receive events.
- Module-level WatchEntry Set shared between `dataWatch` (tool handler) and
  `onDocumentEvent` (subscription handler) in the same extension worker process.

No polling, no new runtime primitives.
