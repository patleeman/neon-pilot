# Global Activity feed

The global Activity page (`/activity`) and its `/api/activity` endpoint are the app-wide
view of work happening across all conversations: chat threads plus background workers
(backed by durable runs). It is intentionally a worker/app task manager rather than a
generic chat/run table.

This is separate from the left-sidebar **activity tree** (see
[`activity-tree.md`](./activity-tree.md)), which is the per-conversation tree model.
The global feed is a flat, app-wide list.

## `/api/activity` contract

`GET /api/activity` returns `{ items: GlobalActivityItem[]; total: number }` and accepts
the existing backward-compatible query parameters:

- `limit` — positive integer, clamped to 200, default 50
- `kind` — `conversation` | `execution` | `all` (malformed values are ignored)
- `active` — `true` restricts to queued/running rows; `false` restricts to the rest

Rows keep the existing fields (`id`, `kind`, `title`, `subtitle`, `status`,
`conversationId`, `conversationTitle`, `createdAt`, `updatedAt`) and are enriched with
optional worker/app-centric fields on execution rows:

- `active` — boolean, true while the row is queued or running. Drives active/done
  grouping; the route also sorts active rows first, then by `updatedAt` descending.
- `source` — user-facing worker/app label, e.g. `Background command`, `Subagent`,
  `Scheduled task`, `Deferred resume`, `Conversation run`, `Worker` (unknown), or
  `Conversation` for chat rows.
- `executionKind` — the typed execution kind for executions; undefined for conversations.
- `visibility` — execution visibility channel (`primary` | `system` | `hidden`).
- `command` — the underlying shell command for background-command executions, when known.
- `cwd` — the working directory the row is executing in, when known.

Conversation rows are preserved and additionally carry `active` and `source: 'Conversation'`
so the UI can group and label them alongside workers.

## UI

`packages/desktop/ui/src/pages/ActivityPage.tsx` renders the feed with four filters:
**All**, **Active** (active workers/conversations only), **Conversations**, and
**Workers** (executions). The kind column is labeled **Source** and shows the worker/app
label from `source` (falling back to a kind label for older cached responses).
Conversation context (`in {conversationTitle}`) is shown for execution rows so background
work stays linked to the thread that owns it.

Avoid deriving worker labels or active state in the UI from raw durable runs; rely on the
`/api/activity` projection so background-work freshness is owned by the backend.
