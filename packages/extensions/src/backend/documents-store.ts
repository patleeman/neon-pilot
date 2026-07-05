/**
 * Public extension backend seam for the host-owned documents store.
 *
 * Provides caller-aware CRUD over documents collections, enforcing the same
 * read/write grant semantics as the HTTP route layer.  Each function accepts
 * an explicit `callerAppId` so the host can authorise access when the caller
 * is an extension app rather than the host itself.
 *
 * Callers (extension backend handlers) pass `ctx.extensionId` as callerAppId.
 *
 * See to-do/windowed-os.md §D4 for the product intent.
 */

function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/documents-store must be resolved by the Neon Pilot host runtime.');
}

// ── Re-exported types (mirrored from store.ts for extension consumption) ──

export interface DocumentRecord {
  owner: string;
  collection: string;
  id: string;
  body: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCollection {
  owner: string;
  collection: string;
  description: string;
  defaultGrantRead: 'owner' | 'all' | 'none';
  defaultGrantWrite: 'owner' | 'all' | 'none';
  createdAt: string;
  updatedAt: string;
}

export interface ListCollectionsOptions {
  /** Filter by owning app ID. Omit to list all visible collections. */
  owner?: string;
}

export interface ListDocumentsOptions {
  limit?: number;
  offset?: number;
}

export interface ListDocumentsResult {
  records: DocumentRecord[];
  total: number;
}

export interface UpsertCollectionOptions {
  description?: string;
  defaultGrantRead?: 'owner' | 'all' | 'none';
  defaultGrantWrite?: 'owner' | 'all' | 'none';
}

// ── Stub functions (replaced by host runtime) ──────────────────────────

export const listCollections = (..._args: unknown[]): unknown => hostResolved();
export const getCollection = (..._args: unknown[]): unknown => hostResolved();
export const upsertCollection = (..._args: unknown[]): unknown => hostResolved();
export const listDocuments = (..._args: unknown[]): unknown => hostResolved();
export const getDocument = (..._args: unknown[]): unknown => hostResolved();
export const putDocument = (..._args: unknown[]): unknown => hostResolved();
export const deleteDocument = (..._args: unknown[]): unknown => hostResolved();
