import { describe, expect, it } from 'vitest';

import { resolveControllableConversationSurfaceId } from './sessionStream';

describe('resolveControllableConversationSurfaceId', () => {
  it('returns the surface id after presence confirms it is open', () => {
    expect(
      resolveControllableConversationSurfaceId(' surface-1 ', {
        surfaces: [{ surfaceId: 'surface-1', surfaceType: 'desktop_web', connectedAt: '2026-06-24T00:00:00.000Z' }],
        controllerSurfaceId: 'surface-1',
        controllerSurfaceType: 'desktop_web',
        controllerAcquiredAt: '2026-06-24T00:00:00.000Z',
      }),
    ).toBe('surface-1');
  });

  it('omits the surface id until the live session has registered this surface', () => {
    expect(
      resolveControllableConversationSurfaceId('surface-1', {
        surfaces: [{ surfaceId: 'surface-2', surfaceType: 'desktop_web', connectedAt: '2026-06-24T00:00:00.000Z' }],
        controllerSurfaceId: 'surface-2',
        controllerSurfaceType: 'desktop_web',
        controllerAcquiredAt: '2026-06-24T00:00:00.000Z',
      }),
    ).toBe('');
    expect(resolveControllableConversationSurfaceId('surface-1', null)).toBe('');
    expect(resolveControllableConversationSurfaceId(' ', undefined)).toBe('');
  });
});
