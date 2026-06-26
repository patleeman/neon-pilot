import { beforeEach, describe, expect, it, vi } from 'vitest';

import { primeDesktopConversationStateCache } from '../hooks/useDesktopConversationState';
import { primeSessionDetailCache } from '../hooks/useSessions';
import {
  formatConversationLocalActionFailure,
  formatConversationMessageActionFailure,
  isConversationSessionNotLiveError,
  primeCreatedConversationOpenCaches,
  retryConversationActionAfterNotLive,
} from './conversationSessionLifecycle';

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
    expect(isConversationSessionNotLiveError('Session conv-123 is not live.')).toBe(true);
    expect(
      isConversationSessionNotLiveError('500 Internal Server Error from /live-sessions/conv-123/export: Session conv-123 is not live'),
    ).toBe(true);
    expect(isConversationSessionNotLiveError(new Error('network exploded'))).toBe(false);
  });

  it('formats message action live-session failures without exposing conversation ids', () => {
    expect(formatConversationMessageActionFailure('Fork', new Error('Session conv-123 is not live'))).toBe(
      'Fork failed: Conversation is still reconnecting. Try again in a moment.',
    );
    expect(formatConversationMessageActionFailure('Bash command', new Error('Session conv-123 is not live'))).toBe(
      'Bash command failed: Conversation is still reconnecting. Try again in a moment.',
    );
    expect(
      formatConversationMessageActionFailure(
        'Bash command',
        new Error('500 Internal Server Error from /api/live-sessions/conv-123/execute-bash: aborted'),
      ),
    ).toBe('Bash command failed: aborted');
    expect(formatConversationMessageActionFailure('Rewind', 'Network failed')).toBe('Rewind failed: Network failed');
  });

  it('formats local action failures without exposing local API routes', () => {
    expect(
      formatConversationLocalActionFailure(
        new Error('500 Internal Server Error from /api/live-sessions/conv-123/compact: Nothing to compact (session too small)'),
      ),
    ).toBe('Nothing to compact (session too small)');
    expect(formatConversationLocalActionFailure(new Error('Session conv-123 is not live'))).toBe(
      'Conversation is still reconnecting. Try again in a moment.',
    );
    expect(
      formatConversationLocalActionFailure(
        new Error(
          'Error: Local API route did not complete for POST /api/live-sessions/conv-123/compact at Module.ep (file:///Users/patrick/workingdir/neon-pilot/packages/desktop/dist/app/localApi.js:132:20)',
        ),
        'Could not compact this conversation.',
      ),
    ).toBe('Could not compact this conversation.');
    expect(formatConversationLocalActionFailure('', 'Could not compact.')).toBe('Could not compact.');
  });

  it('recovers and retries once after a stale live-session failure', async () => {
    const attemptAction = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Session conv-123 is not live'))
      .mockResolvedValueOnce('ok');
    const recoverLiveSession = vi.fn(async () => {});

    await expect(retryConversationActionAfterNotLive({ attemptAction, recoverLiveSession })).resolves.toBe('ok');

    expect(attemptAction).toHaveBeenCalledTimes(2);
    expect(recoverLiveSession).toHaveBeenCalledTimes(1);
  });

  it('does not recover or retry unrelated failures', async () => {
    const attemptAction = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('network exploded'));
    const recoverLiveSession = vi.fn(async () => {});

    await expect(retryConversationActionAfterNotLive({ attemptAction, recoverLiveSession })).rejects.toThrow('network exploded');

    expect(attemptAction).toHaveBeenCalledTimes(1);
    expect(recoverLiveSession).not.toHaveBeenCalled();
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
