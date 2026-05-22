import { describe, expect, it, vi } from 'vitest';

import {
  clearExtensionBadge,
  getAggregatedBadgeCount,
  isSystemNotificationAvailable,
  onBadgeChanged,
  onSystemNotification,
  sendNotifyAsSystemNotification,
  sendSystemNotification,
  setExtensionBadge,
} from './extensionNotifications.js';

describe('extensionNotifications', () => {
  it('tracks extension badges and broadcasts aggregated count changes', () => {
    clearExtensionBadge('a');
    clearExtensionBadge('b');
    const listener = vi.fn();
    const unsubscribe = onBadgeChanged(listener);

    expect(setExtensionBadge('a', 2.8)).toEqual({ badge: 2, aggregated: 2 });
    expect(setExtensionBadge('b', -5)).toEqual({ badge: 0, aggregated: 2 });
    expect(setExtensionBadge('b', 4)).toEqual({ badge: 4, aggregated: 6 });
    expect(getAggregatedBadgeCount()).toBe(6);

    clearExtensionBadge('a');
    expect(getAggregatedBadgeCount()).toBe(4);
    expect(listener).toHaveBeenLastCalledWith(4);

    unsubscribe();
    setExtensionBadge('b', 1);
    expect(listener).toHaveBeenCalledTimes(4);
    clearExtensionBadge('b');
  });

  it('continues broadcasting badges when one listener throws', () => {
    clearExtensionBadge('a');
    clearExtensionBadge('b');
    clearExtensionBadge('thrower');
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    const offThrowing = onBadgeChanged(throwing);
    const offOk = onBadgeChanged(ok);

    setExtensionBadge('thrower', 3);

    expect(throwing).toHaveBeenCalledWith(3);
    expect(ok).toHaveBeenCalledWith(3);
    offThrowing();
    offOk();
    clearExtensionBadge('thrower');
  });

  it('sends system notifications only when listeners are registered', () => {
    expect(isSystemNotificationAvailable()).toBe(false);
    expect(sendSystemNotification('ext', { title: 'Title', body: 'Body' })).toBe(false);

    const listener = vi.fn();
    const unsubscribe = onSystemNotification(listener);

    expect(isSystemNotificationAvailable()).toBe(true);
    expect(sendSystemNotification('ext', { title: 'Title', body: 'Body', subtitle: 'Sub' })).toBe(true);
    expect(listener).toHaveBeenCalledWith({ extensionId: 'ext', title: 'Title', body: 'Body', subtitle: 'Sub' });

    unsubscribe();
    expect(isSystemNotificationAvailable()).toBe(false);
  });

  it('converts backend notify input into a system notification', () => {
    const listener = vi.fn();
    const unsubscribe = onSystemNotification(listener);

    expect(
      sendNotifyAsSystemNotification('ext', {
        title: 'Custom title',
        message: 'Hello',
        subtitle: 'Sub',
        persistent: true,
        actionPayload: { route: '/x' },
      }),
    ).toBe(true);
    expect(listener).toHaveBeenCalledWith({
      extensionId: 'ext',
      title: 'Custom title',
      body: 'Hello',
      subtitle: 'Sub',
      persistent: true,
      actionPayload: { route: '/x' },
    });

    unsubscribe();
  });
});
