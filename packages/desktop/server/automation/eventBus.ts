import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { SqliteDatabase } from '@neon-pilot/core';

import { resolveDaemonPaths } from '../paths.js';
import { resolveRuntimeDbPath } from '../runs/store.js';
import { openRecoveringRuntimeSqliteDb } from '../shared/sqliteRuntimeRecovery.js';

export type EventBusAction =
  | { type: 'run_task'; taskId: string }
  | { type: 'start_agent'; prompt: string; cwd?: string; model?: string }
  | { type: 'start_thread'; prompt: string; conversationId?: string; cwd?: string; model?: string }
  | { type: 'run_script'; command: string; cwd?: string }
  | { type: 'publish_event'; eventType: string; payload?: Record<string, unknown> };

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
  event: EventBusEvent;
  subscription: EventBusSubscription;
}

export interface EventBusDispatchResult {
  status: EventBusReactionStatus;
  output?: Record<string, unknown>;
  error?: string;
}

interface EventBusEventInput {
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
      };
    default:
      throw new Error('Unsupported event bus action type.');
  }
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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
  return resolveRuntimeDbPath(stateRoot ?? resolveDaemonPaths().root);
}

function rowToSubscription(row: EventBusSubscriptionRow): EventBusSubscription {
  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    enabled: row.enabled === 1,
    action: readActionJson(row.action_json),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
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
            'SELECT id, name, pattern, enabled, action_json, created_at, updated_at FROM event_bus_subscriptions WHERE enabled = 1 ORDER BY name COLLATE NOCASE ASC, id ASC',
          )
          .all()
      : db
          .prepare(
            'SELECT id, name, pattern, enabled, action_json, created_at, updated_at FROM event_bus_subscriptions ORDER BY name COLLATE NOCASE ASC, id ASC',
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
  assertSubscriptionDoesNotSelfPublish(pattern, action);
  db.prepare(
    `INSERT INTO event_bus_subscriptions (id, name, pattern, enabled, action_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, pattern, input.subscription.enabled === false ? 0 : 1, JSON.stringify(action), now, now);
  return rowToSubscription(
    db
      .prepare('SELECT id, name, pattern, enabled, action_json, created_at, updated_at FROM event_bus_subscriptions WHERE id = ?')
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
    .prepare('SELECT id, name, pattern, enabled, action_json, created_at, updated_at FROM event_bus_subscriptions WHERE id = ?')
    .get(input.subscriptionId) as EventBusSubscriptionRow | undefined;
  if (!existing) throw new Error(`Subscription not found: ${input.subscriptionId}`);
  const current = rowToSubscription(existing);
  const action = input.patch.action === undefined ? current.action : normalizeAction(input.patch.action);
  const name = input.patch.name === undefined ? current.name : normalizeString(input.patch.name, 'name');
  const pattern = input.patch.pattern === undefined ? current.pattern : normalizeString(input.patch.pattern, 'pattern');
  assertSubscriptionDoesNotSelfPublish(pattern, action);
  const enabled = input.patch.enabled ?? current.enabled;
  const updatedAt = new Date().toISOString();
  db.prepare(
    `UPDATE event_bus_subscriptions
     SET name = ?, pattern = ?, enabled = ?, action_json = ?, updated_at = ?
     WHERE id = ?`,
  ).run(name, pattern, enabled ? 1 : 0, JSON.stringify(action), updatedAt, input.subscriptionId);
  return rowToSubscription(
    db
      .prepare('SELECT id, name, pattern, enabled, action_json, created_at, updated_at FROM event_bus_subscriptions WHERE id = ?')
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
    const result = dispatch ? await dispatch({ event, subscription }) : ({ status: 'pending' } satisfies EventBusDispatchResult);
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
  dispatch?: (input: EventBusDispatchInput) => Promise<EventBusDispatchResult> | EventBusDispatchResult;
}): Promise<{ event: EventBusEvent; reactions: EventBusReaction[] }> {
  const db = openEventBusDb(input.dbPath ?? getEventBusDbPath());
  const recordedAt = new Date().toISOString();
  const eventId = `evt_${randomUUID()}`;
  const type = normalizeString(input.event.type, 'event type');
  const event: EventBusEvent = {
    id: eventId,
    type,
    source: normalizeString(input.event.source, 'event source'),
    payload: normalizeRecord(input.event.payload),
    metadata: normalizeRecord(input.event.metadata),
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
      ephemeralReactions.push(await dispatchEphemeralReaction(event, subscription, input.dispatch));
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
    const pending = insertReaction(db, event, subscription);
    try {
      const result = input.dispatch
        ? await input.dispatch({ event, subscription })
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
