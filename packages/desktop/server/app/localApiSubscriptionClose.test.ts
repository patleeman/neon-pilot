import { describe, expect, it } from 'vitest';

import { buildDesktopCloseEvent, markSubscriptionClosed, shouldCloseSubscription } from './localApiSubscriptionClose';

describe('localApiSubscriptionClose', () => {
  it('closes only once', () => {
    expect(shouldCloseSubscription(false)).toBe(true);
    expect(shouldCloseSubscription(true)).toBe(false);
    expect(markSubscriptionClosed()).toBe(true);
  });

  it('builds close events', () => {
    expect(buildDesktopCloseEvent()).toEqual({ type: 'close' });
  });
});
