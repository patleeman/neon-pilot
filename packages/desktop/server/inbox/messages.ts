import { type ActivityEntryBody, type ActivityEntryKind, notifyActivityMutation, writeActivityEntry } from '../activity/activityEntries.js';
import type { DocumentRecord, DocumentsStore } from '../documents/store.js';
import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { invalidateAppTopics, logError } from '../middleware/index.js';

export const INBOX_OWNER = 'system-inbox';
export const INBOX_COLLECTION = 'messages';

export const VALID_INBOX_SENDER_KINDS = ['persona', 'worker', 'user', 'system', 'automation'] as const;
export const VALID_INBOX_MESSAGE_KINDS = ['note', 'question', 'result', 'alert'] as const;

export type InboxSenderKind = (typeof VALID_INBOX_SENDER_KINDS)[number];
export type InboxMessageKind = (typeof VALID_INBOX_MESSAGE_KINDS)[number];
export type InboxActivityEventType = 'created' | 'answered' | 'read' | 'unread' | 'archived' | 'restored' | 'deleted';

export interface InboxMessageAnswer {
  /** The user's answer text. */
  text: string;
  /** ISO-8601 timestamp of when the user answered. */
  answeredAt: string;
}

export interface InboxMessageBody {
  from: string;
  fromKind: InboxSenderKind;
  to?: string;
  subject: string;
  body: string;
  kind: InboxMessageKind;
  refId?: string;
  read?: boolean;
  archived?: boolean;
  /** User answer for question-kind messages. Mutations set this; worker/persona
   * code must never overwrite an existing answer. */
  answer?: InboxMessageAnswer;
}

export interface InboxCreateMessageInput {
  id?: string;
  from: string;
  fromKind: InboxSenderKind;
  to?: string;
  subject: string;
  body: string;
  kind: InboxMessageKind;
  refId?: string;
  read?: boolean;
  archived?: boolean;
}

export function generateInboxMessageId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `msg_${time}_${rand}`;
}

export function writeInboxMessage(store: DocumentsStore, input: InboxCreateMessageInput): DocumentRecord {
  const id = input.id?.trim() || generateInboxMessageId();
  const body: InboxMessageBody = {
    from: input.from,
    fromKind: input.fromKind,
    subject: input.subject,
    body: input.body,
    kind: input.kind,
    read: input.read ?? false,
    archived: input.archived ?? false,
    ...(input.to ? { to: input.to } : {}),
    ...(input.refId ? { refId: input.refId } : {}),
  };

  return store.putDocument(INBOX_OWNER, INBOX_COLLECTION, id, body);
}

function publishExtensionEvent(topic: 'documents' | 'inbox', payload: unknown): void {
  let extensionHostClient: ReturnType<typeof getExtensionHostClient>;
  try {
    extensionHostClient = getExtensionHostClient();
  } catch (error) {
    logError(`${topic} event publish skipped`, { message: error instanceof Error ? error.message : String(error) });
    return;
  }
  void Promise.resolve(extensionHostClient.publishEvent(topic, payload)).catch((error) => {
    logError(`${topic} event publish failed`, { message: error instanceof Error ? error.message : String(error) });
  });
}

/**
 * Write a durable Activity entry for an inbox lifecycle event.
 *
 * Uses a deterministic id (`inbox_<eventType>_<messageId>`) so
 * repeated writes for the same lifecycle event are idempotent.
 */
export function writeInboxActivityEntry(
  store: DocumentsStore,
  eventType: InboxActivityEventType,
  messageId: string,
  title: string,
  kind: ActivityEntryKind,
  metadata?: Record<string, unknown>,
): void {
  const entryId = `inbox_${eventType}_${messageId}`;
  const body: ActivityEntryBody = {
    type: `inbox_${eventType}`,
    title,
    source: 'Inbox',
    kind,
    metadata: {
      inboxMessageId: messageId,
      ...metadata,
    },
  };
  const doc = writeActivityEntry(store, body, entryId);
  notifyActivityMutation('activity.created', doc.id, doc.body as ActivityEntryBody, { inboxMessageId: messageId, eventType });
}

export function notifyInboxMutation(type: string, id: string, body: InboxMessageBody | undefined, extra?: Record<string, unknown>): void {
  invalidateAppTopics('inbox', 'documents');
  publishExtensionEvent('inbox', { type, owner: INBOX_OWNER, collection: INBOX_COLLECTION, id, ...extra });
  publishExtensionEvent('documents', {
    type: type === 'inbox.deleted' ? 'document.deleted' : 'document.updated',
    owner: INBOX_OWNER,
    collection: INBOX_COLLECTION,
    id,
    ...(body === undefined ? {} : { body }),
  });
}
