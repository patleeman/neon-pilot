import { beforeEach, describe, expect, it, vi } from 'vitest';

const parallel = vi.hoisted(() => ({ readParallelState: vi.fn((jobs) => jobs ?? []) }));
const presence = vi.hoisted(() => ({
  buildLiveSessionPresenceState: vi.fn(() => ({ surfaces: ['desktop'] })),
  registerLiveSessionSurface: vi.fn(() => false),
  removeLiveSessionSurface: vi.fn(() => false),
}));
const queue = vi.hoisted(() => ({
  readQueueState: vi.fn(() => ({ steering: [{ id: 'q1', text: 'queued', imageCount: 0 }], followUp: [] })),
}));
const stale = vi.hoisted(() => ({ ensureStaleTurnState: vi.fn() }));
const broadcasts = vi.hoisted(() => ({ readLiveSessionContextUsage: vi.fn(() => ({ tokens: 10 })) }));
const snapshot = vi.hoisted(() => ({ buildLiveSessionSnapshot: vi.fn((_entry, tailBlocks) => ({ id: 's1', tailBlocks })) }));
const sessions = vi.hoisted(() => ({ readGoalFromEntries: vi.fn(() => ({ objective: 'goal' })) }));

vi.mock('./liveSessionParallelJobs.js', () => parallel);
vi.mock('./liveSessionPresence.js', () => presence);
vi.mock('./liveSessionQueue.js', () => queue);
vi.mock('./liveSessionStaleTurns.js', () => stale);
vi.mock('./liveSessionStateBroadcasts.js', () => broadcasts);
vi.mock('./liveSessionStateSnapshot.js', () => snapshot);
vi.mock('./sessions.js', () => sessions);

import { subscribeLiveSession } from './liveSessionSubscription.js';

describe('live session subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presence.registerLiveSessionSurface.mockReturnValue(false);
    presence.removeLiveSessionSurface.mockReturnValue(false);
  });

  function entry(overrides: Record<string, unknown> = {}) {
    return {
      listeners: new Set(),
      title: 'Title',
      presenceBySurfaceId: new Map(),
      activeStaleTurnCustomType: undefined,
      parallelJobs: [{ id: 'job-1' }],
      session: {
        isStreaming: false,
        systemPrompt: ' system prompt ',
        state: { tools: [{ name: 'bash', description: 'Run shell', parameters: { type: 'object' } }] },
        sessionManager: { getEntries: vi.fn(() => [{ type: 'text', text: 'hi' }]) },
      },
      ...overrides,
    };
  }

  it('adds a listener, replays full live state, and unsubscribes it', () => {
    const e = entry();
    const send = vi.fn();
    const callbacks = { resolveTitle: vi.fn(() => 'Resolved Title'), broadcastPresenceState: vi.fn() };

    const unsubscribe = subscribeLiveSession(e as never, send, { tailBlocks: 3 }, callbacks);

    expect(e.listeners.size).toBe(1);
    expect(stale.ensureStaleTurnState).toHaveBeenCalledWith(e);
    expect(snapshot.buildLiveSessionSnapshot).toHaveBeenCalledWith(e, 3);
    expect(send).toHaveBeenNthCalledWith(1, {
      type: 'snapshot',
      goalState: { objective: 'goal' },
      systemPrompt: 'system prompt',
      toolDefinitions: [{ name: 'bash', description: 'Run shell', parameters: { type: 'object' } }],
      id: 's1',
      tailBlocks: 3,
    });
    expect(send).toHaveBeenCalledWith({ type: 'title_update', title: 'Resolved Title' });
    expect(send).toHaveBeenCalledWith({ type: 'context_usage', usage: { tokens: 10 } });
    expect(send).toHaveBeenCalledWith({ type: 'queue_state', steering: [{ id: 'q1', text: 'queued', imageCount: 0 }], followUp: [] });
    expect(send).toHaveBeenCalledWith({ type: 'parallel_state', jobs: [{ id: 'job-1' }] });

    unsubscribe();
    expect(e.listeners.size).toBe(0);
  });

  it('registers surfaces, sends presence state, and broadcasts presence changes excluding the new subscriber', () => {
    presence.registerLiveSessionSurface.mockReturnValueOnce(true);
    presence.removeLiveSessionSurface.mockReturnValueOnce(true);
    const e = entry();
    const send = vi.fn();
    const callbacks = { resolveTitle: vi.fn(() => ''), broadcastPresenceState: vi.fn() };

    const unsubscribe = subscribeLiveSession(
      e as never,
      send,
      { surface: { surfaceId: 'desktop-1', surfaceType: 'desktop_web' } },
      callbacks,
    );

    const subscription = [...e.listeners][0];
    expect(presence.registerLiveSessionSurface).toHaveBeenCalledWith(e, { surfaceId: 'desktop-1', surfaceType: 'desktop_web' });
    expect(send).toHaveBeenCalledWith({ type: 'presence_state', state: { surfaces: ['desktop'] } });
    expect(callbacks.broadcastPresenceState).toHaveBeenCalledWith(e, { exclude: subscription });

    unsubscribe();
    expect(presence.removeLiveSessionSurface).toHaveBeenCalledWith(e, 'desktop-1');
    expect(callbacks.broadcastPresenceState).toHaveBeenLastCalledWith(e);
  });

  it('sends presence for existing surfaces and agent_start only for active user-visible streaming turns', () => {
    const streaming = entry({ session: { ...entry().session, isStreaming: true }, presenceBySurfaceId: new Map([['mobile', {}]]) });
    const send = vi.fn();
    subscribeLiveSession(streaming as never, send, undefined, { resolveTitle: vi.fn(() => ''), broadcastPresenceState: vi.fn() });
    expect(send).toHaveBeenCalledWith({ type: 'presence_state', state: { surfaces: ['desktop'] } });
    expect(send).toHaveBeenCalledWith({ type: 'agent_start' });

    const hiddenStreaming = entry({ session: { ...entry().session, isStreaming: true }, activeStaleTurnCustomType: 'other_custom_type' });
    const hiddenSend = vi.fn();
    subscribeLiveSession(hiddenStreaming as never, hiddenSend, undefined, {
      resolveTitle: vi.fn(() => ''),
      broadcastPresenceState: vi.fn(),
    });
    expect(hiddenSend).not.toHaveBeenCalledWith({ type: 'agent_start' });
  });
});
