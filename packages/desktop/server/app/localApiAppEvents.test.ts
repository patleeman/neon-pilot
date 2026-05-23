import { describe, expect, it } from 'vitest';

import { buildDesktopAppBridgeError, buildDesktopAppBridgeEvent, shouldProcessDesktopAppEvent } from './localApiAppEvents';

describe('localApiAppEvents', () => {
  it('processes app events only while open', () => {
    expect(shouldProcessDesktopAppEvent(false)).toBe(true);
    expect(shouldProcessDesktopAppEvent(true)).toBe(false);
  });

  it('wraps app events for the desktop bridge', () => {
    expect(buildDesktopAppBridgeEvent({ type: 'invalidate' })).toEqual({ type: 'event', event: { type: 'invalidate' } });
  });

  it('maps errors to desktop bridge errors', () => {
    expect(buildDesktopAppBridgeError(new Error('boom'))).toEqual({ type: 'error', message: 'boom' });
    expect(buildDesktopAppBridgeError('bad')).toEqual({ type: 'error', message: 'bad' });
  });
});
