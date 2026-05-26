import { describe, expect, it, vi } from 'vitest';

const clearCacheMock = vi.fn().mockResolvedValue(undefined);
const setProxyMock = vi.fn().mockResolvedValue(undefined);

vi.mock('electron', () => ({
  app: { name: 'Neon Pilot' },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  session: { fromPartition: () => ({ protocol: { handle: vi.fn() }, setProxy: setProxyMock, clearCache: clearCacheMock }) },
}));

import { buildDesktopProtocolErrorResponse, ensureDesktopAppProtocolForHost, getDesktopAppBaseUrl } from './app-protocol.js';

// ── app-protocol — helper functions ──────────────────────────────────────

describe('getDesktopAppBaseUrl', () => {
  it('returns the neon-pilot://app/ base URL', () => {
    expect(getDesktopAppBaseUrl()).toBe('neon-pilot://app/');
  });
});

describe('buildDesktopProtocolErrorResponse', () => {
  it('maps missing durable runs to 404 so run polling does not retry as a server error', () => {
    const response = buildDesktopProtocolErrorResponse(new Error('Run not found'));

    expect(response.status).toBe(404);
  });
});

describe('ensureDesktopAppProtocolForHost', () => {
  it('clears the local desktop shell cache so stale dynamic extension chunks do not survive updates', () => {
    vi.useFakeTimers();
    ensureDesktopAppProtocolForHost({} as never, 'local');

    expect(setProxyMock).toHaveBeenCalledWith({ mode: 'direct' });
    expect(clearCacheMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(clearCacheMock).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
