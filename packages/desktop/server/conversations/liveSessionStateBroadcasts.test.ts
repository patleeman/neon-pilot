import { beforeEach, describe, expect, it, vi } from 'vitest';

const windows = vi.hoisted(() => ({ normalizeModelContextWindow: vi.fn((_modelId, value, fallback) => value ?? fallback) }));
const parallel = vi.hoisted(() => ({ readParallelState: vi.fn((jobs) => jobs ?? []) }));
const queue = vi.hoisted(() => ({ readQueueState: vi.fn(() => ({ steering: [], followUp: [] })) }));
const usage = vi.hoisted(() => ({
  estimateContextUsageSegments: vi.fn(() => [{ key: 'user', tokens: 10 }]),
  estimateSessionContextTokens: vi.fn(() => 50),
}));

vi.mock('../models/modelContextWindows.js', () => windows);
vi.mock('./liveSessionParallelJobs.js', () => parallel);
vi.mock('./liveSessionQueue.js', () => queue);
vi.mock('./sessionContextUsage.js', () => usage);

import {
  broadcastLiveSessionContextUsage,
  broadcastLiveSessionParallelState,
  broadcastLiveSessionQueueState,
  clearLiveSessionContextUsageTimer,
  readLiveSessionContextUsage,
  scheduleLiveSessionContextUsage,
} from './liveSessionStateBroadcasts.js';

describe('live session state broadcasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function session(overrides: Record<string, unknown> = {}) {
    return {
      model: { id: 'model-1', contextWindow: 1000 },
      messages: [{ role: 'user', content: 'hello' }],
      getContextUsage: vi.fn(() => ({ tokens: 100, contextWindow: 500 })),
      ...overrides,
    };
  }

  it('reads context usage from session-provided usage and computes percent/segments', () => {
    expect(readLiveSessionContextUsage(session() as never)).toEqual({
      tokens: 100,
      contextWindow: 500,
      modelId: 'model-1',
      percent: 20,
      segments: [{ key: 'user', tokens: 10 }],
    });
    expect(windows.normalizeModelContextWindow).toHaveBeenCalledWith('model-1', 500, 1000);
  });

  it('falls back to estimated tokens when usage is unavailable and handles null/invalid usage safely', () => {
    expect(readLiveSessionContextUsage(session({ getContextUsage: vi.fn(() => null) }) as never)).toMatchObject({ tokens: 50, percent: 5 });
    expect(
      readLiveSessionContextUsage(session({ getContextUsage: vi.fn(() => ({ tokens: null, contextWindow: 500 })) }) as never),
    ).toMatchObject({
      tokens: null,
      percent: null,
      contextWindow: 500,
    });
    expect(
      readLiveSessionContextUsage(session({ getContextUsage: vi.fn(() => ({ tokens: -1, contextWindow: 500 })) }) as never),
    ).toBeNull();
    expect(
      readLiveSessionContextUsage(
        session({
          getContextUsage: vi.fn(() => {
            throw new Error('boom');
          }),
        }) as never,
      ),
    ).toBeNull();
  });

  it('broadcasts context usage only when changed unless forced', () => {
    const entry = { session: session(), lastContextUsageJson: null };
    const send = vi.fn();

    broadcastLiveSessionContextUsage(entry as never, send);
    broadcastLiveSessionContextUsage(entry as never, send);
    broadcastLiveSessionContextUsage(entry as never, send, true);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({ type: 'context_usage', usage: expect.objectContaining({ tokens: 100 }) });
  });

  it('broadcasts queue and parallel state only when changed unless forced', () => {
    const queueEntry = { session: session(), lastQueueStateJson: null };
    const parallelEntry = { parallelJobs: [{ id: 'job-1' }], lastParallelStateJson: null };
    const send = vi.fn();

    broadcastLiveSessionQueueState(queueEntry as never, send);
    broadcastLiveSessionQueueState(queueEntry as never, send);
    broadcastLiveSessionQueueState(queueEntry as never, send, true);
    broadcastLiveSessionParallelState(parallelEntry as never, send);
    broadcastLiveSessionParallelState(parallelEntry as never, send);
    broadcastLiveSessionParallelState(parallelEntry as never, send, true);

    expect(send).toHaveBeenCalledTimes(4);
    expect(send).toHaveBeenCalledWith({ type: 'queue_state', steering: [], followUp: [] });
    expect(send).toHaveBeenCalledWith({ type: 'parallel_state', jobs: [{ id: 'job-1' }] });
  });

  it('schedules at most one context usage broadcast and can clear it', () => {
    vi.useFakeTimers();
    const entry = { session: session(), lastContextUsageJson: null, contextUsageTimer: undefined };
    const send = vi.fn();

    scheduleLiveSessionContextUsage(entry as never, send, 100);
    scheduleLiveSessionContextUsage(entry as never, send, 100);
    expect(entry.contextUsageTimer).toBeDefined();
    vi.advanceTimersByTime(100);
    expect(entry.contextUsageTimer).toBeUndefined();
    expect(send).toHaveBeenCalledOnce();

    scheduleLiveSessionContextUsage(entry as never, send, 100);
    clearLiveSessionContextUsageTimer(entry as never);
    expect(entry.contextUsageTimer).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledOnce();
  });
});
