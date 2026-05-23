import type { SqliteDatabase } from '@neon-pilot/core';

export type AutomationActivityKind = 'missed' | 'run-failed';
export type AutomationActivityOutcome = 'skipped' | 'catch-up-started';

interface AutomationMissedActivityEntry {
  id: string;
  automationId: string;
  kind: 'missed';
  createdAt: string;
  count: number;
  firstScheduledAt: string;
  lastScheduledAt: string;
  exampleScheduledAt: string[];
  outcome: AutomationActivityOutcome;
}

interface AutomationRunFailedActivityEntry {
  id: string;
  automationId: string;
  kind: 'run-failed';
  createdAt: string;
  message: string;
}

export type AutomationActivityEntry = AutomationMissedActivityEntry | AutomationRunFailedActivityEntry;
export type AutomationActivityEntryInput =
  | Omit<AutomationMissedActivityEntry, 'id' | 'automationId'>
  | Omit<AutomationRunFailedActivityEntry, 'id' | 'automationId'>;

type AutomationActivityRow = {
  seq: number;
  automation_id: string;
  kind: string;
  created_at: string;
  payload_json: string | null;
};

const AUTOMATION_ACTIVITY_RETENTION_LIMIT = 100;

function readOptionalString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function readRequiredString(value: string | null | undefined, label: string): string {
  const normalized = readOptionalString(value);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeIsoTimestamp(raw: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) {
    return undefined;
  }

  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const normalized = new Date(parsed).toISOString();
  return normalized === raw || normalized === raw.replace('Z', '.000Z') ? normalized : undefined;
}

function readAutomationActivityTimestamp(value: string | null | undefined, label: string): string {
  const raw = readRequiredString(value, label);
  const normalized = normalizeIsoTimestamp(raw);
  if (!normalized) {
    throw new Error(`Automation activity ${label} must be a valid timestamp.`);
  }

  return normalized;
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function rowToAutomationActivityEntry(row: AutomationActivityRow): AutomationActivityEntry | undefined {
  const payload = parseJsonRecord(row.payload_json);
  const createdAt = normalizeIsoTimestamp(row.created_at);
  if (!createdAt) {
    return undefined;
  }

  if (row.kind === 'run-failed') {
    const message = typeof payload?.message === 'string' ? readOptionalString(payload.message) : undefined;
    if (!message) {
      return undefined;
    }

    return {
      id: `${row.automation_id}:${row.seq}`,
      automationId: row.automation_id,
      kind: 'run-failed',
      createdAt,
      message,
    };
  }

  const count = typeof payload?.count === 'number' && Number.isSafeInteger(payload.count) && payload.count > 0 ? payload.count : undefined;
  const firstScheduledAt = typeof payload?.firstScheduledAt === 'string' ? normalizeIsoTimestamp(payload.firstScheduledAt) : undefined;
  const lastScheduledAt = typeof payload?.lastScheduledAt === 'string' ? normalizeIsoTimestamp(payload.lastScheduledAt) : undefined;
  const exampleScheduledAt = Array.isArray(payload?.exampleScheduledAt)
    ? payload.exampleScheduledAt.flatMap((value): string[] => {
        if (typeof value !== 'string') {
          return [];
        }
        const normalized = normalizeIsoTimestamp(value);
        return normalized ? [normalized] : [];
      })
    : [];
  const outcome = payload?.outcome === 'catch-up-started' || payload?.outcome === 'skipped' ? payload.outcome : undefined;

  if (row.kind !== 'missed' || !count || !firstScheduledAt || !lastScheduledAt || !outcome) {
    return undefined;
  }

  return {
    id: `${row.automation_id}:${row.seq}`,
    automationId: row.automation_id,
    kind: 'missed',
    createdAt,
    count,
    firstScheduledAt,
    lastScheduledAt,
    exampleScheduledAt,
    outcome,
  };
}

function readActivityRowBySeq(db: SqliteDatabase, seq: number | bigint | undefined): AutomationActivityEntry {
  if (seq === undefined) {
    throw new Error('Failed to allocate automation activity entry id.');
  }

  const row = db
    .prepare(
      `
    SELECT seq, automation_id, kind, created_at, payload_json
    FROM automation_activity
    WHERE seq = ?
  `,
    )
    .get(seq) as AutomationActivityRow | undefined;
  const entry = row ? rowToAutomationActivityEntry(row) : undefined;
  if (!entry) {
    throw new Error('Failed to read automation activity entry after insert.');
  }

  return entry;
}

function trimAutomationActivityEntries(db: SqliteDatabase, automationId: string): void {
  db.prepare(
    `
    DELETE FROM automation_activity
    WHERE automation_id = ?
      AND seq NOT IN (
        SELECT seq
        FROM automation_activity
        WHERE automation_id = ?
        ORDER BY created_at DESC, seq DESC
        LIMIT ?
      )
  `,
  ).run(automationId, automationId, AUTOMATION_ACTIVITY_RETENTION_LIMIT);
}

export function listAutomationActivityEntriesFromDb(
  db: SqliteDatabase,
  automationId: string,
  options: { limit?: number } = {},
): AutomationActivityEntry[] {
  const normalizedAutomationId = readRequiredString(automationId, 'automationId');
  const limit =
    typeof options.limit === 'number' && Number.isSafeInteger(options.limit) && options.limit > 0 ? Math.min(200, options.limit) : 20;
  const rows = db
    .prepare(
      `
    SELECT seq, automation_id, kind, created_at, payload_json
    FROM automation_activity
    WHERE automation_id = ?
    ORDER BY created_at DESC, seq DESC
    LIMIT ?
  `,
    )
    .all(normalizedAutomationId, limit) as AutomationActivityRow[];

  return rows.map((row) => rowToAutomationActivityEntry(row)).filter((entry): entry is AutomationActivityEntry => entry !== undefined);
}

export function appendAutomationActivityEntryToDb(
  db: SqliteDatabase,
  automationId: string,
  input: AutomationActivityEntryInput,
): AutomationActivityEntry {
  const normalizedAutomationId = readRequiredString(automationId, 'automationId');
  const existing = db.prepare('SELECT id FROM automations WHERE id = ?').get(normalizedAutomationId) as { id: string } | undefined;
  if (!existing) {
    throw new Error(`Automation not found: ${normalizedAutomationId}`);
  }

  const createdAt = readAutomationActivityTimestamp(input.createdAt, 'createdAt');
  const insert = db.prepare(`
    INSERT INTO automation_activity (automation_id, kind, created_at, payload_json)
    VALUES (?, ?, ?, ?)
  `);

  if (input.kind === 'run-failed') {
    const message = readRequiredString(input.message, 'message');
    let insertedSeq: number | bigint | undefined;
    db.transaction(() => {
      const insertResult = insert.run(normalizedAutomationId, 'run-failed', createdAt, JSON.stringify({ message })) as {
        lastInsertRowid?: number | bigint;
      };
      insertedSeq = insertResult.lastInsertRowid;
      trimAutomationActivityEntries(db, normalizedAutomationId);
    })();

    return readActivityRowBySeq(db, insertedSeq);
  }

  if (!Number.isSafeInteger(input.count) || input.count <= 0) {
    throw new Error('Automation activity count must be a positive integer.');
  }

  const firstScheduledAt = readAutomationActivityTimestamp(input.firstScheduledAt, 'firstScheduledAt');
  const lastScheduledAt = readAutomationActivityTimestamp(input.lastScheduledAt, 'lastScheduledAt');
  const exampleScheduledAt = input.exampleScheduledAt.flatMap((value) =>
    typeof value === 'string' ? (normalizeIsoTimestamp(value) ?? []) : [],
  );
  if (input.outcome !== 'skipped' && input.outcome !== 'catch-up-started') {
    throw new Error(`Unsupported automation activity outcome: ${input.outcome}`);
  }

  let insertedSeq: number | bigint | undefined;
  db.transaction(() => {
    const insertResult = insert.run(
      normalizedAutomationId,
      'missed',
      createdAt,
      JSON.stringify({
        count: input.count,
        firstScheduledAt,
        lastScheduledAt,
        exampleScheduledAt,
        outcome: input.outcome,
      }),
    ) as { lastInsertRowid?: number | bigint };
    insertedSeq = insertResult.lastInsertRowid;
    trimAutomationActivityEntries(db, normalizedAutomationId);
  })();

  return readActivityRowBySeq(db, insertedSeq);
}
