import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const now = new Date('2026-05-22T12:00:00.000Z');
const telemetry = vi.hoisted(() => ({
  traceEvents: [] as Array<Record<string, unknown>>,
  appEvents: [] as Array<Record<string, unknown>>,
  readTraceTelemetryEvents: vi.fn(async (input: { since: string; limit?: number }) =>
    telemetry.traceEvents.filter((event) => typeof event.ts === 'string' && event.ts >= input.since).slice(0, input.limit ?? 50_000),
  ),
  queryAppTelemetryEvents: vi.fn(async (input: { since: string; limit?: number }) =>
    telemetry.appEvents.filter((event) => typeof event.ts === 'string' && event.ts >= input.since).slice(0, input.limit ?? 200),
  ),
}));

vi.mock('@neon-pilot/extensions/backend/telemetry', () => ({
  readTraceTelemetryEvents: telemetry.readTraceTelemetryEvents,
  queryAppTelemetryEvents: telemetry.queryAppTelemetryEvents,
}));

function traceEvent(type: string, id: string, payload: Record<string, unknown>, ts = '2026-05-22T11:00:00.000Z') {
  return { schemaVersion: 1, id, ts, type, sessionId: 'session-1', runId: 'run-1', profile: 'shared', payload };
}

function appEvent(category: string, id: string, metadata: Record<string, unknown> = {}) {
  return {
    id,
    ts: '2026-05-22T11:30:00.000Z',
    source: 'server',
    category,
    name: 'check',
    sessionId: 'session-1',
    runId: null,
    route: null,
    status: 200,
    durationMs: null,
    count: null,
    value: null,
    metadataJson: JSON.stringify(metadata),
  };
}

describe('system-telemetry backend routes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    telemetry.traceEvents = [];
    telemetry.appEvents = [];
    telemetry.readTraceTelemetryEvents.mockClear();
    telemetry.queryAppTelemetryEvents.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function backend() {
    vi.resetModules();
    return import('./backend.js');
  }

  it('summarizes stats and tool events inside the requested range', async () => {
    telemetry.traceEvents = [
      traceEvent('stats', 'stats-1', { tokensInput: 100, tokensOutput: 50, tokensCachedInput: 25, tokensCachedWrite: 5, cost: 0.12 }),
      traceEvent('tool_call', 'tool-1', { toolName: 'bash', status: 'ok' }),
      traceEvent('tool_call', 'tool-2', { toolName: 'read', status: 'error' }),
      traceEvent('stats', 'old', { tokensInput: 999 }, '2026-05-20T00:00:00.000Z'),
    ];

    const { summary } = await backend();
    await expect(summary({ query: { range: '24h' } })).resolves.toMatchObject({
      body: {
        activeSessions: 1,
        runsToday: 1,
        totalCost: 0.12,
        tokensTotal: 180,
        tokensInput: 100,
        tokensOutput: 50,
        tokensCached: 25,
        tokensCachedWrite: 5,
        toolCalls: 2,
        toolErrors: 1,
      },
    });
    expect(telemetry.readTraceTelemetryEvents).toHaveBeenCalledWith({ since: '2026-05-21T12:00:00.000Z', limit: 100_000 });
  });

  it('aggregates auto-mode events and context pointer usage', async () => {
    telemetry.traceEvents = [
      traceEvent('auto_mode', 'auto-1', { enabled: true }),
      traceEvent('auto_mode', 'auto-2', { enabled: false, stopReason: 'done' }, '2026-05-22T11:10:00.000Z'),
      traceEvent('suggested_context', 'suggest-1', { pointerCount: 3 }),
      traceEvent('context_pointer_inspect', 'inspect-1', { wasSuggested: true }),
      traceEvent('context_pointer_inspect', 'inspect-2', { wasSuggested: false }),
    ];

    const { autoMode, contextPointers } = await backend();
    await expect(autoMode({ query: { range: '24h' } })).resolves.toMatchObject({
      body: {
        currentActive: 0,
        enabledCount: 1,
        disabledCount: 1,
        topStopReasons: [{ reason: 'done', count: 1 }],
      },
    });
    await expect(contextPointers({ query: { range: '24h' } })).resolves.toEqual({
      status: 200,
      body: {
        summary: {
          totalSuggested: 3,
          totalInspects: 1,
          totalAnyInspects: 2,
          usageRate: 33.3,
          sessionsWithSuggested: 1,
          avgPointersPerTurn: 3,
        },
        daily: [{ date: '2026-05-22', suggested: 3, inspected: 1 }],
      },
    });
  });

  it('returns session integrity app telemetry rows newest first', async () => {
    telemetry.appEvents = [appEvent('other', 'event-1'), appEvent('session_integrity', 'event-2', { issue: 'dangling' })];

    const { sessionIntegrity } = await backend();
    await expect(sessionIntegrity({ query: { range: '24h' } })).resolves.toEqual({
      status: 200,
      body: [
        expect.objectContaining({ id: 'event-2', category: 'session_integrity', metadataJson: JSON.stringify({ issue: 'dangling' }) }),
      ],
    });
    expect(telemetry.queryAppTelemetryEvents).toHaveBeenCalledWith({ since: '2026-05-21T12:00:00.000Z', limit: 200 });
  });
});
