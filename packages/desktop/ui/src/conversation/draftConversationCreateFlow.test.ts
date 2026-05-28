import { describe, expect, it, vi } from 'vitest';

import { startReservedDraftConversationLiveSessionCreate } from './draftConversationCreateFlow';

describe('draftConversationCreateFlow', () => {
  it('starts live-session creation before waiting for reserved conversation apply actions', async () => {
    const order: string[] = [];
    let finishApply: (() => void) | null = null;
    const createdPromise = Promise.resolve({ id: 'conv-1' });
    const createLiveSession = vi.fn(() => {
      order.push('create');
      return createdPromise;
    });
    const applyReservedConversation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          order.push('apply-start');
          finishApply = () => {
            order.push('apply-end');
            resolve();
          };
        }),
    );

    const resultPromise = startReservedDraftConversationLiveSessionCreate({
      reserved: { id: 'conv-1', sessionFile: '/tmp/conv-1.jsonl' },
      createLiveSession,
      applyReservedConversation,
    });

    await Promise.resolve();

    expect(order).toEqual(['create', 'apply-start']);
    expect(createLiveSession).toHaveBeenCalledWith('/tmp/conv-1.jsonl');
    expect(applyReservedConversation).toHaveBeenCalledWith('conv-1');

    finishApply?.();

    await expect(resultPromise).resolves.toEqual({ createdPromise });
  });

  it('applies the reserved conversation without waiting for live-session creation to finish', async () => {
    const order: string[] = [];
    const createdPromise = new Promise<{ id: string }>(() => {});
    const createLiveSession = vi.fn(() => {
      order.push('create');
      return createdPromise;
    });
    const applyReservedConversation = vi.fn(async () => {
      order.push('apply');
    });

    const result = await startReservedDraftConversationLiveSessionCreate({
      reserved: { id: 'conv-1', sessionFile: '/tmp/conv-1.jsonl' },
      createLiveSession,
      applyReservedConversation,
    });

    expect(order).toEqual(['create', 'apply']);
    expect(result.createdPromise).toBe(createdPromise);
  });
});
