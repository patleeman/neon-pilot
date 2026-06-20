import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { SqliteDatabase } from '@neon-pilot/core';

import { loadDaemonConfig } from '../config.js';
import { resolveDaemonPaths } from '../paths.js';
import { resolveRuntimeDbPath } from '../runs/store.js';
import { openRecoveringRuntimeSqliteDb } from '../shared/sqliteRuntimeRecovery.js';

export type EventBusAction =
  | { type: 'run_task'; taskId: string }
  | { type: 'start_agent'; prompt: string; cwd?: string; model?: string }
  | { type: 'start_thread'; prompt: string; conversationId?: string; cwd?: string; model?: string }
  | { type: 'run_script'; command: string; cwd?: string }
  | { type: 'publish_event'; eventType: string; payload?: Record<string, unknown>; recorded?: boolean };

export interface EventBusEvent {
  id: string;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  occurredAt: string;
  recordedAt: string;
  recorded: boolean;
  replayOfEventId?: string;
  reactions: EventBusReaction[];
}

export interface EventBusSubscription {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  action: EventBusAction;
  maxReactionsPerMinute?: number;
  createdAt: string;
  updatedAt: string;
}

export type EventBusReactionStatus = 'pending' | 'completed' | 'failed';

export interface EventBusReaction {
  id: string;
  eventId: string;
  subscriptionId: string;
  subscriptionName: string;
  actionType: EventBusAction['type'];
  status: EventBusReactionStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface EventBusDispatchInput {
  event: EventBusEvent & { dbPath?: string };
  subscription: EventBusSubscription;
}

export interface EventBusDispatchResult {
  status: EventBusReactionStatus;
  output?: Record<string, unknown>;
  error?: string;
}

export interface EventBusEventInput {
  id?: string;
  type: string;
  source: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  recorded?: boolean;
  replayOfEventId?: string;
}

interface EventBusSubscriptionInput {
  id?: string;
  name: string;
  pattern: string;
  enabled?: boolean;
  action: EventBusAction;
  maxReactionsPerMinute?: number;
}

export interface EventBusDelayedEvent {
  id: string;
  dueAt: string;
  status: 'pending' | 'emitted' | 'failed' | 'cancelled';
  event: EventBusEventInput;
  createdAt: string;
  emittedEventId?: string;
  error?: string;
}

interface EventBusDelayedEventRow {
  id: string;
  due_at: string;
  status: string;
  event_json: string;
  created_at: string;
  emitted_event_id: string | null;
  error: string | null;
}

interface EventBusEventRow {
  id: string;
  type: string;
  source: string;
  payload_json: string | null;
  metadata_json: string | null;
  occurred_at: string;
  recorded_at: string;
  recorded: number;
  replay_of_event_id: string | null;
}

interface EventBusSubscriptionRow {
  id: string;
  name: string;
  pattern: string;
  enabled: number;
  action_json: string;
  max_reactions_per_minute: number | null;
  created_at: string;
  updated_at: string;
}

interface EventBusReactionRow {
  id: string;
  event_id: string;
  subscription_id: string;
  subscription_name: string;
  action_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  output_json: string | null;
}

const dbCache = new Map<string, SqliteDatabase>();

function normalizeTimestamp(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value !== 'string') return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

function readObjectJson(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readActionJson(value: string): EventBusAction {
  const parsed = JSON.parse(value) as unknown;
  return normalizeAction(parsed);
}

function normalizeString(value: unknown, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeAction(value: unknown): EventBusAction {
  const action = normalizeRecord(value);
  switch (action.type) {
    case 'run_task':
      return { type: 'run_task', taskId: normalizeString(action.taskId, 'taskId') };
    case 'start_agent':
      return {
        type: 'start_agent',
        prompt: normalizeString(action.prompt, 'prompt'),
        ...(typeof action.cwd === 'string' && action.cwd.trim() ? { cwd: action.cwd.trim() } : {}),
        ...(typeof action.model === 'string' && action.model.trim() ? { model: action.model.trim() } : {}),
      };
    case 'start_thread':
      return {
        type: 'start_thread',
        prompt: normalizeString(action.prompt, 'prompt'),
        ...(typeof action.conversationId === 'string' && action.conversationId.trim()
          ? { conversationId: action.conversationId.trim() }
          : {}),
        ...(typeof action.cwd === 'string' && action.cwd.trim() ? { cwd: action.cwd.trim() } : {}),
        ...(typeof action.model === 'string' && action.model.trim() ? { model: action.model.trim() } : {}),
      };
    case 'run_script':
      return {
        type: 'run_script',
        command: normalizeString(action.command, 'command'),
        ...(typeof action.cwd === 'string' && action.cwd.trim() ? { cwd: action.cwd.trim() } : {}),
      };
    case 'publish_event':
      return {
        type: 'publish_event',
        eventType: normalizeString(action.eventType, 'eventType'),
        payload: normalizeRecord(action.payload),
        ...(typeof action.recorded === 'boolean' ? { recorded: action.recorded } : {}),
      };
    default:
      throw new Error('Unsupported event bus action type.');
  }
}

function normalizePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return undefined;
  return value;
}

function assertSubscriptionDoesNotSelfPublish(pattern: string, action: EventBusAction): void {
  if (action.type === 'publish_event' && eventPatternMatches(pattern, action.eventType)) {
    throw new Error('Subscription cannot publish an event type that matches its own pattern.');
  }
}

function openEventBusDb(dbPath: string): SqliteDatabase {
  const resolved = resolve(dbPath);
  const cached = dbCache.get(resolved);
  if (cached) return cached;

  mkdirSync(dirname(resolved), { recursive: true, mode: 0o700 });
  const db = openRecoveringRuntimeSqliteDb(resolved);
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_bus_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      payload_json TEXT,
      metadata_json TEXT,
      occurred_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      recorded INTEGER NOT NULL DEFAULT 1,
      replay_of_event_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_event_bus_events_time
      ON event_bus_events(occurred_at DESC, recorded_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS event_bus_subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pattern TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      action_json TEXT NOT NULL,
      max_reactions_per_minute INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_bus_delayed_events (
      id TEXT PRIMARY KEY,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL,
      event_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      emitted_event_id TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_event_bus_delayed_due
      ON event_bus_delayed_events(status, due_at ASC, id ASC);

    CREATE INDEX IF NOT EXISTS idx_event_bus_subscriptions_enabled
      ON event_bus_subscriptions(enabled, pattern);

    CREATE TABLE IF NOT EXISTS event_bus_reactions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      subscription_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT,
      output_json TEXT,
      FOREIGN KEY (event_id) REFERENCES event_bus_events(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_event_bus_reactions_event
      ON event_bus_reactions(event_id, started_at ASC, id ASC);
  `);
  const subscriptionColumns = db.prepare('PRAGMA table_info(event_bus_subscriptions)').all() as Array<{ name: string }>;
  if (!subscriptionColumns.some((column) => column.name === 'max_reactions_per_minute')) {
    db.exec('ALTER TABLE event_bus_subscriptions ADD COLUMN max_reactions_per_minute INTEGER');
  }
  dbCache.set(resolved, db);
  return db;
}

export function closeEventBusDbs(): void {
  for (const db of dbCache.values()) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // best effort
    }
    db.close();
  }
  dbCache.clear();
}

export function getEventBusDbPath(stateRoot?: string): string {
  return resolveRuntimeDbPath(stateRoot ?? resolveDaemonPaths(loadDaemonConfig().ipc.socketPath).root);
}

function rowToSubscription(row: EventBusSubscriptionRow): EventBusSubscription {
  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    enabled: row.enabled === 1,
    action: readActionJson(row.action_json),
    maxReactionsPerMinute: row.max_reactions_per_minute ?? undefined,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

function rowToDelayedEvent(row: EventBusDelayedEventRow): EventBusDelayedEvent {
  const parsed = JSON.parse(row.event_json) as EventBusEventInput;
  const status = row.status === 'emitted' || row.status === 'failed' || row.status === 'cancelled' ? row.status : 'pending';
  return {
    id: row.id,
    dueAt: normalizeTimestamp(row.due_at),
    status,
    event: parsed,
    createdAt: normalizeTimestamp(row.created_at),
    emittedEventId: row.emitted_event_id ?? undefined,
    error: row.error ?? undefined,
  };
}

function rowToReaction(row: EventBusReactionRow): EventBusReaction {
  return {
    id: row.id,
    eventId: row.event_id,
    subscriptionId: row.subscription_id,
    subscriptionName: row.subscription_name,
    actionType: row.action_type as EventBusAction['type'],
    status: row.status === 'failed' ? 'failed' : row.status === 'completed' ? 'completed' : 'pending',
    startedAt: normalizeTimestamp(row.started_at),
    completedAt: row.completed_at ? normalizeTimestamp(row.completed_at) : undefined,
    error: row.error ?? undefined,
    output: readObjectJson(row.output_json),
  };
}

function listReactionsForEvent(db: SqliteDatabase, eventId: string): EventBusReaction[] {
  const rows = db
    .prepare(
      `SELECT id, event_id, subscription_id, subscription_name, action_type, status, started_at, completed_at, error, output_json
       FROM event_bus_reactions
       WHERE event_id = ?
       ORDER BY started_at ASC, id ASC`,
    )
    .all(eventId) as EventBusReactionRow[];
  return rows.map(rowToReaction);
}

function rowToEvent(db: SqliteDatabase, row: EventBusEventRow): EventBusEvent {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    payload: readObjectJson(row.payload_json),
    metadata: readObjectJson(row.metadata_json),
    occurredAt: normalizeTimestamp(row.occurred_at),
    recordedAt: normalizeTimestamp(row.recorded_at),
    recorded: row.recorded === 1,
    replayOfEventId: row.replay_of_event_id ?? undefined,
    reactions: listReactionsForEvent(db, row.id),
  };
}

export function eventPatternMatches(pattern: string, eventType: string): boolean {
  const normalizedPattern = pattern.trim();
  if (normalizedPattern === '*') return true;
  if (normalizedPattern.endsWith('.*')) return eventType.startsWith(normalizedPattern.slice(0, -1));
  return normalizedPattern === eventType;
}

export function listEventBusSubscriptions(input: { dbPath?: string; enabledOnly?: boolean } = {}): EventBusSubscription[] {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const rows = (
    input.enabledOnly
      ? db
          .prepare(
            'SELECT id, name, pattern, enabled, action_json, max_reactions_per_minute, created_at, updated_at FROM event_bus_subscriptions WHERE enabled = 1 ORDER BY name COLLATE NOCASE ASC, id ASC',
          )
          .all()
      : db
          .prepare(
            'SELECT id, name, pattern, enabled, action_json, max_reactions_per_minute, created_at, updated_at FROM event_bus_subscriptions ORDER BY name COLLATE NOCASE ASC, id ASC',
          )
          .all()
  ) as EventBusSubscriptionRow[];
  return rows.map(rowToSubscription);
}

export function createEventBusSubscription(input: { dbPath?: string; subscription: EventBusSubscriptionInput }): EventBusSubscription {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const now = new Date().toISOString();
  const action = normalizeAction(input.subscription.action);
  const id = input.subscription.id?.trim() || `sub_${randomUUID()}`;
  const name = normalizeString(input.subscription.name, 'name');
  const pattern = normalizeString(input.subscription.pattern, 'pattern');
  const maxReactionsPerMinute = normalizePositiveInteger(input.subscription.maxReactionsPerMinute);
  assertSubscriptionDoesNotSelfPublish(pattern, action);
  db.prepare(
    `INSERT INTO event_bus_subscriptions (id, name, pattern, enabled, action_json, max_reactions_per_minute, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, pattern, input.subscription.enabled === false ? 0 : 1, JSON.stringify(action), maxReactionsPerMinute ?? null, now, now);
  return rowToSubscription(
    db
      .prepare(
        'SELECT id, name, pattern, enabled, action_json, max_reactions_per_minute, created_at, updated_at FROM event_bus_subscriptions WHERE id = ?',
      )
      .get(id) as EventBusSubscriptionRow,
  );
}

export function updateEventBusSubscription(input: {
  dbPath?: string;
  subscriptionId: string;
  patch: Partial<EventBusSubscriptionInput>;
}): EventBusSubscription {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const existing = db
    .prepare(
      'SELECT id, name, pattern, enabled, action_json, max_reactions_per_minute, created_at, updated_at FROM event_bus_subscriptions WHERE id = ?',
    )
    .get(input.subscriptionId) as EventBusSubscriptionRow | undefined;
  if (!existing) throw new Error(`Subscription not found: ${input.subscriptionId}`);
  const current = rowToSubscription(existing);
  const action = input.patch.action === undefined ? current.action : normalizeAction(input.patch.action);
  const name = input.patch.name === undefined ? current.name : normalizeString(input.patch.name, 'name');
  const pattern = input.patch.pattern === undefined ? current.pattern : normalizeString(input.patch.pattern, 'pattern');
  assertSubscriptionDoesNotSelfPublish(pattern, action);
  const enabled = input.patch.enabled ?? current.enabled;
  const maxReactionsPerMinute =
    input.patch.maxReactionsPerMinute === undefined
      ? current.maxReactionsPerMinute
      : normalizePositiveInteger(input.patch.maxReactionsPerMinute);
  const updatedAt = new Date().toISOString();
  db.prepare(
    `UPDATE event_bus_subscriptions
     SET name = ?, pattern = ?, enabled = ?, action_json = ?, max_reactions_per_minute = ?, updated_at = ?
     WHERE id = ?`,
  ).run(name, pattern, enabled ? 1 : 0, JSON.stringify(action), maxReactionsPerMinute ?? null, updatedAt, input.subscriptionId);
  return rowToSubscription(
    db
      .prepare(
        'SELECT id, name, pattern, enabled, action_json, max_reactions_per_minute, created_at, updated_at FROM event_bus_subscriptions WHERE id = ?',
      )
      .get(input.subscriptionId) as EventBusSubscriptionRow,
  );
}

export function deleteEventBusSubscription(input: { dbPath?: string; subscriptionId: string }): boolean {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const result = db.prepare('DELETE FROM event_bus_subscriptions WHERE id = ?').run(input.subscriptionId);
  return result.changes > 0;
}

export function listEventBusEvents(input: { dbPath?: string; limit?: number; type?: string } = {}): EventBusEvent[] {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
  const rows = (
    input.type
      ? db
          .prepare(
            `SELECT id, type, source, payload_json, metadata_json, occurred_at, recorded_at, recorded, replay_of_event_id
           FROM event_bus_events
           WHERE type = ?
           ORDER BY occurred_at DESC, recorded_at DESC, id DESC
           LIMIT ?`,
          )
          .all(input.type, limit)
      : db
          .prepare(
            `SELECT id, type, source, payload_json, metadata_json, occurred_at, recorded_at, recorded, replay_of_event_id
           FROM event_bus_events
           ORDER BY occurred_at DESC, recorded_at DESC, id DESC
           LIMIT ?`,
          )
          .all(limit)
  ) as EventBusEventRow[];
  return rows.map((row) => rowToEvent(db, row));
}

export function scheduleEventBusEvent(input: {
  dbPath?: string;
  id?: string;
  dueAt: string;
  event: EventBusEventInput;
}): EventBusDelayedEvent {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const id = input.id?.trim() || `delay_${randomUUID()}`;
  const dueAt = normalizeTimestamp(input.dueAt);
  const event: EventBusEventInput = {
    type: normalizeString(input.event.type, 'event type'),
    source: normalizeString(input.event.source, 'event source'),
    payload: normalizeRecord(input.event.payload),
    metadata: normalizeRecord(input.event.metadata),
    recorded: input.event.recorded !== false,
  };
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO event_bus_delayed_events (id, due_at, status, event_json, created_at)
     VALUES (?, ?, 'pending', ?, ?)`,
  ).run(id, dueAt, JSON.stringify(event), createdAt);
  return rowToDelayedEvent(
    db
      .prepare('SELECT id, due_at, status, event_json, created_at, emitted_event_id, error FROM event_bus_delayed_events WHERE id = ?')
      .get(id) as EventBusDelayedEventRow,
  );
}

export function listEventBusDelayedEvents(
  input: { dbPath?: string; includeCompleted?: boolean; limit?: number } = {},
): EventBusDelayedEvent[] {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
  const rows = (
    input.includeCompleted
      ? db
          .prepare(
            `SELECT id, due_at, status, event_json, created_at, emitted_event_id, error
             FROM event_bus_delayed_events
             ORDER BY due_at ASC, id ASC
             LIMIT ?`,
          )
          .all(limit)
      : db
          .prepare(
            `SELECT id, due_at, status, event_json, created_at, emitted_event_id, error
             FROM event_bus_delayed_events
             WHERE status = 'pending'
             ORDER BY due_at ASC, id ASC
             LIMIT ?`,
          )
          .all(limit)
  ) as EventBusDelayedEventRow[];
  return rows.map(rowToDelayedEvent);
}

export function cancelEventBusDelayedEvent(input: { dbPath?: string; delayedEventId: string }): boolean {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const result = db
    .prepare("UPDATE event_bus_delayed_events SET status = 'cancelled' WHERE id = ? AND status = 'pending'")
    .run(input.delayedEventId);
  return result.changes > 0;
}

export function pruneEventBusEvents(input: { dbPath?: string; olderThan?: string; keepLatest?: number } = {}): { deleted: number } {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  let deleted = 0;
  if (input.olderThan) {
    const cutoff = normalizeTimestamp(input.olderThan);
    deleted += db.prepare('DELETE FROM event_bus_events WHERE recorded_at < ?').run(cutoff).changes;
  }
  if (typeof input.keepLatest === 'number' && Number.isSafeInteger(input.keepLatest) && input.keepLatest >= 0) {
    deleted += db
      .prepare(
        `DELETE FROM event_bus_events
         WHERE id NOT IN (
           SELECT id FROM event_bus_events ORDER BY occurred_at DESC, recorded_at DESC, id DESC LIMIT ?
         )`,
      )
      .run(input.keepLatest).changes;
  }
  return { deleted };
}

function subscriptionRateLimited(db: SqliteDatabase, subscription: EventBusSubscription): boolean {
  if (!subscription.maxReactionsPerMinute) return false;
  const since = new Date(Date.now() - 60_000).toISOString();
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM event_bus_reactions WHERE subscription_id = ? AND started_at >= ?')
    .get(subscription.id, since) as { count?: number } | undefined;
  return (row?.count ?? 0) >= subscription.maxReactionsPerMinute;
}

function insertReaction(db: SqliteDatabase, event: EventBusEvent, subscription: EventBusSubscription): EventBusReaction {
  const reaction: EventBusReaction = {
    id: `rxn_${randomUUID()}`,
    eventId: event.id,
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
    actionType: subscription.action.type,
    status: 'pending',
    startedAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO event_bus_reactions (id, event_id, subscription_id, subscription_name, action_type, status, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    reaction.id,
    reaction.eventId,
    reaction.subscriptionId,
    reaction.subscriptionName,
    reaction.actionType,
    reaction.status,
    reaction.startedAt,
  );
  return reaction;
}

function finishReaction(db: SqliteDatabase, reaction: EventBusReaction, result: EventBusDispatchResult): EventBusReaction {
  const completedAt = new Date().toISOString();
  const status = result.status === 'failed' ? 'failed' : result.status === 'pending' ? 'pending' : 'completed';
  db.prepare(
    `UPDATE event_bus_reactions
     SET status = ?, completed_at = ?, error = ?, output_json = ?
     WHERE id = ?`,
  ).run(status, completedAt, result.error ?? null, JSON.stringify(result.output ?? {}), reaction.id);
  return {
    ...reaction,
    status,
    completedAt,
    error: result.error,
    output: result.output ?? {},
  };
}

async function dispatchEphemeralReaction(
  event: EventBusEvent,
  subscription: EventBusSubscription,
  dbPath?: string,
  dispatch?: (input: EventBusDispatchInput) => Promise<EventBusDispatchResult> | EventBusDispatchResult,
): Promise<EventBusReaction> {
  const reaction: EventBusReaction = {
    id: `rxn_${randomUUID()}`,
    eventId: event.id,
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
    actionType: subscription.action.type,
    status: 'pending',
    startedAt: new Date().toISOString(),
  };
  try {
    const result = dispatch
      ? await dispatch({ event: { ...event, dbPath }, subscription })
      : ({ status: 'pending' } satisfies EventBusDispatchResult);
    const status = result.status === 'failed' ? 'failed' : result.status === 'pending' ? 'pending' : 'completed';
    return {
      ...reaction,
      status,
      ...(status === 'pending' ? {} : { completedAt: new Date().toISOString() }),
      ...(result.error ? { error: result.error } : {}),
      output: result.output ?? {},
    };
  } catch (error) {
    return {
      ...reaction,
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: (error as Error).message,
      output: {},
    };
  }
}

export async function emitEventBusEvent(input: {
  dbPath?: string;
  event: EventBusEventInput;
  replayOfEventId?: string;
  dispatchDepth?: number;
  maxDispatchDepth?: number;
  dispatch?: (input: EventBusDispatchInput) => Promise<EventBusDispatchResult> | EventBusDispatchResult;
}): Promise<{ event: EventBusEvent; reactions: EventBusReaction[] }> {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const dispatchDepth = input.dispatchDepth ?? 0;
  const maxDispatchDepth = input.maxDispatchDepth ?? 8;
  if (dispatchDepth > maxDispatchDepth) {
    throw new Error(`Event bus dispatch depth exceeded ${maxDispatchDepth}.`);
  }
  const recordedAt = new Date().toISOString();
  const eventId = `evt_${randomUUID()}`;
  const type = normalizeString(input.event.type, 'event type');
  const event: EventBusEvent = {
    id: eventId,
    type,
    source: normalizeString(input.event.source, 'event source'),
    payload: normalizeRecord(input.event.payload),
    metadata: { ...normalizeRecord(input.event.metadata), dispatchDepth },
    occurredAt: normalizeTimestamp(input.event.occurredAt, recordedAt),
    recordedAt,
    recorded: input.event.recorded !== false,
    replayOfEventId: input.replayOfEventId ?? input.event.replayOfEventId,
    reactions: [],
  };

  const subscriptions = listEventBusSubscriptions({ dbPath: input.dbPath, enabledOnly: true }).filter((subscription) =>
    eventPatternMatches(subscription.pattern, event.type),
  );

  if (!event.recorded) {
    const ephemeralReactions: EventBusReaction[] = [];
    for (const subscription of subscriptions) {
      if (subscriptionRateLimited(db, subscription)) {
        ephemeralReactions.push({
          id: `rxn_${randomUUID()}`,
          eventId: event.id,
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          actionType: subscription.action.type,
          status: 'failed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          error: `Subscription rate limit exceeded: ${subscription.maxReactionsPerMinute}/minute.`,
          output: {},
        });
        continue;
      }
      ephemeralReactions.push(await dispatchEphemeralReaction(event, subscription, input.dbPath, input.dispatch));
    }
    return {
      event: { ...event, reactions: ephemeralReactions },
      reactions: ephemeralReactions,
    };
  }

  db.prepare(
    `INSERT INTO event_bus_events (id, type, source, payload_json, metadata_json, occurred_at, recorded_at, recorded, replay_of_event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.id,
    event.type,
    event.source,
    JSON.stringify(event.payload),
    JSON.stringify(event.metadata),
    event.occurredAt,
    event.recordedAt,
    1,
    event.replayOfEventId ?? null,
  );

  const reactions: EventBusReaction[] = [];
  for (const subscription of subscriptions) {
    if (subscriptionRateLimited(db, subscription)) {
      const pending = insertReaction(db, event, subscription);
      reactions.push(
        finishReaction(db, pending, {
          status: 'failed',
          error: `Subscription rate limit exceeded: ${subscription.maxReactionsPerMinute}/minute.`,
        }),
      );
      continue;
    }
    const pending = insertReaction(db, event, subscription);
    try {
      const result = input.dispatch
        ? await input.dispatch({ event: { ...event, dbPath: input.dbPath }, subscription })
        : ({ status: 'pending' } satisfies EventBusDispatchResult);
      reactions.push(finishReaction(db, pending, result));
    } catch (error) {
      reactions.push(finishReaction(db, pending, { status: 'failed', error: (error as Error).message }));
    }
  }

  return {
    event: { ...event, reactions },
    reactions,
  };
}

export async function processDueEventBusEvents(
  input: {
    dbPath?: string;
    now?: string;
    limit?: number;
    dispatch?: (input: EventBusDispatchInput) => Promise<EventBusDispatchResult> | EventBusDispatchResult;
  } = {},
): Promise<{ processed: number; emitted: EventBusEvent[]; failed: EventBusDelayedEvent[] }> {
  const dbPath = input.dbPath ?? getEventBusDbPath();
  const db = openEventBusDb(dbPath);
  const now = normalizeTimestamp(input.now);
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
  const rows = db
    .prepare(
      `SELECT id, due_at, status, event_json, created_at, emitted_event_id, error
       FROM event_bus_delayed_events
       WHERE status = 'pending' AND due_at <= ?
       ORDER BY due_at ASC, id ASC
       LIMIT ?`,
    )
    .all(now, limit) as EventBusDelayedEventRow[];

  const emitted: EventBusEvent[] = [];
  const failed: EventBusDelayedEvent[] = [];
  for (const row of rows) {
    const delayed = rowToDelayedEvent(row);
    try {
      const result = await emitEventBusEvent({
        dbPath,
        event: {
          ...delayed.event,
          metadata: {
            ...normalizeRecord(delayed.event.metadata),
            delayedEventId: delayed.id,
            scheduledFor: delayed.dueAt,
          },
        },
        dispatch: input.dispatch,
      });
      db.prepare("UPDATE event_bus_delayed_events SET status = 'emitted', emitted_event_id = ?, error = NULL WHERE id = ?").run(
        result.event.id,
        delayed.id,
      );
      emitted.push(result.event);
    } catch (error) {
      const message = (error as Error).message;
      db.prepare("UPDATE event_bus_delayed_events SET status = 'failed', error = ? WHERE id = ?").run(message, delayed.id);
      failed.push({ ...delayed, status: 'failed', error: message });
    }
  }

  return { processed: rows.length, emitted, failed };
}
