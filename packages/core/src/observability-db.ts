import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

import type { DesktopRootLayout } from './runtime/desktop-root.js';
import { getStateRoot } from './runtime/paths.js';
import type { SqliteDatabase } from './sqlite.js';
import type { Migration } from './sqlite-migrations.js';

export function resolveObservabilityDbPath(stateRoot?: string, layout?: DesktopRootLayout): string {
  if (layout) return join(layout.systemObservability, 'observability.db');
  return join(stateRoot ?? getStateRoot(), 'observability', 'observability.db');
}

/**
 * Resolve the observability database directory.
 *
 * When a desktop root layout is available, returns the layout-derived path
 * `<desktop-root>/system/observability`. Otherwise falls back to
 * the legacy `<state-root>/observability`.
 */
export function getObservabilityDbDir(layout?: DesktopRootLayout): string {
  if (layout) return layout.systemObservability;
  return join(getStateRoot(), 'observability');
}

/**
 * Resolve the observability database file path.
 *
 * When a desktop root layout is available, returns the layout-derived path
 * `<desktop-root>/system/observability/observability.db`. Otherwise falls back to
 * the legacy `<state-root>/observability/observability.db`.
 */
export function getObservabilityDbPath(layout?: DesktopRootLayout): string {
  if (layout) return join(layout.systemObservability, 'observability.db');
  return resolveObservabilityDbPath();
}

export function ensureObservabilityDbDir(stateRoot?: string, layout?: DesktopRootLayout): string {
  const dbPath = resolveObservabilityDbPath(stateRoot, layout);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function applyObservabilityMigrations(db: SqliteDatabase, namespace: string, migrations: Migration[]): number {
  if (migrations.length === 0) return 0;

  db.exec(`CREATE TABLE IF NOT EXISTS observability_schema_versions (namespace TEXT PRIMARY KEY, version INTEGER NOT NULL)`);

  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const latest = sorted[sorted.length - 1].version;
  const row = db.prepare(`SELECT version FROM observability_schema_versions WHERE namespace = ?`).get(namespace) as
    | { version?: unknown }
    | undefined;
  const current = typeof row?.version === 'number' ? row.version : 0;

  if (current > latest) {
    throw new Error(`${namespace}: observability schema version ${current} is newer than the latest migration version ${latest}.`);
  }

  let applied = 0;
  for (const migration of sorted) {
    if (migration.version <= current) continue;
    migration.up(db);
    db.prepare(`INSERT OR REPLACE INTO observability_schema_versions (namespace, version) VALUES (?, ?)`).run(namespace, migration.version);
    applied++;
  }
  return applied;
}
