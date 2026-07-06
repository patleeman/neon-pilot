/**
 * Documents Store
 *
 * Host-owned SQLite store for named typed records — {app owner, collection, id, JSON body}.
 * Supports collection discovery, per-collection default grants, and per-app grants for
 * cross-app data sharing.
 *
 * See to-do/windowed-os.md §D4 for the product intent.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  applyMigrations,
  type DesktopRootLayout,
  type Migration,
  openSqliteDatabase,
  type SqliteDatabase,
  type SqliteStatement,
} from '@neon-pilot/core';

// ── Types ──────────────────────────────────────────────────────────────

export type GrantLevel = 'owner' | 'all' | 'none';

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
  defaultGrantRead: GrantLevel;
  defaultGrantWrite: GrantLevel;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionGrant {
  id: string;
  owner: string;
  collection: string;
  granteeAppId: string;
  canRead: boolean;
  canWrite: boolean;
  createdAt: string;
  updatedAt: string;
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
  defaultGrantRead?: GrantLevel;
  defaultGrantWrite?: GrantLevel;
}

// ── DB Path ────────────────────────────────────────────────────────────

const DOCUMENTS_DB_NAME = 'documents.db';

/**
 * Resolve the documents DB path under the legacy state root.
 * Kept for backward compatibility and migration source detection.
 */
export function resolveDocumentsDbPath(stateRoot: string): string {
  return join(stateRoot, 'documents', DOCUMENTS_DB_NAME);
}

/**
 * Resolve the documents DB path under the canonical desktop root layout.
 * The database lives at <desktop-root>/data/documents/documents.db.
 */
export function resolveDocumentsDbPathFromLayout(layout: DesktopRootLayout): string {
  return join(layout.dataDocuments, DOCUMENTS_DB_NAME);
}

/**
 * Migrate the legacy documents DB from the old state-root location to the
 * new desktop-root location. The legacy DB is copied (not moved) only when
 * the new DB does not already exist. The legacy DB is never deleted.
 */
export function maybeMigrateLegacyDocumentsDb(legacyStateRoot: string, layout: DesktopRootLayout): void {
  const newPath = resolveDocumentsDbPathFromLayout(layout);
  if (existsSync(newPath)) {
    return;
  }
  const legacyPath = resolveDocumentsDbPath(legacyStateRoot);
  if (!existsSync(legacyPath)) {
    return;
  }
  const legacyDb = openSqliteDatabase(legacyPath);
  try {
    legacyDb.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    legacyDb.close();
  }
  mkdirSync(dirname(newPath), { recursive: true, mode: 0o700 });
  copyFileSync(legacyPath, newPath);
}

// ── Schema ─────────────────────────────────────────────────────────────

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial documents store schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS collections (
          owner TEXT NOT NULL,
          collection TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          default_grant_read TEXT NOT NULL DEFAULT 'owner',
          default_grant_write TEXT NOT NULL DEFAULT 'owner',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (owner, collection)
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          owner TEXT NOT NULL,
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (owner, collection, id)
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS collection_grants (
          id TEXT PRIMARY KEY,
          owner TEXT NOT NULL,
          collection TEXT NOT NULL,
          grantee_app_id TEXT NOT NULL,
          can_read INTEGER NOT NULL DEFAULT 0,
          can_write INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (owner, collection, grantee_app_id)
        )
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_documents_owner_collection
        ON documents (owner, collection)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_collection_grants_lookup
        ON collection_grants (owner, collection)
      `);
    },
  },
];

function openDocumentsDb(dbPath: string): SqliteDatabase {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });

  const db = openSqliteDatabase(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  applyMigrations(db, 'documents', MIGRATIONS);
  return db;
}

// ── Validation helpers ─────────────────────────────────────────────────

const VALID_GRANT_LEVELS: GrantLevel[] = ['owner', 'all', 'none'];

function assertGrantLevel(value: string): GrantLevel {
  if (VALID_GRANT_LEVELS.includes(value as GrantLevel)) {
    return value as GrantLevel;
  }
  throw new Error(`Invalid grant level "${value}". Must be one of: ${VALID_GRANT_LEVELS.join(', ')}`);
}

function parseBody(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Invalid JSON body: ${raw.slice(0, 200)}`);
  }
}

function toDocumentRecord(row: Record<string, unknown>): DocumentRecord {
  return {
    owner: String(row.owner),
    collection: String(row.collection),
    id: String(row.id),
    body: parseBody(String(row.body)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toDocumentCollection(row: Record<string, unknown>): DocumentCollection {
  return {
    owner: String(row.owner),
    collection: String(row.collection),
    description: String(row.description),
    defaultGrantRead: assertGrantLevel(String(row.default_grant_read)),
    defaultGrantWrite: assertGrantLevel(String(row.default_grant_write)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toCollectionGrant(row: Record<string, unknown>): CollectionGrant {
  return {
    id: String(row.id),
    owner: String(row.owner),
    collection: String(row.collection),
    granteeAppId: String(row.grantee_app_id),
    canRead: Boolean(row.can_read),
    canWrite: Boolean(row.can_write),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// ── Store ──────────────────────────────────────────────────────────────

export class DocumentsStore {
  private db: SqliteDatabase;
  private prepareListCollections: SqliteStatement;
  private prepareListCollectionsByOwner: SqliteStatement;
  private prepareGetCollection: SqliteStatement;
  private prepareUpsertCollection: SqliteStatement;
  private prepareListDocuments: SqliteStatement;
  private prepareCountDocuments: SqliteStatement;
  private prepareGetDocument: SqliteStatement;
  private preparePutDocument: SqliteStatement;
  private prepareDeleteDocument: SqliteStatement;
  private prepareListGrants: SqliteStatement;
  private prepareGetGrant: SqliteStatement;
  private prepareSetGrant: SqliteStatement;
  private prepareDeleteGrant: SqliteStatement;

  constructor(dbPath: string) {
    this.db = openDocumentsDb(dbPath);
    this.prepareListCollections = this.db.prepare('SELECT * FROM collections ORDER BY owner, collection');
    this.prepareListCollectionsByOwner = this.db.prepare('SELECT * FROM collections WHERE owner = ? ORDER BY collection');
    this.prepareGetCollection = this.db.prepare('SELECT * FROM collections WHERE owner = ? AND collection = ?');
    this.prepareUpsertCollection = this.db.prepare(`
      INSERT INTO collections (owner, collection, description, default_grant_read, default_grant_write, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(owner, collection) DO UPDATE SET
        description = excluded.description,
        default_grant_read = excluded.default_grant_read,
        default_grant_write = excluded.default_grant_write,
        updated_at = datetime('now')
    `);
    this.prepareListDocuments = this.db.prepare('SELECT * FROM documents WHERE owner = ? AND collection = ? ORDER BY id LIMIT ? OFFSET ?');
    this.prepareCountDocuments = this.db.prepare('SELECT COUNT(*) AS total FROM documents WHERE owner = ? AND collection = ?');
    this.prepareGetDocument = this.db.prepare('SELECT * FROM documents WHERE owner = ? AND collection = ? AND id = ?');
    this.preparePutDocument = this.db.prepare(`
      INSERT INTO documents (owner, collection, id, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(owner, collection, id) DO UPDATE SET
        body = excluded.body,
        updated_at = datetime('now')
    `);
    this.prepareDeleteDocument = this.db.prepare('DELETE FROM documents WHERE owner = ? AND collection = ? AND id = ?');
    this.prepareListGrants = this.db.prepare('SELECT * FROM collection_grants WHERE owner = ? AND collection = ? ORDER BY grantee_app_id');
    this.prepareGetGrant = this.db.prepare('SELECT * FROM collection_grants WHERE owner = ? AND collection = ? AND grantee_app_id = ?');
    this.prepareSetGrant = this.db.prepare(`
      INSERT INTO collection_grants (id, owner, collection, grantee_app_id, can_read, can_write, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(owner, collection, grantee_app_id) DO UPDATE SET
        can_read = excluded.can_read,
        can_write = excluded.can_write,
        updated_at = datetime('now')
    `);
    this.prepareDeleteGrant = this.db.prepare('DELETE FROM collection_grants WHERE owner = ? AND collection = ? AND grantee_app_id = ?');
  }

  close(): void {
    this.db.close();
  }

  // ── Collections ────────────────────────────────────────────────────

  listCollections(owner?: string): DocumentCollection[] {
    const rows = owner
      ? (this.prepareListCollectionsByOwner.all(owner) as Record<string, unknown>[])
      : (this.prepareListCollections.all() as Record<string, unknown>[]);
    return rows.map(toDocumentCollection);
  }

  getCollection(owner: string, collection: string): DocumentCollection | null {
    const row = this.prepareGetCollection.get(owner, collection) as Record<string, unknown> | undefined;
    return row ? toDocumentCollection(row) : null;
  }

  upsertCollection(owner: string, collection: string, opts: UpsertCollectionOptions = {}): DocumentCollection {
    const existing = this.getCollection(owner, collection);
    const hasDescription = Object.prototype.hasOwnProperty.call(opts, 'description');
    const hasDefaultGrantRead = Object.prototype.hasOwnProperty.call(opts, 'defaultGrantRead');
    const hasDefaultGrantWrite = Object.prototype.hasOwnProperty.call(opts, 'defaultGrantWrite');

    const description = hasDescription ? (opts.description ?? '') : (existing?.description ?? '');
    const defaultGrantRead = hasDefaultGrantRead ? (opts.defaultGrantRead ?? 'owner') : (existing?.defaultGrantRead ?? 'owner');
    const defaultGrantWrite = hasDefaultGrantWrite ? (opts.defaultGrantWrite ?? 'owner') : (existing?.defaultGrantWrite ?? 'owner');

    // Validate grant levels before inserting
    assertGrantLevel(defaultGrantRead);
    assertGrantLevel(defaultGrantWrite);

    this.prepareUpsertCollection.run(owner, collection, description, defaultGrantRead, defaultGrantWrite);

    const result = this.getCollection(owner, collection);
    if (!result) {
      throw new Error(`Failed to read back collection "${owner}/${collection}" after upsert`);
    }
    return result;
  }

  // ── Documents ──────────────────────────────────────────────────────

  listDocuments(owner: string, collection: string, options: ListDocumentsOptions = {}): ListDocumentsResult {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const totalRow = this.prepareCountDocuments.get(owner, collection) as { total: number };
    const total = Number(totalRow.total);

    const rows = this.prepareListDocuments.all(owner, collection, limit, offset) as Record<string, unknown>[];
    return {
      records: rows.map(toDocumentRecord),
      total,
    };
  }

  getDocument(owner: string, collection: string, id: string): DocumentRecord | null {
    const row = this.prepareGetDocument.get(owner, collection, id) as Record<string, unknown> | undefined;
    return row ? toDocumentRecord(row) : null;
  }

  putDocument(owner: string, collection: string, id: string, body: unknown): DocumentRecord {
    // Ensure collection exists (auto-create with defaults)
    const existingCollection = this.getCollection(owner, collection);
    if (!existingCollection) {
      this.upsertCollection(owner, collection);
    }

    const bodyJson = JSON.stringify(body);
    if (bodyJson === undefined) {
      throw new Error('Document body must be JSON-serializable');
    }

    this.preparePutDocument.run(owner, collection, id, bodyJson);

    const result = this.getDocument(owner, collection, id);
    if (!result) {
      throw new Error(`Failed to read back document "${owner}/${collection}/${id}" after put`);
    }
    return result;
  }

  deleteDocument(owner: string, collection: string, id: string): boolean {
    const result = this.prepareDeleteDocument.run(owner, collection, id);
    return result.changes > 0;
  }

  // ── Grants ─────────────────────────────────────────────────────────

  listGrants(owner: string, collection: string): CollectionGrant[] {
    const rows = this.prepareListGrants.all(owner, collection) as Record<string, unknown>[];
    return rows.map(toCollectionGrant);
  }

  getGrant(owner: string, collection: string, granteeAppId: string): CollectionGrant | null {
    const row = this.prepareGetGrant.get(owner, collection, granteeAppId) as Record<string, unknown> | undefined;
    return row ? toCollectionGrant(row) : null;
  }

  setGrant(owner: string, collection: string, granteeAppId: string, canRead: boolean, canWrite: boolean): CollectionGrant {
    const id = `${owner}::${collection}::${granteeAppId}`;
    this.prepareSetGrant.run(id, owner, collection, granteeAppId, canRead ? 1 : 0, canWrite ? 1 : 0);

    const result = this.getGrant(owner, collection, granteeAppId);
    if (!result) {
      throw new Error(`Failed to read back grant "${owner}/${collection}/${granteeAppId}" after set`);
    }
    return result;
  }

  deleteGrant(owner: string, collection: string, granteeAppId: string): boolean {
    const result = this.prepareDeleteGrant.run(owner, collection, granteeAppId);
    return result.changes > 0;
  }
}

// ── Singleton accessor (for backend API and other non-route callers) ──

let _singletonStore: DocumentsStore | null = null;
let _singletonDbPath: string | null = null;

/**
 * Get or create the singleton DocumentsStore.
 *
 * When a {@link DesktopRootLayout} is provided, the DB is stored at
 * `<layout.dataDocuments>/documents.db` and an optional legacy migration
 * from the state root is performed. When only a state root is provided,
 * the DB is stored at `<stateRoot>/documents/documents.db` (legacy path).
 *
 * The store is kept alive for the lifetime of the process.
 */
export function getDocumentsStore(stateRoot: string, desktopRootLayout?: DesktopRootLayout): DocumentsStore {
  let dbPath: string;

  if (desktopRootLayout) {
    dbPath = resolveDocumentsDbPathFromLayout(desktopRootLayout);
    maybeMigrateLegacyDocumentsDb(stateRoot, desktopRootLayout);
  } else {
    dbPath = resolveDocumentsDbPath(stateRoot);
  }

  if (_singletonStore && _singletonDbPath === dbPath) {
    return _singletonStore;
  }
  _singletonStore?.close();
  _singletonStore = new DocumentsStore(dbPath);
  _singletonDbPath = dbPath;
  return _singletonStore;
}

/**
 * Close and reset the singleton (for tests).
 */
export function resetDocumentsStoreSingleton(): void {
  _singletonStore?.close();
  _singletonStore = null;
  _singletonDbPath = null;
}
