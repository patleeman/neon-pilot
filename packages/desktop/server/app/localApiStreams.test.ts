import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getDurableRunLogCursorMock,
  getDurableRunSnapshotMock,
  inlineConversationSessionSnapshotAssetsCapabilityMock,
  readDurableRunLogDeltaMock,
  readWorkspaceRootSnapshotMock,
  subscribeLiveSessionMock,
  subscribeProviderOAuthLoginMock,
  subscribeAppEventsMock,
  extensionHostClientMock,
  buildSnapshotEventsForTopicMock,
  existsSyncMock,
  watchMock,
} = vi.hoisted(() => ({
  getDurableRunLogCursorMock: vi.fn(),
  getDurableRunSnapshotMock: vi.fn(),
  inlineConversationSessionSnapshotAssetsCapabilityMock: vi.fn((_: string, event: unknown) => event),
  readDurableRunLogDeltaMock: vi.fn(),
  readWorkspaceRootSnapshotMock: vi.fn(),
  existsSyncMock: vi.fn(),
  subscribeLiveSessionMock: vi.fn(),
  subscribeProviderOAuthLoginMock: vi.fn(),
  subscribeAppEventsMock: vi.fn(),
  extensionHostClientMock: {
    invokeRoute: vi.fn(),
  },
  buildSnapshotEventsForTopicMock: vi.fn(),
  watchMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
  watch: watchMock,
}));

vi.mock('../automation/durableRuns.js', () => ({
  getDurableRunLogCursor: getDurableRunLogCursorMock,
  getDurableRunSnapshot: getDurableRunSnapshotMock,
  readDurableRunLogDelta: readDurableRunLogDeltaMock,
}));

vi.mock('../conversations/conversationSessionAssetCapability.js', () => ({
  inlineConversationSessionSnapshotAssetsCapability: inlineConversationSessionSnapshotAssetsCapabilityMock,
}));

vi.mock('../conversations/liveSessions.js', () => ({
  subscribe: subscribeLiveSessionMock,
}));

vi.mock('../models/providerAuth.js', () => ({
  subscribeProviderOAuthLogin: subscribeProviderOAuthLoginMock,
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClientMock,
}));

vi.mock('../workspace/workspaceExplorer.js', () => ({
  readWorkspaceRootSnapshot: readWorkspaceRootSnapshotMock,
}));

vi.mock('../shared/appEvents.js', () => ({
  subscribeAppEvents: subscribeAppEventsMock,
}));

vi.mock('../routes/system.js', () => ({
  readInitialAppEventTopics: (searchParams: URLSearchParams) =>
    searchParams.get('initialSnapshotTopics')?.split(',').filter(Boolean) ?? ['sessions', 'tasks'],
  buildSnapshotEventsForTopic: buildSnapshotEventsForTopicMock,
}));

import { subscribeDesktopLocalApiStreamByUrl } from './localApiStreams.js';

describe('localApiStreams', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(false);
    extensionHostClientMock.invokeRoute.mockReset();
    buildSnapshotEventsForTopicMock.mockResolvedValue([]);
    subscribeAppEventsMock.mockReturnValue(vi.fn());
  });

  it('emits initial app snapshots on the desktop app-events stream', async () => {
    vi.useFakeTimers();
    const unsubscribeFromEvents = vi.fn();
    buildSnapshotEventsForTopicMock.mockImplementation(async (topic: string) =>
      topic === 'sessions'
        ? [{ type: 'sessions_snapshot', sessions: [{ id: 'conv-1' }] }]
        : [{ type: 'tasks_snapshot', tasks: [{ id: 'task-1' }] }],
    );

    subscribeAppEventsMock.mockReturnValueOnce(unsubscribeFromEvents);
    const events: unknown[] = [];

    const unsubscribe = await subscribeDesktopLocalApiStreamByUrl(new URL('http://local.test/api/app-events/events'), (event) =>
      events.push(event),
    );

    expect(buildSnapshotEventsForTopicMock).not.toHaveBeenCalledWith('sessions');
    expect(buildSnapshotEventsForTopicMock).not.toHaveBeenCalledWith('tasks');
    expect(events).toEqual([{ type: 'open' }]);

    await vi.advanceTimersByTimeAsync(6_000);

    expect(buildSnapshotEventsForTopicMock).toHaveBeenCalledWith('sessions');
    expect(buildSnapshotEventsForTopicMock).toHaveBeenCalledWith('tasks');
    expect(events).toEqual([
      { type: 'open' },
      { type: 'message', data: JSON.stringify({ type: 'sessions_snapshot', sessions: [{ id: 'conv-1' }] }) },
      { type: 'message', data: JSON.stringify({ type: 'tasks_snapshot', tasks: [{ id: 'task-1' }] }) },
    ]);

    unsubscribe();
    expect(events.at(-1)).toEqual({ type: 'close' });
    expect(unsubscribeFromEvents).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('honors requested initial app snapshot topics on the desktop app-events stream', async () => {
    vi.useFakeTimers();
    buildSnapshotEventsForTopicMock.mockImplementation(async (topic: string) => [{ type: `${topic}_snapshot` }]);
    const events: unknown[] = [];

    const unsubscribe = await subscribeDesktopLocalApiStreamByUrl(
      new URL('http://local.test/api/app-events/events?initialSnapshotTopics=tasks'),
      (event) => events.push(event),
    );

    await vi.advanceTimersByTimeAsync(6_000);

    expect(buildSnapshotEventsForTopicMock).toHaveBeenCalledTimes(1);
    expect(buildSnapshotEventsForTopicMock).toHaveBeenCalledWith('tasks');
    expect(events).toEqual([{ type: 'open' }, { type: 'message', data: JSON.stringify({ type: 'tasks_snapshot' }) }]);

    unsubscribe();
    vi.useRealTimers();
  });

  it('ignores malformed live stream tailBlocks instead of partially parsing them', async () => {
    const unsubscribe = vi.fn();
    subscribeLiveSessionMock.mockImplementation((_sessionId, listener) => {
      listener({ type: 'snapshot', blocks: [], blockOffset: 0, totalBlocks: 0, isStreaming: false });
      return unsubscribe;
    });
    const events: unknown[] = [];

    await subscribeDesktopLocalApiStreamByUrl(new URL('http://local.test/api/live-sessions/session-1/events?tailBlocks=20abc'), (event) =>
      events.push(event),
    );

    expect(subscribeLiveSessionMock).toHaveBeenCalledWith('session-1', expect.any(Function), { deferInitialReplayMs: 150 });
    expect(events).toEqual(
      expect.arrayContaining([
        { type: 'open' },
        { type: 'message', data: JSON.stringify({ type: 'snapshot', blocks: [], blockOffset: 0, totalBlocks: 0, isStreaming: false }) },
      ]),
    );
  });

  it('ignores unsafe live stream tailBlocks', async () => {
    const unsubscribe = vi.fn();
    subscribeLiveSessionMock.mockImplementation((_sessionId, listener) => {
      listener({ type: 'snapshot', blocks: [], blockOffset: 0, totalBlocks: 0, isStreaming: false });
      return unsubscribe;
    });

    await subscribeDesktopLocalApiStreamByUrl(
      new URL(`http://local.test/api/live-sessions/session-1/events?tailBlocks=${Number.MAX_SAFE_INTEGER + 1}`),
      vi.fn(),
    );

    expect(subscribeLiveSessionMock).toHaveBeenCalledWith('session-1', expect.any(Function), { deferInitialReplayMs: 150 });
  });

  it('caps live stream tailBlocks before subscribing', async () => {
    const unsubscribe = vi.fn();
    subscribeLiveSessionMock.mockReturnValue(unsubscribe);

    await subscribeDesktopLocalApiStreamByUrl(new URL('http://local.test/api/live-sessions/session-1/events?tailBlocks=50000'), vi.fn());

    expect(subscribeLiveSessionMock).toHaveBeenCalledWith('session-1', expect.any(Function), {
      tailBlocks: 10000,
      deferInitialReplayMs: 150,
    });
  });

  it('streams debounced workspace changes through the desktop local API bridge without recursive repo watches', async () => {
    vi.useFakeTimers();
    try {
      const close = vi.fn();
      let watcher: (() => void) | null = null;
      readWorkspaceRootSnapshotMock.mockReturnValue({ root: '/repo' });
      watchMock.mockImplementation((_path, listener) => {
        watcher = listener;
        return { close };
      });
      const events: unknown[] = [];

      const unsubscribe = await subscribeDesktopLocalApiStreamByUrl(
        new URL('http://local.test/api/workspace/events?cwd=%2Frepo'),
        (event) => events.push(event),
      );
      watcher?.();
      watcher?.();
      await vi.advanceTimersByTimeAsync(250);
      unsubscribe();

      expect(readWorkspaceRootSnapshotMock).toHaveBeenCalledWith('/repo');
      expect(watchMock).toHaveBeenCalledWith('/repo', expect.any(Function));
      expect(watchMock).not.toHaveBeenCalledWith('/repo', { recursive: true }, expect.any(Function));
      expect(events).toEqual([
        { type: 'open' },
        { type: 'message', data: JSON.stringify({ type: 'ready', root: '/repo' }) },
        { type: 'message', data: JSON.stringify({ type: 'workspace' }) },
        { type: 'close' },
      ]);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('streams extension backend SSE routes through the desktop local API bridge', async () => {
    const events: unknown[] = [];
    let releaseEvent: (() => void) | null = null;
    async function* routeEvents() {
      yield { data: { type: 'output', data: 'startup-prompt' } };
      await new Promise<void>((resolve) => {
        releaseEvent = resolve;
      });
    }
    extensionHostClientMock.invokeRoute.mockResolvedValue({
      stream: 'sse',
      events: routeEvents(),
    });

    const unsubscribe = await subscribeDesktopLocalApiStreamByUrl(
      new URL('http://local.test/api/extensions/system-terminal/routes/stream?id=terminal-1&id=terminal-2'),
      (event) => events.push(event),
    );
    await Promise.resolve();

    expect(extensionHostClientMock.invokeRoute).toHaveBeenCalledWith({
      extensionId: 'system-terminal',
      method: 'GET',
      routePath: '/stream',
      request: {
        method: 'GET',
        path: '/stream',
        query: { id: ['terminal-1', 'terminal-2'] },
        params: {},
        signal: expect.any(AbortSignal),
      },
    });
    expect(events).toEqual([
      { type: 'open' },
      { type: 'message', data: JSON.stringify({ type: 'output', data: 'startup-prompt' }) },
    ]);

    unsubscribe();
    releaseEvent?.();
    expect(events.at(-1)).toEqual({ type: 'close' });
  });
});
