import { describe, expect, it, vi } from 'vitest';

const appEvents = vi.hoisted(() => ({ publishAppEvent: vi.fn() }));

vi.mock('../shared/appEvents.js', () => appEvents);

import {
  buildExtensionStartupStatusNotifications,
  clearExtensionBadge,
  getAggregatedBadgeCount,
  isSystemNotificationAvailable,
  notifyExtensionStartupStatus,
  onBadgeChanged,
  onSystemNotification,
  sendNotifyAsSystemNotification,
  sendSystemNotification,
  setExtensionBadge,
} from './extensionNotifications.js';
import type { ExtensionInstallSummary } from './extensionRegistry.js';

function extensionSummary(overrides: Partial<ExtensionInstallSummary> & { id: string; name?: string }): ExtensionInstallSummary {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    packageType: 'user',
    enabled: true,
    status: 'enabled',
    manifest: {
      schemaVersion: 2,
      id: overrides.id,
      name: overrides.name ?? overrides.id,
      packageType: 'user',
    },
    permissions: [],
    surfaces: [],
    backendActions: [],
    services: [],
    subscriptions: [],
    dependsOn: [],
    skills: [],
    mentions: [],
    tools: [],
    modelProfiles: [],
    routes: [],
    ...overrides,
  };
}

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

  it('summarizes extension startup errors and warnings', () => {
    const notifications = buildExtensionStartupStatusNotifications([
      extensionSummary({ id: 'broken', name: 'Broken', status: 'invalid', errors: ['Bad manifest'] }),
      extensionSummary({ id: 'warned', name: 'Warned', diagnostics: ['Missing optional skill file'] }),
      extensionSummary({ id: 'healthy', name: 'Healthy' }),
    ]);

    expect(notifications).toEqual([
      {
        severity: 'error',
        message: 'Broken needs attention.',
        details: 'Broken (broken): Bad manifest',
      },
      {
        severity: 'warning',
        message: 'Warned has extension warnings.',
        details: 'Warned (warned): Missing optional skill file',
      },
    ]);
  });

  it('publishes startup status notifications to app and system notification streams', () => {
    appEvents.publishAppEvent.mockReset();
    const systemListener = vi.fn();
    const unsubscribe = onSystemNotification(systemListener);

    expect(
      notifyExtensionStartupStatus([
        extensionSummary({ id: 'broken', name: 'Broken', buildError: 'tsc failed' }),
        extensionSummary({ id: 'warned', name: 'Warned', diagnostics: ['Update available'] }),
      ]),
    ).toBe(2);

    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'core',
      message: 'Broken needs attention.',
      severity: 'error',
      details: 'Broken (broken): Build error: tsc failed',
    });
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'core',
      message: 'Warned has extension warnings.',
      severity: 'warning',
      details: 'Warned (warned): Update available',
    });
    expect(systemListener).toHaveBeenCalledWith({
      extensionId: 'core',
      title: 'Extension error',
      body: 'Broken needs attention.',
      subtitle: 'Broken (broken): Build error: tsc failed',
      persistent: true,
    });
    expect(systemListener).toHaveBeenCalledWith({
      extensionId: 'core',
      title: 'Extension warning',
      body: 'Warned has extension warnings.',
      subtitle: 'Warned (warned): Update available',
      persistent: false,
    });

    unsubscribe();
  });
});
