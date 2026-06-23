import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveDesktopRealtimeUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('uses the desktop bridge realtime URL under the app protocol', async () => {
    vi.stubGlobal('window', {
      location: { protocol: 'neon-pilot:', host: 'app' },
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({ realtimeUrl: 'ws://127.0.0.1:4123/api/realtime' }),
      },
    });

    const { resolveDesktopRealtimeUrl } = await import('./desktopRealtimeConnection');

    await expect(resolveDesktopRealtimeUrl()).resolves.toBe('ws://127.0.0.1:4123/api/realtime');
  });

  it('does not synthesize an unresolvable ws://app URL under the app protocol', async () => {
    vi.stubGlobal('window', {
      location: { protocol: 'neon-pilot:', host: 'app' },
      neonPilotDesktop: {
        getEnvironment: vi.fn().mockResolvedValue({}),
      },
    });

    const { resolveDesktopRealtimeUrl } = await import('./desktopRealtimeConnection');

    await expect(resolveDesktopRealtimeUrl()).rejects.toThrow('Desktop realtime URL is unavailable.');
  });

  it('falls back to same-origin WebSocket URLs for browser renderers', async () => {
    vi.stubGlobal('window', { location: { protocol: 'http:', host: '127.0.0.1:3000' } });

    const { resolveDesktopRealtimeUrl } = await import('./desktopRealtimeConnection');

    await expect(resolveDesktopRealtimeUrl()).resolves.toBe('ws://127.0.0.1:3000/api/realtime');
  });
});
