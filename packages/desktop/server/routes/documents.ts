/**
 * Documents HTTP Routes
 *
 * CRUD-ish routes for the host-owned documents store:
 * - Collection discovery
 * - List, get, put/upsert, delete documents
 * - Grant management
 *
 * See to-do/windowed-os.md §D4 for the product intent.
 */

import type { Express, Request, Response } from 'express';

import { writeDocumentActivityEntrySafe } from '../documents/documentActivityProducers.js';
import { DocumentsStore, getDocumentsStore, resetDocumentsStoreSingleton, type UpsertCollectionOptions } from '../documents/store.js';
import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { invalidateAppTopics, logError } from '../middleware/index.js';
import type { ServerRouteContext } from './context.js';

// ── Caller / authorization ────────────────────────────────────────────

export type DocumentsRouteCaller = { kind: 'host' } | { appId: string; kind: 'app' };

interface DocumentsRouteContext {
  getDocumentsRouteCaller?: (req: Request) => DocumentsRouteCaller;
  getStateRoot: ServerRouteContext['getStateRoot'];
  getDesktopRootLayout?: ServerRouteContext['getDesktopRootLayout'];
}

function getCaller(context: DocumentsRouteContext | undefined, req: Request): DocumentsRouteCaller {
  return context?.getDocumentsRouteCaller?.(req) ?? { kind: 'host' };
}

function canManageCollection(caller: DocumentsRouteCaller, owner: string): boolean {
  return caller.kind === 'host' || caller.appId === owner;
}

function canReadCollection(store: DocumentsStore, caller: DocumentsRouteCaller, owner: string, collection: string): boolean {
  if (caller.kind === 'host' || caller.appId === owner) return true;
  const summary = store.getCollection(owner, collection);
  if (!summary) return false;
  if (summary.defaultGrantRead === 'all') return true;
  const grant = store.getGrant(owner, collection, caller.appId);
  return grant?.canRead === true;
}

function canWriteCollection(store: DocumentsStore, caller: DocumentsRouteCaller, owner: string, collection: string): boolean {
  if (caller.kind === 'host' || caller.appId === owner) return true;
  const summary = store.getCollection(owner, collection);
  if (!summary) return false;
  if (summary.defaultGrantWrite === 'all') return true;
  const grant = store.getGrant(owner, collection, caller.appId);
  return grant?.canWrite === true;
}

function forbid(res: Response): void {
  res.status(403).json({ error: 'Document collection access denied' });
}

// ── Type helpers ───────────────────────────────────────────────────────

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
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

// ── Store lifecycle ────────────────────────────────────────────────────

export function resetDocumentsStoreForTests(): void {
  resetDocumentsStoreSingleton();
}

function getStore(context?: DocumentsRouteContext): DocumentsStore {
  const stateRoot = context?.getStateRoot?.();
  if (!stateRoot) {
    throw new Error('getStateRoot not available on route context');
  }
  return getDocumentsStore(stateRoot, context?.getDesktopRootLayout?.());
}

// ── Handlers ───────────────────────────────────────────────────────────

function sendError(res: Response, error: unknown, statusCode = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  logError('documents route error', { message, stack: error instanceof Error ? error.stack : undefined });

  // Treat validation errors as 400
  const status = /invalid|required|must be/i.test(message) ? 400 : statusCode;
  res.status(status).json({ error: message });
}

function publishDocumentsEvent(payload: unknown): void {
  let extensionHostClient: ReturnType<typeof getExtensionHostClient>;
  try {
    extensionHostClient = getExtensionHostClient();
  } catch (error) {
    logError('documents event publish skipped', { message: error instanceof Error ? error.message : String(error) });
    return;
  }
  void extensionHostClient.publishEvent('documents', payload).catch((error) => {
    logError('documents event publish failed', { message: error instanceof Error ? error.message : String(error) });
  });
}

// GET /api/documents/collections
function handleListCollections(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.query.owner as string | undefined);
    const collections = store
      .listCollections(owner)
      .filter((collection) => canReadCollection(store, caller, collection.owner, collection.collection));
    res.json({ collections });
  } catch (error) {
    sendError(res, error);
  }
}

// PUT /api/documents/collections/:owner/:collection
function handleUpsertCollection(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!canManageCollection(caller, owner)) {
      forbid(res);
      return;
    }

    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

    const options: UpsertCollectionOptions = {};
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      options.description = readOptionalString(body.description);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'defaultGrantRead')) {
      options.defaultGrantRead = readString(body.defaultGrantRead) as 'owner' | 'all' | 'none' | undefined;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'defaultGrantWrite')) {
      options.defaultGrantWrite = readString(body.defaultGrantWrite) as 'owner' | 'all' | 'none' | undefined;
    }

    const result = store.upsertCollection(owner, collection, options);

    invalidateAppTopics('documents');
    publishDocumentsEvent({
      type: 'collection.updated',
      owner,
      collection,
    });
    res.json({ collection: result });
  } catch (error) {
    sendError(res, error);
  }
}

// GET /api/documents/collections/:owner/:collection
function handleListDocuments(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!canReadCollection(store, caller, owner, collection)) {
      forbid(res);
      return;
    }

    const limit = readPositiveInt(req.query.limit as string | undefined) ?? 100;
    const offset = readPositiveInt(req.query.offset as string | undefined) ?? 0;

    const result = store.listDocuments(owner, collection, { limit, offset });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
}

// GET /api/documents/collections/:owner/:collection/:id
function handleGetDocument(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    const id = readString(req.params.id);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: 'Document ID is required' });
      return;
    }
    if (!canReadCollection(store, caller, owner, collection)) {
      forbid(res);
      return;
    }

    const doc = store.getDocument(owner, collection, id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ document: doc });
  } catch (error) {
    sendError(res, error);
  }
}

// PUT /api/documents/collections/:owner/:collection/:id
function handlePutDocument(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    const id = readString(req.params.id);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: 'Document ID is required' });
      return;
    }
    if (!canWriteCollection(store, caller, owner, collection)) {
      forbid(res);
      return;
    }

    if (req.body === undefined) {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    const existing = store.getDocument(owner, collection, id);
    const isCreate = !existing;

    const doc = store.putDocument(owner, collection, id, req.body);

    if (isCreate) {
      writeDocumentActivityEntrySafe(store, owner, collection, id, 'created', `${owner}/${collection}/${id}`, { source: 'http' });
    }

    invalidateAppTopics('documents');
    publishDocumentsEvent({
      type: 'document.updated',
      owner,
      collection,
      id,
      body: req.body,
    });
    res.json({ document: doc });
  } catch (error) {
    sendError(res, error);
  }
}

// DELETE /api/documents/collections/:owner/:collection/:id
function handleDeleteDocument(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    const id = readString(req.params.id);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!id) {
      res.status(400).json({ error: 'Document ID is required' });
      return;
    }
    if (!canWriteCollection(store, caller, owner, collection)) {
      forbid(res);
      return;
    }

    const deleted = store.deleteDocument(owner, collection, id);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    writeDocumentActivityEntrySafe(store, owner, collection, id, 'deleted', `${owner}/${collection}/${id}`, { source: 'http' });

    invalidateAppTopics('documents');
    publishDocumentsEvent({
      type: 'document.deleted',
      owner,
      collection,
      id,
    });
    res.json({ deleted: true });
  } catch (error) {
    sendError(res, error);
  }
}

// GET /api/documents/collections/:owner/:collection/grants
function handleListGrants(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!canManageCollection(caller, owner)) {
      forbid(res);
      return;
    }

    const grants = store.listGrants(owner, collection);
    res.json({ grants });
  } catch (error) {
    sendError(res, error);
  }
}

// PUT /api/documents/collections/:owner/:collection/grants/:granteeAppId
function handleSetGrant(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    const granteeAppId = readString(req.params.granteeAppId);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!granteeAppId) {
      res.status(400).json({ error: 'Grantee app ID is required' });
      return;
    }
    if (!canManageCollection(caller, owner)) {
      forbid(res);
      return;
    }

    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const canRead = readBoolean(body.canRead) ?? false;
    const canWrite = readBoolean(body.canWrite) ?? false;

    const grant = store.setGrant(owner, collection, granteeAppId, canRead, canWrite);
    invalidateAppTopics('documents');
    publishDocumentsEvent({
      type: 'grant.updated',
      owner,
      collection,
      granteeAppId,
    });
    res.json({ grant });
  } catch (error) {
    sendError(res, error);
  }
}

// DELETE /api/documents/collections/:owner/:collection/grants/:granteeAppId
function handleDeleteGrant(store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response): void {
  try {
    const owner = readString(req.params.owner);
    const collection = readString(req.params.collection);
    const granteeAppId = readString(req.params.granteeAppId);
    if (!owner) {
      res.status(400).json({ error: 'Owner is required' });
      return;
    }
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    if (!granteeAppId) {
      res.status(400).json({ error: 'Grantee app ID is required' });
      return;
    }
    if (!canManageCollection(caller, owner)) {
      forbid(res);
      return;
    }

    const deleted = store.deleteGrant(owner, collection, granteeAppId);
    if (!deleted) {
      res.status(404).json({ error: 'Grant not found' });
      return;
    }
    invalidateAppTopics('documents');
    publishDocumentsEvent({
      type: 'grant.deleted',
      owner,
      collection,
      granteeAppId,
    });
    res.json({ deleted: true });
  } catch (error) {
    sendError(res, error);
  }
}

// ── Registration ───────────────────────────────────────────────────────

export function registerDocumentsRoutes(app: Pick<Express, 'get' | 'put' | 'delete' | 'patch'>, context?: DocumentsRouteContext): void {
  function withStore(
    handler: (store: DocumentsStore, caller: DocumentsRouteCaller, req: Request, res: Response) => void,
  ): (req: Request, res: Response) => void {
    return (req, res) => {
      try {
        const store = getStore(context);
        handler(store, getCaller(context, req), req, res);
      } catch (error) {
        sendError(res, error);
      }
    };
  }

  // Collections
  app.get('/api/documents/collections', withStore(handleListCollections));
  app.put('/api/documents/collections/:owner/:collection', withStore(handleUpsertCollection));

  // Grants must be registered before document-id routes so "grants" is not treated as an id.
  app.get('/api/documents/collections/:owner/:collection/grants', withStore(handleListGrants));
  app.put('/api/documents/collections/:owner/:collection/grants/:granteeAppId', withStore(handleSetGrant));
  app.delete('/api/documents/collections/:owner/:collection/grants/:granteeAppId', withStore(handleDeleteGrant));

  // Documents CRUD
  app.get('/api/documents/collections/:owner/:collection', withStore(handleListDocuments));
  app.get('/api/documents/collections/:owner/:collection/:id', withStore(handleGetDocument));
  app.put('/api/documents/collections/:owner/:collection/:id', withStore(handlePutDocument));
  app.delete('/api/documents/collections/:owner/:collection/:id', withStore(handleDeleteDocument));
}
