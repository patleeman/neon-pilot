/**
 * system-documents-reader-sample backend
 *
 * Phase 3 proof-of-concept: reads the shared heartbeat document written by
 * system-documents-counter-sample and records document update events received
 * via the extension subscription system.
 *
 * The shared collection (system-documents-counter-sample/shared-heartbeat) is
 * created with defaultGrantRead: 'all', so this extension can read it with
 * only the documents:read permission.
 *
 * Subscription handler:
 *   onDocumentChanged - Receives host:documents events when documents are
 *   mutated. Records all document.updated and document.deleted events for the
 *   shared heartbeat collection in a module-level array that can be inspected
 *   via the getEvents action.
 */

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// Constants

const SHARED_OWNER = 'system-documents-counter-sample';
const SHARED_COLLECTION = 'shared-heartbeat';
const BEAT_ID = 'beat';

// Types

interface DocumentEventPayload {
  type: 'document.updated' | 'document.deleted';
  owner: string;
  collection: string;
  id?: string;
  body?: unknown;
}

interface SubscriptionEvent {
  subscriptionId: string;
  event: string;
  payload: DocumentEventPayload;
  sourceExtensionId: string;
}

interface DocumentRecord {
  owner: string;
  collection: string;
  id: string;
  body: unknown;
  createdAt: string;
  updatedAt: string;
}

// Module-level event log shared between subscription handler and getEvents action.

const receivedEvents: DocumentEventPayload[] = [];

/**
 * Test-only helper to clear the received events log between test cases.
 * Not exposed as an action; used directly in backend.test.ts.
 */
export function _resetReceivedEventsForTests(): void {
  receivedEvents.length = 0;
}

// Actions

/**
 * readBeat - Read the heartbeat document from the shared collection.
 */
export async function readBeat(_input: Record<string, never>, ctx: ExtensionBackendContext): Promise<{ document: DocumentRecord | null }> {
  const doc = await ctx.documents.getDocument({ owner: SHARED_OWNER, collection: SHARED_COLLECTION, id: BEAT_ID });
  return { document: doc as DocumentRecord | null };
}

/**
 * getEvents - Return all document update events received so far by the
 * subscription handler.
 */
export async function getEvents(_input: Record<string, never>): Promise<{ events: DocumentEventPayload[] }> {
  return { events: [...receivedEvents] };
}

// Subscription handler

/**
 * onDocumentChanged - Called by the extension host when a host:documents
 * event is published. Records document.updated and document.deleted events
 * for the shared heartbeat collection owned by the counter sample.
 */
export function onDocumentChanged(input: SubscriptionEvent): void {
  const payload = input.payload;
  if (!payload || typeof payload !== 'object') return;
  if (payload.type !== 'document.updated' && payload.type !== 'document.deleted') return;
  // Only track events for the counter sample's shared heartbeat collection.
  if (payload.owner !== SHARED_OWNER) return;
  if (payload.collection !== SHARED_COLLECTION) return;

  receivedEvents.push({ ...payload });
}
