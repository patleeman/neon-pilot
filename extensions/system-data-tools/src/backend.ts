/**
 * system-data-tools backend
 *
 * Agent-facing tools over the host-owned documents store.
 *
 * Tools:
 *   data_list   – discover collections (required so agents reuse schemas)
 *   data_read   – read documents from a collection
 *   data_write  – create or update a document
 *   data_watch  – block until a document change is detected (via extension subscriptions)
 *
 * Subscription handler:
 *   onDocumentEvent – receives host:documents events and resolves pending
 *                     data_watch calls so they return the change data.
 */

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// ── Types ─────────────────────────────────────────────────────────────

interface DocumentEventPayload {
  type: 'document.updated' | 'document.deleted' | 'collection.updated' | 'grant.updated' | 'grant.deleted';
  owner: string;
  collection: string;
  id?: string;
  body?: unknown;
  granteeAppId?: string;
}

interface SubscriptionEvent {
  subscriptionId: string;
  event: string;
  payload: DocumentEventPayload;
  sourceExtensionId: string;
}

// ── Watch coordination (module-level, shared across tool + subscription handler) ──

interface WatchEntry {
  owner: string;
  collection?: string;
  resolve: (value: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingWatches = new Set<WatchEntry>();

function cancelWatch(entry: WatchEntry): void {
  clearTimeout(entry.timer);
  pendingWatches.delete(entry);
}

// ── Tool handlers ─────────────────────────────────────────────────────

/**
 * data_list — List document collections visible to trusted agent data tooling.
 */
export async function dataList(input: { owner?: string }, ctx: ExtensionBackendContext): Promise<{ collections: unknown[] }> {
  const collections = await ctx.documents.listCollections({
    ...(input.owner ? { owner: input.owner } : {}),
  });
  return { collections };
}

/**
 * data_read — Read documents from a collection.
 * If `id` is provided, return a single document; otherwise return a paginated list.
 */
export async function dataRead(
  input: { owner: string; collection: string; id?: string; limit?: number; offset?: number },
  ctx: ExtensionBackendContext,
): Promise<unknown> {
  if (input.id) {
    const document = await ctx.documents.getDocument({ owner: input.owner, collection: input.collection, id: input.id });
    if (!document) {
      return { error: `Document "${input.owner}/${input.collection}/${input.id}" not found` };
    }
    return { document };
  }

  const limit = typeof input.limit === 'number' && input.limit > 0 ? Math.min(input.limit, 1000) : 100;
  const offset = typeof input.offset === 'number' && input.offset >= 0 ? input.offset : 0;

  const result = await ctx.documents.listDocuments({ owner: input.owner, collection: input.collection, limit, offset });
  return result;
}

/**
 * data_write — Create or update a document.
 */
export async function dataWrite(
  input: { owner: string; collection: string; id: string; body: unknown },
  ctx: ExtensionBackendContext,
): Promise<{ document: unknown }> {
  const document = await ctx.documents.putDocument({ owner: input.owner, collection: input.collection, id: input.id, body: input.body });
  return { document };
}

/**
 * data_watch — Block until a document change matches the watch criteria,
 * or until the timeout expires.
 *
 * Implementation: registers a module-level watch entry that the
 * onDocumentEvent subscription handler (wired via contributes.subscriptions)
 * resolves when a matching host:documents event arrives.
 */
export async function dataWatch(
  input: { owner: string; collection?: string; timeout?: number },
  _ctx: ExtensionBackendContext,
): Promise<{ event: DocumentEventPayload | null; reason?: string }> {
  const timeoutMs = Math.min(typeof input.timeout === 'number' && input.timeout > 0 ? input.timeout * 1000 : 60_000, 300_000);

  return new Promise((resolve) => {
    const entry: WatchEntry = {
      owner: input.owner,
      collection: input.collection,
      resolve: (value: unknown) => {
        resolve(value as { event: DocumentEventPayload | null; reason?: string });
      },
      timer: setTimeout(() => {
        pendingWatches.delete(entry);
        resolve({ event: null, reason: 'timeout' });
      }, timeoutMs),
    };

    pendingWatches.add(entry);
  });
}

// ── Subscription handler ──────────────────────────────────────────────

/**
 * onDocumentEvent — Called by the extension host when a host:documents event
 * is published (from document mutations via the route layer or backend API).
 *
 * If the event matches a pending data_watch call, the watch is resolved and
 * the event payload is returned to the agent.
 */
export function onDocumentEvent(input: SubscriptionEvent): void {
  const payload = input.payload;
  if (!payload || typeof payload !== 'object') return;

  const type = payload.type;
  // Only document-level mutations trigger watch resolution
  if (type !== 'document.updated' && type !== 'document.deleted') return;

  for (const entry of pendingWatches) {
    // Match: same owner, and either no collection filter or matching collection
    if (entry.owner !== payload.owner) continue;
    if (entry.collection && entry.collection !== payload.collection) continue;

    cancelWatch(entry);
    entry.resolve({ event: payload });
    return; // resolve only the first matching watch
  }
}
