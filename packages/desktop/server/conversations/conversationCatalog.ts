import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { type SqliteDatabase } from '@neon-pilot/core';

import { openRecoveringRuntimeSqliteDb } from '../shared/sqliteRuntimeRecovery.js';
import { ensureConversationsDbFile } from './conversationDbPaths.js';
import type { SessionMeta } from './conversationTypes.js';
import type { SessionDetail } from './conversationTypes.js';

interface ConversationCatalogRow {
  id: string;
  file: string;
  signature: string;
  title: string;
  cwd: string;
  workspace_cwd: string | null;
  cwd_slug: string;
  model: string;
  timestamp: string;
  last_activity_at: string;
  message_count: number;
  parent_session_file: string | null;
  parent_session_id: string | null;
  parent_message_id: string | null;
  offshoot_kind: string | null;
  offshoot_timestamp: string | null;
  source_run_id: string | null;
}

let db: SqliteDatabase | null = null;
let catalogBackfillStarted = false;
let catalogBackfillTimer: ReturnType<typeof setTimeout> | null = null;
const DEFAULT_CATALOG_BACKFILL_DELAY_MS = 5 * 60_000;

function getDb(): SqliteDatabase {
  if (db) return db;

  const dbFile = ensureConversationsDbFile();
  mkdirSync(dirname(dbFile), { recursive: true });
  db = openRecoveringRuntimeSqliteDb(dbFile);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      file TEXT NOT NULL,
      signature TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      cwd TEXT NOT NULL,
      workspace_cwd TEXT,
      cwd_slug TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT 'unknown',
      timestamp TEXT NOT NULL,
      last_activity_at TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      parent_session_file TEXT,
      parent_session_id TEXT,
      parent_message_id TEXT,
      offshoot_kind TEXT,
      offshoot_timestamp TEXT,
      source_run_id TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS conversations_last_activity_idx ON conversations(last_activity_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS conversations_cwd_idx ON conversations(cwd);
    CREATE TABLE IF NOT EXISTS conversation_details (
      conversation_id TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      detail_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (conversation_id, cache_key)
    );
    CREATE TABLE IF NOT EXISTS conversation_assets (
      conversation_id TEXT NOT NULL,
      signature TEXT NOT NULL,
      block_id TEXT NOT NULL,
      image_index INTEGER NOT NULL DEFAULT -1,
      mime_type TEXT NOT NULL,
      file_name TEXT,
      data BLOB NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (conversation_id, block_id, image_index)
    );
    CREATE TABLE IF NOT EXISTS conversation_catalog_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function rowToSessionMeta(row: ConversationCatalogRow): SessionMeta {
  return {
    id: row.id,
    file: row.file,
    timestamp: row.timestamp,
    lastActivityAt: row.last_activity_at,
    cwd: row.cwd,
    ...(row.workspace_cwd !== null ? { workspaceCwd: row.workspace_cwd } : {}),
    cwdSlug: row.cwd_slug,
    model: row.model,
    title: row.title,
    messageCount: row.message_count,
    ...(row.parent_session_file ? { parentSessionFile: row.parent_session_file } : {}),
    ...(row.parent_session_id ? { parentSessionId: row.parent_session_id } : {}),
    ...(row.parent_message_id ? { parentMessageId: row.parent_message_id } : {}),
    ...(row.offshoot_kind ? { offshootKind: row.offshoot_kind as SessionMeta['offshootKind'] } : {}),
    ...(row.offshoot_timestamp ? { offshootTimestamp: row.offshoot_timestamp } : {}),
    ...(row.source_run_id ? { sourceRunId: row.source_run_id } : {}),
  };
}

export function upsertConversationCatalogSession(meta: SessionMeta, signature = ''): void {
  getDb()
    .prepare(
      `
      INSERT INTO conversations (
        id, file, signature, title, cwd, workspace_cwd, cwd_slug, model, timestamp, last_activity_at, message_count,
        parent_session_file, parent_session_id, parent_message_id, offshoot_kind, offshoot_timestamp, source_run_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        file = excluded.file,
        signature = excluded.signature,
        title = excluded.title,
        cwd = excluded.cwd,
        workspace_cwd = excluded.workspace_cwd,
        cwd_slug = excluded.cwd_slug,
        model = excluded.model,
        timestamp = excluded.timestamp,
        last_activity_at = excluded.last_activity_at,
        message_count = excluded.message_count,
        parent_session_file = excluded.parent_session_file,
        parent_session_id = excluded.parent_session_id,
        parent_message_id = excluded.parent_message_id,
        offshoot_kind = excluded.offshoot_kind,
        offshoot_timestamp = excluded.offshoot_timestamp,
        source_run_id = excluded.source_run_id,
        updated_at = excluded.updated_at
    `,
    )
    .run(
      meta.id,
      meta.file,
      signature,
      meta.title,
      meta.cwd,
      meta.workspaceCwd ?? null,
      meta.cwdSlug,
      meta.model,
      meta.timestamp,
      meta.lastActivityAt ?? meta.timestamp,
      meta.messageCount,
      meta.parentSessionFile ?? null,
      meta.parentSessionId ?? null,
      meta.parentMessageId ?? null,
      meta.offshootKind ?? null,
      meta.offshootTimestamp ?? null,
      meta.sourceRunId ?? null,
      new Date().toISOString(),
    );
}

export function upsertConversationCatalogSessions(metas: SessionMeta[]): void {
  const write = getDb().transaction((sessions: SessionMeta[]) => {
    for (const meta of sessions) {
      upsertConversationCatalogSession(meta);
    }
  });
  write(metas);
}

export function listConversationCatalogSessions(options: { limit?: number } = {}): SessionMeta[] {
  const limit = Number.isSafeInteger(options.limit) && typeof options.limit === 'number' && options.limit > 0 ? options.limit : null;
  const rows = getDb()
    .prepare(
      `
      SELECT id, file, signature, title, cwd, workspace_cwd, cwd_slug, model, timestamp, last_activity_at, message_count,
        parent_session_file, parent_session_id, parent_message_id, offshoot_kind, offshoot_timestamp, source_run_id
      FROM conversations
      ORDER BY last_activity_at DESC, id DESC
      ${limit === null ? '' : 'LIMIT ?'}
    `,
    )
    .all(...(limit === null ? [] : [limit])) as ConversationCatalogRow[];
  return rows.map(rowToSessionMeta);
}

export function readConversationCatalogSession(id: string): SessionMeta | null {
  const row = getDb()
    .prepare(
      `
      SELECT id, file, signature, title, cwd, workspace_cwd, cwd_slug, model, timestamp, last_activity_at, message_count,
        parent_session_file, parent_session_id, parent_message_id, offshoot_kind, offshoot_timestamp, source_run_id
      FROM conversations
      WHERE id = ?
    `,
    )
    .get(id) as ConversationCatalogRow | undefined;
  return row ? rowToSessionMeta(row) : null;
}

export function hasConversationCatalogRows(): boolean {
  const row = getDb().prepare('SELECT 1 AS found FROM conversations LIMIT 1').get() as { found?: number } | undefined;
  return row?.found === 1;
}

export function isConversationCatalogComplete(): boolean {
  const row = getDb().prepare('SELECT value FROM conversation_catalog_state WHERE key = ?').get('complete') as
    | { value?: string }
    | undefined;
  return row?.value === 'true';
}

export function markConversationCatalogComplete(): void {
  getDb()
    .prepare(
      `
      INSERT INTO conversation_catalog_state (key, value, updated_at)
      VALUES ('complete', 'true', ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    )
    .run(new Date().toISOString());
}

function detailCacheKey(options?: { tailBlocks?: number }): string {
  return Number.isSafeInteger(options?.tailBlocks) && typeof options?.tailBlocks === 'number' && options.tailBlocks > 0
    ? `tail:${options.tailBlocks}`
    : 'full';
}

export function readConversationDetailCache(
  conversationId: string,
  signature: string,
  options?: { tailBlocks?: number },
): SessionDetail | null {
  const row = getDb()
    .prepare('SELECT detail_json FROM conversation_details WHERE conversation_id = ? AND cache_key = ? AND signature = ?')
    .get(conversationId, detailCacheKey(options), signature) as { detail_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.detail_json) as SessionDetail;
  } catch {
    return null;
  }
}

export function writeConversationDetailCache(conversationId: string, detail: SessionDetail, options?: { tailBlocks?: number }): void {
  getDb()
    .prepare(
      `
      INSERT INTO conversation_details (conversation_id, cache_key, signature, detail_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id, cache_key) DO UPDATE SET
        signature = excluded.signature,
        detail_json = excluded.detail_json,
        updated_at = excluded.updated_at
    `,
    )
    .run(conversationId, detailCacheKey(options), detail.signature ?? '', JSON.stringify(detail), new Date().toISOString());
}

export function readConversationAssetCache(input: {
  conversationId: string;
  signature: string;
  blockId: string;
  imageIndex?: number;
}): { mimeType: string; data: Buffer; fileName?: string } | null {
  const row = getDb()
    .prepare(
      `
      SELECT mime_type, file_name, data
      FROM conversation_assets
      WHERE conversation_id = ? AND signature = ? AND block_id = ? AND image_index = ?
    `,
    )
    .get(input.conversationId, input.signature, input.blockId, input.imageIndex ?? -1) as
    | { mime_type: string; file_name: string | null; data: Buffer }
    | undefined;
  if (!row) return null;
  return {
    mimeType: row.mime_type,
    data: Buffer.from(row.data),
    ...(row.file_name ? { fileName: row.file_name } : {}),
  };
}

export function writeConversationAssetCache(input: {
  conversationId: string;
  signature: string;
  blockId: string;
  imageIndex?: number;
  asset: { mimeType: string; data: Buffer; fileName?: string };
}): void {
  getDb()
    .prepare(
      `
      INSERT INTO conversation_assets (conversation_id, signature, block_id, image_index, mime_type, file_name, data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id, block_id, image_index) DO UPDATE SET
        signature = excluded.signature,
        mime_type = excluded.mime_type,
        file_name = excluded.file_name,
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
    )
    .run(
      input.conversationId,
      input.signature,
      input.blockId,
      input.imageIndex ?? -1,
      input.asset.mimeType,
      input.asset.fileName ?? null,
      input.asset.data,
      new Date().toISOString(),
    );
}

export function closeConversationCatalogDb(): void {
  if (catalogBackfillTimer) {
    clearTimeout(catalogBackfillTimer);
    catalogBackfillTimer = null;
  }
  catalogBackfillStarted = false;
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // Best-effort checkpoint before close.
  }
  db.close();
  db = null;
}

export function startConversationCatalogBackfill(input: { listSessions: () => SessionMeta[]; delayMs?: number; limit?: number }): void {
  if (catalogBackfillStarted) return;
  catalogBackfillStarted = true;

  const delayMs =
    Number.isSafeInteger(input.delayMs) && typeof input.delayMs === 'number' && input.delayMs >= 0
      ? input.delayMs
      : DEFAULT_CATALOG_BACKFILL_DELAY_MS;
  const limit =
    Number.isSafeInteger(input.limit) && typeof input.limit === 'number' && input.limit > 0 ? Math.min(input.limit, 1_000) : 250;

  catalogBackfillTimer = setTimeout(() => {
    catalogBackfillTimer = null;
    try {
      const sessions = input.listSessions();
      upsertConversationCatalogSessions(sessions.slice(0, limit));
      if (input.limit === undefined || limit >= sessions.length) {
        markConversationCatalogComplete();
      }
    } catch {
      // Best-effort delayed reconciliation. Request paths still have targeted fallback.
    }
  }, delayMs);
  catalogBackfillTimer.unref?.();
}
