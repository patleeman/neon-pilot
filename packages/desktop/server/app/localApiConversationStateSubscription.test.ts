import { describe, expect, it } from 'vitest';

import {
  buildConversationStateSubscriptionSurface,
  shouldIgnoreConversationStateLiveEvent,
  shouldSubscribeConversationStateLiveEvents,
} from './localApiConversationStateSubscription';

describe('localApiConversationStateSubscription', () => {
  it('ignores live events once closed', () => {
    expect(shouldIgnoreConversationStateLiveEvent(true)).toBe(true);
    expect(shouldIgnoreConversationStateLiveEvent(false)).toBe(false);
  });

  it('subscribes to live events only for live state', () => {
    expect(shouldSubscribeConversationStateLiveEvents(true)).toBe(true);
    expect(shouldSubscribeConversationStateLiveEvents(false)).toBe(false);
  });

  it('builds optional subscription surface input only when complete', () => {
    expect(buildConversationStateSubscriptionSurface({ surfaceId: 's1', surfaceType: 'desktop_web' })).toEqual({
      surface: { surfaceId: 's1', surfaceType: 'desktop_web' },
    });
    expect(buildConversationStateSubscriptionSurface({ surfaceId: 's1' })).toEqual({});
    expect(buildConversationStateSubscriptionSurface({ surfaceType: 'desktop_web' })).toEqual({});
  });
});
