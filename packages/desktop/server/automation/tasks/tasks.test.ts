import {
  getAlert,
  listProfileActivityEntries,
  loadAttentionEventsState,
  openSqliteDatabase,
  setTaskCallbackBinding,
} from '@neon-pilot/core';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { startBackgroundRunMock, startScheduledTaskRunMock } = vi.hoisted(() => ({
  startBackgroundRunMock: vi.fn(),
  startScheduledTaskRunMock: vi.fn(),
}));

vi.mock('../../daemon/client.js', () => ({
  startBackgroundRun: startBackgroundRunMock,
  startScheduledTaskRun: startScheduledTaskRunMock,
}));

import type { DaemonEvent, DaemonPaths, EventPayload } from '../../daemon/types.js';
import {
  createDurableRunManifest,
  createInitialDurableRunStatus,
  loadDurableRunManifest,
  loadDurableRunStatus,
  resolveDurableRunPaths,
  resolveDurableRunsRoot,
  resolveRuntimeDbPath,
  saveDurableRunManifest,
  saveDurableRunStatus,
} from '../../runs/store.js';
import { subscribeAppEvents } from '../../shared/appEvents.js';
import { getRuntimeSettingsFilePath } from '../../ui/settingsPersistence.js';
import { readSavedUiPreferences, writeSavedUiPreferences } from '../../ui/uiPreferences.js';
import type { DaemonConfig } from '../config.js';
import {
  appendAutomationActivityEntry,
  closeAutomationDbs,
  createStoredAutomation,
  DEFAULT_CRON_CATCH_UP_WINDOW_SECONDS,
  deleteStoredAutomation,
  listAutomationActivityEntries,
  listStoredAutomations,
  loadAutomationRuntimeStateMap,
  loadAutomationSchedulerState,
  saveAutomationRuntimeStateMap,
  saveAutomationSchedulerState,
  setStoredAutomationThreadBinding,
} from '../store.js';
import { ensureAutomationThread } from '../threads.js';
import { createTasksModule } from './tasks.js';
import type { TaskRunRequest, TaskRunResult } from './tasks-runner.js';
import type { DaemonModuleContext } from './types.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function seedAutomation(
  stateRoot: string,
  input: {
    id: string;
    title?: string;
    cron?: string;
    at?: string;
    prompt?: string;
    enabled?: boolean;
    cwd?: string;
    modelRef?: string;
    timeoutSeconds?: number;
    catchUpWindowSeconds?: number;
  },
) {
  return createStoredAutomation({
    id: input.id,
    title: input.title ?? input.id,
    enabled: input.enabled ?? true,
    cron: input.cron,
    at: input.at,
    prompt: input.prompt ?? input.title ?? input.id,
    cwd: input.cwd,
    modelRef: input.modelRef,
    timeoutSeconds: input.timeoutSeconds ?? 1800,
    catchUpWindowSeconds: input.catchUpWindowSeconds,
    dbPath: resolveRuntimeDbPath(stateRoot),
  });
}

function createTimerEvent(): DaemonEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    version: 1,
    type: 'timer.tasks.tick',
    source: 'test',
    timestamp: new Date().toISOString(),
    payload: {
      timer: 'tasks-tick',
    },
  };
}

function createRequestedTaskRunEvent(taskId: string, runId?: string): DaemonEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    version: 1,
    type: 'tasks.run.requested',
    source: 'test',
    timestamp: new Date().toISOString(),
    payload: {
      taskId,
      ...(runId ? { runId } : {}),
    },
  };
}

interface PublishedEvent {
  type: string;
  payload?: EventPayload;
}

function createContext(
  taskDir: string,
  stateRoot: string,
): {
  context: DaemonModuleContext;
  published: PublishedEvent[];
} {
  const daemonConfig: DaemonConfig = {
    logLevel: 'error',
    queue: { maxDepth: 100 },
    ipc: {},
    modules: {
      maintenance: {
        enabled: false,
        cleanupIntervalMinutes: 60,
      },
      tasks: {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
    },
  };

  const paths: DaemonPaths = {
    stateRoot,
    root: stateRoot,
    socketPath: join(stateRoot, 'daemon.sock'),
    pidFile: join(stateRoot, 'daemon.pid'),
    logDir: join(stateRoot, 'logs'),
    logFile: join(stateRoot, 'logs', 'daemon.log'),
  };

  mkdirSync(paths.logDir, { recursive: true });

  const published: PublishedEvent[] = [];

  return {
    context: {
      config: daemonConfig,
      paths,
      publish: (type, payload) => {
        published.push({ type, payload });
        return true;
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    },
    published,
  };
}

async function waitForCondition(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!check()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function createRunResult(request: TaskRunRequest, success: boolean, nowIso: string, error?: string, outputText?: string): TaskRunResult {
  return {
    success,
    startedAt: nowIso,
    endedAt: nowIso,
    exitCode: success ? 0 : 1,
    signal: null,
    timedOut: false,
    cancelled: false,
    logPath: join(request.runsRoot, `${request.task.id}-attempt-${request.attempt}.log`),
    error,
    outputText,
  };
}

describe('tasks module scheduling', () => {
  afterEach(async () => {
    startBackgroundRunMock.mockReset();
    startScheduledTaskRunMock.mockReset();
    closeAutomationDbs();
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('opens a fresh runtime sqlite database without creating migration backups', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    expect(listStoredAutomations({ dbPath })).toEqual([]);

    const db = openSqliteDatabase(dbPath);
    try {
      expect(db.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 5 });
    } finally {
      db.close();
    }
    expect(existsSync(join(stateRoot, '.backups'))).toBe(false);
  });

  it('migrates legacy automation profile columns to shared runtime scope', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    const legacyDb = openSqliteDatabase(dbPath);
    legacyDb.exec(`
      CREATE TABLE automations (
        id TEXT PRIMARY KEY,
        profile TEXT NOT NULL,
        title TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        schedule_type TEXT NOT NULL,
        cron TEXT,
        at TEXT,
        prompt TEXT NOT NULL,
        cwd TEXT,
        model_ref TEXT,
        timeout_seconds INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        legacy_file_path TEXT
      );
    `);
    legacyDb
      .prepare(
        'INSERT INTO automations (id, profile, title, enabled, schedule_type, cron, prompt, timeout_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'legacy-task',
        'datadog',
        'Legacy task',
        1,
        'cron',
        '0 * * * *',
        'Run legacy task.',
        1800,
        '2026-03-02T10:00:00.000Z',
        '2026-03-02T10:00:00.000Z',
      );
    legacyDb.exec(`
      CREATE TABLE automation_state (
        automation_id TEXT PRIMARY KEY,
        running INTEGER NOT NULL DEFAULT 0,
        running_started_at TEXT,
        active_run_id TEXT,
        last_run_id TEXT,
        last_status TEXT,
        last_run_at TEXT,
        last_success_at TEXT,
        last_failure_at TEXT,
        last_error TEXT,
        last_log_path TEXT,
        last_scheduled_minute TEXT,
        last_attempt_count INTEGER,
        one_time_resolved_at TEXT,
        one_time_resolved_status TEXT,
        one_time_completed_at TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );
      CREATE TABLE automation_activity (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );
    `);
    legacyDb
      .prepare('INSERT INTO automation_state (automation_id, running, last_status, last_run_at) VALUES (?, ?, ?, ?)')
      .run('legacy-task', 0, 'success', '2026-03-02T11:00:00.000Z');
    legacyDb
      .prepare('INSERT INTO automation_activity (automation_id, kind, created_at, payload_json) VALUES (?, ?, ?, ?)')
      .run('legacy-task', 'run-failed', '2026-03-02T12:00:00.000Z', JSON.stringify({ message: 'boom' }));
    legacyDb.close();

    const automations = listStoredAutomations({ dbPath });
    expect(automations[0]).toEqual(
      expect.objectContaining({
        id: 'legacy-task',
        profile: 'shared',
        runtimeScope: 'shared',
        catchUpWindowSeconds: DEFAULT_CRON_CATCH_UP_WINDOW_SECONDS,
      }),
    );

    expect(loadAutomationRuntimeStateMap({ dbPath })['legacy-task']).toEqual(
      expect.objectContaining({
        id: 'legacy-task',
        lastStatus: 'success',
      }),
    );
    expect(listAutomationActivityEntries('legacy-task', { dbPath })).toEqual([
      expect.objectContaining({
        automationId: 'legacy-task',
        kind: 'run-failed',
      }),
    ]);

    const migratedDb = openSqliteDatabase(dbPath);
    const columns = migratedDb.prepare('PRAGMA table_info(automations)').all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain('runtime_scope');
    expect(columns.map((column) => column.name)).not.toContain('profile');
    expect(columns.map((column) => column.name)).not.toContain('legacy_file_path');
    const childTableSql = migratedDb
      .prepare(
        "SELECT group_concat(sql, '\n') AS sql FROM sqlite_master WHERE type = 'table' AND name IN ('automation_state', 'automation_activity')",
      )
      .get() as { sql: string };
    expect(childTableSql.sql).not.toContain('automations_legacy_profile');
    expect(childTableSql.sql).not.toContain('automations_migrate_');
    expect(childTableSql.sql).toContain('REFERENCES automations(id)');
    expect(migratedDb.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    migratedDb.close();
  });

  it('repairs stale automation child foreign keys left by an interrupted migration', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    const staleDb = openSqliteDatabase(dbPath);
    staleDb.exec(`
      PRAGMA foreign_keys = OFF;
      PRAGMA user_version = 5;
      CREATE TABLE automations (
        id TEXT PRIMARY KEY,
        runtime_scope TEXT NOT NULL DEFAULT 'shared',
        title TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        schedule_type TEXT NOT NULL,
        cron TEXT,
        at TEXT,
        prompt TEXT NOT NULL,
        cwd TEXT,
        model_ref TEXT,
        thinking_level TEXT,
        allowed_tools_json TEXT,
        timeout_seconds INTEGER NOT NULL,
        catch_up_window_seconds INTEGER,
        policies_json TEXT,
        target_type TEXT NOT NULL DEFAULT 'background-agent',
        conversation_behavior TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        thread_mode TEXT NOT NULL DEFAULT 'dedicated',
        thread_session_file TEXT,
        thread_conversation_id TEXT
      );
      INSERT INTO automations (id, runtime_scope, title, enabled, schedule_type, cron, prompt, timeout_seconds, created_at, updated_at)
      VALUES ('stale-fk-task', 'shared', 'Stale FK task', 1, 'cron', '0 * * * *', 'Run stale FK task.', 1800, '2026-03-02T10:00:00.000Z', '2026-03-02T10:00:00.000Z');
      CREATE TABLE automation_state (
        automation_id TEXT PRIMARY KEY,
        running INTEGER NOT NULL DEFAULT 0,
        running_started_at TEXT,
        active_run_id TEXT,
        last_run_id TEXT,
        last_status TEXT,
        last_run_at TEXT,
        last_success_at TEXT,
        last_failure_at TEXT,
        last_error TEXT,
        last_log_path TEXT,
        last_scheduled_minute TEXT,
        last_attempt_count INTEGER,
        one_time_resolved_at TEXT,
        one_time_resolved_status TEXT,
        one_time_completed_at TEXT,
        FOREIGN KEY (automation_id) REFERENCES "automations_migrate_12345"(id) ON DELETE CASCADE
      );
      INSERT INTO automation_state (automation_id, running, last_status, last_run_at)
      VALUES ('stale-fk-task', 0, 'success', '2026-03-02T11:00:00.000Z');
      CREATE TABLE automation_activity (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT,
        FOREIGN KEY (automation_id) REFERENCES "automations_migrate_12345"(id) ON DELETE CASCADE
      );
      INSERT INTO automation_activity (automation_id, kind, created_at, payload_json)
      VALUES ('stale-fk-task', 'run-failed', '2026-03-02T12:00:00.000Z', '{"message":"stale"}');
      PRAGMA foreign_keys = ON;
    `);
    staleDb.close();

    expect(listStoredAutomations({ dbPath })[0]).toEqual(expect.objectContaining({ id: 'stale-fk-task' }));
    expect(loadAutomationRuntimeStateMap({ dbPath })['stale-fk-task']).toEqual(expect.objectContaining({ lastStatus: 'success' }));
    expect(listAutomationActivityEntries('stale-fk-task', { dbPath })).toEqual([
      expect.objectContaining({ automationId: 'stale-fk-task', kind: 'run-failed' }),
    ]);

    const repairedDb = openSqliteDatabase(dbPath);
    const childTableSql = repairedDb
      .prepare(
        "SELECT group_concat(sql, '\n') AS sql FROM sqlite_master WHERE type = 'table' AND name IN ('automation_state', 'automation_activity')",
      )
      .get() as { sql: string };
    expect(childTableSql.sql).not.toContain('automations_migrate_');
    expect(childTableSql.sql).toContain('REFERENCES automations(id)');
    expect(repairedDb.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    repairedDb.close();
  });

  it('deletes automation child rows when removing an automation', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    seedAutomation(stateRoot, { id: 'cleanup-children', title: 'Cleanup children', cron: '0 * * * *', prompt: 'Clean child rows' });

    saveAutomationRuntimeStateMap(
      {
        'cleanup-children': {
          id: 'cleanup-children',
          key: 'cleanup-children',
          filePath: '/__automations__/cleanup-children.automation.md',
          scheduleType: 'cron',
          running: false,
          lastStatus: 'failed',
          lastRunAt: '2026-03-02T12:00:00.000Z',
        },
      },
      { dbPath },
    );
    appendAutomationActivityEntry(
      'cleanup-children',
      {
        kind: 'run-failed',
        createdAt: '2026-03-02T12:00:00.000Z',
        message: 'failed before cleanup',
      },
      { dbPath },
    );

    expect(deleteStoredAutomation('cleanup-children', { dbPath })).toBe(true);
    expect(listStoredAutomations({ dbPath }).map((task) => task.id)).not.toContain('cleanup-children');
    expect(loadAutomationRuntimeStateMap({ dbPath })['cleanup-children']).toBeUndefined();
    expect(listAutomationActivityEntries('cleanup-children', { dbPath })).toEqual([]);

    const db = openSqliteDatabase(dbPath);
    try {
      expect(db.prepare('SELECT COUNT(*) AS count FROM automation_state WHERE automation_id = ?').get('cleanup-children')).toEqual({
        count: 0,
      });
      expect(db.prepare('SELECT COUNT(*) AS count FROM automation_activity WHERE automation_id = ?').get('cleanup-children')).toEqual({
        count: 0,
      });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('prunes orphan automation child rows left by earlier startup cleanup', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    const orphanDb = openSqliteDatabase(dbPath);
    orphanDb.exec(`
      PRAGMA foreign_keys = OFF;
      PRAGMA user_version = 5;
      CREATE TABLE automations (
        id TEXT PRIMARY KEY,
        runtime_scope TEXT NOT NULL DEFAULT 'shared',
        title TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        schedule_type TEXT NOT NULL,
        cron TEXT,
        at TEXT,
        prompt TEXT NOT NULL,
        cwd TEXT,
        model_ref TEXT,
        thinking_level TEXT,
        timeout_seconds INTEGER NOT NULL,
        catch_up_window_seconds INTEGER,
        policies_json TEXT,
        target_type TEXT NOT NULL DEFAULT 'background-agent',
        conversation_behavior TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        thread_mode TEXT NOT NULL DEFAULT 'dedicated',
        thread_session_file TEXT,
        thread_conversation_id TEXT,
        allowed_tools_json TEXT
      );
      CREATE TABLE automation_state (
        automation_id TEXT PRIMARY KEY,
        running INTEGER NOT NULL DEFAULT 0,
        running_started_at TEXT,
        active_run_id TEXT,
        last_run_id TEXT,
        last_status TEXT,
        last_run_at TEXT,
        last_success_at TEXT,
        last_failure_at TEXT,
        last_error TEXT,
        last_log_path TEXT,
        last_scheduled_minute TEXT,
        last_attempt_count INTEGER,
        one_time_resolved_at TEXT,
        one_time_resolved_status TEXT,
        one_time_completed_at TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );
      CREATE TABLE automation_activity (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );
      INSERT INTO automation_state (automation_id, running, last_status, last_run_at)
      VALUES ('orphaned-task', 0, 'failed', '2026-03-02T11:00:00.000Z');
      INSERT INTO automation_activity (automation_id, kind, created_at, payload_json)
      VALUES ('orphaned-task', 'run-failed', '2026-03-02T12:00:00.000Z', '{"message":"orphaned"}');
      PRAGMA foreign_keys = ON;
    `);
    orphanDb.close();

    expect(listStoredAutomations({ dbPath })).toEqual([]);
    expect(loadAutomationRuntimeStateMap({ dbPath })['orphaned-task']).toBeUndefined();
    expect(listAutomationActivityEntries('orphaned-task', { dbPath })).toEqual([]);

    const repairedDb = openSqliteDatabase(dbPath);
    try {
      expect(repairedDb.prepare('SELECT COUNT(*) AS count FROM automation_state').get()).toEqual({ count: 0 });
      expect(repairedDb.prepare('SELECT COUNT(*) AS count FROM automation_activity').get()).toEqual({ count: 0 });
      expect(repairedDb.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      repairedDb.close();
    }
  });

  it('prunes orphan legacy automation children before profile migrations validate foreign keys', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    const legacyDb = openSqliteDatabase(dbPath);
    legacyDb.exec(`
      PRAGMA foreign_keys = OFF;
      PRAGMA user_version = 0;
      CREATE TABLE automations (
        id TEXT PRIMARY KEY,
        profile TEXT NOT NULL,
        title TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        schedule_type TEXT NOT NULL,
        cron TEXT,
        at TEXT,
        prompt TEXT NOT NULL,
        cwd TEXT,
        model_ref TEXT,
        timeout_seconds INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE automation_state (
        automation_id TEXT PRIMARY KEY,
        running INTEGER NOT NULL DEFAULT 0,
        running_started_at TEXT,
        active_run_id TEXT,
        last_run_id TEXT,
        last_status TEXT,
        last_run_at TEXT,
        last_success_at TEXT,
        last_failure_at TEXT,
        last_error TEXT,
        last_log_path TEXT,
        last_scheduled_minute TEXT,
        last_attempt_count INTEGER,
        one_time_resolved_at TEXT,
        one_time_resolved_status TEXT,
        one_time_completed_at TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );
      CREATE TABLE automation_activity (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );
      INSERT INTO automations (id, profile, title, enabled, schedule_type, cron, prompt, timeout_seconds, created_at, updated_at)
      VALUES ('legacy-task', 'shared', 'Legacy task', 1, 'cron', '*/15 * * * *', 'Run legacy task.', 1200, '2026-03-02T10:00:00.000Z', '2026-03-02T10:00:00.000Z');
      INSERT INTO automation_state (automation_id, running, last_status, last_run_at)
      VALUES ('legacy-task', 0, 'success', '2026-03-02T11:00:00.000Z');
      INSERT INTO automation_activity (automation_id, kind, created_at, payload_json)
      VALUES ('legacy-task', 'run-failed', '2026-03-02T12:00:00.000Z', '{"message":"kept"}');
      INSERT INTO automation_activity (automation_id, kind, created_at, payload_json)
      VALUES ('missing-legacy-task', 'run-failed', '2026-03-02T12:30:00.000Z', '{"message":"orphaned"}');
      PRAGMA foreign_keys = ON;
    `);
    legacyDb.close();

    expect(listStoredAutomations({ dbPath })).toEqual([
      expect.objectContaining({
        id: 'legacy-task',
        profile: 'shared',
        runtimeScope: 'shared',
      }),
    ]);
    expect(loadAutomationRuntimeStateMap({ dbPath })['legacy-task']).toEqual(expect.objectContaining({ id: 'legacy-task' }));
    expect(listAutomationActivityEntries('legacy-task', { dbPath })).toEqual([
      expect.objectContaining({
        automationId: 'legacy-task',
        kind: 'run-failed',
      }),
    ]);
    expect(listAutomationActivityEntries('missing-legacy-task', { dbPath })).toEqual([]);

    const migratedDb = openSqliteDatabase(dbPath);
    try {
      expect(migratedDb.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
      expect(migratedDb.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(migratedDb.prepare('PRAGMA user_version').get()).toEqual({ user_version: 5 });
    } finally {
      migratedDb.close();
    }
  });

  it('rejects fractional automation timeouts when storing tasks', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    expect(() =>
      createStoredAutomation({
        dbPath,
        id: 'fractional-timeout',
        title: 'Fractional timeout',
        enabled: true,
        cron: '0 * * * *',
        timeoutSeconds: 1.5,
        prompt: 'Run maintenance.',
      }),
    ).toThrow('timeoutSeconds must be a positive integer.');
  });

  it('rejects unsafe automation durations when storing tasks', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    expect(() =>
      createStoredAutomation({
        dbPath,
        id: 'unsafe-timeout',
        title: 'Unsafe timeout',
        enabled: true,
        cron: '0 * * * *',
        timeoutSeconds: Number.MAX_SAFE_INTEGER + 1,
        prompt: 'Run maintenance.',
      }),
    ).toThrow('timeoutSeconds must be a positive integer.');

    expect(() =>
      createStoredAutomation({
        dbPath,
        id: 'huge-timeout',
        title: 'Huge timeout',
        enabled: true,
        cron: '0 * * * *',
        timeoutSeconds: Number.MAX_SAFE_INTEGER,
        prompt: 'Run maintenance.',
      }),
    ).toThrow('timeoutSeconds must be a positive integer.');

    expect(() =>
      createStoredAutomation({
        dbPath,
        id: 'unsafe-catch-up',
        title: 'Unsafe catch-up',
        enabled: true,
        cron: '0 * * * *',
        timeoutSeconds: 60,
        catchUpWindowSeconds: Number.MAX_SAFE_INTEGER + 1,
        prompt: 'Run maintenance.',
      }),
    ).toThrow('catchUpWindowSeconds must be a positive integer.');

    expect(() =>
      createStoredAutomation({
        dbPath,
        id: 'huge-catch-up',
        title: 'Huge catch-up',
        enabled: true,
        cron: '0 * * * *',
        timeoutSeconds: 60,
        catchUpWindowSeconds: Number.MAX_SAFE_INTEGER,
        prompt: 'Run maintenance.',
      }),
    ).toThrow('catchUpWindowSeconds must be a positive integer.');
  });

  it('normalizes one-time automation timestamps when storing tasks', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    const automation = createStoredAutomation({
      dbPath,
      id: 'normalized-at',
      title: 'Normalized at',
      enabled: true,
      at: '2026-03-02T10:00:00Z',
      timeoutSeconds: 60,
      prompt: 'Run maintenance.',
    });

    expect(automation.schedule).toEqual(
      expect.objectContaining({
        type: 'at',
        at: '2026-03-02T10:00:00.000Z',
      }),
    );
  });

  it('defaults cron automations to a short catch-up window', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    const automation = createStoredAutomation({
      dbPath,
      id: 'default-catch-up',
      title: 'Default catch-up',
      enabled: true,
      cron: '0 * * * *',
      timeoutSeconds: 60,
      prompt: 'Run maintenance.',
    });

    expect(automation.catchUpWindowSeconds).toBe(DEFAULT_CRON_CATCH_UP_WINDOW_SECONDS);
  });

  it('rejects malformed one-time automation timestamps when storing tasks', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    expect(() =>
      createStoredAutomation({
        dbPath,
        id: 'malformed-at',
        title: 'Malformed at',
        enabled: true,
        at: '9999',
        timeoutSeconds: 60,
        prompt: 'Run maintenance.',
      }),
    ).toThrow('Invalid at timestamp: 9999');
  });

  it('does not floor fractional automation activity limits', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'activity-limit',
      title: 'Activity limit',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });

    appendAutomationActivityEntry(
      'activity-limit',
      {
        kind: 'missed',
        createdAt: '2026-03-02T10:00:00.000Z',
        count: 1,
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T10:00:00.000Z',
        exampleScheduledAt: ['2026-03-02T10:00:00.000Z'],
        outcome: 'skipped',
      },
      { dbPath },
    );
    appendAutomationActivityEntry(
      'activity-limit',
      {
        kind: 'missed',
        createdAt: '2026-03-02T11:00:00.000Z',
        count: 1,
        firstScheduledAt: '2026-03-02T11:00:00.000Z',
        lastScheduledAt: '2026-03-02T11:00:00.000Z',
        exampleScheduledAt: ['2026-03-02T11:00:00.000Z'],
        outcome: 'skipped',
      },
      { dbPath },
    );

    expect(listAutomationActivityEntries('activity-limit', { dbPath, limit: 1.5 })).toHaveLength(2);
  });

  it('does not clamp unsafe automation activity limits', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'unsafe-activity-limit',
      title: 'Unsafe activity limit',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });

    for (let index = 0; index < 21; index += 1) {
      const hour = String(index).padStart(2, '0');
      appendAutomationActivityEntry(
        'unsafe-activity-limit',
        {
          kind: 'missed',
          createdAt: `2026-03-02T${hour}:00:00.000Z`,
          count: 1,
          firstScheduledAt: `2026-03-02T${hour}:00:00.000Z`,
          lastScheduledAt: `2026-03-02T${hour}:00:00.000Z`,
          exampleScheduledAt: [`2026-03-02T${hour}:00:00.000Z`],
          outcome: 'skipped',
        },
        { dbPath },
      );
    }

    expect(listAutomationActivityEntries('unsafe-activity-limit', { dbPath, limit: Number.MAX_SAFE_INTEGER + 1 })).toHaveLength(20);
  });

  it('rejects unsafe automation activity counts', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'unsafe-activity-count',
      title: 'Unsafe activity count',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });

    expect(() =>
      appendAutomationActivityEntry(
        'unsafe-activity-count',
        {
          kind: 'missed',
          createdAt: '2026-03-02T10:00:00.000Z',
          count: Number.MAX_SAFE_INTEGER + 1,
          firstScheduledAt: '2026-03-02T10:00:00.000Z',
          lastScheduledAt: '2026-03-02T10:00:00.000Z',
          exampleScheduledAt: ['2026-03-02T10:00:00.000Z'],
          outcome: 'skipped',
        },
        { dbPath },
      ),
    ).toThrow('Automation activity count must be a positive integer.');
  });

  it('rejects invalid automation activity timestamps with field errors', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    createStoredAutomation({
      dbPath,
      id: 'invalid-activity-time',
      title: 'Invalid activity time',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });

    expect(() =>
      appendAutomationActivityEntry(
        'invalid-activity-time',
        {
          kind: 'missed',
          createdAt: 'not-a-date',
          count: 1,
          firstScheduledAt: '2026-03-02T10:00:00.000Z',
          lastScheduledAt: '2026-03-02T10:00:00.000Z',
          exampleScheduledAt: ['2026-03-02T10:00:00.000Z'],
          outcome: 'skipped',
        },
        { dbPath },
      ),
    ).toThrow('Automation activity createdAt must be a valid timestamp.');

    expect(() =>
      appendAutomationActivityEntry(
        'invalid-activity-time',
        {
          kind: 'missed',
          createdAt: '2026-03-02T10:00:00.000Z',
          count: 1,
          firstScheduledAt: 'not-a-date',
          lastScheduledAt: '2026-03-02T10:00:00.000Z',
          exampleScheduledAt: ['2026-03-02T10:00:00.000Z'],
          outcome: 'skipped',
        },
        { dbPath },
      ),
    ).toThrow('Automation activity firstScheduledAt must be a valid timestamp.');
  });

  it('skips persisted automation activity rows with malformed created times', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    createStoredAutomation({
      dbPath,
      id: 'corrupt-activity-time',
      title: 'Corrupt activity time',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });
    appendAutomationActivityEntry(
      'corrupt-activity-time',
      {
        kind: 'missed',
        createdAt: '2026-03-02T10:00:00.000Z',
        count: 1,
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T10:00:00.000Z',
        exampleScheduledAt: ['2026-03-02T10:00:00.000Z'],
        outcome: 'skipped',
      },
      { dbPath },
    );
    openSqliteDatabase(dbPath)
      .prepare('UPDATE automation_activity SET created_at = ? WHERE automation_id = ?')
      .run('not-a-date', 'corrupt-activity-time');

    expect(listAutomationActivityEntries('corrupt-activity-time', { dbPath })).toEqual([]);
  });

  it('skips persisted automation activity rows with non-ISO created times', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    createStoredAutomation({
      dbPath,
      id: 'non-iso-activity-time',
      title: 'Non ISO activity time',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });
    appendAutomationActivityEntry(
      'non-iso-activity-time',
      {
        kind: 'missed',
        createdAt: '2026-03-02T10:00:00.000Z',
        count: 1,
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T10:00:00.000Z',
        exampleScheduledAt: ['2026-03-02T10:00:00.000Z'],
        outcome: 'skipped',
      },
      { dbPath },
    );
    openSqliteDatabase(dbPath)
      .prepare('UPDATE automation_activity SET created_at = ? WHERE automation_id = ?')
      .run('1', 'non-iso-activity-time');

    expect(listAutomationActivityEntries('non-iso-activity-time', { dbPath })).toEqual([]);
  });

  it('drops non-ISO automation activity example timestamps', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    createStoredAutomation({
      dbPath,
      id: 'non-iso-activity-example-time',
      title: 'Non ISO activity example time',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });

    appendAutomationActivityEntry(
      'non-iso-activity-example-time',
      {
        kind: 'missed',
        createdAt: '2026-03-02T10:00:00.000Z',
        count: 1,
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T10:00:00.000Z',
        exampleScheduledAt: ['1', '2026-03-02T10:00:00.000Z'],
        outcome: 'skipped',
      },
      { dbPath },
    );

    const [entry] = listAutomationActivityEntries('non-iso-activity-example-time', { dbPath });
    expect(entry?.kind).toBe('missed');
    if (entry?.kind !== 'missed') {
      throw new Error('Expected missed activity entry.');
    }
    expect(entry.exampleScheduledAt).toEqual(['2026-03-02T10:00:00.000Z']);
  });

  it('sanitizes malformed persisted automation runtime state', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    createStoredAutomation({
      dbPath,
      id: 'corrupt-runtime-state',
      title: 'Corrupt runtime state',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });
    openSqliteDatabase(dbPath)
      .prepare(
        `
      INSERT INTO automation_state (
        automation_id, running_started_at, last_status, last_run_at, last_success_at,
        last_failure_at, last_attempt_count, one_time_resolved_at, one_time_resolved_status,
        one_time_completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        'corrupt-runtime-state',
        'not-a-date',
        'weird',
        'bad-last-run',
        'bad-success',
        'bad-failure',
        Number.MAX_SAFE_INTEGER + 1,
        'bad-resolved',
        'weird-status',
        'bad-completed',
      );

    expect(loadAutomationRuntimeStateMap({ dbPath })['corrupt-runtime-state']).toEqual(
      expect.objectContaining({
        runningStartedAt: undefined,
        lastStatus: undefined,
        lastRunAt: undefined,
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        lastAttemptCount: undefined,
        oneTimeResolvedAt: undefined,
        oneTimeResolvedStatus: undefined,
        oneTimeCompletedAt: undefined,
      }),
    );
  });

  it('sanitizes non-ISO persisted automation runtime timestamps', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    createStoredAutomation({
      dbPath,
      id: 'non-iso-runtime-state',
      title: 'Non ISO runtime state',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });
    openSqliteDatabase(dbPath)
      .prepare(
        `
      INSERT INTO automation_state (
        automation_id, running_started_at, last_run_at, last_success_at,
        last_failure_at, one_time_resolved_at, one_time_completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run('non-iso-runtime-state', '1', '1', '1', '1', '1', '1');

    expect(loadAutomationRuntimeStateMap({ dbPath })['non-iso-runtime-state']).toEqual(
      expect.objectContaining({
        runningStartedAt: undefined,
        lastRunAt: undefined,
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        oneTimeResolvedAt: undefined,
        oneTimeCompletedAt: undefined,
      }),
    );
  });

  it('drops malformed persisted automation scheduler timestamps', () => {
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    saveAutomationSchedulerState({ lastEvaluatedAt: '2026-03-02T10:00:00.000Z' }, { dbPath });
    openSqliteDatabase(dbPath)
      .prepare('UPDATE automation_scheduler_state SET value = ? WHERE key = ?')
      .run('not-a-date', 'lastEvaluatedAt');

    expect(loadAutomationSchedulerState({ dbPath })).toEqual({});
  });

  it('normalizes malformed stored automation row timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00.000Z'));
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    const automation = createStoredAutomation({
      dbPath,
      id: 'corrupt-automation-time',
      title: 'Corrupt automation time',
      enabled: true,
      cron: '0 * * * *',
      prompt: 'Run maintenance.',
    });
    openSqliteDatabase(dbPath)
      .prepare('UPDATE automations SET created_at = ?, updated_at = ? WHERE id = ?')
      .run('not-a-date', 'also-not-a-date', automation.id);

    expect(listStoredAutomations({ dbPath })[0]).toEqual(
      expect.objectContaining({
        createdAt: '2026-03-02T12:00:00.000Z',
        updatedAt: '2026-03-02T12:00:00.000Z',
      }),
    );
  });

  it('does not floor fractional task module timer config', () => {
    const module = createTasksModule({
      enabled: true,
      taskDir: createTempDir('tasks-module-definitions-'),
      tickIntervalSeconds: 5.5,
      maxRetries: 3,
      reapAfterDays: 7,
      defaultTimeoutSeconds: 1800,
    });

    expect(module.timers[0]?.intervalMs).toBe(30_000);
  });

  it('does not accept unsafe task module timer config', () => {
    const module = createTasksModule({
      enabled: true,
      taskDir: createTempDir('tasks-module-definitions-'),
      tickIntervalSeconds: Number.MAX_SAFE_INTEGER + 1,
      maxRetries: 3,
      reapAfterDays: 7,
      defaultTimeoutSeconds: 1800,
    });

    expect(module.timers[0]?.intervalMs).toBe(30_000);
  });

  it('falls back to the current clock when the task clock returns an invalid Date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00.000Z'));
    const taskDir = createTempDir('tasks-invalid-clock-');
    const stateRoot = createTempDir('tasks-invalid-clock-state-');
    const { context } = createContext(taskDir, stateRoot);
    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      { now: () => new Date(Number.NaN) },
    );

    await expect(module.start(context)).resolves.toBeUndefined();
    expect(module.getStatus?.().lastTickAt).toBe('2026-04-18T10:00:00.000Z');
    vi.useRealTimers();
  });

  it('retries one-time tasks up to 3 attempts and resolves on success', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'nightly', title: 'Nightly', at: '2026-03-02T10:00:05.000Z', prompt: 'Run nightly update' });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');

    const runTask = vi.fn(async (request: TaskRunRequest) => {
      const nowIso = currentTime.toISOString();
      if (request.attempt < 3) {
        return createRunResult(request, false, nowIso, `failed attempt ${request.attempt}`);
      }

      return createRunResult(request, true, nowIso);
    });

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context, published } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number; runningTasks?: number };
      return (status.totalRuns ?? 0) === 1 && (status.runningTasks ?? 0) === 0;
    });

    expect(runTask).toHaveBeenCalledTimes(3);

    const status = module.getStatus?.() as {
      successfulRuns?: number;
      failedRuns?: number;
      runningTasks?: number;
    };

    expect(status.successfulRuns).toBe(1);
    expect(status.failedRuns).toBe(0);
    expect(status.runningTasks).toBe(0);

    currentTime = new Date('2026-03-02T10:01:00.000Z');
    await module.handleEvent(createTimerEvent(), context);

    expect(runTask).toHaveBeenCalledTimes(3);
    expect(published.some((event) => event.type === 'tasks.run.completed')).toBe(true);

    await module.stop?.(context);
  });

  it('writes durable run records for scheduled task executions', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'nightly', title: 'Nightly', at: '2026-03-02T10:00:05.000Z', prompt: 'Run nightly update' });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');

    const runTask = vi.fn(async (request: TaskRunRequest) => {
      const logPath = join(request.runsRoot, `${request.task.id}-attempt-${request.attempt}.log`);
      mkdirSync(request.runsRoot, { recursive: true });
      writeFileSync(logPath, 'nightly output\n');
      return createRunResult(request, true, currentTime.toISOString(), undefined, 'nightly output');
    });

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      return (status.totalRuns ?? 0) === 1;
    });

    const runsRoot = resolveDurableRunsRoot(stateRoot);
    const runIds = readdirSync(runsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(runIds).toHaveLength(1);

    const runPaths = resolveDurableRunPaths(runsRoot, runIds[0] as string);
    expect(loadDurableRunManifest(runPaths.manifestPath)).toMatchObject({
      kind: 'scheduled-task',
      resumePolicy: 'rerun',
      source: {
        type: 'scheduled-task',
        id: 'nightly',
      },
    });
    expect(loadDurableRunStatus(runPaths.statusPath)).toMatchObject({
      status: 'completed',
      activeAttempt: 1,
      completedAt: '2026-03-02T10:00:10.000Z',
    });
    expect(statSync(runPaths.resultPath).mode & 0o777).toBe(0o600);
    expect(statSync(runPaths.outputLogPath).mode & 0o777).toBe(0o600);
    expect(readFileSync(runPaths.outputLogPath, 'utf-8')).toContain('nightly output');

    await module.stop?.(context);
  });

  it('starts requested task runs with the provided durable run id', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const requestedRunId = 'task-run-now-requested';
    seedAutomation(stateRoot, {
      id: 'run-now',
      title: 'Run now',
      at: '2026-03-03T10:00:00.000Z',
      prompt: 'Run immediately when requested',
    });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => {
      const logPath = join(request.runsRoot, `${request.task.id}-attempt-${request.attempt}.log`);
      mkdirSync(request.runsRoot, { recursive: true });
      writeFileSync(logPath, 'requested run output\n');
      return createRunResult(request, true, currentTime.toISOString(), undefined, 'requested run output');
    });

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    await module.handleEvent(createRequestedTaskRunEvent('run-now', requestedRunId), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      return (status.totalRuns ?? 0) === 1;
    });

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) })['run-now']?.oneTimeResolvedAt).toBeUndefined();

    const runPaths = resolveDurableRunPaths(resolveDurableRunsRoot(stateRoot), requestedRunId);
    expect(loadDurableRunManifest(runPaths.manifestPath)).toMatchObject({
      id: requestedRunId,
      source: {
        type: 'scheduled-task',
        id: 'run-now',
      },
    });
    expect(loadDurableRunStatus(runPaths.statusPath)).toMatchObject({
      runId: requestedRunId,
      status: 'completed',
      completedAt: '2026-03-02T10:00:00.000Z',
    });

    currentTime = new Date('2026-03-03T10:00:00.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      return (status.totalRuns ?? 0) === 2;
    });

    expect(runTask).toHaveBeenCalledTimes(2);
    expect(loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) })['run-now']?.oneTimeResolvedStatus).toBe('success');

    await module.stop?.(context);
  });

  it('clears active run state when a task run is cancelled', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const requestedRunId = 'task-run-cancelled';
    seedAutomation(stateRoot, {
      id: 'cancel-me',
      title: 'Cancel me',
      at: '2026-03-03T10:00:00.000Z',
      prompt: 'Run until cancelled',
    });

    const currentTime = new Date('2026-03-02T10:00:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => ({
      ...createRunResult(request, false, currentTime.toISOString(), 'cancelled by user'),
      cancelled: true,
      exitCode: null,
    }));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    await module.handleEvent(createRequestedTaskRunEvent('cancel-me', requestedRunId), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      return (status.totalRuns ?? 0) === 1;
    });

    const persistedState = loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) });
    expect(persistedState['cancel-me']?.activeRunId).toBeUndefined();
    expect(persistedState['cancel-me']?.lastStatus).toBe('skipped');

    const runPaths = resolveDurableRunPaths(resolveDurableRunsRoot(stateRoot), requestedRunId);
    expect(loadDurableRunStatus(runPaths.statusPath)).toMatchObject({
      runId: requestedRunId,
      status: 'interrupted',
      completedAt: '2026-03-02T10:00:00.000Z',
    });

    await module.stop?.(context);
  });

  it('ignores requested task runs while a prior requested run is still active', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const firstRunId = 'task-run-now-first';
    const secondRunId = 'task-run-now-second';
    seedAutomation(stateRoot, {
      id: 'run-now',
      title: 'Run now',
      at: '2026-03-03T10:00:00.000Z',
      prompt: 'Run immediately when requested',
    });

    const currentTime = new Date('2026-03-02T10:00:00.000Z');
    let releaseRun: (() => void) | undefined;
    const runTask = vi.fn(async (request: TaskRunRequest) => {
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return createRunResult(request, true, currentTime.toISOString(), undefined, 'requested run output');
    });

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    await module.handleEvent(createRequestedTaskRunEvent('run-now', firstRunId), context);
    await waitForCondition(() => runTask.mock.calls.length === 1);

    await module.handleEvent(createRequestedTaskRunEvent('run-now', secondRunId), context);
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(existsSync(resolveDurableRunPaths(resolveDurableRunsRoot(stateRoot), secondRunId).manifestPath)).toBe(false);

    releaseRun?.();

    await waitForCondition(() => {
      const status = module.getStatus?.() as { runningTasks?: number; totalRuns?: number };
      return (status.runningTasks ?? 0) === 0 && (status.totalRuns ?? 0) === 1;
    });

    await module.stop?.(context);
  });

  it('runs all due tasks as direct daemon subprocesses', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, {
      id: 'default-mode',
      title: 'Default mode',
      at: '2026-03-02T10:00:00.000Z',
      prompt: 'Run using default execution',
    });
    seedAutomation(stateRoot, { id: 'second-run', title: 'Second run', at: '2026-03-02T10:00:00.000Z', prompt: 'Run the second task' });

    let currentTime = new Date('2026-03-02T09:59:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      return (status.totalRuns ?? 0) === 2;
    });

    const taskIds = runTask.mock.calls
      .map(([request]: [TaskRunRequest]) => request.task.id)
      .sort((left, right) => left.localeCompare(right));

    expect(taskIds).toEqual(['default-mode', 'second-run']);

    await module.stop?.(context);
  });

  it('does not write activity entries for successful task runs', async () => {
    const repoRoot = createTempDir('tasks-module-repo-');
    const taskDir = join(repoRoot, 'profiles', 'datadog', 'agent', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'daily-report', title: 'Daily report', at: '2026-03-02T10:00:00.000Z', prompt: 'Write daily report' });

    let currentTime = new Date('2026-03-02T09:59:00.000Z');

    const runTask = vi.fn(async (request: TaskRunRequest) =>
      createRunResult(request, true, currentTime.toISOString(), undefined, 'Daily report generated successfully.'),
    );

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { successfulRuns?: number };
      return (status.successfulRuns ?? 0) === 1;
    });

    expect(listProfileActivityEntries({ stateRoot, profile: 'datadog' })).toHaveLength(0);

    await module.stop?.(context);
  });

  it('keeps successful task runs out of both shared and daemon-internal activity state', async () => {
    const repoRoot = createTempDir('tasks-module-repo-');
    const taskDir = join(repoRoot, 'profiles', 'datadog', 'agent', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    const stateRoot = createTempDir('tasks-module-state-');
    const daemonRoot = join(stateRoot, 'daemon');
    seedAutomation(daemonRoot, {
      id: 'datadog-memory-maintenance',
      title: 'Datadog memory maintenance',
      at: '2026-03-02T10:00:00.000Z',
      prompt: 'Maintain durable memory',
    });

    let currentTime = new Date('2026-03-02T09:59:00.000Z');

    const runTask = vi.fn(async (request: TaskRunRequest) =>
      createRunResult(
        request,
        true,
        currentTime.toISOString(),
        undefined,
        'Completed the datadog memory-maintenance pass.\n\nFiles updated\n- /tmp/processed-conversations.json',
      ),
    );

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);
    context.paths.root = daemonRoot;
    context.paths.socketPath = join(daemonRoot, 'daemon.sock');
    context.paths.pidFile = join(daemonRoot, 'daemon.pid');
    context.paths.logDir = join(daemonRoot, 'logs');
    context.paths.logFile = join(daemonRoot, 'logs', 'daemon.log');
    mkdirSync(context.paths.logDir, { recursive: true });

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { successfulRuns?: number };
      return (status.successfulRuns ?? 0) === 1;
    });

    expect(listProfileActivityEntries({ stateRoot, profile: 'datadog' })).toHaveLength(0);
    expect(listProfileActivityEntries({ stateRoot: daemonRoot, profile: 'datadog' })).toHaveLength(0);

    await module.stop?.(context);
  });

  it('runs due automations directly without durable event-bus dispatch', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, {
      id: 'checkout-poller',
      title: 'Checkout poller',
      cron: '* * * * *',
      prompt: 'Poll checkout events',
    });

    const currentTime = new Date('2026-03-02T10:10:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) =>
      createRunResult(request, true, currentTime.toISOString(), undefined, 'Checkout poll complete.'),
    );
    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );
    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => runTask.mock.calls.length === 1);
    expect(startScheduledTaskRunMock).not.toHaveBeenCalled();

    await module.stop?.(context);
  });

  it('recovers interrupted one-time task runs on startup instead of marking them missed', async () => {
    const repoRoot = createTempDir('tasks-module-repo-');
    const taskDir = join(repoRoot, 'profiles', 'datadog', 'agent', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    const stateRoot = createTempDir('tasks-module-state-');
    const priorRunId = 'task-recover-me-prior';
    const task = seedAutomation(stateRoot, {
      id: 'recover-me',
      title: 'Recover me',
      at: '2026-03-02T10:00:00.000Z',
      prompt: 'Recover me after restart',
    });

    const runsRoot = resolveDurableRunsRoot(stateRoot);
    const priorRunPaths = resolveDurableRunPaths(runsRoot, priorRunId);
    saveDurableRunManifest(
      priorRunPaths.manifestPath,
      createDurableRunManifest({
        id: priorRunId,
        kind: 'scheduled-task',
        resumePolicy: 'rerun',
        createdAt: '2026-03-02T10:00:00.000Z',
        source: {
          type: 'scheduled-task',
          id: 'recover-me',
          filePath: task.filePath,
        },
      }),
    );
    saveDurableRunStatus(
      priorRunPaths.statusPath,
      createInitialDurableRunStatus({
        runId: priorRunId,
        status: 'running',
        createdAt: '2026-03-02T10:00:00.000Z',
        updatedAt: '2026-03-02T10:05:00.000Z',
        activeAttempt: 1,
        startedAt: '2026-03-02T10:00:00.000Z',
      }),
    );

    saveAutomationRuntimeStateMap(
      {
        'recover-me': {
          id: 'recover-me',
          filePath: task.filePath,
          scheduleType: 'at',
          running: true,
          runningStartedAt: '2026-03-02T10:00:00.000Z',
          activeRunId: priorRunId,
          lastRunId: priorRunId,
          lastStatus: 'running',
        },
      },
      { dbPath: resolveRuntimeDbPath(stateRoot) },
    );

    const currentTime = new Date('2026-03-02T10:30:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) =>
      createRunResult(request, true, currentTime.toISOString(), undefined, 'Recovered successfully.'),
    );

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      if ((status.totalRuns ?? 0) !== 1) {
        return false;
      }

      const persistedState = loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) });
      const taskState = persistedState['recover-me'];
      return taskState?.activeRunId === undefined && taskState.lastRunId !== priorRunId && taskState.oneTimeResolvedStatus === 'success';
    });

    expect(runTask).toHaveBeenCalledTimes(1);

    const persistedState = loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) });
    expect(persistedState['recover-me']?.filePath).toBe(task.filePath);
    expect(persistedState['recover-me']?.activeRunId).toBeUndefined();
    expect(persistedState['recover-me']?.lastRunId).not.toBe(priorRunId);
    expect(persistedState['recover-me']?.oneTimeResolvedStatus).toBe('success');

    await module.stop?.(context);
  });

  it('reattaches orphan durable scheduled task runs on startup', async () => {
    const repoRoot = createTempDir('tasks-module-repo-');
    const taskDir = join(repoRoot, 'profiles', 'datadog', 'agent', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    const stateRoot = createTempDir('tasks-module-state-');
    const priorRunId = 'task-recover-orphan-prior';
    const task = seedAutomation(stateRoot, {
      id: 'recover-orphan',
      title: 'Recover orphan',
      at: '2026-03-02T10:00:00.000Z',
      prompt: 'Recover orphan after restart',
    });

    const runsRoot = resolveDurableRunsRoot(stateRoot);
    const priorRunPaths = resolveDurableRunPaths(runsRoot, priorRunId);
    saveDurableRunManifest(
      priorRunPaths.manifestPath,
      createDurableRunManifest({
        id: priorRunId,
        kind: 'scheduled-task',
        resumePolicy: 'rerun',
        createdAt: '2026-03-02T10:00:00.000Z',
        source: {
          type: 'scheduled-task',
          id: 'recover-orphan',
          filePath: task.filePath,
        },
      }),
    );
    saveDurableRunStatus(
      priorRunPaths.statusPath,
      createInitialDurableRunStatus({
        runId: priorRunId,
        status: 'running',
        createdAt: '2026-03-02T10:00:00.000Z',
        updatedAt: '2026-03-02T10:05:00.000Z',
        activeAttempt: 1,
        startedAt: '2026-03-02T10:00:00.000Z',
      }),
    );

    const currentTime = new Date('2026-03-02T10:30:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) =>
      createRunResult(request, true, currentTime.toISOString(), undefined, 'Recovered orphan successfully.'),
    );

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      if ((status.totalRuns ?? 0) !== 1) {
        return false;
      }

      const persistedState = loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) });
      const taskState = persistedState['recover-orphan'];
      return taskState?.activeRunId === undefined && taskState.lastRunId !== priorRunId && taskState.oneTimeResolvedStatus === 'success';
    });

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(runTask.mock.calls[0]?.[0].task.id).toBe('recover-orphan');

    const persistedState = loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) });
    expect(persistedState['recover-orphan']?.filePath).toBe(task.filePath);
    expect(persistedState['recover-orphan']?.activeRunId).toBeUndefined();
    expect(persistedState['recover-orphan']?.lastRunId).not.toBe(priorRunId);
    expect(persistedState['recover-orphan']?.oneTimeResolvedStatus).toBe('success');

    await module.stop?.(context);
  });

  it('clears stale running task state on startup when no durable run was created', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const task = seedAutomation(stateRoot, {
      id: 'stale-running',
      title: 'Stale running',
      at: '2026-03-03T10:00:00.000Z',
      prompt: 'This run should not stay running forever.',
    });
    const dbPath = resolveRuntimeDbPath(stateRoot);

    saveAutomationRuntimeStateMap(
      {
        'stale-running': {
          id: 'stale-running',
          filePath: task.filePath,
          scheduleType: 'at',
          running: true,
          runningStartedAt: '2026-03-02T10:00:00.000Z',
          lastStatus: 'running',
        },
      },
      { dbPath },
    );

    const currentTime = new Date('2026-03-02T10:30:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    expect(runTask).not.toHaveBeenCalled();

    const persistedState = loadAutomationRuntimeStateMap({ dbPath });
    expect(persistedState['stale-running']).toEqual(
      expect.objectContaining({
        running: false,
        activeRunId: undefined,
        lastRunId: undefined,
        lastStatus: 'failed',
        lastRunAt: '2026-03-02T10:30:00.000Z',
        lastFailureAt: '2026-03-02T10:30:00.000Z',
        lastError: 'Automation was interrupted before a durable run record was created.',
      }),
    );
    expect(persistedState['stale-running']?.runningStartedAt).toBeUndefined();
    expect(listAutomationActivityEntries('stale-running', { dbPath })).toEqual([
      expect.objectContaining({
        automationId: 'stale-running',
        kind: 'run-failed',
        message: 'Automation was interrupted before a durable run record was created.',
      }),
    ]);
    expect(getAlert({ stateRoot, profile: 'assistant', alertId: 'automation-run-failed-stale-running' })).toEqual(
      expect.objectContaining({
        kind: 'task-failed',
        status: 'active',
        title: 'Automation failed to start: Stale running',
        sourceKind: 'scheduled-task',
        sourceId: 'stale-running',
      }),
    );

    const status = module.getStatus?.() as { failedRuns?: number; runningTasks?: number };
    expect(status.failedRuns).toBe(1);
    expect(status.runningTasks).toBe(0);

    await module.stop?.(context);
  });

  it('does not create shared activity entries when a one-time task is missed while the daemon was offline', async () => {
    const repoRoot = createTempDir('tasks-module-repo-');
    const taskDir = join(repoRoot, 'profiles', 'datadog', 'agent', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'daily-report', title: 'Daily report', at: '2026-03-02T10:00:00.000Z', prompt: 'Write daily report' });

    const currentTime = new Date('2026-03-02T10:30:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    expect(runTask).not.toHaveBeenCalled();
    expect(listProfileActivityEntries({ stateRoot, profile: 'datadog' })).toHaveLength(0);
    expect(listAutomationActivityEntries('daily-report', { dbPath: resolveRuntimeDbPath(stateRoot) })).toEqual([
      expect.objectContaining({
        automationId: 'daily-report',
        kind: 'missed',
        count: 1,
        outcome: 'skipped',
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T10:00:00.000Z',
      }),
    ]);

    await module.stop?.(context);
  });

  it('does not create shared activity entries when cron runs are missed while the daemon is offline', async () => {
    const repoRoot = createTempDir('tasks-module-repo-');
    const taskDir = join(repoRoot, 'profiles', 'datadog', 'agent', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'hourly', title: 'Hourly', cron: '0 * * * *', prompt: 'Run hourly task' });

    saveAutomationSchedulerState({ lastEvaluatedAt: '2026-03-02T09:59:30.000Z' }, { dbPath: resolveRuntimeDbPath(stateRoot) });

    let currentTime = new Date('2026-03-02T11:20:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    expect(runTask).not.toHaveBeenCalled();
    expect(listProfileActivityEntries({ stateRoot, profile: 'datadog' })).toHaveLength(0);

    currentTime = new Date('2026-03-02T11:20:30.000Z');
    await module.handleEvent(createTimerEvent(), context);

    expect(listProfileActivityEntries({ stateRoot, profile: 'datadog' })).toHaveLength(0);
    expect(listAutomationActivityEntries('hourly', { dbPath: resolveRuntimeDbPath(stateRoot) })).toEqual([
      expect.objectContaining({
        automationId: 'hourly',
        kind: 'missed',
        count: 2,
        outcome: 'skipped',
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T11:00:00.000Z',
      }),
    ]);
    const persistedState = loadAutomationSchedulerState({ dbPath: resolveRuntimeDbPath(stateRoot) });
    expect(persistedState.lastEvaluatedAt).toBe('2026-03-02T11:20:30.000Z');

    await module.stop?.(context);
  });

  it('runs one catch-up cron execution when the latest missed slot is still within the automation window', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'morning-brief',
      title: 'Morning brief',
      enabled: true,
      cron: '0 * * * *',
      catchUpWindowSeconds: 15 * 60,
      prompt: 'Assemble the morning briefing.',
    });
    setStoredAutomationThreadBinding('morning-brief', { dbPath, mode: 'dedicated' });

    saveAutomationSchedulerState({ lastEvaluatedAt: '2026-03-02T09:59:30.000Z' }, { dbPath });

    expect(listStoredAutomations({ dbPath })[0]?.catchUpWindowSeconds).toBe(15 * 60);
    expect(listStoredAutomations({ dbPath })[0]?.policies).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'catch_up', windowSeconds: 15 * 60 })]),
    );

    const currentTime = new Date('2026-03-02T10:10:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 1,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    await waitForCondition(() => runTask.mock.calls.length === 1);

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(runTask.mock.calls[0]?.[0].task.id).toBe('morning-brief');
    expect(listAutomationActivityEntries('morning-brief', { dbPath })).toEqual([
      expect.objectContaining({
        automationId: 'morning-brief',
        kind: 'missed',
        count: 1,
        outcome: 'catch-up-started',
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T10:00:00.000Z',
      }),
    ]);

    await module.stop?.(context);
  });

  it('keeps cron automations skipped when the missed slot is outside the catch-up window', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'morning-brief',
      title: 'Morning brief',
      enabled: true,
      cron: '0 * * * *',
      catchUpWindowSeconds: 5 * 60,
      prompt: 'Assemble the morning briefing.',
    });
    setStoredAutomationThreadBinding('morning-brief', { dbPath, mode: 'dedicated' });

    saveAutomationSchedulerState({ lastEvaluatedAt: '2026-03-02T09:59:30.000Z' }, { dbPath });

    let currentTime = new Date('2026-03-02T10:10:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 1,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    expect(runTask).not.toHaveBeenCalled();
    expect(listAutomationActivityEntries('morning-brief', { dbPath })).toEqual([
      expect.objectContaining({
        automationId: 'morning-brief',
        kind: 'missed',
        count: 1,
        outcome: 'skipped',
        firstScheduledAt: '2026-03-02T10:00:00.000Z',
        lastScheduledAt: '2026-03-02T10:00:00.000Z',
      }),
    ]);
    expect(getAlert({ stateRoot, profile: 'assistant', alertId: 'automation-skipped-morning-brief' })).toEqual(
      expect.objectContaining({
        kind: 'task-failed',
        severity: 'disruptive',
        status: 'active',
        title: 'Automation skipped: Morning brief',
        sourceKind: 'scheduled-task',
        sourceId: 'morning-brief',
        requiresAck: true,
      }),
    );

    currentTime = new Date('2026-03-02T10:10:30.000-05:00');
    await module.handleEvent(createTimerEvent(), context);

    expect(runTask).not.toHaveBeenCalled();

    await module.stop?.(context);
  });

  it('uses the catch-up policy window for missed cron runs', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'policy-catch-up',
      title: 'Policy catch up',
      enabled: true,
      cron: '0 * * * *',
      catchUpWindowSeconds: 5 * 60,
      policies: [{ kind: 'catch_up', enabled: true, windowSeconds: 15 * 60, mode: 'latest' }],
      prompt: 'Catch up through policy.',
    });
    setStoredAutomationThreadBinding('policy-catch-up', { dbPath, mode: 'dedicated' });
    saveAutomationSchedulerState({ lastEvaluatedAt: '2026-03-02T09:59:30.000Z' }, { dbPath });

    const currentTime = new Date('2026-03-02T10:10:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));
    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 1,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );
    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    await waitForCondition(() => runTask.mock.calls.length === 1);

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(runTask.mock.calls[0]?.[0].task.id).toBe('policy-catch-up');

    await module.stop?.(context);
  });

  it('applies a once-per-day policy to recurring cron automations', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'daily-flex',
      title: 'Daily flexible run',
      enabled: true,
      cron: '* * * * *',
      policies: [{ kind: 'once_per_period', enabled: true, count: 1, period: 'day' }],
      prompt: 'Run once per day.',
    });
    setStoredAutomationThreadBinding('daily-flex', { dbPath, mode: 'dedicated' });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));
    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 1,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );
    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    await waitForCondition(() => runTask.mock.calls.length === 1);

    currentTime = new Date('2026-03-02T10:01:00.000Z');
    await module.handleEvent(createTimerEvent(), context);

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(loadAutomationRuntimeStateMap({ dbPath })['daily-flex']).toEqual(
      expect.objectContaining({
        lastStatus: 'skipped',
        lastSuccessAt: '2026-03-02T10:00:00.000Z',
        lastError: 'Task skipped because the once-per-day policy is already satisfied.',
      }),
    );

    await module.stop?.(context);
  });

  it('records activity and alerts when a due automation fails before creating a run', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'broken-thread',
      title: 'Broken thread',
      enabled: true,
      cron: '* * * * *',
      targetType: 'conversation',
      prompt: 'Run maintenance.',
    });
    setStoredAutomationThreadBinding('broken-thread', {
      dbPath,
      mode: 'existing',
      conversationId: 'missing-thread',
      sessionFile: '/missing/thread.jsonl',
    });

    const currentTime = new Date('2026-03-02T10:10:00.000Z');
    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 1,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask: vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString())),
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    await waitForCondition(() => listAutomationActivityEntries('broken-thread', { dbPath }).length === 1);

    expect(listAutomationActivityEntries('broken-thread', { dbPath })).toEqual([
      expect.objectContaining({
        automationId: 'broken-thread',
        kind: 'run-failed',
        message: 'Automation @broken-thread is bound to a missing thread.',
      }),
    ]);
    expect(getAlert({ stateRoot, profile: 'assistant', alertId: 'automation-run-failed-broken-thread' })).toEqual(
      expect.objectContaining({
        kind: 'task-failed',
        status: 'active',
        title: 'Automation failed to start: Broken thread',
        sourceKind: 'scheduled-task',
        sourceId: 'broken-thread',
      }),
    );

    await module.stop?.(context);
  });

  it('skips overlapping cron runs when prior run is still active', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'heartbeat', title: 'Heartbeat', cron: '* * * * *', prompt: 'Heartbeat task' });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');

    let releaseRun: (() => void) | undefined;
    const runTask = vi.fn(async (request: TaskRunRequest) => {
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });

      return createRunResult(request, true, currentTime.toISOString());
    });

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    await waitForCondition(() => runTask.mock.calls.length === 1);

    currentTime = new Date('2026-03-02T10:01:00.000Z');
    await module.handleEvent(createTimerEvent(), context);

    const midStatus = module.getStatus?.() as { skippedRuns?: number; runningTasks?: number };
    expect(runTask).toHaveBeenCalledTimes(1);
    expect(midStatus.skippedRuns).toBe(1);
    expect(midStatus.runningTasks).toBe(1);

    releaseRun?.();

    await waitForCondition(() => {
      const status = module.getStatus?.() as { runningTasks?: number; totalRuns?: number };
      return (status.runningTasks ?? 0) === 0 && (status.totalRuns ?? 0) === 1;
    });

    await module.stop?.(context);
  });

  it('creates a conversation callback wakeup for bound task completions', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'watch-prod', title: 'Watch prod', at: '2026-03-02T10:00:05.000Z', prompt: 'Watch the prod gates' });

    setTaskCallbackBinding({
      stateRoot,
      profile: 'datadog',
      taskId: 'watch-prod',
      conversationId: 'conv-123',
      sessionFile: '/tmp/conv-123.jsonl',
      notifyOnSuccess: 'disruptive',
      notifyOnFailure: 'disruptive',
    });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) =>
      createRunResult(request, true, currentTime.toISOString(), undefined, 'Confirm Kubernetes Mutations is waiting for approval.'),
    );

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const state = loadAttentionEventsState(join(stateRoot, 'pi-agent', 'attention-events-state.json'));
      return Object.keys(state.events).length === 1;
    });

    const attentionState = loadAttentionEventsState(join(stateRoot, 'pi-agent', 'attention-events-state.json'));
    const callback = Object.values(attentionState.events)[0];
    expect(callback).toEqual(
      expect.objectContaining({
        source: expect.objectContaining({ kind: 'scheduled-task', id: 'watch-prod' }),
        status: 'ready',
        title: 'Scheduled task @watch-prod completed',
      }),
    );

    await module.stop?.(context);
  });

  it('runs one-time conversation automations directly in their bound thread', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'conversation-check',
      title: 'Conversation check',
      enabled: true,
      at: '2026-03-02T10:00:05.000Z',
      cwd: '/tmp/workspace',
      prompt: 'Check the deployment again.',
      targetType: 'conversation',
      conversationBehavior: 'followUp',
    });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) =>
      createRunResult(
        request,
        true,
        currentTime.toISOString(),
        undefined,
        '[background-agent] starting cwd=/Users/patrick/workingdir/neon-pilot model=(default) allowedTools=(default)\nConversation check passed.',
      ),
    );

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const runtimeState = loadAutomationRuntimeStateMap({ dbPath });
      return runtimeState['conversation-check']?.lastStatus === 'success';
    });

    const attentionState = loadAttentionEventsState(join(stateRoot, 'pi-agent', 'attention-events-state.json'));
    expect(Object.keys(attentionState.events)).toHaveLength(0);

    const runtimeState = loadAutomationRuntimeStateMap({ dbPath });
    expect(runtimeState['conversation-check']).toEqual(
      expect.objectContaining({
        lastStatus: 'success',
        lastAttemptCount: 1,
        oneTimeResolvedStatus: 'success',
      }),
    );
    expect(runTask).toHaveBeenCalledTimes(1);
    expect(runTask.mock.calls[0]?.[0].task).toEqual(
      expect.objectContaining({
        id: 'conversation-check',
        targetType: 'conversation',
        threadMode: 'dedicated',
        threadConversationId: expect.any(String),
        threadSessionFile: expect.any(String),
        conversationBehavior: 'followUp',
      }),
    );
    const boundTask = runTask.mock.calls[0]?.[0].task;
    expect(boundTask?.threadSessionFile).toBeTruthy();
    const rawSessionLines = readFileSync(boundTask!.threadSessionFile!, 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(rawSessionLines).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'custom_message', customType: 'automation_run', display: false })]),
    );

    const completedAuditEntry = rawSessionLines.find(
      (line) =>
        line.type === 'custom_message' &&
        line.customType === 'automation_run' &&
        typeof line.content === 'string' &&
        line.content.includes('Automation completed: Conversation check'),
    );
    expect(completedAuditEntry?.content).toContain('Output:\nConversation check passed.');
    expect(completedAuditEntry?.content).toContain('Run log: available from the automation run details.');
    expect(completedAuditEntry?.content).not.toContain('[background-agent] starting cwd=');
    expect(completedAuditEntry?.content).not.toContain('/tmp/');
    expect(completedAuditEntry?.content).not.toContain('/Users/');
    expect(completedAuditEntry?.details).toEqual(expect.objectContaining({ logPath: expect.stringContaining('/attempts/') }));

    const runId = runtimeState['conversation-check']?.lastRunId;
    expect(runId).toBeTruthy();
    const runStatus = loadDurableRunStatus(resolveDurableRunPaths(resolveDurableRunsRoot(stateRoot), runId!).statusPath);
    expect(runStatus).toEqual(expect.objectContaining({ status: 'completed' }));

    await module.stop?.(context);
  });

  it('publishes owner-thread transcript changes when automation run entries are appended', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    const events: Array<{ type: string; sessionId?: string; topics?: string[] }> = [];
    const unsubscribe = subscribeAppEvents((event) => {
      if (event.type === 'session_file_changed' || event.type === 'invalidate') events.push(event);
    });

    try {
      createStoredAutomation({
        dbPath,
        id: 'transcript-check',
        title: 'Transcript check',
        enabled: true,
        at: '2026-03-02T10:00:05.000Z',
        cwd: '/tmp/workspace',
        prompt: 'Check the transcript.',
        targetType: 'conversation',
      });

      let currentTime = new Date('2026-03-02T10:00:00.000Z');
      const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));
      const module = createTasksModule(
        {
          enabled: true,
          taskDir,
          tickIntervalSeconds: 30,
          maxRetries: 3,
          reapAfterDays: 7,
          defaultTimeoutSeconds: 1800,
        },
        { now: () => currentTime, runTask },
      );
      const { context } = createContext(taskDir, stateRoot);

      await module.start(context);
      currentTime = new Date('2026-03-02T10:00:10.000Z');
      await module.handleEvent(createTimerEvent(), context);
      await waitForCondition(() => loadAutomationRuntimeStateMap({ dbPath })['transcript-check']?.lastStatus === 'success');

      const conversationId = runTask.mock.calls[0]?.[0].task.threadConversationId;
      expect(events).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'session_file_changed', sessionId: conversationId })]),
      );
      expect(events).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'invalidate', topics: expect.arrayContaining(['sessions']) })]),
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'invalidate', topics: expect.arrayContaining(['tasks', 'runs', 'sessions', 'workspace']) }),
        ]),
      );

      await module.stop?.(context);
    } finally {
      unsubscribe();
    }
  });

  it('restores archived owner threads to the open sidebar workspace when a conversation automation runs', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);
    const settingsFile = getRuntimeSettingsFilePath(stateRoot);
    const events: Array<{ type: string; sessionIds?: string[]; archivedSessionIds?: string[]; topics?: string[] }> = [];
    const unsubscribe = subscribeAppEvents((event) => {
      if (event.type === 'conversation_workspace_changed' || event.type === 'invalidate') events.push(event);
    });

    try {
      createStoredAutomation({
        dbPath,
        id: 'archived-owner-check',
        title: 'Archived owner check',
        enabled: true,
        at: '2026-03-02T10:00:05.000Z',
        cwd: '/tmp/workspace',
        prompt: 'Check the archived owner.',
        targetType: 'conversation',
      });
      const task = ensureAutomationThread('archived-owner-check', { dbPath, stateRoot });
      writeSavedUiPreferences(
        {
          openConversationIds: [],
          archivedConversationIds: [task!.threadConversationId!],
          activeConversationId: null,
          conversationWorkspaceMigrated: true,
        },
        settingsFile,
      );

      let currentTime = new Date('2026-03-02T10:00:00.000Z');
      const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));
      const module = createTasksModule(
        {
          enabled: true,
          taskDir,
          tickIntervalSeconds: 30,
          maxRetries: 3,
          reapAfterDays: 7,
          defaultTimeoutSeconds: 1800,
        },
        { now: () => currentTime, runTask },
      );
      const { context } = createContext(taskDir, stateRoot);

      await module.start(context);
      currentTime = new Date('2026-03-02T10:00:10.000Z');
      await module.handleEvent(createTimerEvent(), context);
      await waitForCondition(() => loadAutomationRuntimeStateMap({ dbPath })['archived-owner-check']?.lastStatus === 'success');

      const saved = readSavedUiPreferences(settingsFile);
      expect(saved.openConversationIds).toContain(task!.threadConversationId);
      expect(saved.archivedConversationIds).not.toContain(task!.threadConversationId);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'invalidate', topics: expect.arrayContaining(['sessions', 'workspace']) }),
          expect.objectContaining({
            type: 'conversation_workspace_changed',
            sessionIds: expect.arrayContaining([task!.threadConversationId]),
            archivedSessionIds: [],
          }),
        ]),
      );

      await module.stop?.(context);
    } finally {
      unsubscribe();
    }
  });

  it('redacts local paths from failed owner-thread automation audit entries', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'failed-conversation-check',
      title: 'Failed conversation check',
      enabled: true,
      at: '2026-03-02T10:00:05.000Z',
      cwd: '/tmp/workspace',
      prompt: 'Fail the conversation check.',
      targetType: 'conversation',
      timeoutSeconds: 1800,
    });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');
    const rawError =
      'spawn /Users/patrick/workingdir/neon-pilot/dist/dev-desktop/Neon Pilot Testing.app/Contents/MacOS/Neon Pilot Testing ENOENT';
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, false, currentTime.toISOString(), rawError));
    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 1,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      { now: () => currentTime, runTask },
    );
    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);
    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);
    await waitForCondition(() => loadAutomationRuntimeStateMap({ dbPath })['failed-conversation-check']?.lastStatus === 'failed');

    const runtimeState = loadAutomationRuntimeStateMap({ dbPath });
    expect(runtimeState['failed-conversation-check']?.lastError).toBe(rawError);

    const boundTask = runTask.mock.calls[0]?.[0].task;
    expect(boundTask?.threadSessionFile).toBeTruthy();
    const rawSessionLines = readFileSync(boundTask!.threadSessionFile!, 'utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const failedAuditEntry = rawSessionLines.find(
      (line) =>
        line.type === 'custom_message' &&
        line.customType === 'automation_run' &&
        typeof line.content === 'string' &&
        line.content.includes('Automation failed: Failed conversation check'),
    );

    expect(failedAuditEntry?.content).toContain('Error: spawn automation runner ENOENT');
    expect(failedAuditEntry?.content).not.toContain('/Users/');
    expect(failedAuditEntry?.content).not.toContain('Neon Pilot Testing.app');
    expect(failedAuditEntry?.details).toEqual(expect.objectContaining({ error: 'spawn automation runner ENOENT' }));
    expect(JSON.stringify(failedAuditEntry?.details)).not.toContain('/Users/');
    expect(JSON.stringify(failedAuditEntry?.details)).not.toContain('Neon Pilot Testing.app');

    await module.stop?.(context);
  });

  it('reruns recurring conversation automations after the prior run completes', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    const dbPath = resolveRuntimeDbPath(stateRoot);

    createStoredAutomation({
      dbPath,
      id: 'hourly-check',
      title: 'Hourly check',
      enabled: true,
      cron: '0 * * * *',
      cwd: '/tmp/workspace',
      prompt: 'Check the deployment again.',
      targetType: 'conversation',
    });

    let currentTime = new Date('2026-03-02T09:59:00.000Z');
    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:00.000Z');
    await module.handleEvent(createTimerEvent(), context);
    await waitForCondition(() => {
      const status = module.getStatus?.() as { runningTasks?: number; successfulRuns?: number };
      return (status.runningTasks ?? 0) === 0 && (status.successfulRuns ?? 0) === 1;
    });

    currentTime = new Date('2026-03-02T11:00:00.000Z');
    await module.handleEvent(createTimerEvent(), context);
    await waitForCondition(() => {
      const status = module.getStatus?.() as { runningTasks?: number; successfulRuns?: number };
      return (status.runningTasks ?? 0) === 0 && (status.successfulRuns ?? 0) === 2;
    });

    const attentionState = loadAttentionEventsState(join(stateRoot, 'pi-agent', 'attention-events-state.json'));
    expect(Object.keys(attentionState.events)).toHaveLength(0);

    const runtimeState = loadAutomationRuntimeStateMap({ dbPath });
    expect(runtimeState['hourly-check']).toEqual(
      expect.objectContaining({
        lastStatus: 'success',
        lastError: undefined,
      }),
    );
    const status = module.getStatus?.() as { skippedRuns?: number; successfulRuns?: number };
    expect(status.skippedRuns).toBe(0);
    expect(status.successfulRuns).toBe(2);
    expect(runTask).toHaveBeenCalledTimes(2);
    expect(runTask.mock.calls.every((call) => Boolean(call[0].task.threadSessionFile))).toBe(true);

    await module.stop?.(context);
  });

  it('reaps completed one-time tasks after 7 days', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'cleanup', title: 'Cleanup', at: '2026-03-02T10:00:00.000Z', prompt: 'Cleanup task' });

    let currentTime = new Date('2026-03-02T09:59:00.000Z');

    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    currentTime = new Date('2026-03-02T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    await waitForCondition(() => {
      const status = module.getStatus?.() as { totalRuns?: number };
      return (status.totalRuns ?? 0) === 1;
    });

    expect(listStoredAutomations({ dbPath: resolveRuntimeDbPath(stateRoot) }).map((task) => task.id)).toContain('cleanup');

    currentTime = new Date('2026-03-10T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    expect(listStoredAutomations({ dbPath: resolveRuntimeDbPath(stateRoot) }).map((task) => task.id)).not.toContain('cleanup');

    const persistedState = loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) });
    expect(Object.keys(persistedState).length).toBe(0);

    await module.stop?.(context);
  });

  it('reaps skipped one-time tasks after 7 days', async () => {
    const taskDir = createTempDir('tasks-module-definitions-');
    const stateRoot = createTempDir('tasks-module-state-');
    seedAutomation(stateRoot, { id: 'missed', title: 'Missed', at: '2026-03-02T09:00:00.000Z', prompt: 'Missed task' });

    let currentTime = new Date('2026-03-02T10:00:00.000Z');

    const runTask = vi.fn(async (request: TaskRunRequest) => createRunResult(request, true, currentTime.toISOString()));

    const module = createTasksModule(
      {
        enabled: true,
        taskDir,
        tickIntervalSeconds: 30,
        maxRetries: 3,
        reapAfterDays: 7,
        defaultTimeoutSeconds: 1800,
      },
      {
        now: () => currentTime,
        runTask,
      },
    );

    const { context } = createContext(taskDir, stateRoot);

    await module.start(context);

    expect(runTask).toHaveBeenCalledTimes(0);
    expect(listStoredAutomations({ dbPath: resolveRuntimeDbPath(stateRoot) }).map((task) => task.id)).toContain('missed');

    currentTime = new Date('2026-03-10T10:00:10.000Z');
    await module.handleEvent(createTimerEvent(), context);

    expect(listStoredAutomations({ dbPath: resolveRuntimeDbPath(stateRoot) }).map((task) => task.id)).not.toContain('missed');

    const persistedState = loadAutomationRuntimeStateMap({ dbPath: resolveRuntimeDbPath(stateRoot) });
    expect(Object.keys(persistedState).length).toBe(0);

    await module.stop?.(context);
  });
});
