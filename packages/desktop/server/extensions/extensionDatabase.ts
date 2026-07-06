import { join } from 'node:path';

import {
  applyMigrations,
  type DesktopRootLayout,
  getStateRoot,
  type Migration,
  openSqliteDatabase,
  type SqliteDatabase,
  type SqliteStatement,
} from '@neon-pilot/core';

import { preparePrivateExtensionSqlitePath, repairPrivateExtensionSqliteFiles } from './extensionSqliteSecurity.js';

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

function getExtensionDatabasePath(
  extensionId: string,
  name = 'main',
  stateRoot: string = getStateRoot(),
  /**
   * When provided, resolves the path from a DesktopRootLayout instead of stateRoot.
   */
  layout?: DesktopRootLayout,
): string {
  if (layout) return getExtensionDatabasePathFromLayout(extensionId, name, layout);
  return join(stateRoot, 'extension-data', extensionId, 'databases', `${normalizeDatabaseName(name)}.sqlite`);
}

/**
 * Resolve extension database paths from a DesktopRootLayout.
 * Extension databases live under `layout.dataApps/<extensionId>/databases/`.
 */
export function getExtensionDatabasePathFromLayout(extensionId: string, name: string, layout: DesktopRootLayout): string {
  return join(layout.dataApps, extensionId, 'databases', `${normalizeDatabaseName(name)}.sqlite`);
}

/**
 * Resolve the extension data root directory from a DesktopRootLayout.
 */
export function getExtensionDataRootFromLayout(layout: DesktopRootLayout): string {
  return layout.dataApps;
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

export function createExtensionDatabaseManager(extensionId: string, options?: { layout?: DesktopRootLayout }): ExtensionDatabaseManager {
  const dbOptionsLayout = options?.layout;
  return {
    async open(name = 'main', openOptions: ExtensionDatabaseOpenOptions = {}): Promise<SqliteDatabase> {
      const normalizedName = normalizeDatabaseName(name);
      const dbPath = getExtensionDatabasePath(extensionId, normalizedName, undefined, dbOptionsLayout);
      const cached = dbCache.get(dbPath);
      if (cached) {
        if (openOptions.migrations?.length)
          applyMigrations(
            cached,
            `extension ${extensionId} database ${normalizedName}`,
            toCoreMigrations(extensionId, normalizedName, openOptions.migrations),
          );
        return cached;
      }

      preparePrivateExtensionSqlitePath(dbPath);
      const db = openSqliteDatabase(dbPath);
      db.pragma('journal_mode = WAL');
      repairPrivateExtensionSqliteFiles(dbPath);
      if (openOptions.migrations?.length) {
        applyMigrations(
          db,
          `extension ${extensionId} database ${normalizedName}`,
          toCoreMigrations(extensionId, normalizedName, openOptions.migrations),
        );
      }
      repairPrivateExtensionSqliteFiles(dbPath);
      dbCache.set(dbPath, db);
      return db;
    },

    async close(name = 'main'): Promise<void> {
      const dbPath = getExtensionDatabasePath(extensionId, name, undefined, dbOptionsLayout);
      const db = dbCache.get(dbPath);
      if (!db) return;
      closeDatabase(db);
      dbCache.delete(dbPath);
    },

    async closeAll(): Promise<void> {
      const prefix = dbOptionsLayout
        ? join(dbOptionsLayout.dataApps, extensionId, 'databases')
        : join(getStateRoot(), 'extension-data', extensionId, 'databases');
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
