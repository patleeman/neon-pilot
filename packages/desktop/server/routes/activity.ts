/**
 * Activity Entries HTTP Routes
 *
 * Host-owned activity timeline surface over the documents store. Entries live
 * in the `activity` owner, `activity-entries` collection, with the body shape
 * defined by `ActivityEntryBody`.
 *
 * Mutations publish/invalidation flow through the documents store backing the
 * route; both `activity` and `documents` topics are invalidated so subscribers
 * stay in sync.
 *
 * See to-do/windowed-os.md §D4 and Phase 4 for product intent.
 */

import type { Express, Request, Response } from 'express';

import {
  ACTIVITY_COLLECTION,
  ACTIVITY_OWNER,
  type ActivityEntryBody,
  generateActivityEntryId,
  notifyActivityMutation,
  VALID_ACTIVITY_ENTRY_KINDS,
} from '../activity/activityEntries.js';
import { type DocumentRecord, type DocumentsStore, getDocumentsStore } from '../documents/store.js';
import { logError } from '../middleware/index.js';
import type { ServerRouteContext } from './context.js';

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

type ActivityEntryKind = (typeof VALID_ACTIVITY_ENTRY_KINDS)[number];

// ── Store lifecycle ────────────────────────────────────────────────────

interface ActivityRouteContext {
  getStateRoot: ServerRouteContext['getStateRoot'];
  getDesktopRootLayout?: ServerRouteContext['getDesktopRootLayout'];
}

function getStore(context?: ActivityRouteContext): DocumentsStore {
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

function readActivityEntryKind(value: unknown): ActivityEntryKind | undefined {
  if (typeof value === 'string' && (VALID_ACTIVITY_ENTRY_KINDS as readonly string[]).includes(value)) {
    return value as ActivityEntryKind;
  }
  return undefined;
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

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error('metadata must be an object');
}

function isHostManagedDoc(doc: DocumentRecord): boolean {
  return doc.owner === ACTIVITY_OWNER && doc.collection === ACTIVITY_COLLECTION;
}

function entryBodyOf(doc: DocumentRecord): ActivityEntryBody {
  return doc.body as ActivityEntryBody;
}

// ── Errors / events ────────────────────────────────────────────────────

function sendError(res: Response, error: unknown, statusCode = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  logError('activity route error', { message, stack: error instanceof Error ? error.stack : undefined });
  const status = /invalid|required|must be/i.test(message) ? 400 : statusCode;
  res.status(status).json({ error: message });
}

function afterMutation(type: string, id: string, body: ActivityEntryBody | undefined, extra?: Record<string, unknown>): void {
  notifyActivityMutation(type, id, body, extra);
}

// ── Handlers ───────────────────────────────────────────────────────────

// GET /api/activity/entries
function handleList(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const limit = Math.min(Math.max(readPositiveInt(req.query.limit as string | undefined) ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const offset = Math.max(readPositiveInt(req.query.offset as string | undefined) ?? 0, 0);
    const typeFilter = readString(req.query.type as string | undefined);
    const processedFilter = readBoolean(req.query.processed as string | undefined);

    // Pull the full collection before slicing so totals and newer entries
    // are not hidden by the store's id-order page.
    const initial = store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION, { limit: 1, offset: 0 });
    const all =
      initial.total === 0 ? [] : store.listDocuments(ACTIVITY_OWNER, ACTIVITY_COLLECTION, { limit: initial.total, offset: 0 }).records;

    let filtered = all.filter((doc) => {
      if (!isHostManagedDoc(doc)) return false;
      const body = entryBodyOf(doc) ?? {};
      if (typeFilter !== undefined && body.type !== typeFilter) return false;
      if (processedFilter !== undefined && body.processed !== processedFilter) return false;
      return true;
    });

    // Sort newest-first by updatedAt
    filtered = filtered.sort((a, b) => {
      const aUpdated = Date.parse(a.updatedAt);
      const bUpdated = Date.parse(b.updatedAt);
      if (Number.isFinite(aUpdated) && Number.isFinite(bUpdated) && aUpdated !== bUpdated) {
        return bUpdated - aUpdated;
      }
      return b.id > a.id ? 1 : b.id < a.id ? -1 : 0;
    });

    const total = filtered.length;
    const records = filtered.slice(offset, offset + limit);
    res.json({ records, total });
  } catch (error) {
    sendError(res, error);
  }
}

// GET /api/activity/entries/:id
function handleGet(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const id = readString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Entry id is required' });
      return;
    }
    const doc = store.getDocument(ACTIVITY_OWNER, ACTIVITY_COLLECTION, id);
    if (!doc || !isHostManagedDoc(doc)) {
      res.status(404).json({ error: 'Activity entry not found' });
      return;
    }
    res.json({ document: doc });
  } catch (error) {
    sendError(res, error);
  }
}

// POST /api/activity/entries
function handleCreate(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

    const type = readString(body.type);
    const title = readString(body.title);

    if (!type) {
      res.status(400).json({ error: 'type is required' });
      return;
    }
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const subtitle = readOptionalString(body.subtitle);
    const source = readOptionalString(body.source);
    const kind = readActivityEntryKind(body.kind);
    const metadata = readOptionalRecord(body.metadata);
    const processed = readBoolean(body.processed);
    const id = readString(body.id) ?? generateActivityEntryId();

    if (body.kind !== undefined && !kind) {
      res.status(400).json({ error: 'kind must be one of: ' + VALID_ACTIVITY_ENTRY_KINDS.join(', ') });
      return;
    }

    if (store.getDocument(ACTIVITY_OWNER, ACTIVITY_COLLECTION, id)) {
      res.status(409).json({ error: 'Activity entry with that id already exists' });
      return;
    }

    const doc = store.putDocument(ACTIVITY_OWNER, ACTIVITY_COLLECTION, id, {
      type,
      title,
      ...(subtitle !== undefined ? { subtitle } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      ...(processed !== undefined ? { processed } : {}),
    } satisfies ActivityEntryBody);

    const entryBody = entryBodyOf(doc);
    afterMutation('activity.created', id, entryBody);
    res.json({ document: doc });
  } catch (error) {
    sendError(res, error);
  }
}

// DELETE /api/activity/entries/:id
function handleDelete(store: DocumentsStore, req: Request, res: Response): void {
  try {
    const id = readString(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Entry id is required' });
      return;
    }
    const existing = store.getDocument(ACTIVITY_OWNER, ACTIVITY_COLLECTION, id);
    if (!existing || !isHostManagedDoc(existing)) {
      res.status(404).json({ error: 'Activity entry not found' });
      return;
    }
    store.deleteDocument(ACTIVITY_OWNER, ACTIVITY_COLLECTION, id);
    afterMutation('activity.deleted', id, undefined);
    res.json({ deleted: true });
  } catch (error) {
    sendError(res, error);
  }
}

// ── Registration ───────────────────────────────────────────────────────

export function registerActivityEntriesRoutes(app: Pick<Express, 'get' | 'post' | 'delete'>, context?: ActivityRouteContext): void {
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

  app.get('/api/activity/entries', withStore(handleList));
  app.get('/api/activity/entries/:id', withStore(handleGet));
  app.post('/api/activity/entries', withStore(handleCreate));
  app.delete('/api/activity/entries/:id', withStore(handleDelete));
}
