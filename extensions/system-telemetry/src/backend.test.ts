import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const now = new Date('2026-05-22T12:00:00.000Z');

function traceEvent(type: string, id: string, payload: Record<string, unknown>, ts = '2026-05-22T11:00:00.000Z') {
  return JSON.stringify({ schemaVersion: 1, id, ts, type, sessionId: 'session-1', runId: 'run-1', profile: 'shared', payload });
}

function appEvent(category: string, id: string, metadata: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    id,
    ts: '2026-05-22T11:30:00.000Z',
    source: 'server',
    category,
    name: 'check',
    sessionId: 'session-1',
    status: 200,
    metadata,
  });
}

describe('system-telemetry backend routes', () => {
  const stateRoot = join(tmpdir(), `system-telemetry-${process.pid}`);
  const logDir = join(stateRoot, 'logs', 'telemetry');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    rmSync(stateRoot, { recursive: true, force: true });
    mkdirSync(logDir, { recursive: true });
    vi.stubEnv('NEON_PILOT_STATE_ROOT', stateRoot);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    rmSync(stateRoot, { recursive: true, force: true });
  });

  async function backend() {
    vi.resetModules();
    return import('./backend.js');
  }

  it('summarizes stats and tool events inside the requested range', async () => {
    writeFileSync(
      join(logDir, 'trace-telemetry-2026-05-22.jsonl'),
      [
        traceEvent('stats', 'stats-1', { tokensInput: 100, tokensOutput: 50, tokensCachedInput: 25, tokensCachedWrite: 5, cost: 0.12 }),
        traceEvent('tool_call', 'tool-1', { toolName: 'bash', status: 'ok' }),
        traceEvent('tool_call', 'tool-2', { toolName: 'read', status: 'error' }),
        traceEvent('stats', 'old', { tokensInput: 999 }, '2026-05-20T00:00:00.000Z'),
      ].join('\n'),
    );

    const { summary } = await backend();
    expect(summary({ query: { range: '24h' } }).body).toMatchObject({
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
    });
  });

  it('aggregates auto-mode events and context pointer usage', async () => {
    writeFileSync(
      join(logDir, 'trace-telemetry-2026-05-22.jsonl'),
      [
        traceEvent('auto_mode', 'auto-1', { enabled: true }),
        traceEvent('auto_mode', 'auto-2', { enabled: false, stopReason: 'done' }, '2026-05-22T11:10:00.000Z'),
        traceEvent('suggested_context', 'suggest-1', { pointerCount: 3 }),
        traceEvent('context_pointer_inspect', 'inspect-1', { wasSuggested: true }),
        traceEvent('context_pointer_inspect', 'inspect-2', { wasSuggested: false }),
      ].join('\n'),
    );

    const { autoMode, contextPointers } = await backend();
    expect(autoMode({ query: { range: '24h' } }).body).toMatchObject({
      currentActive: 0,
      enabledCount: 1,
      disabledCount: 1,
      topStopReasons: [{ reason: 'done', count: 1 }],
    });
    expect(contextPointers({ query: { range: '24h' } }).body).toEqual({
      summary: {
        totalSuggested: 3,
        totalInspects: 1,
        totalAnyInspects: 2,
        usageRate: 33.3,
        sessionsWithSuggested: 1,
        avgPointersPerTurn: 3,
      },
      daily: [{ date: '2026-05-22', suggested: 3, inspected: 1 }],
    });
  });

  it('returns session integrity app telemetry rows newest first', async () => {
    writeFileSync(
      join(logDir, 'app-telemetry-2026-05-22.jsonl'),
      [appEvent('other', 'event-1'), appEvent('session_integrity', 'event-2', { issue: 'dangling' })].join('\n'),
    );

    const { sessionIntegrity } = await backend();
    expect(sessionIntegrity({ query: { range: '24h' } }).body).toEqual([
      expect.objectContaining({ id: 'event-2', category: 'session_integrity', metadataJson: JSON.stringify({ issue: 'dangling' }) }),
    ]);
  });
});
