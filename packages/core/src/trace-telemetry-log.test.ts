import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeTraceTelemetryLogs,
  getTraceTelemetryLogDir,
  readTraceTelemetryLogEvents,
  resolveTraceTelemetryLogDir,
  resolveTraceTelemetryLogPath,
  type TraceTelemetryLogEvent,
  writeTraceTelemetryLogEvent,
} from './trace-telemetry-log.js';

function event(overrides: Partial<TraceTelemetryLogEvent> = {}): TraceTelemetryLogEvent {
  return {
    schemaVersion: 1,
    id: overrides.id ?? randomUUID(),
    ts: overrides.ts ?? '2026-05-22T12:00:00.000Z',
    type: overrides.type ?? 'stats',
    sessionId: overrides.sessionId ?? 'session-1',
    runId: overrides.runId ?? null,
    profile: overrides.profile ?? 'default',
    payload: overrides.payload ?? { totalTokens: 123 },
  };
}

describe('trace-telemetry-log', () => {
  const stateRoot = join(tmpdir(), `trace-telemetry-log-test-${randomUUID()}`);
  const originalMaxBytes = process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_MAX_BYTES;
  const originalRetentionDays = process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_RETENTION_DAYS;

  beforeEach(() => {
    closeTraceTelemetryLogs();
    rmSync(stateRoot, { recursive: true, force: true });
    delete process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_MAX_BYTES;
    delete process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_RETENTION_DAYS;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    closeTraceTelemetryLogs();
    rmSync(stateRoot, { recursive: true, force: true });
    if (originalMaxBytes) process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_MAX_BYTES = originalMaxBytes;
    else delete process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_MAX_BYTES;
    if (originalRetentionDays) process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_RETENTION_DAYS = originalRetentionDays;
    else delete process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_RETENTION_DAYS;
  });

  it('writes JSONL trace events and reads valid events at or after the requested timestamp', () => {
    writeTraceTelemetryLogEvent(event({ id: 'old', ts: '2026-05-21T23:59:59.000Z' }), stateRoot);
    writeTraceTelemetryLogEvent(event({ id: 'newer', ts: '2026-05-22T12:00:00.000Z', payload: { model: 'gpt' } }), stateRoot);
    writeTraceTelemetryLogEvent(event({ id: 'newest', ts: '2026-05-22T13:00:00.000Z', type: 'tool_call' }), stateRoot);

    const events = readTraceTelemetryLogEvents({ since: '2026-05-22T00:00:00.000Z', stateRoot });

    expect(events.map((item) => item.id)).toEqual(['newer', 'newest']);
    expect(events[0]).toMatchObject({ schemaVersion: 1, type: 'stats', sessionId: 'session-1', payload: { model: 'gpt' } });

    const logPath = resolveTraceTelemetryLogPath('2026-05-22T12:00:00.000Z', stateRoot);
    expect(readFileSync(logPath, 'utf-8').trim().split('\n')).toHaveLength(2);
  });

  it('coerces malformed optional fields and skips malformed required fields while reading', () => {
    const dir = resolveTraceTelemetryLogDir(stateRoot);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'trace-telemetry-2026-05-22.jsonl'),
      [
        JSON.stringify({
          schemaVersion: 1,
          id: 'valid',
          ts: '2026-05-22T12:00:00.000Z',
          type: 'context',
          sessionId: 's',
          runId: 42,
          payload: [],
        }),
        JSON.stringify({ schemaVersion: 1, id: 'missing-session', ts: '2026-05-22T12:00:00.000Z', type: 'context' }),
        '{not-json}',
      ].join('\n'),
      'utf-8',
    );

    const events = readTraceTelemetryLogEvents({ since: '2026-05-22T00:00:00.000Z', stateRoot });

    expect(events).toEqual([
      {
        schemaVersion: 1,
        id: 'valid',
        ts: '2026-05-22T12:00:00.000Z',
        type: 'context',
        sessionId: 's',
        runId: '42',
        profile: '',
        payload: {},
      },
    ]);
  });

  it('rotates to numbered segments when the daily log would exceed the configured max bytes', () => {
    process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_MAX_BYTES = '120';
    writeTraceTelemetryLogEvent(event({ id: 'first', payload: { text: 'x'.repeat(80) } }), stateRoot);
    writeTraceTelemetryLogEvent(event({ id: 'second', payload: { text: 'y'.repeat(80) } }), stateRoot);

    const dir = resolveTraceTelemetryLogDir(stateRoot);
    expect(readFileSync(join(dir, 'trace-telemetry-2026-05-22.jsonl'), 'utf-8')).toContain('first');
    expect(existsSync(join(dir, 'trace-telemetry-2026-05-22.1.jsonl'))).toBe(true);
    expect(readFileSync(join(dir, 'trace-telemetry-2026-05-22.1.jsonl'), 'utf-8')).toContain('second');
  });

  it('prunes old trace telemetry files every 250 writes', () => {
    process.env.NEON_PILOT_TRACE_TELEMETRY_LOG_RETENTION_DAYS = '1';
    const dir = resolveTraceTelemetryLogDir(stateRoot);
    mkdirSync(dir, { recursive: true });
    const oldFile = join(dir, 'trace-telemetry-2026-05-20.jsonl');
    writeFileSync(oldFile, `${JSON.stringify(event({ id: 'old' }))}\n`, 'utf-8');
    const oldTime = new Date('2026-05-20T00:00:00.000Z');
    utimesSync(oldFile, oldTime, oldTime);
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-22T00:00:00.000Z').getTime());

    for (let index = 0; index < 250; index += 1) {
      writeTraceTelemetryLogEvent(event({ id: `event-${index}` }), stateRoot);
    }

    expect(existsSync(oldFile)).toBe(false);
    expect(statSync(resolveTraceTelemetryLogPath('2026-05-22T12:00:00.000Z', stateRoot)).size).toBeGreaterThan(0);
  });

  it('falls back to the base path if segment inspection fails', () => {
    mkdirSync(resolveTraceTelemetryLogDir(stateRoot), { recursive: true });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(basename(resolveTraceTelemetryLogPath('invalid-date', stateRoot))).toMatch(/^trace-telemetry-\d{4}-\d{2}-\d{2}\.jsonl$/);
    writeTraceTelemetryLogEvent(event({ ts: 'bad-date' }), '/dev/null/not-a-directory');

    expect(spy).toHaveBeenCalled();
  });
});

describe('trace-telemetry-log layout-aware helpers', () => {
  it('getTraceTelemetryLogDir returns layout.logsTelemetry when layout is provided', () => {
    const layout = {
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

    expect(getTraceTelemetryLogDir(layout)).toBe('/custom/desktop/logs/telemetry');
  });

  it('getTraceTelemetryLogDir falls back to stateRoot-based path when no layout is provided', () => {
    const result = getTraceTelemetryLogDir();
    expect(result).toMatch(/logs\/telemetry$/);
  });

  it('writes trace telemetry events to the layout-derived directory when layout is provided', () => {
    const layoutRoot = join(tmpdir(), `trace-layout-test-${randomUUID()}`);
    const layout = {
      root: layoutRoot,
      apps: join(layoutRoot, 'apps'),
      data: join(layoutRoot, 'data'),
      dataApps: join(layoutRoot, 'data/apps'),
      dataDocuments: join(layoutRoot, 'data/documents'),
      dataExports: join(layoutRoot, 'data/exports'),
      documents: join(layoutRoot, 'documents'),
      agents: join(layoutRoot, 'agents'),
      soulDoc: join(layoutRoot, 'agents/soul.md'),
      logs: join(layoutRoot, 'logs'),
      logsDesktop: join(layoutRoot, 'logs/desktop'),
      logsDaemon: join(layoutRoot, 'logs/daemon'),
      logsTelemetry: join(layoutRoot, 'logs/telemetry'),
      system: join(layoutRoot, 'system'),
      systemAgents: join(layoutRoot, 'system/agents'),
      systemApps: join(layoutRoot, 'system/apps'),
      systemCache: join(layoutRoot, 'system/cache'),
      systemConfig: join(layoutRoot, 'system/config'),
      systemConversations: join(layoutRoot, 'system/conversations'),
      systemConversationsIndex: join(layoutRoot, 'system/conversations/session-meta-index.json'),
      systemSessions: join(layoutRoot, 'system/conversations/sessions'),
      systemDaemon: join(layoutRoot, 'system/daemon'),
      systemElectron: join(layoutRoot, 'system/electron'),
      systemElectronUserData: join(layoutRoot, 'system/electron/user-data'),
      systemObservability: join(layoutRoot, 'system/observability'),
      systemRuntime: join(layoutRoot, 'system/runtime'),
      systemChatWorkspaces: join(layoutRoot, 'system/runtime/chat-workspaces'),
      systemSecrets: join(layoutRoot, 'system/secrets'),
      systemState: join(layoutRoot, 'system/state'),
    };

    writeTraceTelemetryLogEvent(event({ id: 'layout-event', ts: '2026-06-01T12:00:00.000Z' }), undefined, layout);

    const events = readTraceTelemetryLogEvents({ since: '2026-06-01T00:00:00.000Z', layout });
    expect(events.map((item) => item.id)).toEqual(['layout-event']);

    // File should exist under the layout-derived directory
    const logPath = resolveTraceTelemetryLogPath('2026-06-01T12:00:00.000Z', undefined, 0, layout);
    expect(logPath).toMatch(new RegExp(layout.logsTelemetry.replace(/[/\\]/g, '\\$&')));
    expect(readFileSync(logPath, 'utf-8').trim()).toContain('layout-event');

    rmSync(layoutRoot, { recursive: true, force: true });
  });
});
