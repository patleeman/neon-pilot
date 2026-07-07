import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type AppTelemetryLogEvent,
  closeAppTelemetryLogs,
  exportAppTelemetryLogBundle,
  getAppTelemetryExportDir,
  getAppTelemetryLogDir,
  listAppTelemetryLogFiles,
  readAppTelemetryLogEvents,
  resolveAppTelemetryLogDir,
  writeAppTelemetryLogEvent,
} from './app-telemetry-log.js';

function event(overrides: Partial<AppTelemetryLogEvent> = {}): AppTelemetryLogEvent {
  return {
    schemaVersion: 1,
    id: overrides.id ?? randomUUID(),
    ts: overrides.ts ?? '2026-05-22T12:00:00.000Z',
    source: overrides.source ?? 'server',
    category: overrides.category ?? 'api',
    name: overrides.name ?? 'request',
    sessionId: overrides.sessionId ?? null,
    runId: overrides.runId ?? null,
    route: overrides.route ?? null,
    status: overrides.status ?? null,
    durationMs: overrides.durationMs ?? null,
    count: overrides.count ?? null,
    value: overrides.value ?? null,
    metadata: overrides.metadata ?? null,
  };
}

describe('app-telemetry-log', () => {
  const stateRoot = join(tmpdir(), `app-telemetry-log-test-${randomUUID()}`);
  const originalMaxBytes = process.env.NEON_PILOT_APP_TELEMETRY_LOG_MAX_BYTES;
  const originalRetentionDays = process.env.NEON_PILOT_APP_TELEMETRY_LOG_RETENTION_DAYS;

  beforeEach(() => {
    closeAppTelemetryLogs();
    rmSync(stateRoot, { recursive: true, force: true });
    delete process.env.NEON_PILOT_APP_TELEMETRY_LOG_MAX_BYTES;
    delete process.env.NEON_PILOT_APP_TELEMETRY_LOG_RETENTION_DAYS;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    closeAppTelemetryLogs();
    rmSync(stateRoot, { recursive: true, force: true });
    if (originalMaxBytes) process.env.NEON_PILOT_APP_TELEMETRY_LOG_MAX_BYTES = originalMaxBytes;
    else delete process.env.NEON_PILOT_APP_TELEMETRY_LOG_MAX_BYTES;
    if (originalRetentionDays) process.env.NEON_PILOT_APP_TELEMETRY_LOG_RETENTION_DAYS = originalRetentionDays;
    else delete process.env.NEON_PILOT_APP_TELEMETRY_LOG_RETENTION_DAYS;
  });

  it('writes, lists, and reads app telemetry events newest first with schema normalization', () => {
    writeAppTelemetryLogEvent(event({ id: 'old', ts: '2026-05-21T23:59:59.000Z' }), stateRoot);
    writeAppTelemetryLogEvent(
      event({ id: 'newer', ts: '2026-05-22T12:00:00.000Z', status: 200, durationMs: 8.5, metadata: { ok: true } }),
      stateRoot,
    );
    writeAppTelemetryLogEvent(event({ id: 'newest', ts: '2026-05-22T13:00:00.000Z', count: 2, value: 3 }), stateRoot);

    const files = listAppTelemetryLogFiles(stateRoot);
    expect(files.map((file) => file.name)).toEqual(['app-telemetry-2026-05-22.jsonl', 'app-telemetry-2026-05-21.jsonl']);
    expect(files[0].sizeBytes).toBeGreaterThan(0);
    expect(files[0].modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const events = readAppTelemetryLogEvents({ since: '2026-05-22T00:00:00.000Z', limit: 10, stateRoot });
    expect(events.map((item) => item.id)).toEqual(['newest', 'newer']);
    expect(events[1]).toMatchObject({ source: 'server', category: 'api', name: 'request', status: 200, metadata: { ok: true } });
  });

  it('skips malformed records and coerces optional fields when reading', () => {
    const dir = resolveAppTelemetryLogDir(stateRoot);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'app-telemetry-2026-05-22.jsonl'),
      [
        JSON.stringify({
          schemaVersion: 1,
          id: 'valid',
          ts: '2026-05-22T12:00:00.000Z',
          source: 'renderer',
          category: 'navigation',
          name: 'route_view',
          sessionId: 7,
          runId: 8,
          route: 9,
          status: Number.NaN,
          durationMs: Infinity,
          metadata: [],
        }),
        JSON.stringify({ schemaVersion: 1, id: 'missing-name', ts: '2026-05-22T12:00:00.000Z', source: 'server', category: 'api' }),
        '{not-json}',
      ].join('\n'),
      'utf-8',
    );

    expect(readAppTelemetryLogEvents({ since: '2026-05-22T00:00:00.000Z', limit: 10, stateRoot })).toEqual([
      {
        schemaVersion: 1,
        id: 'valid',
        ts: '2026-05-22T12:00:00.000Z',
        source: 'renderer',
        category: 'navigation',
        name: 'route_view',
        sessionId: '7',
        runId: '8',
        route: '9',
        status: null,
        durationMs: null,
        count: null,
        value: null,
        metadata: null,
      },
    ]);
  });

  it('exports only events since the requested timestamp and counts contributing files', () => {
    writeAppTelemetryLogEvent(event({ id: 'old', ts: '2026-05-21T12:00:00.000Z' }), stateRoot);
    writeAppTelemetryLogEvent(event({ id: 'included-1', ts: '2026-05-22T12:00:00.000Z' }), stateRoot);
    writeAppTelemetryLogEvent(event({ id: 'included-2', ts: '2026-05-23T12:00:00.000Z' }), stateRoot);

    const bundle = exportAppTelemetryLogBundle({ since: '2026-05-22T00:00:00.000Z', stateRoot });

    expect(bundle.fileCount).toBe(2);
    expect(bundle.eventCount).toBe(2);
    expect(bundle.sizeBytes).toBeGreaterThan(0);
    expect(readFileSync(bundle.path, 'utf-8')).toContain('included-1');
    expect(readFileSync(bundle.path, 'utf-8')).not.toContain('old');
  });

  it('rotates and prunes log files using configured thresholds', () => {
    process.env.NEON_PILOT_APP_TELEMETRY_LOG_MAX_BYTES = '120';
    process.env.NEON_PILOT_APP_TELEMETRY_LOG_RETENTION_DAYS = '1';
    const dir = resolveAppTelemetryLogDir(stateRoot);
    mkdirSync(dir, { recursive: true });
    const oldFile = join(dir, 'app-telemetry-2026-05-20.jsonl');
    writeFileSync(oldFile, `${JSON.stringify(event({ id: 'old' }))}\n`, 'utf-8');
    const oldTime = new Date('2026-05-20T00:00:00.000Z');
    utimesSync(oldFile, oldTime, oldTime);
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-22T00:00:00.000Z').getTime());

    for (let index = 0; index < 250; index += 1) {
      writeAppTelemetryLogEvent(event({ id: `event-${index}`, payload: undefined } as Partial<AppTelemetryLogEvent>), stateRoot);
    }

    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(join(dir, 'app-telemetry-2026-05-22.1.jsonl'))).toBe(true);
    expect(statSync(join(dir, 'app-telemetry-2026-05-22.jsonl')).size).toBeGreaterThan(0);
  });

  it('returns safe empty results and logs write errors instead of throwing', () => {
    expect(listAppTelemetryLogFiles(stateRoot)).toEqual([]);
    expect(readAppTelemetryLogEvents({ since: '2026-05-22T00:00:00.000Z', limit: 10, stateRoot })).toEqual([]);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    writeAppTelemetryLogEvent(event(), '/dev/null/not-a-directory');

    expect(spy).toHaveBeenCalled();
  });
});

describe('app-telemetry-log layout-aware helpers', () => {
  const testLayout = {
    root: '/custom/desktop',
    apps: '/custom/desktop/apps',
    data: '/custom/desktop/data',
    dataApps: '/custom/desktop/data/apps',
    dataDocuments: '/custom/desktop/data/documents',
    dataExports: '/custom/desktop/data/exports',
    documents: '/custom/desktop/documents',
    agents: '/custom/desktop/agents',
    soulDoc: '/custom/desktop/agents/soul.md',
    logs: '/custom/desktop/logs',
    logsDesktop: '/custom/desktop/logs/desktop',
    logsDaemon: '/custom/desktop/logs/daemon',
    logsTelemetry: '/custom/desktop/logs/telemetry',
    system: '/custom/desktop/system',
    systemAgents: '/custom/desktop/system/agents',
    systemApps: '/custom/desktop/system/apps',
    systemCache: '/custom/desktop/system/cache',
    systemConfig: '/custom/desktop/system/config',
    systemConversations: '/custom/desktop/system/conversations',
    systemConversationsIndex: '/custom/desktop/system/conversations/session-meta-index.json',
    systemSessions: '/custom/desktop/system/conversations/sessions',
    systemDaemon: '/custom/desktop/system/daemon',
    systemElectron: '/custom/desktop/system/electron',
    systemElectronUserData: '/custom/desktop/system/electron/user-data',
    systemObservability: '/custom/desktop/system/observability',
    systemRuntime: '/custom/desktop/system/runtime',
    systemChatWorkspaces: '/custom/desktop/system/runtime/chat-workspaces',
    systemSecrets: '/custom/desktop/system/secrets',
    systemState: '/custom/desktop/system/state',
  };

  it('getAppTelemetryLogDir returns layout.logsTelemetry when layout is provided', () => {
    expect(getAppTelemetryLogDir(testLayout)).toBe('/custom/desktop/logs/telemetry');
  });

  it('getAppTelemetryLogDir falls back to stateRoot-based path when no layout is provided', () => {
    const result = getAppTelemetryLogDir();
    expect(result).toMatch(/logs\/telemetry$/);
  });

  it('getAppTelemetryExportDir returns layout.dataExports/telemetry when layout is provided', () => {
    expect(getAppTelemetryExportDir(testLayout)).toBe('/custom/desktop/data/exports/telemetry');
  });

  it('getAppTelemetryExportDir falls back to stateRoot-based path when no layout is provided', () => {
    const result = getAppTelemetryExportDir();
    expect(result).toMatch(/exports\/telemetry$/);
  });
});
