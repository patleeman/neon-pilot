import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onConversationRunEnded, saveArenaSettings, voteDuel } from './backend.js';

type StorageEntry = { key: string; value: unknown };

function createContext(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const manageParallelJob = vi.fn(async () => ({ ok: true, status: 'skipped' as const }));
  const updateTranscriptBlock = vi.fn(async () => ({ blockId: 'block-1' }));
  return {
    store,
    ctx: {
      storage: {
        get: vi.fn(async (key: string) => store.get(key)),
        put: vi.fn(async (key: string, value: unknown) => {
          store.set(key, value);
        }),
        list: vi.fn(
          async (prefix: string): Promise<StorageEntry[]> =>
            [...store.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value })),
        ),
      },
      conversations: {
        getBlocks: vi.fn(async () => ({ blocks: [] })),
        manageParallelJob,
        updateTranscriptBlock,
      },
    },
    manageParallelJob,
    updateTranscriptBlock,
  };
}

describe('Model Arena backend', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks failed challenger runs and clears the arena parallel job', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Fix this backend error',
      taskType: 'backend',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'anthropic/claude-sonnet',
      childConversationId: 'child-1',
      jobId: 'job-1',
      sideA: 'primary',
      sideB: 'challenger',
      status: 'running',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
    };
    const harness = createContext({ 'duels/duel-1': duel });

    await expect(
      onConversationRunEnded({ payload: { conversationId: 'child-1', error: 'No API key configured' } }, harness.ctx as never),
    ).resolves.toEqual({ updated: 1 });

    expect(harness.manageParallelJob).toHaveBeenCalledWith({ conversationId: 'parent-1', jobId: 'job-1', action: 'skip' });
    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'parent-1' }));
    expect(harness.store.get('duels/duel-1')).toMatchObject({
      status: 'failed',
      error: 'No API key configured',
      parallelJobCleared: true,
    });
  });

  it('normalizes challenger settings for GA-safe inputs', async () => {
    const harness = createContext();

    const result = await saveArenaSettings(
      {
        automaticDuels: true,
        sampleRate: 2,
        rampedSampleRate: -1,
        rampDownAfterVotes: 12.7,
        minPromptChars: 4.2,
        challengerModels: ['openai/gpt-5', ' ', 'openai/gpt-5', 'anthropic/claude-sonnet'],
      },
      harness.ctx as never,
    );

    expect(result.settings).toMatchObject({
      sampleRate: 1,
      rampedSampleRate: 0,
      rampDownAfterVotes: 13,
      minPromptChars: 4,
      challengerModels: ['openai/gpt-5', 'anthropic/claude-sonnet'],
    });
  });

  it('keeps provider-qualified primary model stats separate', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Build a frontend component',
      taskType: 'frontend',
      primaryModel: 'openrouter/deepseek-v4-flash',
      challengerModel: 'ds4/deepseek-v4-flash',
      childConversationId: 'child-1',
      jobId: 'job-1',
      sideA: 'primary',
      sideB: 'challenger',
      status: 'ready',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      primaryText: 'A',
      challengerText: 'B',
    };
    const harness = createContext({ 'duels/duel-1': duel });

    await voteDuel({ duelId: 'duel-1', choice: 'a' }, harness.ctx as never);

    expect(harness.store.get('stats/models')).toMatchObject({
      models: {
        'openrouter/deepseek-v4-flash': { wins: 1, byTask: { frontend: { wins: 1 } } },
        'ds4/deepseek-v4-flash': { losses: 1, byTask: { frontend: { losses: 1 } } },
      },
    });
  });
});
