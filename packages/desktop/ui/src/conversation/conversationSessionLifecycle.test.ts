import { beforeEach, describe, expect, it, vi } from 'vitest';

import { primeDesktopConversationStateCache } from '../hooks/useDesktopConversationState';
import { primeSessionDetailCache } from '../hooks/useSessions';
import { isConversationSessionNotLiveError, primeCreatedConversationOpenCaches } from './conversationSessionLifecycle';

vi.mock('../hooks/useDesktopConversationState', () => ({
  primeDesktopConversationStateCache: vi.fn(),
}));

vi.mock('../hooks/useSessions', () => ({
  primeSessionDetailCache: vi.fn(),
}));

describe('conversation session lifecycle helpers', () => {
  beforeEach(() => {
    vi.mocked(primeDesktopConversationStateCache).mockReset();
    vi.mocked(primeSessionDetailCache).mockReset();
  });

  it('recognizes live-session absence errors from different surfaces', () => {
    expect(isConversationSessionNotLiveError(new Error('session not live'))).toBe(true);
    expect(isConversationSessionNotLiveError('not a live session')).toBe(true);
    expect(isConversationSessionNotLiveError('Session conv-123 is not live')).toBe(true);
    expect(isConversationSessionNotLiveError(new Error('network exploded'))).toBe(false);
  });

  it('primes aggregate-compatible desktop and session-detail caches for newly created conversations', () => {
    const sessionDetail = {
      meta: { id: 'conv-1' },
      blocks: [],
      blockOffset: 0,
      totalBlocks: 0,
    };
    const bootstrap = {
      conversationId: 'conv-1',
      liveSession: { live: true },
      sessionDetail,
    };

    primeCreatedConversationOpenCaches(
      {
        id: 'conv-1',
        bootstrap,
      } as never,
      {
        tailBlocks: 120,
        bootstrapVersionKey: '7',
        sessionDetailVersion: 8,
      },
    );

    expect(primeDesktopConversationStateCache).toHaveBeenCalledWith('conv-1', bootstrap, { tailBlocks: 120, includeToolBlocks: false });
    expect(primeSessionDetailCache).toHaveBeenCalledWith('conv-1', sessionDetail, { tailBlocks: 120 }, 8);
  });

  it('does not prime caches when creation did not return bootstrap data', () => {
    primeCreatedConversationOpenCaches({ id: 'conv-1', bootstrap: null } as never, {
      tailBlocks: 120,
      bootstrapVersionKey: '7',
      sessionDetailVersion: 8,
    });

    expect(primeDesktopConversationStateCache).not.toHaveBeenCalled();
    expect(primeSessionDetailCache).not.toHaveBeenCalled();
  });
});
