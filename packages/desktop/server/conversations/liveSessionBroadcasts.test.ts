import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = vi.hoisted(() => ({ estimateTokens: vi.fn(() => 42) }));
const appEvents = vi.hoisted(() => ({ invalidateAppTopics: vi.fn(), publishAppEvent: vi.fn() }));
const trace = vi.hoisted(() => ({ persistTraceContext: vi.fn() }));
const durableRun = vi.hoisted(() => ({ syncLiveSessionDurableRun: vi.fn() }));
const presence = vi.hoisted(() => ({ broadcastLiveSessionPresenceState: vi.fn() }));
const readApi = vi.hoisted(() => ({ computeLiveSessionRunning: vi.fn(() => false) }));
const stateBroadcasts = vi.hoisted(() => ({
  broadcastLiveSessionContextUsage: vi.fn(),
  broadcastLiveSessionParallelState: vi.fn(),
  broadcastLiveSessionQueueState: vi.fn(),
  clearLiveSessionContextUsageTimer: vi.fn(),
  scheduleLiveSessionContextUsage: vi.fn(),
}));
const sessions = vi.hoisted(() => ({ readGoalFromEntries: vi.fn(() => ({ objective: 'goal' })) }));

vi.mock('@earendil-works/pi-coding-agent', () => agent);
vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('../traces/tracePersistence.js', () => trace);
vi.mock('./liveSessionDurableRun.js', () => durableRun);
vi.mock('./liveSessionPresenceFacade.js', () => presence);
vi.mock('./liveSessionReadApi.js', () => readApi);
vi.mock('./liveSessionStateBroadcasts.js', () => stateBroadcasts);
vi.mock('./sessions.js', () => sessions);

import {
  applySessionTitle,
  broadcast,
  broadcastContextUsage,
  broadcastParallelState,
  broadcastPresenceState,
  broadcastQueueState,
  broadcastSnapshot,
  clearContextUsageTimer,
  publishRunningChange,
  scheduleContextUsage,
  syncDurableConversationRun,
} from './liveSessionBroadcasts.js';

describe('live session broadcasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function entry() {
    return {
      sessionId: 's1',
      running: false,
      listeners: [
        { send: vi.fn(), tailBlocks: 1 },
        { send: vi.fn(), tailBlocks: 2 },
      ],
      session: {
        systemPrompt: 'system prompt',
        model: { id: 'model-1' },
        setSessionName: vi.fn(),
        sessionManager: { getEntries: vi.fn(() => [{ type: 'text', text: 'hello' }]) },
      },
    } as never;
  }

  it('broadcasts events to listeners while honoring exclusions', () => {
    const e = entry() as { listeners: Array<{ send: ReturnType<typeof vi.fn> }> };
    broadcast(e as never, { type: 'event' } as never, { exclude: e.listeners[1] as never });
    expect(e.listeners[0].send).toHaveBeenCalledWith({ type: 'event' });
    expect(e.listeners[1].send).not.toHaveBeenCalled();
  });

  it('broadcasts snapshots with stale state ensured, per-listener tail blocks, and goal state', () => {
    const e = entry() as { listeners: Array<{ send: ReturnType<typeof vi.fn>; tailBlocks: number }> };
    const callbacks = { ensureStaleTurnState: vi.fn(), buildLiveSessionSnapshot: vi.fn((_entry, tailBlocks) => ({ tailBlocks })) };

    broadcastSnapshot(e as never, callbacks);

    expect(callbacks.ensureStaleTurnState).toHaveBeenCalledWith(e);
    expect(sessions.readGoalFromEntries).toHaveBeenCalledWith([{ type: 'text', text: 'hello' }]);
    expect(e.listeners[0].send).toHaveBeenCalledWith({ type: 'snapshot', goalState: { objective: 'goal' }, tailBlocks: 1 });
    expect(e.listeners[1].send).toHaveBeenCalledWith({ type: 'snapshot', goalState: { objective: 'goal' }, tailBlocks: 2 });
  });

  it('publishes running changes only when computed state changes', () => {
    const e = entry() as { running: boolean };
    readApi.computeLiveSessionRunning.mockReturnValueOnce(false);
    publishRunningChange(e as never);
    expect(appEvents.publishAppEvent).not.toHaveBeenCalled();

    readApi.computeLiveSessionRunning.mockReturnValueOnce(true);
    publishRunningChange(e as never);
    expect(e.running).toBe(true);
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({ type: 'session_meta_changed', sessionId: 's1', running: true });
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('sessions');
  });

  it('applies non-empty session titles and broadcasts title updates', () => {
    const e = entry() as {
      title?: string;
      listeners: Array<{ send: ReturnType<typeof vi.fn> }>;
      session: { setSessionName: ReturnType<typeof vi.fn> };
    };
    const callbacks = { resolveEntryTitle: vi.fn(() => 'Resolved Title'), publishSessionMetaChanged: vi.fn() };

    applySessionTitle(e as never, '  New Title  ', callbacks);
    expect(e.session.setSessionName).toHaveBeenCalledWith('New Title');
    expect(e.title).toBe('Resolved Title');
    expect(e.listeners[0].send).toHaveBeenCalledWith({ type: 'title_update', title: 'Resolved Title' });
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({ type: 'live_title', sessionId: 's1', title: 'Resolved Title' });
    expect(callbacks.publishSessionMetaChanged).toHaveBeenCalledWith('s1');

    applySessionTitle(e as never, '   ', callbacks);
    expect(e.session.setSessionName).toHaveBeenCalledTimes(1);
  });

  it('persists and broadcasts context usage with computed token segments', () => {
    const e = entry();
    const usage = {
      modelId: 'usage-model',
      tokens: 100,
      contextWindow: 200,
      percent: 12.345,
      segments: [
        { key: 'user', tokens: 10 },
        { key: 'assistant', tokens: 20 },
        { key: 'tool', tokens: 30 },
        { key: 'summary', tokens: 40 },
      ],
    };
    stateBroadcasts.broadcastLiveSessionContextUsage.mockImplementation((_entry, send, _force) => send({ type: 'context_usage' }));

    broadcastContextUsage(e, { readLiveSessionContextUsageForEntry: vi.fn(() => usage) }, true);

    expect(trace.persistTraceContext).toHaveBeenCalledWith({
      sessionId: 's1',
      modelId: 'usage-model',
      totalTokens: 100,
      contextWindow: 200,
      pct: 12.35,
      segSystem: 42,
      segUser: 10,
      segAssistant: 20,
      segTool: 30,
      segSummary: 40,
      systemPromptTokens: 42,
    });
    expect(stateBroadcasts.broadcastLiveSessionContextUsage).toHaveBeenCalledWith(e, expect.any(Function), true);
  });

  it('delegates durable run, queue, parallel, scheduled context usage, clear, and presence helpers', async () => {
    const e = entry();
    stateBroadcasts.broadcastLiveSessionQueueState.mockImplementation((_entry, send) => send({ type: 'queue' }));
    stateBroadcasts.broadcastLiveSessionParallelState.mockImplementation((_entry, send) => send({ type: 'parallel' }));

    await syncDurableConversationRun(e, { runId: 'run-1' } as never, { force: true });
    broadcastQueueState(e, true);
    broadcastParallelState(e, true);
    scheduleContextUsage(e, 123);
    clearContextUsageTimer(e);
    broadcastPresenceState(e, { exclude: (e as never as { listeners: unknown[] }).listeners[0] as never });

    expect(durableRun.syncLiveSessionDurableRun).toHaveBeenCalledWith(e, { runId: 'run-1' }, { force: true });
    expect(stateBroadcasts.broadcastLiveSessionQueueState).toHaveBeenCalledWith(e, expect.any(Function), true);
    expect(stateBroadcasts.broadcastLiveSessionParallelState).toHaveBeenCalledWith(e, expect.any(Function), true);
    expect(stateBroadcasts.scheduleLiveSessionContextUsage).toHaveBeenCalledWith(e, expect.any(Function), 123);
    expect(stateBroadcasts.clearLiveSessionContextUsageTimer).toHaveBeenCalledWith(e);
    expect(presence.broadcastLiveSessionPresenceState).toHaveBeenCalledWith(
      e,
      { broadcast },
      { exclude: (e as never as { listeners: unknown[] }).listeners[0] },
    );
  });
});
