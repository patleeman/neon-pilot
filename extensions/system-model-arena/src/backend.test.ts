import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelDuel,
  getArenaState,
  listArenaModels,
  onConversationRunEnded,
  onPromptSubmitted,
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
  const createSpeculativeWorkspace = vi.fn(async () => ({
    id: 'workspace-1',
    sourcePath: '/repo',
    rootPath: '/tmp/model-arena-workspace',
    strategy: 'copy',
  }));
  const applySpeculativeWorkspace = vi.fn(async () => ({ changes: [], summary: { added: 0, modified: 0, deleted: 0 } }));
  const disposeSpeculativeWorkspace = vi.fn(async () => ({ ok: true }));
  const startParallelPrompt = vi.fn(async () => ({ childConversationId: 'child-1', jobId: 'job-1' }));
  const create = vi.fn(async () => ({ id: 'created-child-1', conversationId: 'created-child-1' }));
  const fork = vi.fn(async () => ({ id: 'forked-child-1', conversationId: 'forked-child-1' }));
  const ensureLive = vi.fn(async () => ({ id: 'conv-1', conversationId: 'conv-1' }));
  const runTurn = vi.fn(async () => ({ accepted: true }));
  const listModels = vi.fn(async () => [
    { id: 'gpt-5', name: 'GPT-5', provider: 'openai', input: ['text', 'image'], authConfigured: true },
    { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic', authConfigured: true },
    { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', provider: 'openai-codex', authConfigured: true },
  ]);
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
        createSpeculativeWorkspace,
        applySpeculativeWorkspace,
        disposeSpeculativeWorkspace,
        appendTranscriptBlock,
        updateTranscriptBlock,
        ensureLive,
        fork,
        runTurn,
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
    fork,
    ensureLive,
    runTurn,
    manageParallelJob,
    startParallelPrompt,
    createSpeculativeWorkspace,
    applySpeculativeWorkspace,
    disposeSpeculativeWorkspace,
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

  it('does not save challenger settings when runnable models are unavailable', async () => {
    const harness = createContext();
    harness.listModels.mockRejectedValue(new Error('models unavailable'));

    await expect(saveArenaSettings({ challengerModels: ['openai/gpt-5'], automaticDuels: true }, harness.ctx as never)).rejects.toThrow(
      'Model list is unavailable',
    );
    expect(harness.store.has('settings')).toBe(false);
  });

  it('returns normal model dropdown options for arena challengers', async () => {
    const harness = createContext({ settings: { challengerModels: ['openai/gpt-5', 'openai-codex/gpt-5.3-codex-spark'] } });
    harness.listModels.mockResolvedValue([
      { id: 'gpt-5', name: 'GPT-5', provider: 'openai', input: ['text', 'image'], authConfigured: true },
      { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic', authConfigured: true },
      { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', provider: 'openai-codex', authConfigured: true },
      { id: '', name: 'Broken', provider: 'openai' },
      { id: 'no-provider', name: 'No Provider', provider: '' },
    ]);

    await expect(listArenaModels({}, harness.ctx as never)).resolves.toEqual([
      { id: 'gpt-5', name: 'GPT-5', provider: 'openai', input: ['text', 'image'], authConfigured: true },
      { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic', input: ['text'], authConfigured: true },
    ]);

    await expect(getArenaState({}, harness.ctx as never)).resolves.toMatchObject({
      settings: { challengerModels: ['openai/gpt-5'] },
      models: [
        { id: 'gpt-5', name: 'GPT-5', provider: 'openai' },
        { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic' },
      ],
    });
  });

  it('expires stale running duels when loading arena state', async () => {
    const staleUpdatedAt = '2026-06-29T00:00:00.000Z';
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-29T07:00:01.000Z').getTime());
    const harness = createContext({
      'duels/stale': {
        id: 'stale',
        conversationId: 'parent-1',
        blockId: 'model_arena_duel:stale',
        prompt: 'Compare this answer',
        taskType: 'general',
        primaryModel: 'openai/gpt-5',
        challengerModel: 'anthropic/claude-sonnet',
        childConversationId: 'child-1',
        jobId: 'job-1',
        sideA: 'primary',
        sideB: 'challenger',
        status: 'running',
        createdAt: staleUpdatedAt,
        updatedAt: staleUpdatedAt,
        primaryText: 'Primary answer',
      },
    });
    harness.getBlocks.mockResolvedValue({ blocks: [] });

    await expect(getArenaState({}, harness.ctx as never)).resolves.toMatchObject({
      duels: [
        expect.objectContaining({
          id: 'stale',
          status: 'failed',
          error: 'Model Arena duel expired before both answers were captured.',
        }),
      ],
    });
    expect(harness.store.get('duels/stale')).toMatchObject({
      status: 'failed',
      error: 'Model Arena duel expired before both answers were captured.',
    });
    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: 'model_arena_duel:stale',
        data: expect.objectContaining({ status: 'failed', error: 'Model Arena duel expired before both answers were captured.' }),
      }),
    );
  });

  it('returns arena state when stored duel recovery stalls', async () => {
    vi.useFakeTimers();
    try {
      const harness = createContext({
        'duels/stalled': {
          id: 'stalled',
          conversationId: 'parent-1',
          blockId: 'model_arena_duel:stalled',
          prompt: 'Compare this answer',
          taskType: 'general',
          primaryModel: 'openai/gpt-5',
          challengerModel: 'anthropic/claude-sonnet',
          childConversationId: 'child-1',
          jobId: 'job-1',
          sideA: 'primary',
          sideB: 'challenger',
          status: 'running',
          createdAt: '2026-06-29T00:00:00.000Z',
          updatedAt: '2026-06-29T00:00:00.000Z',
        },
      });
      harness.getBlocks.mockImplementation(() => new Promise(() => undefined));

      const pending = getArenaState({}, harness.ctx as never);
      await vi.advanceTimersByTimeAsync(1_501);

      await expect(pending).resolves.toMatchObject({
        duels: [expect.objectContaining({ id: 'stalled', status: 'running' })],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns an empty arena model list when provider discovery stalls', async () => {
    vi.useFakeTimers();
    try {
      const harness = createContext();
      harness.listModels.mockImplementation(() => new Promise(() => undefined));

      const pending = getArenaState({}, harness.ctx as never);
      await vi.advanceTimersByTimeAsync(2_501);

      await expect(pending).resolves.toMatchObject({
        models: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not launch stale challenger models that are no longer runnable', async () => {
    const harness = createContext({ settings: { challengerModels: ['codex-compatible/gpt-5.3-codex-spark'] } });
    harness.listModels.mockResolvedValue([
      { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', provider: 'codex-compatible', authConfigured: true },
    ]);
    harness.listModels.mockResolvedValue([
      { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', provider: 'openai-codex', authConfigured: false },
    ]);
    harness.getBlocks.mockResolvedValue({
      blocks: [
        { type: 'user', id: 'user-1', text: 'Compare this answer' },
        { type: 'text', id: 'assistant-1', text: 'Answer' },
      ],
    });

    await expect(
      startManualDuel({ conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'Answer' }, harness.ctx as never),
    ).rejects.toThrow('Add challenger models before starting a duel.');
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
    expect(harness.store.get('settings')).toMatchObject({ challengerModels: [] });
  });

  it('does not launch automatic duels when runnable models are unavailable', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'], sampleRate: 1, minPromptChars: 0 } });
    harness.listModels.mockRejectedValue(new Error('models unavailable'));
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      onPromptSubmitted(
        { payload: { conversationId: 'conv-1', prompt: 'Compare this backend design', currentModel: 'gpt-5', currentProvider: 'openai' } },
        harness.ctx as never,
      ),
    ).resolves.toEqual({ skipped: true, reason: 'models_unavailable' });
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
  });

  it('skips automatic duels for attachment prompts until challengers receive the same media', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'], sampleRate: 1, minPromptChars: 0 } });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      onPromptSubmitted(
        {
          payload: {
            conversationId: 'conv-1',
            prompt: 'Describe this screenshot',
            currentModel: 'gpt-5',
            currentProvider: 'openai',
            imageCount: 1,
          },
        },
        harness.ctx as never,
      ),
    ).resolves.toEqual({ skipped: true, reason: 'attachments_unsupported' });
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
  });

  it('skips automatic image duels when no challenger can accept images', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'], sampleRate: 1, minPromptChars: 0 } });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      onPromptSubmitted(
        {
          payload: {
            conversationId: 'conv-1',
            prompt: 'Describe this screenshot',
            currentModel: 'gpt-5',
            currentProvider: 'openai',
            delivery: 'started',
            imageCount: 1,
            images: [{ data: 'png-bytes', mimeType: 'image/png', name: 'shot.png' }],
          },
        },
        harness.ctx as never,
      ),
    ).resolves.toEqual({ skipped: true, reason: 'no_capable_challenger' });
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
  });

  it('replays images, videos, attachments, and materialized context into automatic challenger duels', async () => {
    const harness = createContext({ settings: { challengerModels: ['openai/gpt-5'], sampleRate: 1, minPromptChars: 0 } });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const started = await onPromptSubmitted(
      {
        payload: {
          conversationId: 'conv-1',
          prompt: 'Describe this screenshot and video',
          currentModel: 'claude-sonnet',
          currentProvider: 'anthropic',
          delivery: 'started',
          imageCount: 1,
          videoCount: 1,
          images: [{ data: 'png-bytes', mimeType: 'image/png', name: 'shot.png' }],
          videos: [{ path: '/tmp/demo.mov', mimeType: 'video/quicktime', name: 'demo.mov', sizeBytes: 42 }],
          attachmentRefs: [{ attachmentId: 'att-1', revision: 2 }],
          contextMessageCount: 1,
          contextMessages: [{ customType: 'referenced_context', content: 'Selected context' }],
        },
      },
      harness.ctx as never,
    );

    expect(started).toMatchObject({ started: true, duelId: expect.any(String) });
    expect(harness.startParallelPrompt).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        text: 'Describe this screenshot and video',
        images: [{ data: 'png-bytes', mimeType: 'image/png', name: 'shot.png' }],
        videos: [{ path: '/tmp/demo.mov', mimeType: 'video/quicktime', name: 'demo.mov', sizeBytes: 42 }],
        attachmentRefs: [{ attachmentId: 'att-1', revision: 2 }],
        contextMessages: [{ customType: 'referenced_context', content: 'Selected context' }],
        model: 'openai/gpt-5',
      }),
    );
  });

  it('skips automatic duels for queued prompts so they cannot capture the previous answer', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'], sampleRate: 1, minPromptChars: 0 } });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      onPromptSubmitted(
        {
          payload: {
            conversationId: 'conv-1',
            prompt: 'Compare this queued backend design',
            currentModel: 'gpt-5',
            currentProvider: 'openai',
            delivery: 'queued',
          },
        },
        harness.ctx as never,
      ),
    ).resolves.toEqual({ skipped: true, reason: 'queued_prompt' });
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
  });

  it('skips automatic duels when the primary prompt used unreplayable context', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'], sampleRate: 1, minPromptChars: 0 } });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      onPromptSubmitted(
        {
          payload: {
            conversationId: 'conv-1',
            prompt: 'Use the selected thread and summarize the backend migration',
            currentModel: 'gpt-5',
            currentProvider: 'openai',
            delivery: 'started',
            contextMessageCount: 1,
          },
        },
        harness.ctx as never,
      ),
    ).resolves.toEqual({ skipped: true, reason: 'context_unsupported' });
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
  });

  it('skips automatic duels when the parallel prompt window has already closed', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'], sampleRate: 1, minPromptChars: 0 } });
    harness.startParallelPrompt.mockRejectedValue(
      new Error('Failed to start parallel prompt: Parallel prompts are only available while the conversation is busy.'),
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await expect(
      onPromptSubmitted(
        {
          payload: {
            conversationId: 'conv-1',
            prompt: 'Compare this backend answer',
            currentModel: 'gpt-5',
            currentProvider: 'openai',
            delivery: 'started',
          },
        },
        harness.ctx as never,
      ),
    ).resolves.toEqual({ skipped: true, reason: 'parallel_unavailable' });
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.appendTranscriptBlock).not.toHaveBeenCalled();
  });

  it('runs the automatic sampling lifecycle with task metadata through vote stats', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'], sampleRate: 1, minPromptChars: 0 } });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const started = await onPromptSubmitted(
      {
        payload: {
          conversationId: 'parent-1',
          prompt: 'Compare this backend queue design',
          currentModel: 'gpt-5',
          currentProvider: 'openai',
          delivery: 'started',
        },
      },
      harness.ctx as never,
    );

    expect(started).toMatchObject({ started: true, duelId: expect.any(String) });
    const duelId = (started as { duelId: string }).duelId;
    expect(harness.startParallelPrompt).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({
        text: 'Compare this backend queue design',
        cwd: '/tmp/model-arena-workspace',
        model: 'anthropic/claude-sonnet',
        purpose: 'model_arena_duel',
        metadata: expect.objectContaining({ duelId, taskType: 'backend' }),
      }),
    );
    expect(harness.store.get(`duels/${duelId}`)).toMatchObject({
      taskType: 'backend',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'anthropic/claude-sonnet',
      status: 'running',
      blockAppended: false,
      speculativeWorkspace: {
        id: 'workspace-1',
        sourcePath: '/repo',
        rootPath: '/tmp/model-arena-workspace',
        strategy: 'copy',
      },
    });
    expect(harness.appendTranscriptBlock).not.toHaveBeenCalled();

    harness.getBlocks.mockImplementation(async (conversationId: string) => ({
      blocks:
        conversationId === 'child-1'
          ? [{ type: 'text', id: 'assistant-child', text: 'Challenger backend answer' }]
          : [{ type: 'text', id: 'assistant-parent', text: 'Primary backend answer' }],
    }));

    await onConversationRunEnded({ payload: { conversationId: 'parent-1' } }, harness.ctx as never);
    expect(harness.appendTranscriptBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'parent-1',
        blockId: `model_arena_duel:${duelId}`,
        data: expect.objectContaining({ status: 'ready', sourceBlockId: 'assistant-parent' }),
      }),
    );
    await onConversationRunEnded({ payload: { conversationId: 'child-1' } }, harness.ctx as never);

    expect(harness.store.get(`duels/${duelId}`)).toMatchObject({
      status: 'ready',
      blockAppended: true,
      sourceBlockId: 'assistant-parent',
      primaryText: 'Primary backend answer',
      challengerText: 'Challenger backend answer',
    });

    await voteDuel({ duelId, choice: 'a' }, harness.ctx as never);

    expect(harness.disposeSpeculativeWorkspace).toHaveBeenCalledWith({
      id: 'workspace-1',
      rootPath: '/tmp/model-arena-workspace',
    });
    expect(harness.applySpeculativeWorkspace).not.toHaveBeenCalled();
    expect(harness.store.get('stats/models')).toMatchObject({
      models: {
        'openai/gpt-5': { byTask: { backend: { votes: 1 } } },
        'anthropic/claude-sonnet': { byTask: { backend: { votes: 1 } } },
      },
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
    expect(harness.ensureLive).toHaveBeenCalledWith('conv-1');
    expect(harness.startParallelPrompt).toHaveBeenCalledWith('conv-1', expect.objectContaining({ text: 'First prompt' }));
    expect(harness.appendTranscriptBlock).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-1' }));
    expect(harness.store.get(`duels/${result.duelId}`)).toMatchObject({ sourceBlockId: 'assistant-1', blockAppended: true });
  });

  it('does not start manual duels when runnable models are unavailable', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.listModels.mockRejectedValue(new Error('models unavailable'));
    harness.getBlocks.mockResolvedValue({
      blocks: [
        { type: 'user', id: 'user-1', text: 'First prompt' },
        { type: 'text', id: 'assistant-1', text: 'First answer' },
      ],
    });

    await expect(
      startManualDuel({ conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'First answer' }, harness.ctx as never),
    ).rejects.toThrow('Model list is unavailable');
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
  });

  it('reuses an existing active manual duel for the same assistant message', async () => {
    const existingDuel = {
      id: 'duel-existing',
      conversationId: 'conv-1',
      blockId: 'model_arena_duel:duel-existing',
      sourceBlockId: 'assistant-1',
      prompt: 'First prompt',
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
      primaryText: 'First answer',
    };
    const harness = createContext({
      settings: { challengerModels: ['anthropic/claude-sonnet'] },
      'duels/duel-existing': existingDuel,
    });
    harness.getBlocks.mockResolvedValue({
      blocks: [
        { type: 'user', id: 'user-1', text: 'First prompt' },
        { type: 'text', id: 'assistant-1', text: 'First answer' },
      ],
    });

    await expect(
      startManualDuel({ conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'First answer' }, harness.ctx as never),
    ).resolves.toMatchObject({ duelId: 'duel-existing', existing: true });

    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
    expect(harness.appendTranscriptBlock).not.toHaveBeenCalled();
    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'model_arena_duel:duel-existing' }));
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

  it('forks from the source prompt when manual compare runs after the parent is idle', async () => {
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
    expect(harness.fork).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        atBlockId: 'user-1',
        beforeEntry: true,
        title: 'Model Arena challenger',
        targetCwd: '/tmp/model-arena-workspace',
        model: 'anthropic/claude-sonnet',
      }),
    );
    expect(harness.runTurn).toHaveBeenCalledWith('forked-child-1', 'Compare this completed answer');
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.store.get(`duels/${result.duelId}`)).toMatchObject({
      childConversationId: 'forked-child-1',
      jobId: 'conversation:forked-child-1',
      speculativeWorkspace: {
        id: 'workspace-1',
        sourcePath: '/repo',
        rootPath: '/tmp/model-arena-workspace',
        strategy: 'copy',
      },
      parallelJobCleared: true,
    });
  });

  it('applies isolated challenger workspace changes only when the challenger wins', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Fix a backend bug',
      taskType: 'backend',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'anthropic/claude-sonnet',
      childConversationId: 'child-1',
      jobId: 'job-1',
      speculativeWorkspace: {
        id: 'workspace-1',
        sourcePath: '/repo',
        rootPath: '/tmp/model-arena-workspace',
        strategy: 'copy',
      },
      sideA: 'primary',
      sideB: 'challenger',
      status: 'ready',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      primaryText: 'Primary',
      challengerText: 'Challenger',
    };
    const harness = createContext({ 'duels/duel-1': duel });

    await voteDuel({ duelId: 'duel-1', choice: 'b' }, harness.ctx as never);

    expect(harness.applySpeculativeWorkspace).toHaveBeenCalledWith({
      id: 'workspace-1',
      sourcePath: '/repo',
      rootPath: '/tmp/model-arena-workspace',
    });
    expect(harness.disposeSpeculativeWorkspace).not.toHaveBeenCalled();
    expect(harness.store.get('duels/duel-1')).toMatchObject({ status: 'voted', vote: 'b', revealed: true });
    expect(harness.store.get('duels/duel-1')).not.toHaveProperty('speculativeWorkspace');
  });

  it('disposes isolated challenger workspace changes when the primary wins', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Fix a backend bug',
      taskType: 'backend',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'anthropic/claude-sonnet',
      childConversationId: 'child-1',
      jobId: 'job-1',
      speculativeWorkspace: {
        id: 'workspace-1',
        sourcePath: '/repo',
        rootPath: '/tmp/model-arena-workspace',
        strategy: 'copy',
      },
      sideA: 'primary',
      sideB: 'challenger',
      status: 'ready',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      primaryText: 'Primary',
      challengerText: 'Challenger',
    };
    const harness = createContext({ 'duels/duel-1': duel });

    await voteDuel({ duelId: 'duel-1', choice: 'a' }, harness.ctx as never);

    expect(harness.disposeSpeculativeWorkspace).toHaveBeenCalledWith({
      id: 'workspace-1',
      rootPath: '/tmp/model-arena-workspace',
    });
    expect(harness.applySpeculativeWorkspace).not.toHaveBeenCalled();
    expect(harness.store.get('duels/duel-1')).not.toHaveProperty('speculativeWorkspace');
  });

  it('rejects manual duels for image prompts until challenger runs receive equivalent media', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.getBlocks.mockResolvedValue({
      blocks: [
        {
          type: 'user',
          id: 'user-1',
          text: 'Describe this screenshot',
          images: [{ src: 'neon-pilot://asset/image-1', mimeType: 'image/png', alt: 'screenshot' }],
        },
        { type: 'text', id: 'assistant-1', text: 'The screenshot shows a settings page.' },
      ],
    });

    await expect(
      startManualDuel(
        {
          conversationId: 'conv-1',
          blockId: 'assistant-1',
          messageText: 'The screenshot shows a settings page.',
        },
        harness.ctx as never,
      ),
    ).rejects.toThrow('cannot compare image prompts yet');
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
  });

  it('classifies debugging intent before frontend or backend domain words', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.getBlocks.mockResolvedValue({
      blocks: [
        { type: 'user', id: 'user-1', text: 'Fix this React error' },
        { type: 'text', id: 'assistant-1', text: 'Patch' },
      ],
    });

    const result = await startManualDuel({ conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'Patch' }, harness.ctx as never);

    expect(harness.store.get(`duels/${result.duelId}`)).toMatchObject({ taskType: 'debugging' });
  });

  it('keeps provider-qualified challengers eligible when current model metadata is unqualified', async () => {
    const harness = createContext({ settings: { challengerModels: ['codex-compatible/gpt-5.3-codex-spark'] } });
    harness.listModels.mockResolvedValue([
      { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', provider: 'codex-compatible', authConfigured: true },
    ]);
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
      expect.objectContaining({ model: 'codex-compatible/gpt-5.3-codex-spark' }),
    );
  });

  it('rejects manual duels when the provider-qualified challenger is the current model', async () => {
    const harness = createContext({ settings: { challengerModels: ['anthropic/claude-sonnet'] } });
    harness.getMeta.mockResolvedValue({ currentModel: 'claude-sonnet', currentProvider: 'anthropic' });
    harness.getBlocks.mockResolvedValue({
      blocks: [
        { type: 'user', id: 'user-1', text: 'Compare this answer' },
        { type: 'text', id: 'assistant-1', text: 'Answer' },
      ],
    });

    await expect(
      startManualDuel({ conversationId: 'conv-1', blockId: 'assistant-1', messageText: 'Answer' }, harness.ctx as never),
    ).rejects.toThrow('different from the current conversation model');
    expect(harness.startParallelPrompt).not.toHaveBeenCalled();
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

  it('records source block ids when automatic duels reconcile the primary answer', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Compare this backend answer',
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
    harness.getBlocks.mockResolvedValue({ blocks: [{ type: 'text', id: 'assistant-1', text: 'Primary answer' }] });

    await expect(onConversationRunEnded({ payload: { conversationId: 'parent-1' } }, harness.ctx as never)).resolves.toEqual({
      updated: 1,
    });

    expect(harness.store.get('duels/duel-1')).toMatchObject({ primaryText: 'Primary answer', sourceBlockId: 'assistant-1' });
    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceBlockId: 'assistant-1', sideA: expect.objectContaining({ text: 'Primary answer' }) }),
      }),
    );
  });

  it('rejects stale votes for cancelled or incomplete duels', async () => {
    const harness = createContext({
      'duels/cancelled': {
        id: 'cancelled',
        conversationId: 'parent-1',
        blockId: 'model_arena_duel:cancelled',
        prompt: 'Compare this answer',
        taskType: 'general',
        primaryModel: 'openai/gpt-5',
        challengerModel: 'anthropic/claude-sonnet',
        childConversationId: 'child-1',
        jobId: 'job-1',
        sideA: 'primary',
        sideB: 'challenger',
        status: 'cancelled',
        createdAt: '2026-06-29T12:00:00.000Z',
        updatedAt: '2026-06-29T12:00:00.000Z',
        primaryText: 'A',
        challengerText: 'B',
      },
      'duels/running': {
        id: 'running',
        conversationId: 'parent-1',
        blockId: 'model_arena_duel:running',
        prompt: 'Compare this answer',
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
        primaryText: 'A',
      },
    });

    await expect(voteDuel({ duelId: 'cancelled', choice: 'a' }, harness.ctx as never)).rejects.toThrow('not ready');
    await expect(voteDuel({ duelId: 'running', choice: 'a' }, harness.ctx as never)).rejects.toThrow('not ready');
    expect(harness.store.has('stats/models')).toBe(false);
    expect(harness.store.get('duels/cancelled')).toMatchObject({ status: 'cancelled' });
    expect(harness.store.get('duels/running')).toMatchObject({ status: 'running' });
  });

  it('keeps repeat votes idempotent only for the same choice', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Build a frontend component',
      taskType: 'frontend',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'anthropic/claude-sonnet',
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
    const statsAfterFirstVote = harness.store.get('stats/models');
    await expect(voteDuel({ duelId: 'duel-1', choice: 'a' }, harness.ctx as never)).resolves.toMatchObject({ ok: true });
    await expect(voteDuel({ duelId: 'duel-1', choice: 'b' }, harness.ctx as never)).rejects.toThrow('already voted');

    expect(harness.store.get('stats/models')).toBe(statsAfterFirstVote);
    expect(harness.store.get('duels/duel-1')).toMatchObject({ vote: 'a' });
  });

  it('cancels an active duel and updates the transcript block without recording a vote', async () => {
    const duel = {
      id: 'duel-1',
      conversationId: 'parent-1',
      blockId: 'model_arena_duel:duel-1',
      prompt: 'Compare this answer',
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
      primaryText: 'Primary answer',
    };
    const harness = createContext({ 'duels/duel-1': duel });

    const result = await cancelDuel({ duelId: 'duel-1' }, harness.ctx as never);

    expect(result).toMatchObject({ ok: true, duel: { status: 'cancelled', vote: null } });
    expect(harness.store.get('duels/duel-1')).toMatchObject({ status: 'cancelled' });
    expect(harness.store.get('duels/duel-1')).not.toHaveProperty('vote');
    expect(harness.manageParallelJob).toHaveBeenCalledWith({ conversationId: 'parent-1', jobId: 'job-1', action: 'skip' });
    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'parent-1',
        blockId: 'model_arena_duel:duel-1',
        data: expect.objectContaining({ status: 'cancelled' }),
      }),
    );
    expect(harness.store.has('stats/models')).toBe(false);
  });

  it('cancels duplicate active duels for the same assistant response together', async () => {
    const base = {
      conversationId: 'parent-1',
      prompt: 'Compare this answer',
      taskType: 'general',
      primaryModel: 'openai/gpt-5',
      challengerModel: 'anthropic/claude-sonnet',
      childConversationId: 'child-1',
      jobId: 'job-1',
      sideA: 'primary',
      sideB: 'challenger',
      status: 'ready',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
      primaryText: 'Primary answer',
      sourceBlockId: 'assistant-1',
    };
    const harness = createContext({
      'duels/duel-old': { ...base, id: 'duel-old', blockId: 'model_arena_duel:duel-old', challengerText: 'Older challenger' },
      'duels/duel-new': { ...base, id: 'duel-new', blockId: 'model_arena_duel:duel-new', challengerText: 'Newer challenger' },
      'duels/duel-other': {
        ...base,
        id: 'duel-other',
        blockId: 'model_arena_duel:duel-other',
        sourceBlockId: 'assistant-2',
        primaryText: 'Other answer',
      },
    });

    const result = await cancelDuel({ duelId: 'duel-new' }, harness.ctx as never);

    expect(result).toMatchObject({ ok: true, cancelled: 2 });
    expect(harness.store.get('duels/duel-old')).toMatchObject({ status: 'cancelled' });
    expect(harness.store.get('duels/duel-new')).toMatchObject({ status: 'cancelled' });
    expect(harness.store.get('duels/duel-other')).toMatchObject({ status: 'ready' });
    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'model_arena_duel:duel-old' }));
    expect(harness.updateTranscriptBlock).toHaveBeenCalledWith(expect.objectContaining({ blockId: 'model_arena_duel:duel-new' }));
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
        data: expect.objectContaining({
          status: 'ready',
          sideB: expect.objectContaining({ text: '## Challenger answer\n\n- better markdown' }),
        }),
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
