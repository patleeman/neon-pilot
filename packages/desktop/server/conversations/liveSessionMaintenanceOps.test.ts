import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelPrefs = vi.hoisted(() => ({ readSavedModelPreferences: vi.fn(() => ({ currentServiceTier: 'auto' })) }));
const conversationPrefs = vi.hoisted(() => ({
  applyConversationModelPreferencesToLiveSession: vi.fn(async () => ({ currentServiceTier: 'flex' })),
}));
const liveSessionModels = vi.hoisted(() => ({ applyLiveSessionServiceTier: vi.fn() }));
const transcript = vi.hoisted(() => ({ resolveCompactionSummaryTitle: vi.fn(() => 'Manual compaction') }));

vi.mock('../models/modelPreferences.js', () => modelPrefs);
vi.mock('./conversationModelPreferences.js', () => conversationPrefs);
vi.mock('./liveSessionModels.js', () => liveSessionModels);
vi.mock('./liveSessionTranscript.js', () => transcript);

import { compactLiveSession, renameLiveSession, updateLiveSessionModelPreferences } from './liveSessionMaintenanceOps.js';

describe('live session maintenance operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function entry(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: 's1',
      title: 'Title',
      session: { compact: vi.fn(async () => 'compacted'), isStreaming: false, model: { id: 'model-1' }, thinkingLevel: 'medium' },
      ...overrides,
    };
  }

  it('marks manual compaction active, broadcasts state, records title, and always cleans up', async () => {
    const e = entry();
    const callbacks = {
      broadcastSnapshot: vi.fn(),
      clearContextUsageTimer: vi.fn(),
      broadcastContextUsage: vi.fn(),
      publishSessionMetaChanged: vi.fn(),
    };

    await expect(compactLiveSession(e as never, 'keep important details', callbacks)).resolves.toBe('compacted');

    expect(e.session.compact).toHaveBeenCalledWith('keep important details');
    expect(e.isCompacting).toBe(false);
    expect(e.lastCompactionSummaryTitle).toBe('Manual compaction');
    expect(callbacks.broadcastSnapshot).toHaveBeenCalledTimes(2);
    expect(callbacks.clearContextUsageTimer).toHaveBeenCalledWith(e);
    expect(callbacks.broadcastContextUsage).toHaveBeenCalledWith(e, true);
    expect(callbacks.publishSessionMetaChanged).toHaveBeenCalledTimes(2);
  });

  it('cleans up compaction state even when compact fails', async () => {
    const error = new Error('compact failed');
    const e = entry({
      session: {
        compact: vi.fn(async () => {
          throw error;
        }),
        isStreaming: false,
      },
    });
    const callbacks = {
      broadcastSnapshot: vi.fn(),
      clearContextUsageTimer: vi.fn(),
      broadcastContextUsage: vi.fn(),
      publishSessionMetaChanged: vi.fn(),
    };

    await expect(compactLiveSession(e as never, undefined, callbacks)).rejects.toThrow('compact failed');

    expect(e.isCompacting).toBe(false);
    expect(callbacks.broadcastSnapshot).toHaveBeenCalledTimes(2);
    expect(callbacks.clearContextUsageTimer).toHaveBeenCalledWith(e);
    expect(callbacks.broadcastContextUsage).toHaveBeenCalledWith(e, true);
  });

  it('renames sessions and syncs durable state from last state or streaming state', async () => {
    const syncDurableConversationRun = vi.fn(async () => undefined);
    const callbacks = { applySessionTitle: vi.fn(), syncDurableConversationRun };
    const waiting = entry({ lastDurableRunState: 'completed' });
    const streaming = entry({ session: { isStreaming: true } });
    const idle = entry({ session: { isStreaming: false } });

    renameLiveSession(waiting as never, 'New Title', callbacks);
    renameLiveSession(streaming as never, 'Streaming Title', callbacks);
    renameLiveSession(idle as never, 'Idle Title', callbacks);

    expect(callbacks.applySessionTitle).toHaveBeenNthCalledWith(1, waiting, 'New Title');
    expect(syncDurableConversationRun).toHaveBeenNthCalledWith(1, waiting, 'completed', { force: true });
    expect(syncDurableConversationRun).toHaveBeenNthCalledWith(2, streaming, 'running', { force: true });
    expect(syncDurableConversationRun).toHaveBeenNthCalledWith(3, idle, 'waiting', { force: true });
  });

  it('updates model preferences, reapplies service tier, and publishes metadata changes', async () => {
    const e = entry();
    const availableModels = [{ id: 'model-1' }];
    const publishSessionMetaChanged = vi.fn();

    await expect(
      updateLiveSessionModelPreferences({
        entry: e as never,
        preferences: { model: 'model-2', thinkingLevel: 'high' } as never,
        availableModels: availableModels as never,
        settingsFile: '/settings.json',
        publishSessionMetaChanged,
      }),
    ).resolves.toEqual({ currentServiceTier: 'flex' });

    expect(modelPrefs.readSavedModelPreferences).toHaveBeenCalledWith('/settings.json', availableModels);
    expect(conversationPrefs.applyConversationModelPreferencesToLiveSession).toHaveBeenCalledWith(
      e.session,
      { model: 'model-2', thinkingLevel: 'high' },
      { currentModel: 'model-1', currentThinkingLevel: 'medium', currentServiceTier: 'auto' },
      availableModels,
    );
    expect(liveSessionModels.applyLiveSessionServiceTier).toHaveBeenCalledWith(e.session, 'flex');
    expect(publishSessionMetaChanged).toHaveBeenCalledWith('s1');
  });
});
