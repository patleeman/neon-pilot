import { describe, expect, it, vi } from 'vitest';

import { resolveReservedDraftConversationCreateCwd, startReservedDraftConversationLiveSessionCreate } from './draftConversationCreateFlow';

describe('draftConversationCreateFlow', () => {
  it('uses the reserved workspace cwd for create-time routing', () => {
    expect(
      resolveReservedDraftConversationCreateCwd({
        reserved: { id: 'conv-1', sessionFile: '/tmp/conv-1.jsonl', cwd: '/repo' },
        draftCwdValue: '',
        isNeutralChatCwdPath: () => false,
      }),
    ).toBe('/repo');
  });

  it('keeps neutral chat reservations as no-workspace creates', () => {
    expect(
      resolveReservedDraftConversationCreateCwd({
        reserved: {
          id: 'conv-1',
          sessionFile: '/tmp/conv-1.jsonl',
          cwd: '/Users/patrick/.local/state/neon-pilot/neon-pilot-runtime/chat-workspaces/shared',
        },
        draftCwdValue: '',
        isNeutralChatCwdPath: (cwd) => Boolean(cwd?.includes('/chat-workspaces/')),
      }),
    ).toBeUndefined();
  });

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
    expect(createLiveSession).toHaveBeenCalledWith('/tmp/conv-1.jsonl', undefined);
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

  it('passes the initial prompt into live-session creation', async () => {
    const initialPrompt = { text: 'start here', behavior: 'followUp' };
    const createdPromise = Promise.resolve({ id: 'conv-1' });
    const createLiveSession = vi.fn(() => createdPromise);

    await startReservedDraftConversationLiveSessionCreate({
      reserved: { id: 'conv-1', sessionFile: '/tmp/conv-1.jsonl' },
      initialPrompt,
      createLiveSession,
      applyReservedConversation: vi.fn(async () => undefined),
    });

    expect(createLiveSession).toHaveBeenCalledWith('/tmp/conv-1.jsonl', initialPrompt);
  });
});
