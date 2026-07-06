/**
 * Inbox HTTP Routes
 *
 * Host-owned Inbox surface over the documents store. Messages live in the
 * `system-inbox` owner, `messages` collection, with the body shape defined by
 * `InboxMessageBody`. The Inbox is the first serious consumer of the documents
 * store: worker results, persona messages, and questions needing user input
 * arrive here for triage.
 *
 * Mutations publish/invalidation flow through the documents store backing the
 * route; both `inbox` and `documents` topics are invalidated so the Documents
 * app and the Inbox app stay in sync.
 *
 * See to-do/windowed-os.md §D4 and Phase 4 for product intent.
 */

import type { Express, Request, Response } from 'express';

import { type DocumentRecord, type DocumentsStore, getDocumentsStore } from '../documents/store.js';
import {
  generateInboxMessageId,
  INBOX_COLLECTION,
  INBOX_OWNER,
  type InboxMessageBody,
  notifyInboxMutation,
  VALID_INBOX_MESSAGE_KINDS,
  VALID_INBOX_SENDER_KINDS,
  writeInboxMessage,
} from '../inbox/messages.js';
import { logError } from '../middleware/index.js';
import type { ServerRouteContext } from './context.js';

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

type SenderKind = (typeof VALID_INBOX_SENDER_KINDS)[number];
type MessageKind = (typeof VALID_INBOX_MESSAGE_KINDS)[number];

// ── Store lifecycle ────────────────────────────────────────────────────

// The inbox route piggy-backs on the documents store singleton; tests call
// `resetDocumentsStoreSingleton` (re-exported from documents.ts) to reset it.

interface InboxRouteContext {
  getStateRoot: ServerRouteContext['getStateRoot'];
  getDesktopRootLayout?: ServerRouteContext['getDesktopRootLayout'];
}

function getStore(context?: InboxRouteContext): DocumentsStore {
  const stateRoot = context?.getStateRoot?.();
  if (!stateRoot) {
    throw new Error('getStateRoot not available on route context');
  }
  const desktopRootLayout = context?.getDesktopRootLayout?.();
  return getDocumentsStore(stateRoot, desktopRootLayout);
}

// ── Type helpers ───────────────────────────────────────────────────────

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readPositiveInt(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    if (Number.isSafeInteger(n) && n >= 0) return n;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

function readSenderKind(value: unknown): SenderKind | undefined {
  if (typeof value === 'string' && (VALID_INBOX_SENDER_KINDS as readonly string[]).includes(value)) {
    return value as SenderKind;
  }
  return undefined;
}

function readMessageKind(value: unknown): MessageKind | undefined {
  if (typeof value === 'string' && (VALID_INBOX_MESSAGE_KINDS as readonly string[]).includes(value)) {
    return value as MessageKind;
  }
  return undefined;
}

function isHostManagedDoc(doc: DocumentRecord): boolean {
  return doc.owner === INBOX_OWNER && doc.collection === INBOX_COLLECTION;
}

function messageBodyOf(doc: DocumentRecord): InboxMessageBody {
  return doc.body as InboxMessageBody;
}

// ── Errors / events ────────────────────────────────────────────────────

function sendError(res: Response, error: unknown, statusCode = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  logError('inbox route error', { message, stack: error instanceof Error ? error.stack : undefined });
  const status = /invalid|required|must be/i.test(message) ? 400 : statusCode;
  res.status(status).json({ error: message });
}

function afterMutation(type: string, id: string, body: InboxMessageBody | undefined, extra?: Record<string, unknown>): void {
  notifyInboxMutation(type, id, body, extra);
}

// ── Handlers ───────────────────────────────────────────────────────────

// GET /api/inbox
function handleList(store: DocumentsStore, req: Request, res: Response): void {
  try {
    // Default to non-archived (inbox view). Pass archived=true for archived,
    // archived=anything-else-falsy also means non-archived. To list everything
    // callers must page through both views; the first slice keeps it explicit.
    const archivedFilter = readBoolean(req.query.archived as string | undefined) ?? false;
    const unreadOnly = readBoolean(req.query.unreadOnly as string | undefined) === true;
    const limit = Math.min(Math.max(readPositiveInt(req.query.limit as string | undefined) ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const offset = Math.max(readPositiveInt(req.query.offset as string | undefined) ?? 0, 0);

    // The documents store orders by id; for Inbox we surface newest-first by
    // updatedAt after filtering. Pull the full collection before slicing so
    // totals and newer messages are not hidden by the store's id-order page.
    const initial = store.listDocuments(INBOX_OWNER, INBOX_COLLECTION, { limit: 1, offset: 0 });
    const all = initial.total === 0 ? [] : store.listDocuments(INBOX_OWNER, INBOX_COLLECTION, { limit: initial.total, offset: 0 }).records;

    let filtered = all.filter((doc) => {
      const body = messageBodyOf(doc) ?? {};
      if (archivedFilter !== undefined && Boolean(body.archived) !== archivedFilter) return false;
      if (unreadOnly && body.read === true) return false;
      return true;
    });

    filtered = filtered.sort((a, b) => {
      const aUpdated = Date.parse(a.updatedAt);
      const bUpdated = Date.parse(b.updatedAt);
      if (Number.isFinite(aUpdated) && Number.isFinite(bUpdated) && aUpdated !== bUpdated) {
        return bUpdated - aUpdated;
      }
      // Descending id tiebreaker keeps ordering deterministic when timestamps
      // share second granularity.
      return b.id > a.id ? 1 : b.id < a.id ? -1 : 0;
    });

    const total = filtered.length;
    const records = filtered.slice(offset, offset + limit);
    res.json({ records, total });
  } catch (error) {
    sendError(res, error);
  }
}

// GET /api/inbox/:id
function handleGet(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const id = readString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Message id is required' });
      return;
    }
    const doc = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, id);
    if (!doc || !isHostManagedDoc(doc)) {
      res.status(404).json({ error: 'Inbox message not found' });
      return;
    }
    res.json({ document: doc });
  } catch (error) {
    sendError(res, error);
  }
}

// POST /api/inbox
function handleCreate(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const from = readString(body.from);
    const fromKind = readSenderKind(body.fromKind);
    const subject = readString(body.subject);
    const messageKind = readMessageKind(body.kind);
    const messageText = typeof body.body === 'string' ? body.body : undefined;

    if (!from) {
      res.status(400).json({ error: 'from is required' });
      return;
    }
    if (!fromKind) {
      res.status(400).json({ error: 'fromKind must be one of: ' + VALID_INBOX_SENDER_KINDS.join(', ') });
      return;
    }
    if (!subject) {
      res.status(400).json({ error: 'subject is required' });
      return;
    }
    if (!messageKind) {
      res.status(400).json({ error: 'kind must be one of: ' + VALID_INBOX_MESSAGE_KINDS.join(', ') });
      return;
    }
    if (messageText === undefined || messageText.length === 0) {
      res.status(400).json({ error: 'body is required' });
      return;
    }

    const to = readOptionalString(body.to);
    const refId = readOptionalString(body.refId);
    const id = readString(body.id) ?? generateInboxMessageId();

    if (store.getDocument(INBOX_OWNER, INBOX_COLLECTION, id)) {
      res.status(409).json({ error: 'Inbox message with that id already exists' });
      return;
    }

    const doc = writeInboxMessage(store, {
      id,
      from,
      fromKind,
      subject,
      body: messageText,
      kind: messageKind,
      ...(to ? { to } : {}),
      ...(refId ? { refId } : {}),
    });

    const messageBody = messageBodyOf(doc);
    afterMutation('inbox.created', id, messageBody);
    res.json({ document: doc });
  } catch (error) {
    sendError(res, error);
  }
}

// PATCH /api/inbox/:id
function handlePatch(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const id = readString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Message id is required' });
      return;
    }
    const existing = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, id);
    if (!existing || !isHostManagedDoc(existing)) {
      res.status(404).json({ error: 'Inbox message not found' });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const hasRead = Object.prototype.hasOwnProperty.call(body, 'read');
    const hasArchived = Object.prototype.hasOwnProperty.call(body, 'archived');
    const hasAnswer = Object.prototype.hasOwnProperty.call(body, 'answer');
    if (!hasRead && !hasArchived && !hasAnswer) {
      res.status(400).json({ error: 'Provide at least one of read, archived, or answer' });
      return;
    }

    const read = hasRead ? readBoolean(body.read) : undefined;
    const archived = hasArchived ? readBoolean(body.archived) : undefined;
    if (hasRead && read === undefined) {
      res.status(400).json({ error: 'read must be a boolean' });
      return;
    }
    if (hasArchived && archived === undefined) {
      res.status(400).json({ error: 'archived must be a boolean' });
      return;
    }

    const current = messageBodyOf(existing) ?? {};

    // Validate answer field: must be a non-empty string for question messages.
    let answer: InboxMessageBody['answer'] | undefined;
    if (hasAnswer) {
      if (current.kind !== 'question') {
        res.status(400).json({ error: 'answer is only supported for question messages' });
        return;
      }
      if (current.answer) {
        res.status(409).json({ error: 'question already has an answer' });
        return;
      }
      const raw = body.answer;
      if (typeof raw !== 'string' || raw.trim().length === 0) {
        res.status(400).json({ error: 'answer must be a non-empty string' });
        return;
      }
      answer = { text: raw.trim(), answeredAt: new Date().toISOString() };
    }

    const nextBody: InboxMessageBody = {
      ...current,
      ...(hasRead ? { read } : {}),
      ...(hasArchived ? { archived } : {}),
      ...(answer ? { answer, read: false, archived: false } : {}),
    };

    const doc = store.putDocument(INBOX_OWNER, INBOX_COLLECTION, id, nextBody);
    afterMutation('inbox.updated', id, nextBody, {
      changes: {
        ...(hasRead ? { read: nextBody.read } : {}),
        ...(hasArchived ? { archived: nextBody.archived } : {}),
        ...(answer ? { answered: true } : {}),
      },
    });
    res.json({ document: doc });
  } catch (error) {
    sendError(res, error);
  }
}

// DELETE /api/inbox/:id
function handleDelete(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const id = readString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Message id is required' });
      return;
    }
    const existing = store.getDocument(INBOX_OWNER, INBOX_COLLECTION, id);
    if (!existing || !isHostManagedDoc(existing)) {
      res.status(404).json({ error: 'Inbox message not found' });
      return;
    }
    store.deleteDocument(INBOX_OWNER, INBOX_COLLECTION, id);
    afterMutation('inbox.deleted', id, undefined);
    res.json({ deleted: true });
  } catch (error) {
    sendError(res, error);
  }
}

// ── Registration ───────────────────────────────────────────────────────

export function registerInboxRoutes(app: Pick<Express, 'get' | 'post' | 'patch' | 'delete'>, context?: InboxRouteContext): void {
  function withStore(handler: (store: DocumentsStore, req: Request, res: Response) => void): (req: Request, res: Response) => void {
    return (req, res) => {
      try {
        const store = getStore(context);
        handler(store, req, res);
      } catch (error) {
        sendError(res, error);
      }
    };
  }

  app.get('/api/inbox', withStore(handleList));
  app.get('/api/inbox/:id', withStore(handleGet));
  app.post('/api/inbox', withStore(handleCreate));
  app.patch('/api/inbox/:id', withStore(handlePatch));
  app.delete('/api/inbox/:id', withStore(handleDelete));
}
