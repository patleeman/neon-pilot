import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  applyMigrations,
  getStateRoot,
  type Migration,
  openSqliteDatabase,
  type SqliteDatabase,
  type SqliteStatement,
} from '@neon-pilot/core';

export interface ExtensionDatabaseMigration {
  version: number;
  description?: string;
  up: (db: SqliteDatabase) => void;
}

export interface ExtensionDatabaseOpenOptions {
  migrations?: ExtensionDatabaseMigration[];
}

export interface ExtensionDatabaseManager {
  open(name?: string, options?: ExtensionDatabaseOpenOptions): Promise<SqliteDatabase>;
  close(name?: string): Promise<void>;
  closeAll(): Promise<void>;
}

const dbCache = new Map<string, SqliteDatabase>();

function normalizeDatabaseName(name = 'main'): string {
  const normalized = name.trim();
  if (
    !normalized ||
    normalized.includes('\0') ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    normalized === '.' ||
    normalized === '..'
  ) {
    throw new Error('Extension database name is invalid.');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new Error('Extension database name is invalid.');
  }
  return normalized.replace(/\.sqlite$/i, '');
}

function getExtensionDatabasePath(extensionId: string, name = 'main', stateRoot: string = getStateRoot()): string {
  return join(stateRoot, 'extension-data', extensionId, 'databases', `${normalizeDatabaseName(name)}.sqlite`);
}

function toCoreMigrations(extensionId: string, name: string, migrations: ExtensionDatabaseMigration[]): Migration[] {
  return migrations.map((migration) => {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error('Extension database migration version must be a positive integer.');
    }
    if (typeof migration.up !== 'function') {
      throw new Error('Extension database migration up handler is required.');
    }
    return {
      version: migration.version,
      description: migration.description ?? `${extensionId}/${name} migration ${migration.version}`,
      up: migration.up,
    };
  });
}

export function createExtensionDatabaseManager(extensionId: string): ExtensionDatabaseManager {
  return {
    async open(name = 'main', options: ExtensionDatabaseOpenOptions = {}): Promise<SqliteDatabase> {
      const normalizedName = normalizeDatabaseName(name);
      const dbPath = getExtensionDatabasePath(extensionId, normalizedName);
      const cached = dbCache.get(dbPath);
      if (cached) {
        if (options.migrations?.length)
          applyMigrations(
            cached,
            `extension ${extensionId} database ${normalizedName}`,
            toCoreMigrations(extensionId, normalizedName, options.migrations),
          );
        return cached;
      }

      mkdirSync(dirname(dbPath), { recursive: true });
      const db = openSqliteDatabase(dbPath);
      db.pragma('journal_mode = WAL');
      if (options.migrations?.length) {
        applyMigrations(
          db,
          `extension ${extensionId} database ${normalizedName}`,
          toCoreMigrations(extensionId, normalizedName, options.migrations),
        );
      }
      dbCache.set(dbPath, db);
      return db;
    },

    async close(name = 'main'): Promise<void> {
      const dbPath = getExtensionDatabasePath(extensionId, name);
      const db = dbCache.get(dbPath);
      if (!db) return;
      closeDatabase(db);
      dbCache.delete(dbPath);
    },

    async closeAll(): Promise<void> {
      const prefix = join(getStateRoot(), 'extension-data', extensionId, 'databases');
      for (const [dbPath, db] of dbCache) {
        if (!dbPath.startsWith(prefix)) continue;
        closeDatabase(db);
        dbCache.delete(dbPath);
      }
    },
  };
}

function closeDatabase(db: SqliteDatabase): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // Best-effort checkpoint before close.
  }
  db.close();
}

export function closeExtensionDatabaseManagersForTests(): void {
  for (const db of dbCache.values()) closeDatabase(db);
  dbCache.clear();
}

export type { SqliteDatabase as ExtensionSqliteDatabase, SqliteStatement as ExtensionSqliteStatement };
