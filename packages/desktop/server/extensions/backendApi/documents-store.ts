/**
 * Host backend API — documents store CRUD for extension callers.
 *
 * Lazy-loads the DocumentsStore via callServerModuleExport (the standard
 * backend API seam pattern) and enforces caller-aware read/write grants
 * mirroring routes/documents.ts.
 *
 * Extension callers pass their extensionId as `callerAppId`. Host-owned
 * agent tools that need trusted cross-owner access should go through the
 * extension capability bridge (`ctx.documents`), where the host supplies the
 * actual extension identity and grants only locked system brokers host-level
 * access.
 *
 * Mutations publish the same documents invalidation/events as the HTTP
 * route layer, so route writes and extension-tool writes share one
 * visible update path.
 */

import { callServerModuleExport } from './serverModuleResolver.js';

// ── Local type definitions (mirrored from the SDK seam; avoids import type
//    that would trigger the extension build resolver).

interface DC {
  owner: string;
  collection: string;
  description: string;
  defaultGrantRead: 'owner' | 'all' | 'none';
  defaultGrantWrite: 'owner' | 'all' | 'none';
  createdAt: string;
  updatedAt: string;
}

interface DR {
  owner: string;
  collection: string;
  id: string;
  body: unknown;
  createdAt: string;
  updatedAt: string;
}

interface LDO {
  limit?: number;
  offset?: number;
}

interface LDR {
  records: DR[];
  total: number;
}

interface UCO {
  description?: string;
  defaultGrantRead?: 'owner' | 'all' | 'none';
  defaultGrantWrite?: 'owner' | 'all' | 'none';
}

interface DocumentMutationPayload {
  type: 'collection.updated' | 'document.updated' | 'document.deleted' | 'grant.updated' | 'grant.deleted';
  owner: string;
  collection: string;
  id?: string;
  granteeAppId?: string;
  body?: unknown;
}

/** Wrapper to prevent esbuild from inlining the string literal into import(). */
async function callMod<T>(spec: string, name: string, ...args: unknown[]): Promise<T> {
  // Keep spec opaque: pass through a rest param so esbuild cannot statically
  // resolve the path during extension bundling.
  return callServerModuleExport<T>(spec, name, ...args);
}

async function getStore(): Promise<{
  listCollections(owner?: string): DC[];
  getCollection(owner: string, collection: string): DC | null;
  upsertCollection(owner: string, collection: string, opts?: UCO): DC;
  listDocuments(owner: string, collection: string, opts?: LDO): LDR;
  getDocument(owner: string, collection: string, id: string): DR | null;
  putDocument(owner: string, collection: string, id: string, body: unknown): DR;
  deleteDocument(owner: string, collection: string, id: string): boolean;
  listGrants(owner: string, collection: string): CG[];
  getGrant(owner: string, collection: string, granteeAppId: string): CG | null;
  setGrant(owner: string, collection: string, granteeAppId: string, canRead: boolean, canWrite: boolean): CG;
  deleteGrant(owner: string, collection: string, granteeAppId: string): boolean;
}> {
  const stateRoot = resolveStateRoot();
  return callMod('../../documents/store.js', 'getDocumentsStore', stateRoot);
}

async function assertPermission(callerAppId: string, permission: 'documents:read' | 'documents:write', capability: string): Promise<void> {
  const readwritePermission = 'documents:readwrite';
  const permitted = await callMod<boolean>('../../extensions/extensionPermissions.js', 'extensionHasPermission', callerAppId, permission);
  if (permitted) return;
  const readwritePermitted = await callMod<boolean>(
    '../../extensions/extensionPermissions.js',
    'extensionHasPermission',
    callerAppId,
    readwritePermission,
  );
  if (readwritePermitted) return;
  await callMod<void>('../../extensions/extensionPermissions.js', 'assertExtensionPermission', callerAppId, permission, capability);
}

async function publishDocumentsMutation(payload: DocumentMutationPayload): Promise<void> {
  await callMod<void>('../../shared/appEvents.js', 'invalidateAppTopics', 'documents');
  await callMod<void>('../../extensions/extensionSubscriptions.js', 'publishExtensionHostEvent', 'documents', payload);
}

function resolveStateRoot(): string {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.__NEON_PILOT_STATE_ROOT__ === 'string' && g.__NEON_PILOT_STATE_ROOT__) {
      return g.__NEON_PILOT_STATE_ROOT__;
    }
  }
  const envRoot = process.env.NEON_PILOT_STATE_ROOT?.trim();
  if (envRoot) return envRoot;
  throw new Error('Cannot resolve state root for documents store. Set NEON_PILOT_STATE_ROOT.');
}

// ── Caller helpers (mirrors routes/documents.ts authorization) ────────

type Caller = { kind: 'host' } | { appId: string; kind: 'app' };

function requireCallerAppId(callerAppId: string | undefined, capability: string): string {
  const trimmed = callerAppId?.trim();
  if (trimmed) return trimmed;
  throw new Error(
    `${capability} requires callerAppId. Extension callers must pass ctx.extensionId; host-owned agent tools should use ctx.documents.`,
  );
}

function makeCaller(callerAppId: string): Caller {
  return callerAppId ? { kind: 'app', appId: callerAppId } : { kind: 'host' };
}

function deny(): never {
  throw new Error('Document collection access denied');
}

function assertCanManage(c: Caller, owner: string): void {
  if (c.kind !== 'host' && c.appId !== owner) deny();
}

function assertCanRead(
  s: {
    getCollection(o: string, c: string): DC | null;
    getGrant(o: string, c: string, g: string): { canRead: boolean; canWrite: boolean } | null;
  },
  c: Caller,
  owner: string,
  col: string,
): void {
  if (c.kind === 'host' || c.appId === owner) return;
  const summary = s.getCollection(owner, col);
  if (!summary) throw new Error(`Collection "${owner}/${col}" not found`);
  if (summary.defaultGrantRead === 'all') return;
  if (!c.appId) deny();
  if (s.getGrant(owner, col, c.appId)?.canRead) return;
  deny();
}

function assertCanWrite(
  s: {
    getCollection(o: string, c: string): DC | null;
    getGrant(o: string, c: string, g: string): { canRead: boolean; canWrite: boolean } | null;
  },
  c: Caller,
  owner: string,
  col: string,
): void {
  if (c.kind === 'host' || c.appId === owner) return;
  const summary = s.getCollection(owner, col);
  if (!summary) throw new Error(`Collection "${owner}/${col}" not found`);
  if (summary.defaultGrantWrite === 'all') return;
  if (!c.appId) deny();
  if (s.getGrant(owner, col, c.appId)?.canWrite) return;
  deny();
}

// ── Public API ─────────────────────────────────────────────────────────

export async function listCollections(options?: { owner?: string; callerAppId?: string }): Promise<DC[]> {
  const callerAppId = requireCallerAppId(options?.callerAppId, 'documents.listCollections');
  await assertPermission(callerAppId, 'documents:read', 'documents.listCollections');
  const store = await getStore();
  const c = makeCaller(callerAppId);
  return store.listCollections(options?.owner).filter((col) => {
    if (c.kind === 'host' || c.appId === col.owner) return true;
    if (col.defaultGrantRead === 'all') return true;
    if (!c.appId) return false;
    return store.getGrant(col.owner, col.collection, c.appId)?.canRead === true;
  });
}

export async function getCollection(owner: string, collection: string, callerAppId?: string): Promise<DC | null> {
  const appId = requireCallerAppId(callerAppId, 'documents.getCollection');
  await assertPermission(appId, 'documents:read', 'documents.getCollection');
  const store = await getStore();
  const result = store.getCollection(owner, collection);
  if (result) assertCanRead(store, makeCaller(appId), owner, collection);
  return result;
}

export async function upsertCollection(owner: string, collection: string, options?: UCO, callerAppId?: string): Promise<DC> {
  const appId = requireCallerAppId(callerAppId, 'documents.upsertCollection');
  await assertPermission(appId, 'documents:write', 'documents.upsertCollection');
  const store = await getStore();
  assertCanManage(makeCaller(appId), owner);
  const result = store.upsertCollection(owner, collection, options ?? {});
  await publishDocumentsMutation({ type: 'collection.updated', owner, collection });
  return result;
}

export async function listDocuments(owner: string, collection: string, options?: LDO, callerAppId?: string): Promise<LDR> {
  const appId = requireCallerAppId(callerAppId, 'documents.listDocuments');
  await assertPermission(appId, 'documents:read', 'documents.listDocuments');
  const store = await getStore();
  assertCanRead(store, makeCaller(appId), owner, collection);
  return store.listDocuments(owner, collection, { limit: options?.limit, offset: options?.offset });
}

export async function getDocument(owner: string, collection: string, id: string, callerAppId?: string): Promise<DR | null> {
  const appId = requireCallerAppId(callerAppId, 'documents.getDocument');
  await assertPermission(appId, 'documents:read', 'documents.getDocument');
  const store = await getStore();
  assertCanRead(store, makeCaller(appId), owner, collection);
  return store.getDocument(owner, collection, id);
}

export async function putDocument(owner: string, collection: string, id: string, body: unknown, callerAppId?: string): Promise<DR> {
  const appId = requireCallerAppId(callerAppId, 'documents.putDocument');
  await assertPermission(appId, 'documents:write', 'documents.putDocument');
  const store = await getStore();
  assertCanWrite(store, makeCaller(appId), owner, collection);
  const result = store.putDocument(owner, collection, id, body);
  await publishDocumentsMutation({ type: 'document.updated', owner, collection, id, body });
  return result;
}

export async function deleteDocument(owner: string, collection: string, id: string, callerAppId?: string): Promise<{ deleted: boolean }> {
  const appId = requireCallerAppId(callerAppId, 'documents.deleteDocument');
  await assertPermission(appId, 'documents:write', 'documents.deleteDocument');
  const store = await getStore();
  assertCanWrite(store, makeCaller(appId), owner, collection);
  const deleted = store.deleteDocument(owner, collection, id);
  if (deleted) {
    await publishDocumentsMutation({ type: 'document.deleted', owner, collection, id });
  }
  return { deleted };
}

// ── Grants ────────────────────────────────────────────────────────────

interface CG {
  id: string;
  owner: string;
  collection: string;
  granteeAppId: string;
  canRead: boolean;
  canWrite: boolean;
  createdAt: string;
  updatedAt: string;
}

function assertCanManageCollection(c: Caller, owner: string): void {
  if (c.kind === 'host') return;
  if (c.appId === owner) return;
  throw new Error('Document grant management denied: caller is not the collection owner');
}

function isOwnGrantLookup(c: Caller, granteeAppId: string): boolean {
  return c.kind === 'app' && c.appId === granteeAppId;
}

export async function listGrants(owner: string, collection: string, callerAppId?: string): Promise<CG[]> {
  const appId = requireCallerAppId(callerAppId, 'documents.listGrants');
  await assertPermission(appId, 'documents:read', 'documents.listGrants');
  const store = await getStore();
  assertCanManageCollection(makeCaller(appId), owner);
  return store.listGrants(owner, collection);
}

export async function getGrant(owner: string, collection: string, granteeAppId: string, callerAppId?: string): Promise<CG | null> {
  const appId = requireCallerAppId(callerAppId, 'documents.getGrant');
  await assertPermission(appId, 'documents:read', 'documents.getGrant');
  const c = makeCaller(appId);
  // An app may inspect its own grant row
  if (!isOwnGrantLookup(c, granteeAppId)) {
    assertCanManageCollection(c, owner);
  }
  const store = await getStore();
  return store.getGrant(owner, collection, granteeAppId);
}

export async function setGrant(
  owner: string,
  collection: string,
  granteeAppId: string,
  canRead: boolean,
  canWrite: boolean,
  callerAppId?: string,
): Promise<CG> {
  const appId = requireCallerAppId(callerAppId, 'documents.setGrant');
  await assertPermission(appId, 'documents:write', 'documents.setGrant');
  const c = makeCaller(appId);
  assertCanManageCollection(c, owner);
  const store = await getStore();
  const result = store.setGrant(owner, collection, granteeAppId, canRead, canWrite);
  await publishDocumentsMutation({ type: 'grant.updated', owner, collection, granteeAppId });
  return result;
}

export async function deleteGrant(
  owner: string,
  collection: string,
  granteeAppId: string,
  callerAppId?: string,
): Promise<{ deleted: boolean }> {
  const appId = requireCallerAppId(callerAppId, 'documents.deleteGrant');
  await assertPermission(appId, 'documents:write', 'documents.deleteGrant');
  const c = makeCaller(appId);
  assertCanManageCollection(c, owner);
  const store = await getStore();
  const deleted = store.deleteGrant(owner, collection, granteeAppId);
  if (deleted) {
    await publishDocumentsMutation({ type: 'grant.deleted', owner, collection, granteeAppId });
  }
  return { deleted };
}
