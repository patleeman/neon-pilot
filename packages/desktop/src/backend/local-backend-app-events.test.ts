import { describe, expect, it } from 'vitest';

import { isDesktopAppEventBridgeMessage } from './local-backend-app-events.js';

describe('local backend app events', () => {
  it('recognizes extension-host app event bridge messages', () => {
    expect(
      isDesktopAppEventBridgeMessage({
        type: 'desktop-app-event',
        event: { type: 'invalidate', topics: ['tasks'] },
      }),
    ).toBe(true);
    expect(isDesktopAppEventBridgeMessage({ type: 'desktop-app-event' })).toBe(false);
    expect(isDesktopAppEventBridgeMessage({ type: 'other', event: { type: 'invalidate', topics: ['tasks'] } })).toBe(false);
  });
});
