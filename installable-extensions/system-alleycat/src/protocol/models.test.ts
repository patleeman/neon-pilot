import { describe, expect, it, vi } from 'vitest';

import { models } from './models.js';

describe('alleycat protocol models', () => {
  it('maps runtime models into Codex model/list shape with normalized reasoning efforts', async () => {
    const ctx = {
      models: {
        list: vi.fn().mockResolvedValue([
          {
            id: 'provider/model-a',
            name: 'Model A',
            description: 'Primary model',
            input: ['text', 'image'],
            supportedReasoningEfforts: ['Low', 'x-high', 'bad', 'low'],
            defaultReasoningEffort: 'HIGH',
          },
          { model: 'model-b', displayName: 'Model B', thinkingLevels: ['minimal'] },
        ]),
      },
    };

    await expect(models.list({}, ctx as never, undefined as never, vi.fn())).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'provider/model-a',
          model: 'provider/model-a',
          displayName: 'Model A',
          description: 'Primary model',
          inputModalities: ['text', 'image'],
          supportedReasoningEfforts: [
            { reasoningEffort: 'low', description: 'low' },
            { reasoningEffort: 'xhigh', description: 'xhigh' },
          ],
          defaultReasoningEffort: 'high',
          isDefault: true,
        }),
        expect.objectContaining({
          id: 'model-b',
          displayName: 'Model B',
          supportedReasoningEfforts: [{ reasoningEffort: 'minimal', description: 'minimal' }],
          defaultReasoningEffort: 'minimal',
          isDefault: false,
        }),
      ],
      nextCursor: null,
    });
  });

  it('falls back to bundled defaults when no runtime models are available and returns empty on model service failure', async () => {
    const emptyCtx = { models: { list: vi.fn().mockResolvedValue([]) } };
    const failedCtx = { models: { list: vi.fn().mockRejectedValue(new Error('offline')) } };

    const fallback = await models.list({}, emptyCtx as never, undefined as never, vi.fn());
    expect((fallback as { data: Array<{ id: string }> }).data.map((model) => model.id)).toEqual(['gpt-5.5', 'gpt-5.4', 'gpt-5.3']);

    await expect(models.list({}, failedCtx as never, undefined as never, vi.fn())).resolves.toEqual({ data: [], nextCursor: null });
  });
});
