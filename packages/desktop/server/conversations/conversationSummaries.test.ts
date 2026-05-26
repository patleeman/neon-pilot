import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  normalizeConversationSummaryBackfillLoopOptions,
  parseConversationSummaryAttemptTimestamp,
  queueConversationSummaryBackfill,
  readConversationSummaryBackfillStateForTests,
  readConversationSummaryIndexCapability,
  setConversationSummaryJobRunnerForTests,
  startConversationSummaryBackfillLoop,
  stopConversationSummaryBackfillLoop,
} from './conversationSummaries.js';
import type { SessionMeta } from './sessions.js';

afterEach(() => {
  setConversationSummaryJobRunnerForTests(null);
  stopConversationSummaryBackfillLoop();
  vi.useRealTimers();
});

const tempRoots: string[] = [];

function meta(id: string, overrides: Partial<SessionMeta> = {}): SessionMeta {
  const root = mkdtempSync(join(tmpdir(), 'neon-summary-test-'));
  tempRoots.push(root);
  const file = join(root, `${id}.jsonl`);
  writeFileSync(file, `${JSON.stringify({ type: 'session', id, timestamp: '2026-05-01T00:00:00.000Z', cwd: '/repo' })}\n`);
  return {
    id,
    file,
    timestamp: '2026-05-01T00:00:00.000Z',
    cwd: '/repo',
    cwdSlug: 'repo',
    model: 'test-model',
    title: `Conversation ${id}`,
    messageCount: 2,
    lastActivityAt: '2026-05-01T00:00:01.000Z',
    isRunning: false,
    isLive: false,
    needsAttention: false,
    ...overrides,
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('normalizeConversationSummaryBackfillLoopOptions', () => {
  it('uses defaults when no input provided', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({});
    expect(result.initialDelayMs).toBe(300_000);
    expect(result.intervalMs).toBe(600_000);
    expect(result.limit).toBe(25);
    expect(result.jobDelayMs).toBe(1_500);
  });

  it('clamps initialDelayMs to max', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ initialDelayMs: 600_000 });
    expect(result.initialDelayMs).toBe(300_000);
  });

  it('uses default for negative initialDelayMs', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ initialDelayMs: -1 });
    expect(result.initialDelayMs).toBe(300_000);
  });

  it('uses 0 initialDelayMs as-is', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ initialDelayMs: 0 });
    expect(result.initialDelayMs).toBe(0);
  });

  it('clamps intervalMs to max', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ intervalMs: 1_000_000 });
    expect(result.intervalMs).toBe(600_000);
  });

  it('uses default when intervalMs is below minimum', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ intervalMs: 1_000 });
    expect(result.intervalMs).toBe(600_000);
  });

  it('preserves moderate limit values', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ limit: 100 });
    expect(result.limit).toBe(100);
  });

  it('clamps limit to max', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ limit: 1_000 });
    expect(result.limit).toBe(500);
  });

  it('uses default for non-positive limit', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ limit: 0 });
    expect(result.limit).toBe(25);
  });

  it('preserves valid custom values', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({
      initialDelayMs: 10_000,
      intervalMs: 120_000,
      limit: 16,
      jobDelayMs: 25,
    });
    expect(result.initialDelayMs).toBe(10_000);
    expect(result.intervalMs).toBe(120_000);
    expect(result.limit).toBe(16);
    expect(result.jobDelayMs).toBe(25);
  });

  it('clamps jobDelayMs to max', () => {
    const result = normalizeConversationSummaryBackfillLoopOptions({ jobDelayMs: 120_000 } as never);
    expect(result.jobDelayMs).toBe(60_000);
  });
});

describe('startConversationSummaryBackfillLoop', () => {
  it('waits for the startup grace period before scanning old sessions', async () => {
    vi.useFakeTimers();
    const listSessions = vi.fn(() => []);

    startConversationSummaryBackfillLoop({ listSessions, initialDelayMs: 60_000, intervalMs: 120_000 });

    await vi.advanceTimersByTimeAsync(59_999);
    expect(listSessions).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(listSessions).toHaveBeenCalledTimes(1);
  });

  it('queues only closed sessions up to the configured limit', async () => {
    vi.useFakeTimers();
    const started: string[] = [];
    setConversationSummaryJobRunnerForTests(async (session) => {
      started.push(session.id);
    });

    startConversationSummaryBackfillLoop({
      listSessions: () => [
        meta('closed-1'),
        meta('running', { isRunning: true }),
        meta('live', { isLive: true }),
        meta('empty', { messageCount: 0 }),
        meta('closed-2'),
        meta('closed-3'),
      ],
      initialDelayMs: 0,
      intervalMs: 120_000,
      limit: 2,
      jobDelayMs: 1,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(started).toEqual(['closed-1', 'closed-2']);
  });

  it('runs one summary job at a time and waits jobDelayMs before the next job', async () => {
    vi.useFakeTimers();
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    setConversationSummaryJobRunnerForTests(
      (session) =>
        new Promise<void>((resolve) => {
          started.push(session.id);
          resolvers.push(resolve);
        }),
    );

    queueConversationSummaryBackfill([meta('a'), meta('b'), meta('c')], 3);
    expect(started).toEqual(['a']);
    expect(readConversationSummaryBackfillStateForTests()).toMatchObject({ active: 1, pending: 2 });

    resolvers.shift()?.();
    await vi.advanceTimersByTimeAsync(1_499);
    expect(started).toEqual(['a']);

    await vi.advanceTimersByTimeAsync(1);
    expect(started).toEqual(['a', 'b']);
    expect(readConversationSummaryBackfillStateForTests()).toMatchObject({ active: 1, pending: 1 });

    resolvers.shift()?.();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(started).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates queued sessions while a job is pending or active', async () => {
    vi.useFakeTimers();
    const started: string[] = [];
    setConversationSummaryJobRunnerForTests(
      (session) =>
        new Promise<void>(() => {
          started.push(session.id);
        }),
    );

    queueConversationSummaryBackfill([meta('dup'), meta('dup'), meta('other')], 10);

    expect(started).toEqual(['dup']);
    expect(readConversationSummaryBackfillStateForTests()).toMatchObject({ active: 1, pending: 1, queued: 1 });
  });

  it('summary reads are cache-only and do not enqueue work', () => {
    const before = readConversationSummaryBackfillStateForTests();
    const result = readConversationSummaryIndexCapability({ sessionIds: ['missing-a', 'missing-b'] });
    expect(result).toEqual({ summaries: {} });
    expect(readConversationSummaryBackfillStateForTests()).toEqual(before);
  });
});

describe('parseConversationSummaryAttemptTimestamp', () => {
  it('parses a valid ISO timestamp', () => {
    const ms = parseConversationSummaryAttemptTimestamp('2026-05-02T10:00:00.000Z');
    expect(Number.isFinite(ms)).toBe(true);
    expect(ms).toBeGreaterThan(0);
  });

  it('rejects ISO timestamp without milliseconds due to roundtrip check', () => {
    const result = parseConversationSummaryAttemptTimestamp('2026-05-02T10:00:00Z');
    expect(Number.isFinite(result)).toBe(false);
  });

  it('returns NaN for empty string', () => {
    expect(parseConversationSummaryAttemptTimestamp('')).toBeNaN();
  });

  it('returns NaN for non-ISO string', () => {
    expect(parseConversationSummaryAttemptTimestamp('not a date')).toBeNaN();
  });

  it('returns NaN for whitespace-only', () => {
    expect(parseConversationSummaryAttemptTimestamp('   ')).toBeNaN();
  });

  it('rejects timestamps that roundtrip differently (invalid ISO)', () => {
    // 2026-13-01 is invalid month but Date.parse might accept it
    const result = parseConversationSummaryAttemptTimestamp('2026-13-01T00:00:00.000Z');
    expect(Number.isFinite(result)).toBe(false);
  });
});
