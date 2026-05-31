import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  awaitPendingSideChatSession,
  clearPendingSideChatSessionsForTest,
  registerPendingSideChatSession,
} from './sideChatSessionReadiness';

afterEach(() => {
  clearPendingSideChatSessionsForTest();
});

describe('sideChatSessionReadiness', () => {
  it('waits for the pending side-chat live session before continuing', async () => {
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const onReady = vi.fn();

    registerPendingSideChatSession('conv-1', readyPromise);
    const waitPromise = awaitPendingSideChatSession('conv-1').then(onReady);

    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();

    resolveReady();
    await waitPromise;

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('continues immediately when no side-chat creation is pending', async () => {
    await expect(awaitPendingSideChatSession('conv-missing')).resolves.toBeUndefined();
  });

  it('keeps the newest pending promise when creation is retried for a conversation', async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });
    const onReady = vi.fn();

    registerPendingSideChatSession('conv-1', firstPromise);
    registerPendingSideChatSession('conv-1', secondPromise);
    const waitPromise = awaitPendingSideChatSession('conv-1').then(onReady);

    resolveFirst();
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();

    resolveSecond();
    await waitPromise;
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
