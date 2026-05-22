import { describe, expect, it, vi } from 'vitest';

import { destroyLiveSession } from './liveSessionDestroy.js';

describe('destroyLiveSession', () => {
  function entry(isStreaming = false) {
    return {
      sessionId: 's1',
      session: { isStreaming, dispose: vi.fn() },
    };
  }

  it('clears pending cwd changes even when the session is not live', () => {
    const pending = new Map<string, unknown>([['missing', { cwd: '/repo' }]]);
    const input = {
      registry: new Map(),
      pendingConversationWorkingDirectoryChanges: pending,
      clearContextUsageTimer: vi.fn(),
      syncDurableConversationRun: vi.fn(),
      publishSessionMetaChanged: vi.fn(),
    };

    destroyLiveSession('missing', input as never);

    expect(pending.has('missing')).toBe(false);
    expect(input.clearContextUsageTimer).not.toHaveBeenCalled();
    expect(input.publishSessionMetaChanged).not.toHaveBeenCalled();
  });

  it('disposes waiting sessions, removes them from registry, and syncs durable state', () => {
    const live = entry(false);
    const input = {
      registry: new Map([['s1', live]]),
      pendingConversationWorkingDirectoryChanges: new Map<string, unknown>([['s1', { cwd: '/repo' }]]),
      clearContextUsageTimer: vi.fn(),
      syncDurableConversationRun: vi.fn(async () => undefined),
      publishSessionMetaChanged: vi.fn(),
    };

    destroyLiveSession('s1', input as never);

    expect(input.pendingConversationWorkingDirectoryChanges.has('s1')).toBe(false);
    expect(input.clearContextUsageTimer).toHaveBeenCalledWith(live);
    expect(input.syncDurableConversationRun).toHaveBeenCalledWith(live, 'waiting', { force: true });
    expect(live.session.dispose).toHaveBeenCalledOnce();
    expect(input.registry.has('s1')).toBe(false);
    expect(input.publishSessionMetaChanged).toHaveBeenCalledWith('s1');
  });

  it('marks streaming sessions interrupted and logs async sync failures without blocking disposal', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const live = entry(true);
    const error = new Error('sync failed');
    const input = {
      registry: new Map([['s1', live]]),
      pendingConversationWorkingDirectoryChanges: new Map<string, unknown>(),
      clearContextUsageTimer: vi.fn(),
      syncDurableConversationRun: vi.fn(async () => {
        throw error;
      }),
      publishSessionMetaChanged: vi.fn(),
    };

    destroyLiveSession('s1', input as never);
    await Promise.resolve();

    expect(input.syncDurableConversationRun).toHaveBeenCalledWith(live, 'interrupted', {
      force: true,
      lastError: 'Live session disposed while a response was active.',
    });
    expect(live.session.dispose).toHaveBeenCalledOnce();
    expect(input.registry.has('s1')).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('[liveSessionDestroy] sync failed', error);
    errorSpy.mockRestore();
  });
});
