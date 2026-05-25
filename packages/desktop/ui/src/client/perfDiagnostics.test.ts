// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('perfDiagnostics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    });
  });

  it('records chat render timing samples', async () => {
    const { recordChatRenderTiming } = await import('./perfDiagnostics');

    recordChatRenderTiming({
      conversationId: 'conv-1',
      route: '/conversations/conv-1',
      startedAtMs: performance.now() - 12,
      meta: { messageCount: 4, toolBlocks: 1 },
    });

    const perf = (globalThis as typeof globalThis & { __NEON_PILOT_APP_PERF__?: { chatRenderSamples?: unknown[] } })
      .__NEON_PILOT_APP_PERF__;
    expect(perf?.chatRenderSamples).toEqual([
      expect.objectContaining({
        conversationId: 'conv-1',
        route: '/conversations/conv-1',
        meta: { messageCount: 4, toolBlocks: 1 },
      }),
    ]);
  });

  it('records thresholded client timing samples', async () => {
    const { measureClientPerfTiming } = await import('./perfDiagnostics');

    const value = measureClientPerfTiming({ name: 'test.syncWork', meta: { items: 2 } }, () => 'ok');

    expect(value).toBe('ok');
    const perf = (globalThis as typeof globalThis & { __NEON_PILOT_APP_PERF__?: { clientSamples?: unknown[] } }).__NEON_PILOT_APP_PERF__;
    expect(perf?.clientSamples).toEqual([
      expect.objectContaining({
        name: 'test.syncWork',
        route: '/',
        meta: { items: 2 },
      }),
    ]);
  });

  it('only logs perf samples for the documented debug key', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    localStorage.setItem('pa.debugPerf', '1');

    const { recordClientPerfTiming } = await import('./perfDiagnostics');
    recordClientPerfTiming({ name: 'test.legacyDebugKey', startedAtMs: performance.now() - 20 });

    expect(info).not.toHaveBeenCalled();

    localStorage.setItem('neonPilot.debugPerf', '1');
    recordClientPerfTiming({ name: 'test.debugKey', startedAtMs: performance.now() - 20 });

    expect(info).toHaveBeenCalledWith('[pa-perf][client]', expect.objectContaining({ name: 'test.debugKey' }));
  });

  it('records conversation extension-open phase timing', async () => {
    const { completeConversationOpenPhase, ensureConversationOpenStart } = await import('./perfDiagnostics');

    ensureConversationOpenStart('conv-1', 'route');
    completeConversationOpenPhase('conv-1', 'extensions', { extensionCount: 3 });

    const perf = (globalThis as typeof globalThis & { __NEON_PILOT_APP_PERF__?: { conversationOpenSamples?: unknown[] } })
      .__NEON_PILOT_APP_PERF__;
    expect(perf?.conversationOpenSamples).toEqual([
      expect.objectContaining({
        conversationId: 'conv-1',
        source: 'route',
        phase: 'extensions',
        meta: { extensionCount: 3 },
      }),
    ]);
  });
});
