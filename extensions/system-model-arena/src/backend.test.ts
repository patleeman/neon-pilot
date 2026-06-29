import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getArenaState,
  listArenaModels,
  onConversationRunEnded,
  refreshDuel,
  saveArenaSettings,
  startManualDuel,
  voteDuel,
} from './backend.js';

type StorageEntry = { key: string; value: unknown };

function createContext(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const manageParallelJob = vi.fn(async () => ({ ok: true, status: 'skipped' as const }));
  const updateTranscriptBlock = vi.fn(async () => ({ blockId: 'block-1' }));
  const appendTranscriptBlock = vi.fn(async () => ({ blockId: 'block-1' }));
  const startParallelPrompt = vi.fn(async () => ({ childConversationId: 'child-1', jobId: 'job-1' }));
  const create = vi.fn(async () => ({ id: 'created-child-1', conversationId: 'created-child-1' }));
  const listModels = vi.fn(async () => []);
  const getBlocks = vi.fn(async () => ({ blocks: [] }));
  const getMeta = vi.fn(async () => ({ currentModel: 'gpt-5', currentProvider: 'openai' }));
  const get = vi.fn(async () => ({ model: 'gpt-5', currentProvider: 'openai' }));
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
        get,
        getBlocks,
        getMeta,
        create,
        manageParallelJob,
        startParallelPrompt,
        appendTranscriptBlock,
        updateTranscriptBlock,
      },
      models: {
        list: listModels,
      },
    },
    listModels,
    get,
    getBlocks,
    getMeta,
    create,
    manageParallelJob,
    startParallelPrompt,
    appendTranscriptBlock,
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

  it('returns normal model dropdown options for arena challengers', async () => {
    const harness = createContext({ settings: { challengerModels: ['openai/gpt-5'] } });
    harness.listModels.mockResolvedValue([
      { id: 'gpt-5', name: 'GPT-5', provider: 'openai', input: ['text', 'image'] },
      { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic' },
      { id: '', name: 'Broken', provider: 'openai' },
      { id: 'no-provider', name: 'No Provider', provider: '' },
    ]);

    await expect(listArenaModels({}, harness.ctx as never)).resolves.toEqual([
      { id: 'gpt-5', name: 'GPT-5', provider: 'openai', input: ['text', 'image'] },
      { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic', input: ['text'] },
    ]);

    await expect(getArenaState({}, harness.ctx as never)).resolves.toMatchObject({
      settings: { challengerModels: ['openai/gpt-5'] },
      models: [
        { id: 'gpt-5', name: 'GPT-5', provider: 'openai' },
        { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic' },
      ],
    });
  });

  it('starts manual duels from the selected assistant message prompt', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.getBlocks.mockResolvedValue({
      blocks: [
        { type: 'user', id: 'user-1', text: 'First prompt' },
        { type: 'text', id: 'assistant-1', text: 'First answer' },
        { type: 'user', id: 'user-2', text: 'Second prompt' },
        { type: 'text', id: 'assistant-2', text: 'Second answer' },
      ],
    });

    const result = await startManualDuel(
      { conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'First answer' },
      harness.ctx as never,
    );

    expect(result).toMatchObject({ text: expect.stringContaining('Started model duel'), duelId: expect.any(String) });
    expect(harness.getBlocks).toHaveBeenCalledWith('conv-1', { tailBlocks: 120 });
    expect(harness.startParallelPrompt).toHaveBeenCalledWith('conv-1', expect.objectContaining({ text: 'First prompt' }));
    expect(harness.appendTranscriptBlock).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-1' }));
  });

  it('starts manual duels from route-backed session detail blocks', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.getBlocks.mockResolvedValue({
      detail: {
        blocks: [
          { type: 'user', id: 'user-1', text: 'Prompt from session detail' },
          { type: 'text', id: 'assistant-1', text: 'Answer from session detail' },
        ],
      },
    });

    await startManualDuel(
      { conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'Answer from session detail' },
      harness.ctx as never,
    );

    expect(harness.startParallelPrompt).toHaveBeenCalledWith('conv-1', expect.objectContaining({ text: 'Prompt from session detail' }));
  });

  it('creates a challenger conversation when manual compare runs after the parent is idle', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.startParallelPrompt.mockRejectedValue(
      new Error('Failed to start parallel prompt: Parallel prompts are only available while the conversation is busy.'),
    );
    harness.getBlocks.mockResolvedValue({
      detail: {
        blocks: [
          { type: 'user', id: 'user-1', text: 'Compare this completed answer' },
          { type: 'text', id: 'assistant-1', text: 'Completed answer' },
        ],
      },
    });

    const result = await startManualDuel(
      { conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'Completed answer' },
      harness.ctx as never,
    );

    expect(result).toMatchObject({ text: expect.stringContaining('Started model duel'), duelId: expect.any(String) });
    expect(harness.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Model Arena challenger',
        prompt: 'Compare this completed answer',
        model: 'anthropic/claude-sonnet',
      }),
    );
    expect(harness.store.get(`duels/${result.duelId}`)).toMatchObject({
      childConversationId: 'created-child-1',
      jobId: 'conversation:created-child-1',
      parallelJobCleared: true,
    });
  });

  it('keeps provider-qualified challengers eligible when current model metadata is unqualified', async () => {
    const harness = createContext({ settings: { challengerModels: ['openai-codex/gpt-5.3-codex-spark'] } });
    harness.getBlocks.mockResolvedValue({
      blocks: [
        { type: 'user', id: 'user-1', text: 'Compare this answer' },
        { type: 'text', id: 'assistant-1', text: 'Answer' },
      ],
    });
    harness.getMeta.mockResolvedValue({ currentModel: 'gpt-5.3-codex-spark' });

    await startManualDuel({ conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'Answer' }, harness.ctx as never);

    expect(harness.startParallelPrompt).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ model: 'openai-codex/gpt-5.3-codex-spark' }),
    );
  });

  it('uses stored conversation model metadata when live metadata is sparse', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.getMeta.mockResolvedValue({});
    harness.get.mockResolvedValue({ model: 'deepseek-v4-flash' });
    harness.getBlocks.mockResolvedValue({
      detail: {
        blocks: [
          { type: 'user', id: 'user-1', text: 'Compare model metadata' },
          { type: 'text', id: 'assistant-1', text: 'Answer' },
        ],
      },
    });

    const result = await startManualDuel({ conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'Answer' }, harness.ctx as never);

    expect(harness.store.get(`duels/${result.duelId}`)).toMatchObject({ primaryModel: 'deepseek-v4-flash' });
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

  it('refreshes a running duel from the child conversation answer', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Compare this markdown answer',
      taskType: 'general',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'anthropic/claude-sonnet',
      childConversationId: 'child-1',
      jobId: 'job-1',
      sideA: 'primary',
      sideB: 'challenger',
      status: 'running',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      primaryText: '**Primary** answer',
    };
    const harness = createContext({ 'duels/duel-1': duel });
    harness.getBlocks.mockImplementation(async (conversationId: string) => ({
      blocks:
        conversationId === 'child-1'
          ? [{ type: 'text', id: 'assistant-child', text: '## Challenger answer\n\n- better markdown' }]
          : [{ type: 'text', id: 'assistant-parent', text: '**Primary** answer' }],
    }));

    await expect(refreshDuel({ duelId: 'duel-1' }, harness.ctx as never)).resolves.toMatchObject({
      ok: true,
      duel: {
        status: 'ready',
        sideA: { text: '**Primary** answer' },
        sideB: { text: '## Challenger answer\n\n- better markdown' },
      },
    });

    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'parent-1',
        blockId: 'model_arena_duel:duel-1',
        data: expect.objectContaining({ status: 'ready', sideB: { text: '## Challenger answer\n\n- better markdown' } }),
      }),
    );
  });

  it('refreshes a running duel from the child conversation error', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Compare this failed challenger',
      taskType: 'debugging',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'openai-codex/gpt-5.3-codex-spark',
      childConversationId: 'child-1',
      jobId: 'job-1',
      sideA: 'primary',
      sideB: 'challenger',
      status: 'running',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      primaryText: 'Primary answer',
    };
    const harness = createContext({ 'duels/duel-1': duel });
    harness.getBlocks.mockImplementation(async (conversationId: string) => ({
      blocks:
        conversationId === 'child-1'
          ? [{ type: 'error', id: 'error-child', message: 'No API key for provider: openai-codex' }]
          : [{ type: 'text', id: 'assistant-parent', text: 'Primary answer' }],
    }));

    await expect(refreshDuel({ duelId: 'duel-1' }, harness.ctx as never)).resolves.toMatchObject({
      ok: true,
      duel: {
        status: 'failed',
        sideA: { text: 'Primary answer' },
        sideB: { text: '' },
        error: 'No API key for provider: openai-codex',
      },
    });

    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'parent-1',
        blockId: 'model_arena_duel:duel-1',
        data: expect.objectContaining({ status: 'failed', error: 'No API key for provider: openai-codex' }),
      }),
    );
  });

  it('turns child conversation read failures into duel errors on refresh', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Compare this failed challenger',
      taskType: 'debugging',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'openai-codex/gpt-5.3-codex-spark',
      childConversationId: 'child-1',
      jobId: 'job-1',
      sideA: 'primary',
      sideB: 'challenger',
      status: 'running',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      primaryText: 'Primary answer',
    };
    const harness = createContext({ 'duels/duel-1': duel });
    harness.getBlocks.mockImplementation(async (conversationId: string) => {
      if (conversationId === 'child-1') throw new Error('No API key for provider: openai-codex');
      return { blocks: [{ type: 'text', id: 'assistant-parent', text: 'Primary answer' }] };
    });

    await expect(refreshDuel({ duelId: 'duel-1' }, harness.ctx as never)).resolves.toMatchObject({
      duel: {
        status: 'failed',
        error: 'No API key for provider: openai-codex',
      },
    });
  });
});
