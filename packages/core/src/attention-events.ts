import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { getStateRoot } from './runtime/paths.js';

export const ATTENTION_EVENTS_STATE_FILE_NAME = 'attention-events-state.json';

export type AttentionEventStatus = 'scheduled' | 'ready' | 'delivering' | 'completed' | 'cancelled' | 'failed';
export type AttentionEventDeliveryMode = 'batchable' | 'sequential' | 'isolated';
export type AttentionEventPriority = 'low' | 'normal' | 'high';
export type AttentionEventBehavior = 'steer' | 'followUp';

export interface AttentionEventSource {
  kind: string;
  id?: string;
  extensionId?: string;
}

export interface AttentionEventContextMessage {
  customType: string;
  content: string;
}

export interface AttentionEventDelivery {
  mode: AttentionEventDeliveryMode;
  priority: AttentionEventPriority;
  requireAck: boolean;
  autoResumeIfOpen: boolean;
  behavior?: AttentionEventBehavior;
  batchKey?: string;
}

export interface AttentionEventRecord {
  id: string;
  conversationId?: string;
  sessionFile: string;
  title?: string;
  prompt: string;
  contextMessages?: AttentionEventContextMessage[];
  source: AttentionEventSource;
  status: AttentionEventStatus;
  dueAt: string;
  createdAt: string;
  readyAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  attempts: number;
  lastError?: string;
  delivery: AttentionEventDelivery;
}

export interface AttentionEventsStateFile {
  version: 1;
  events: Record<string, AttentionEventRecord>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeIsoTimestamp(value: unknown): string | undefined {
  const raw = toString(value);
  if (!raw) return undefined;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function normalizeAttempts(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeStatus(value: unknown): AttentionEventStatus {
  if (
    value === 'ready' ||
    value === 'delivering' ||
    value === 'completed' ||
    value === 'cancelled' ||
    value === 'failed' ||
    value === 'scheduled'
  ) {
    return value;
  }
  return 'scheduled';
}

function normalizeDeliveryMode(value: unknown): AttentionEventDeliveryMode {
  return value === 'sequential' || value === 'isolated' || value === 'batchable' ? value : 'batchable';
}

function normalizePriority(value: unknown): AttentionEventPriority {
  return value === 'low' || value === 'high' || value === 'normal' ? value : 'normal';
}

function normalizeBehavior(value: unknown): AttentionEventBehavior | undefined {
  return value === 'steer' || value === 'followUp' ? value : undefined;
}

function parseSource(value: unknown): AttentionEventSource | undefined {
  if (!isRecord(value)) return undefined;
  const kind = toString(value.kind);
  if (!kind) return undefined;
  const source: AttentionEventSource = { kind };
  const id = toString(value.id);
  const extensionId = toString(value.extensionId);
  if (id) source.id = id;
  if (extensionId) source.extensionId = extensionId;
  return source;
}

function parseContextMessages(value: unknown): AttentionEventContextMessage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const messages = value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const customType = toString(item.customType);
    const content = toString(item.content);
    return customType && content ? [{ customType, content }] : [];
  });
  return messages.length > 0 ? messages : undefined;
}

function parseDelivery(value: unknown): AttentionEventDelivery {
  const input = isRecord(value) ? value : {};
  const mode = normalizeDeliveryMode(input.mode);
  const delivery: AttentionEventDelivery = {
    mode,
    priority: normalizePriority(input.priority),
    requireAck: typeof input.requireAck === 'boolean' ? input.requireAck : mode === 'isolated',
    autoResumeIfOpen: typeof input.autoResumeIfOpen === 'boolean' ? input.autoResumeIfOpen : true,
  };
  const behavior = normalizeBehavior(input.behavior);
  const batchKey = toString(input.batchKey);
  if (behavior) delivery.behavior = behavior;
  if (batchKey) delivery.batchKey = batchKey;
  return delivery;
}

function parseRecord(value: unknown): AttentionEventRecord | undefined {
  if (!isRecord(value)) return undefined;
  const id = toString(value.id);
  const sessionFile = toString(value.sessionFile);
  const prompt = toString(value.prompt);
  const dueAt = normalizeIsoTimestamp(value.dueAt);
  const createdAt = normalizeIsoTimestamp(value.createdAt) ?? dueAt;
  const source = parseSource(value.source);
  if (!id || !sessionFile || !prompt || !dueAt || !createdAt || !source) return undefined;

  const record: AttentionEventRecord = {
    id,
    sessionFile,
    prompt,
    source,
    status: normalizeStatus(value.status),
    dueAt,
    createdAt,
    attempts: normalizeAttempts(value.attempts),
    delivery: parseDelivery(value.delivery),
  };

  const conversationId = toString(value.conversationId);
  const title = toString(value.title);
  const contextMessages = parseContextMessages(value.contextMessages);
  const lastError = toString(value.lastError);
  if (conversationId) record.conversationId = conversationId;
  if (title) record.title = title;
  if (contextMessages) record.contextMessages = contextMessages;
  if (lastError) record.lastError = lastError;

  for (const key of ['readyAt', 'deliveredAt', 'completedAt', 'cancelledAt', 'failedAt'] as const) {
    const timestamp = normalizeIsoTimestamp(value[key]);
    if (timestamp) record[key] = timestamp;
  }

  return record;
}

function compareAttentionEvents(left: AttentionEventRecord, right: AttentionEventRecord): number {
  const priorityRank: Record<AttentionEventPriority, number> = { high: 0, normal: 1, low: 2 };
  const priorityCompare = priorityRank[left.delivery.priority] - priorityRank[right.delivery.priority];
  if (priorityCompare !== 0) return priorityCompare;
  const leftTime = left.readyAt ?? left.dueAt;
  const rightTime = right.readyAt ?? right.dueAt;
  const timeCompare = leftTime.localeCompare(rightTime);
  if (timeCompare !== 0) return timeCompare;
  return left.id.localeCompare(right.id);
}

function sortEventIds(events: Record<string, AttentionEventRecord>): Record<string, AttentionEventRecord> {
  return Object.fromEntries(Object.entries(events).sort(([left], [right]) => left.localeCompare(right)));
}

export function createEmptyAttentionEventsState(): AttentionEventsStateFile {
  return { version: 1, events: {} };
}

export function resolveAttentionEventsStateFile(stateRoot = getStateRoot()): string {
  return join(stateRoot, 'pi-agent', ATTENTION_EVENTS_STATE_FILE_NAME);
}

export function loadAttentionEventsState(path = resolveAttentionEventsStateFile()): AttentionEventsStateFile {
  if (!existsSync(path)) return createEmptyAttentionEventsState();
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    if (!raw) return createEmptyAttentionEventsState();
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.events)) return createEmptyAttentionEventsState();
    const events: Record<string, AttentionEventRecord> = {};
    for (const value of Object.values(parsed.events)) {
      const record = parseRecord(value);
      if (record) events[record.id] = record;
    }
    return { version: 1, events: sortEventIds(events) };
  } catch {
    return createEmptyAttentionEventsState();
  }
}

export function saveAttentionEventsState(state: AttentionEventsStateFile, path = resolveAttentionEventsStateFile()): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify({ version: 1, events: sortEventIds(state.events) }, null, 2)}\n`);
}

const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 5_000;

function acquireAttentionEventsLock(lockPath: string): { release: () => void } {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      try {
        writeFileSync(lockPath, String(process.pid), 'utf-8');
      } catch {
        // best effort
      }
      closeSync(fd);
      return {
        release: () => {
          try {
            unlinkSync(lockPath);
          } catch {
            /* best effort */
          }
        },
      };
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== 'EEXIST') throw err;
      if (Date.now() > deadline) {
        try {
          const pid = Number(readFileSync(lockPath, 'utf-8').trim());
          if (Number.isFinite(pid) && pid > 0) {
            try {
              process.kill(pid, 0);
            } catch {
              try {
                unlinkSync(lockPath);
              } catch {
                /* best effort */
              }
              continue;
            }
          }
        } catch {
          try {
            unlinkSync(lockPath);
          } catch {
            /* best effort */
          }
          continue;
        }
        throw new Error(`Timed out waiting for attention events lock: ${lockPath}`);
      }
      const pollUntil = Date.now() + LOCK_RETRY_MS;
      while (Date.now() < pollUntil) {
        /* spin */
      }
    }
  }
}

export function withAttentionEventsLock<T>(fn: (state: AttentionEventsStateFile) => T, path?: string): T {
  const statePath = path ?? resolveAttentionEventsStateFile();
  const lock = acquireAttentionEventsLock(`${statePath}.lock`);
  try {
    const state = loadAttentionEventsState(statePath);
    const result = fn(state);
    saveAttentionEventsState(state, statePath);
    return result;
  } finally {
    lock.release();
  }
}

export function listAttentionEvents(state: AttentionEventsStateFile): AttentionEventRecord[] {
  return Object.values(state.events).sort(compareAttentionEvents);
}

export function getSessionAttentionEvents(state: AttentionEventsStateFile, sessionFile: string): AttentionEventRecord[] {
  return listAttentionEvents(state).filter((event) => event.sessionFile === sessionFile);
}

export function getReadySessionAttentionEvents(state: AttentionEventsStateFile, sessionFile: string): AttentionEventRecord[] {
  return getSessionAttentionEvents(state, sessionFile).filter((event) => event.status === 'ready');
}

export function scheduleAttentionEvent(
  state: AttentionEventsStateFile,
  event: Omit<AttentionEventRecord, 'status' | 'readyAt' | 'deliveredAt' | 'completedAt' | 'cancelledAt' | 'failedAt' | 'delivery'> & {
    delivery?: Partial<AttentionEventDelivery>;
  },
): AttentionEventRecord {
  const record: AttentionEventRecord = {
    ...event,
    status: 'scheduled',
    delivery: parseDelivery(event.delivery),
  };
  state.events[record.id] = record;
  return { ...record };
}

export function createReadyAttentionEvent(
  state: AttentionEventsStateFile,
  event: Omit<AttentionEventRecord, 'status' | 'deliveredAt' | 'completedAt' | 'cancelledAt' | 'failedAt' | 'delivery'> & {
    delivery?: Partial<AttentionEventDelivery>;
  },
): AttentionEventRecord {
  const readyAt = normalizeIsoTimestamp(event.readyAt) ?? normalizeIsoTimestamp(event.dueAt) ?? new Date().toISOString();
  const record: AttentionEventRecord = {
    ...event,
    readyAt,
    status: 'ready',
    delivery: parseDelivery(event.delivery),
  };
  state.events[record.id] = record;
  return { ...record };
}

export function activateDueAttentionEvents(
  state: AttentionEventsStateFile,
  input?: { at?: Date; sessionFile?: string },
): AttentionEventRecord[] {
  const at = input?.at ?? new Date();
  const nowMs = at.getTime();
  const activated: AttentionEventRecord[] = [];
  for (const event of listAttentionEvents(state)) {
    if (input?.sessionFile && event.sessionFile !== input.sessionFile) continue;
    if (event.status !== 'scheduled' || Date.parse(event.dueAt) > nowMs) continue;
    event.status = 'ready';
    event.readyAt = at.toISOString();
    activated.push({ ...event });
  }
  return activated.sort(compareAttentionEvents);
}

export function markAttentionEventsDelivering(
  state: AttentionEventsStateFile,
  input: { ids: string[]; deliveredAt?: string },
): AttentionEventRecord[] {
  const deliveredAt = normalizeIsoTimestamp(input.deliveredAt) ?? new Date().toISOString();
  return input.ids.flatMap((id) => {
    const event = state.events[id];
    if (!event || event.status !== 'ready') return [];
    event.status = 'delivering';
    event.deliveredAt = deliveredAt;
    return [{ ...event }];
  });
}

export function completeAttentionEvents(
  state: AttentionEventsStateFile,
  input: { ids: string[]; completedAt?: string },
): AttentionEventRecord[] {
  const completedAt = normalizeIsoTimestamp(input.completedAt) ?? new Date().toISOString();
  return input.ids.flatMap((id) => {
    const event = state.events[id];
    if (!event) return [];
    event.status = 'completed';
    event.completedAt = completedAt;
    return [{ ...event }];
  });
}

export function retryAttentionEvents(
  state: AttentionEventsStateFile,
  input: { ids: string[]; dueAt: string; lastError?: string },
): AttentionEventRecord[] {
  const dueAt = normalizeIsoTimestamp(input.dueAt);
  if (!dueAt) throw new Error(`Invalid attention event retry dueAt timestamp: ${input.dueAt}`);
  return input.ids.flatMap((id) => {
    const event = state.events[id];
    if (!event) return [];
    event.status = 'scheduled';
    event.dueAt = dueAt;
    event.attempts += 1;
    delete event.readyAt;
    delete event.deliveredAt;
    const lastError = toString(input.lastError);
    if (lastError) event.lastError = lastError;
    return [{ ...event }];
  });
}

export function cancelAttentionEvent(
  state: AttentionEventsStateFile,
  input: { id: string; cancelledAt?: string },
): AttentionEventRecord | undefined {
  const event = state.events[input.id];
  if (!event) return undefined;
  event.status = 'cancelled';
  event.cancelledAt = normalizeIsoTimestamp(input.cancelledAt) ?? new Date().toISOString();
  return { ...event };
}

export function groupAttentionEventsForDelivery(events: AttentionEventRecord[]): AttentionEventRecord[][] {
  const groups: AttentionEventRecord[][] = [];
  let batch: AttentionEventRecord[] = [];
  const flushBatch = () => {
    if (batch.length > 0) {
      groups.push(batch);
      batch = [];
    }
  };

  for (const event of [...events].sort(compareAttentionEvents)) {
    if (event.delivery.mode === 'batchable' && !event.delivery.requireAck) {
      batch.push(event);
      continue;
    }
    flushBatch();
    groups.push([event]);
  }

  flushBatch();
  return groups;
}
