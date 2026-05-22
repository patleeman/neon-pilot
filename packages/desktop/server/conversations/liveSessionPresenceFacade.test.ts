import { beforeEach, describe, expect, it, vi } from 'vitest';

const presence = vi.hoisted(() => ({
  assertLiveSessionSurfaceCanControl: vi.fn(),
  buildLiveSessionPresenceState: vi.fn(() => ({ controllerSurfaceId: 'desktop' })),
  takeOverLiveSessionSurface: vi.fn(() => ({ changed: false, state: { controllerSurfaceId: 'desktop' } })),
}));

vi.mock('./liveSessionPresence.js', () => presence);

import {
  broadcastLiveSessionPresenceState,
  ensureLiveSessionSurfaceCanControl,
  takeOverLiveSessionControl,
} from './liveSessionPresenceFacade.js';

describe('live session presence facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presence.buildLiveSessionPresenceState.mockReturnValue({ controllerSurfaceId: 'desktop' });
    presence.takeOverLiveSessionSurface.mockReturnValue({ changed: false, state: { controllerSurfaceId: 'desktop' } });
  });

  it('broadcasts the built presence state with optional exclusions', () => {
    const entry = { sessionId: 's1' };
    const excluded = { id: 'listener-1' };
    const callbacks = { broadcast: vi.fn() };

    broadcastLiveSessionPresenceState(entry as never, callbacks, { exclude: excluded });

    expect(presence.buildLiveSessionPresenceState).toHaveBeenCalledWith(entry);
    expect(callbacks.broadcast).toHaveBeenCalledWith(
      entry,
      { type: 'presence_state', state: { controllerSurfaceId: 'desktop' } },
      { exclude: excluded },
    );
  });

  it('delegates control assertions to the presence layer', () => {
    const entry = { sessionId: 's1' };
    ensureLiveSessionSurfaceCanControl(entry as never, 'desktop');
    expect(presence.assertLiveSessionSurfaceCanControl).toHaveBeenCalledWith(entry, 'desktop');
  });

  it('broadcasts takeover state only when control changes', () => {
    const entry = { sessionId: 's1' };
    const callbacks = { broadcastPresenceState: vi.fn() };

    expect(takeOverLiveSessionControl(entry as never, 'desktop', callbacks)).toEqual({ controllerSurfaceId: 'desktop' });
    expect(callbacks.broadcastPresenceState).not.toHaveBeenCalled();

    presence.takeOverLiveSessionSurface.mockReturnValueOnce({ changed: true, state: { controllerSurfaceId: 'mobile' } });
    expect(takeOverLiveSessionControl(entry as never, 'mobile', callbacks)).toEqual({ controllerSurfaceId: 'mobile' });
    expect(callbacks.broadcastPresenceState).toHaveBeenCalledWith(entry);
  });
});
