import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateAppTopicsMock, publishAppEventMock } = vi.hoisted(() => ({
  invalidateAppTopicsMock: vi.fn(),
  publishAppEventMock: vi.fn(),
}));

vi.mock('../../server/shared/appEvents.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  publishAppEvent: publishAppEventMock,
}));

import { bridgeRawLocalApiAppEventsToBundledRuntime, publishBundledDesktopAppEvent } from './local-backend-app-events.js';

describe('local backend app events', () => {
  beforeEach(() => {
    invalidateAppTopicsMock.mockReset();
    publishAppEventMock.mockReset();
  });

  it('publishes sanitized invalidations into the bundled realtime runtime', () => {
    publishBundledDesktopAppEvent({ type: 'invalidate', topics: ['tasks', 'sessions', 'not-a-topic' as never] });

    expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
    expect(invalidateAppTopicsMock).toHaveBeenCalledWith('tasks', 'sessions');
    expect(publishAppEventMock).not.toHaveBeenCalled();
  });

  it('bridges raw local API app events into the bundled realtime runtime', async () => {
    const unsubscribe = vi.fn();
    let listener:
      | ((event: { type: 'open' } | { type: 'event'; event: unknown } | { type: 'error'; message: string } | { type: 'close' }) => void)
      | undefined;
    const localApi = {
      subscribeDesktopAppEvents: vi.fn(async (onEvent) => {
        listener = onEvent;
        return unsubscribe;
      }),
    };

    await expect(bridgeRawLocalApiAppEventsToBundledRuntime(localApi)).resolves.toBe(unsubscribe);
    listener?.({ type: 'open' });
    listener?.({ type: 'event', event: { type: 'invalidate', topics: ['tasks', 'workspace'] } });

    expect(invalidateAppTopicsMock).toHaveBeenCalledTimes(1);
    expect(invalidateAppTopicsMock).toHaveBeenCalledWith('tasks', 'workspace');
  });
});
