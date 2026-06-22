import { describe, expect, it, vi } from 'vitest';

vi.mock('./liveSessionRecovery.js', () => ({
  resolveTranscriptTailRecoveryPlan: vi.fn(() => null),
}));

import type { LiveSessionReadHost } from './liveSessionReadApi.js';
import { computeLiveSessionRunning, listLiveSessions } from './liveSessionReadApi.js';

function makeEntry(overrides: Partial<LiveSessionReadHost> = {}): LiveSessionReadHost {
  return {
    cwd: '/repo',
    session: { isStreaming: false } as unknown,
    title: 'Test',
    activeStaleTurnCustomType: null,
    queuedStaleTurnCustomTypes: [],
    ...overrides,
  } as LiveSessionReadHost;
}

describe('computeLiveSessionRunning', () => {
  it('returns false when lastDurableRunState is waiting and no stale turn is active', () => {
    expect(computeLiveSessionRunning(makeEntry({ lastDurableRunState: 'waiting' }))).toBe(false);
  });

  it('returns false when lastDurableRunState is waiting and session is not streaming', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          lastDurableRunState: 'waiting',
          session: { isStreaming: false } as unknown,
        }),
      ),
    ).toBe(false);
  });

  it('returns true during compaction even when the durable run is waiting', () => {
    expect(computeLiveSessionRunning(makeEntry({ isCompacting: true, lastDurableRunState: 'waiting' }))).toBe(true);
  });

  it('returns true when session.isStreaming is true and no stale turn masks it', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          session: { isStreaming: true } as unknown,
          activeStaleTurnCustomType: null,
        }),
      ),
    ).toBe(true);
  });

  it('returns true when session.isStreaming is true even if a stale stale-turn marker exists', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          session: { isStreaming: true } as unknown,
          activeStaleTurnCustomType: 'auto_mode',
        }),
      ),
    ).toBe(true);
  });

  it('returns false for a bootstrapped stale tool-use tail with no active durable run', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          session: {
            isStreaming: true,
            sessionManager: {
              getBranch: () => [
                { type: 'message', id: 'user-1', parentId: null, message: { role: 'user', content: [{ type: 'text', text: 'prompt' }] } },
                {
                  type: 'message',
                  id: 'assistant-1',
                  parentId: 'user-1',
                  message: { role: 'assistant', stopReason: 'toolUse', content: [{ type: 'toolCall', id: 'call-1' }] },
                },
              ],
            },
          } as unknown,
        }),
      ),
    ).toBe(false);
  });

  it('returns false when lastDurableRunState is waiting but session.isStreaming has not cleared yet (race guard)', () => {
    // This simulates the agent_end → syncDurableConversationRun('waiting') race:
    // lastDurableRunState flips to 'waiting' synchronously but session.isStreaming
    // is still true because the Pi runtime hasn't called finishRun() yet.
    expect(
      computeLiveSessionRunning(
        makeEntry({
          session: { isStreaming: true } as unknown,
          lastDurableRunState: 'waiting',
        }),
      ),
    ).toBe(false);
  });

  it('ignores stale stale-turn markers when the session is otherwise idle', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          session: { isStreaming: false } as unknown,
          lastDurableRunState: 'waiting',
          queuedStaleTurnCustomTypes: ['auto_mode'],
          activeStaleTurnCustomType: 'auto_mode',
        }),
      ),
    ).toBe(false);
  });

  it('returns true when lastDurableRunState is running', () => {
    expect(computeLiveSessionRunning(makeEntry({ lastDurableRunState: 'running' }))).toBe(true);
  });

  it('returns true when lastDurableRunState is recovering', () => {
    expect(computeLiveSessionRunning(makeEntry({ lastDurableRunState: 'recovering' }))).toBe(true);
  });

  it('returns true when both session.isStreaming and stale turn are present', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          session: { isStreaming: true } as unknown,
          activeStaleTurnCustomType: 'auto_mode',
        }),
      ),
    ).toBe(true);
  });

  it('returns false for an idle session with no lastDurableRunState set', () => {
    expect(computeLiveSessionRunning(makeEntry({ lastDurableRunState: undefined }))).toBe(false);
  });

  it('returns false when interrupted durable run only has a stale stale-turn marker', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          lastDurableRunState: 'interrupted',
          activeStaleTurnCustomType: 'auto_mode',
        }),
      ),
    ).toBe(false);
  });

  it('returns false when a stopped run is interrupted but pi session has not cleared streaming yet', () => {
    expect(
      computeLiveSessionRunning(
        makeEntry({
          session: { isStreaming: true } as unknown,
          lastDurableRunState: 'interrupted',
        }),
      ),
    ).toBe(false);
  });
});

describe('listLiveSessions', () => {
  it('reports isStreaming from the canonical running resolver', () => {
    const entry = makeEntry({
      session: { isStreaming: true } as unknown,
      lastDurableRunState: 'waiting',
    });

    expect(listLiveSessions([['session-1', entry]], () => 'Done')).toMatchObject([{ id: 'session-1', running: false, isStreaming: false }]);
  });
});
