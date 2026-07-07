/**
 * Persona Inbox Reader
 *
 * Active pull/ack helper for the persona to read and optionally mark as read
 * messages from the host-owned Inbox. Complements the passive unread context
 * injected by {@link buildUnreadInboxContext}.
 */

import { getStateRoot, resolveDesktopRootLayout } from '@neon-pilot/core';

import { getDocumentsStore } from '../documents/store.js';
import {
  INBOX_COLLECTION,
  INBOX_OWNER,
  type InboxMessageBody,
  type InboxMessageKind,
  type InboxSenderKind,
  notifyInboxMutation,
  VALID_INBOX_MESSAGE_KINDS,
  writeInboxActivityEntry,
} from './messages.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const BODY_PREVIEW_MAX_LENGTH = 200;

export interface PersonaReadInboxOptions {
  /** Optional kind filter. One of: note, question, result, alert. */
  kind?: string;
  /** When true, only return answered question messages. Default false. */
  answeredOnly?: boolean;
  /** Maximum number of messages to return. Default 10, max 100. */
  limit?: number;
  /** When true, mark returned messages as read after fetching. Default false. */
  markRead?: boolean;
}

export interface PersonaInboxMessageEntry {
  id: string;
  subject: string;
  kind: InboxMessageKind;
  from: string;
  fromKind: InboxSenderKind;
  /** Body content (full text). */
  body: string;
  /** Truncated body preview (first ~200 characters). */
  bodyPreview: string;
  /** User answer text, if the message is an answered question. */
  answer?: string;
  /** ISO-8601 timestamp of when the message was created. */
  createdAt: string;
  /** ISO-8601 timestamp of when the message was last updated. */
  updatedAt: string;
}

export interface PersonaReadInboxResult {
  messages: PersonaInboxMessageEntry[];
  total: number;
  /** Number of messages that were marked as read in this call (only when markRead is true). */
  markedRead?: number;
}

export class PersonaInboxReadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonaInboxReadValidationError';
  }
}

function validateKind(kind: string): InboxMessageKind {
  if ((VALID_INBOX_MESSAGE_KINDS as readonly string[]).includes(kind)) {
    return kind as InboxMessageKind;
  }

  throw new PersonaInboxReadValidationError(`Kind must be one of: ${VALID_INBOX_MESSAGE_KINDS.join(', ')}.`);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(limit)) {
    throw new PersonaInboxReadValidationError('Limit must be a finite number.');
  }
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);
}

function makeBodyPreview(body: string): string {
  return body.length > BODY_PREVIEW_MAX_LENGTH ? `${body.slice(0, BODY_PREVIEW_MAX_LENGTH)}...` : body;
}

function toEntry(body: InboxMessageBody, id: string, createdAt: string, updatedAt: string): PersonaInboxMessageEntry {
  return {
    id,
    subject: body.subject,
    kind: body.kind,
    from: body.from,
    fromKind: body.fromKind,
    body: body.body,
    bodyPreview: makeBodyPreview(body.body),
    ...(body.kind === 'question' && body.answer ? { answer: body.answer.text } : {}),
    createdAt,
    updatedAt,
  };
}

/**
 * Read inbox messages visible to the persona.
 *
 * By default returns unread, non-archived messages, newest first.
 * Supports optional kind filtering, answered-only mode, and marking
 * returned messages as read.
 *
 * When `markRead` is true, each returned message is updated with
 * `read: true` via `store.putDocument` and an Inbox mutation
 * notification + activity entry is emitted.
 */
export function readPersonaInbox(options: PersonaReadInboxOptions = {}): PersonaReadInboxResult {
  const kind = options.kind ? validateKind(options.kind) : undefined;
  const limit = normalizeLimit(options.limit);
  const answeredOnly = options.answeredOnly === true;
  const markRead = options.markRead === true;

  const stateRoot = getStateRoot();
  const layout = resolveDesktopRootLayout();
  const store = getDocumentsStore(stateRoot, layout);

  // Fetch all to filter/sort in memory (same pattern as buildUnreadInboxContext and route handler).
  const initial = store.listDocuments(INBOX_OWNER, INBOX_COLLECTION, { limit: 1, offset: 0 });
  if (initial.total === 0) {
    return { messages: [], total: 0 };
  }

  const all = store.listDocuments(INBOX_OWNER, INBOX_COLLECTION, { limit: initial.total, offset: 0 }).records;

  // Filter: default unread + non-archived, plus optional kind/answeredOnly.
  const filtered = all.filter((doc) => {
    const body = doc.body as InboxMessageBody | null;
    if (!body) return false;
    if (body.read === true) return false;
    if (body.archived === true) return false;
    if (kind !== undefined && body.kind !== kind) return false;
    if (answeredOnly && (!body.answer || body.kind !== 'question')) return false;
    return true;
  });

  // Sort newest-first by updatedAt.
  filtered.sort((a, b) => {
    const aUpdated = Date.parse(a.updatedAt);
    const bUpdated = Date.parse(b.updatedAt);
    if (Number.isFinite(aUpdated) && Number.isFinite(bUpdated) && aUpdated !== bUpdated) {
      return bUpdated - aUpdated;
    }
    return b.id > a.id ? 1 : b.id < a.id ? -1 : 0;
  });

  const selected = filtered.slice(0, limit);
  const messages = selected.map((doc) => toEntry(doc.body as InboxMessageBody, doc.id, doc.createdAt, doc.updatedAt));

  // Mark as read if requested (after preparing the response).
  let markedRead = 0;
  if (markRead && messages.length > 0) {
    for (const msg of messages) {
      const existingBody = all.find((d) => d.id === msg.id);
      if (!existingBody) continue;
      const currentBody = existingBody.body as InboxMessageBody;
      if (currentBody.read !== true) {
        const updatedBody: InboxMessageBody = { ...currentBody, read: true };
        store.putDocument(INBOX_OWNER, INBOX_COLLECTION, msg.id, updatedBody);
        notifyInboxMutation('inbox.updated', msg.id, updatedBody, { changes: { read: true } });
        writeInboxActivityEntry(store, 'read', msg.id, `Inbox message read: ${currentBody.subject}`, 'activity', {
          messageKind: currentBody.kind,
          ...(currentBody.refId ? { refId: currentBody.refId } : {}),
          fromKind: currentBody.fromKind,
        });
        markedRead++;
      }
    }
  }

  return { messages, total: filtered.length, ...(markRead ? { markedRead } : {}) };
}
