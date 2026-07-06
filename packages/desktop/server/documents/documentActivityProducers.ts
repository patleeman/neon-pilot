/**
 * Document Activity Producers
 *
 * Durable Activity entries for Document create/delete lifecycle events.
 * Produces deterministic-id entries for clearly user-visible events:
 * created, deleted.
 *
 * - document_created is produced only on true creation (first time a document
 *   is put with a given owner/collection/id triple), not on subsequent updates.
 * - document_deleted is produced after a successful deleteDocument call.
 *
 * See to-do/windowed-os.md §D4 for the product intent.
 */

import { type ActivityEntryBody, notifyActivityMutation, writeActivityEntry } from '../activity/activityEntries.js';
import type { DocumentsStore } from '../documents/store.js';
import { logError } from '../middleware/index.js';

export type DocumentLifecycleEvent = 'created' | 'deleted';

const DOCUMENT_LIFECYCLE_EVENTS: DocumentLifecycleEvent[] = ['created', 'deleted'];

/**
 * Write an activity entry for a document lifecycle event.
 *
 * Uses a deterministic id (`document_lifecycle_<owner>_<collection>_<documentId>_<event>`)
 * so that repeated writes for the same event are idempotent. Callers are
 * responsible for providing the {@link DocumentsStore} (typically obtained
 * from route or API context).
 *
 * @param store       The documents store instance.
 * @param owner       The document's owner.
 * @param collection  The document's collection.
 * @param documentId  The document's id within the owner/collection.
 * @param event       The lifecycle event (created or deleted).
 * @param title       Human-readable title for the activity entry.
 * @param metadata    Additional metadata to include (e.g. source route/API).
 */
export function writeDocumentActivityEntry(
  store: DocumentsStore,
  owner: string,
  collection: string,
  documentId: string,
  event: DocumentLifecycleEvent,
  title: string,
  metadata?: Record<string, unknown>,
): void {
  const id = `document_lifecycle_${owner}_${collection}_${documentId}_${event}`;
  const type = `document_${event}`;

  const body: ActivityEntryBody = {
    type,
    title: `Document ${event}: ${title}`,
    source: 'Document Service',
    kind: 'activity',
    metadata: {
      owner,
      collection,
      documentId,
      event,
      ...metadata,
    },
  };

  const doc = writeActivityEntry(store, body, id);
  notifyActivityMutation('activity.created', doc.id, doc.body as ActivityEntryBody, {
    documentId,
    event,
    docOwner: owner,
    docCollection: collection,
  });
}

/**
 * Best-effort variant that catches and logs any failure.
 * Use this when the activity write should not block the primary mutation.
 */
export function writeDocumentActivityEntrySafe(
  store: DocumentsStore,
  owner: string,
  collection: string,
  documentId: string,
  event: DocumentLifecycleEvent,
  title: string,
  metadata?: Record<string, unknown>,
): void {
  try {
    writeDocumentActivityEntry(store, owner, collection, documentId, event, title, metadata);
  } catch (error) {
    logError('Failed to write document activity entry', {
      documentId,
      owner,
      collection,
      event,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Validate that an event string is a known lifecycle event.
 * Returns the validated event or undefined.
 */
export function parseDocumentLifecycleEvent(value: string): DocumentLifecycleEvent | undefined {
  const normalized = value.trim().toLowerCase() as DocumentLifecycleEvent;
  return DOCUMENT_LIFECYCLE_EVENTS.includes(normalized) ? normalized : undefined;
}
