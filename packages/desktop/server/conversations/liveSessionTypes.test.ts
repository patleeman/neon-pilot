import { describe, expect, it } from 'vitest';

import type { LiveEntry, LiveListener, PersistedTokensSnapshot } from './liveSessionTypes.js';

describe('live session public types', () => {
  it('keeps core live entry and listener shapes assignable', () => {
    const listener: LiveListener = { send: () => undefined, tailBlocks: 10 };
    const tokens: PersistedTokensSnapshot = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, cost: 0.5 };
    const entry: LiveEntry = {
      sessionId: 's1',
      session: {} as never,
      cwd: '/repo',
      listeners: new Set([listener]),
      title: 'Title',
      lastContextUsageJson: null,
      lastQueueStateJson: null,
      running: false,
      tracePersistedTokens: tokens,
      lifecycleHandlers: [],
      presenceBySurfaceId: new Map(),
      activeStaleTurnCustomType: null,
    };

    expect(entry).toMatchObject({
      sessionId: 's1',
      cwd: '/repo',
      title: 'Title',
      running: false,
      tracePersistedTokens: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, cost: 0.5 },
    });
    expect([...entry.listeners][0]).toBe(listener);
  });
});
