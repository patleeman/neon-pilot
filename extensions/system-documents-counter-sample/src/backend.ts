/**
 * system-documents-counter-sample backend
 *
 * Phase 3 proof-of-concept: writes incrementing heartbeat documents into
 * a shared Documents collection so other extensions (e.g.,
 * system-documents-reader-sample) can observe cross-extension data flow.
 *
 * The shared collection is created with defaultGrantRead: 'all' so other
 * system extensions can read the heartbeat document without explicit grants.
 */

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// Constants

const SHARED_OWNER = 'system-documents-counter-sample';
const SHARED_COLLECTION = 'shared-heartbeat';
const BEAT_ID = 'beat';

// Types

interface HeartbeatBody {
  count: number;
  timestamp: string;
  previousTimestamp?: string;
}

interface DocumentRecord {
  owner: string;
  collection: string;
  id: string;
  body: unknown;
  createdAt: string;
  updatedAt: string;
}

// Helpers

async function ensureSharedCollection(ctx: ExtensionBackendContext): Promise<void> {
  const existing = await ctx.documents.getCollection({ owner: SHARED_OWNER, collection: SHARED_COLLECTION });
  if (!existing) {
    await ctx.documents.upsertCollection({
      owner: SHARED_OWNER,
      collection: SHARED_COLLECTION,
      options: {
        description: 'Shared heartbeat collection for cross-extension document sharing demo',
        defaultGrantRead: 'all',
        defaultGrantWrite: 'owner',
      },
    });
  }
}

async function readCurrentBeat(ctx: ExtensionBackendContext): Promise<HeartbeatBody | null> {
  const doc = await ctx.documents.getDocument({ owner: SHARED_OWNER, collection: SHARED_COLLECTION, id: BEAT_ID });
  if (!doc) return null;
  return (doc as DocumentRecord).body as HeartbeatBody;
}

// Actions

/**
 * writeBeat - Increment the heartbeat counter and write the updated document.
 * Creates the shared collection on first call if it does not exist.
 */
export async function writeBeat(_input: Record<string, never>, ctx: ExtensionBackendContext): Promise<{ document: DocumentRecord }> {
  await ensureSharedCollection(ctx);

  const current = await readCurrentBeat(ctx);
  const now = new Date().toISOString();

  const body: HeartbeatBody = {
    count: (current?.count ?? 0) + 1,
    timestamp: now,
    ...(current ? { previousTimestamp: current.timestamp } : {}),
  };

  const document = await ctx.documents.putDocument({
    owner: SHARED_OWNER,
    collection: SHARED_COLLECTION,
    id: BEAT_ID,
    body,
  });

  return { document: document as DocumentRecord };
}

/**
 * resetBeat - Reset the heartbeat counter to zero.
 */
export async function resetBeat(_input: Record<string, never>, ctx: ExtensionBackendContext): Promise<{ ok: true }> {
  await ensureSharedCollection(ctx);

  const now = new Date().toISOString();
  const body: HeartbeatBody = { count: 0, timestamp: now };

  await ctx.documents.putDocument({
    owner: SHARED_OWNER,
    collection: SHARED_COLLECTION,
    id: BEAT_ID,
    body,
  });

  return { ok: true };
}
