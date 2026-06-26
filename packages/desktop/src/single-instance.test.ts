import { describe, expect, it, vi } from 'vitest';

import {
  claimDesktopSingleInstance,
  type DesktopSingleInstanceApp,
  readDesktopInitialRoute,
  readDesktopProtocolRoute,
} from './single-instance.js';

function createAppMock(lockGranted: boolean) {
  const listeners = new Map<string, (_event: unknown, argv: string[], workingDirectory: string) => void>();
  const app = {
    requestSingleInstanceLock: vi.fn(() => lockGranted),
    on: vi.fn((event: 'second-instance', listener: () => void) => {
      listeners.set(event, listener);
      return app as unknown as DesktopSingleInstanceApp;
    }),
    exit: vi.fn(),
  };

  return { app: app as unknown as DesktopSingleInstanceApp, listeners };
}

describe('claimDesktopSingleInstance', () => {
  it('registers a second-instance handler when the lock is acquired', () => {
    const { app, listeners } = createAppMock(true);
    const onSecondInstance = vi.fn();

    expect(claimDesktopSingleInstance(app, onSecondInstance)).toBe(true);

    expect(app.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(app.on).toHaveBeenCalledWith('second-instance', onSecondInstance);
    expect(app.exit).not.toHaveBeenCalled();

    listeners.get('second-instance')?.({}, ['app', '--neon-pilot-initial-route=/settings'], '/tmp');
    expect(onSecondInstance).toHaveBeenCalledWith({}, ['app', '--neon-pilot-initial-route=/settings'], '/tmp');
  });

  it('exits immediately when another desktop instance already owns the lock', () => {
    const { app } = createAppMock(false);

    expect(claimDesktopSingleInstance(app, vi.fn())).toBe(false);

    expect(app.exit).toHaveBeenCalledWith(0);
    expect(app.on).not.toHaveBeenCalled();
  });
});

describe('readDesktopInitialRoute', () => {
  it('reads a valid route from second-instance argv before env', () => {
    expect(
      readDesktopInitialRoute({ NEON_PILOT_DESKTOP_INITIAL_ROUTE: '/settings' }, ['app', '--neon-pilot-initial-route=/automations']),
    ).toBe('/automations');
  });

  it('falls back to env and rejects unsafe routes', () => {
    expect(readDesktopInitialRoute({ NEON_PILOT_DESKTOP_INITIAL_ROUTE: '/settings' }, ['app'])).toBe('/settings');
    expect(readDesktopInitialRoute({ NEON_PILOT_DESKTOP_INITIAL_ROUTE: '//evil.example' }, ['app'])).toBe('/');
    expect(readDesktopInitialRoute({}, ['app', '--neon-pilot-initial-route=//evil.example'])).toBe('/');
  });
});

describe('readDesktopProtocolRoute', () => {
  it('reads safe app routes from neon-pilot protocol URLs', () => {
    expect(readDesktopProtocolRoute('neon-pilot://app/settings')).toBe('/settings');
    expect(readDesktopProtocolRoute('neon-pilot://app/conversations/thread-1?view=full#message-2')).toBe(
      '/conversations/thread-1?view=full#message-2',
    );
  });

  it('rejects non-app protocol URLs and unsafe routes', () => {
    expect(readDesktopProtocolRoute('https://example.com/settings')).toBeNull();
    expect(readDesktopProtocolRoute('neon-pilot://other/settings')).toBeNull();
    expect(readDesktopProtocolRoute('neon-pilot://app//evil.example')).toBeNull();
    expect(readDesktopProtocolRoute('not a url')).toBeNull();
  });
});
