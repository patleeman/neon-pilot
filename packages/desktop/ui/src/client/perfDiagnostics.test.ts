// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const telemetryMocks = vi.hoisted(() => ({
  recordRendererTelemetry: vi.fn(),
}));

vi.mock('../telemetry/appTelemetry', () => telemetryMocks);

describe('perfDiagnostics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    telemetryMocks.recordRendererTelemetry.mockReset();
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

  it('records API timing samples in the renderer clock domain', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(125);
    const { recordApiTiming } = await import('./perfDiagnostics');
    const res = new Response('{}', {
      headers: {
        'X-PA-Perf': JSON.stringify({ localApi: { totalBeforeReturnMs: 4 } }),
      },
    });

    recordApiTiming('/api/conversations/reserve', res, 100);

    const perf = (globalThis as typeof globalThis & { __NEON_PILOT_APP_PERF__?: { apiSamples?: unknown[] } }).__NEON_PILOT_APP_PERF__;
    expect(perf?.apiSamples).toEqual([
      expect.objectContaining({
        path: '/api/conversations/reserve',
        startTimeMs: 100,
        endTimeMs: 125,
        durationMs: 25,
        meta: { localApi: { totalBeforeReturnMs: 4 } },
      }),
    ]);
  });

  it('aggregates activity tree row renders per animation frame', async () => {
    let animationFrame: FrameRequestCallback | null = null;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      animationFrame = callback;
      return 1;
    });
    const { recordActivityTreeRowRender } = await import('./perfDiagnostics');

    recordActivityTreeRowRender('conversation:one');
    recordActivityTreeRowRender('conversation:two');
    recordActivityTreeRowRender('conversation:one');

    expect(
      (globalThis as typeof globalThis & { __NEON_PILOT_APP_PERF__?: { activityTreeRenderSamples?: unknown[] } }).__NEON_PILOT_APP_PERF__
        ?.activityTreeRenderSamples,
    ).toEqual([]);

    animationFrame?.(performance.now());

    expect(
      (globalThis as typeof globalThis & { __NEON_PILOT_APP_PERF__?: { activityTreeRenderSamples?: unknown[] } }).__NEON_PILOT_APP_PERF__
        ?.activityTreeRenderSamples,
    ).toEqual([
      expect.objectContaining({
        route: '/',
        totalRenderCount: 3,
        itemRenderCounts: [
          { itemId: 'conversation:one', count: 2 },
          { itemId: 'conversation:two', count: 1 },
        ],
      }),
    ]);
  });

  it('records renderer interactions with useful target attribution', async () => {
    const { recordRendererInteraction } = await import('./perfDiagnostics');
    const button = document.createElement('button');
    button.setAttribute('data-route', '/telemetry');
    button.textContent = 'Telemetry';
    document.body.appendChild(button);

    recordRendererInteraction('click', button, 123);

    const perf = (
      globalThis as typeof globalThis & {
        __NEON_PILOT_APP_PERF__?: { interactionSamples?: Array<{ type: string; route: string; target: string | null }> };
      }
    ).__NEON_PILOT_APP_PERF__;
    expect(perf?.interactionSamples).toEqual([
      expect.objectContaining({
        type: 'click',
        route: '/',
        target: expect.stringContaining('route=/telemetry'),
      }),
    ]);
  });

  it('includes transcript size metadata for conversation scroll interactions', async () => {
    const { recordRendererInteraction } = await import('./perfDiagnostics');
    const scrollShell = document.createElement('div');
    scrollShell.setAttribute('data-conversation-scroll-shell', '1');
    scrollShell.setAttribute('data-conversation-id', 'conv-1');
    scrollShell.setAttribute('data-historical-tail-blocks', '80');
    scrollShell.setAttribute('data-historical-total-blocks', '600');
    scrollShell.setAttribute('data-visible-message-count', '75');
    document.body.appendChild(scrollShell);

    recordRendererInteraction('scroll', scrollShell, 456);

    const perf = (
      globalThis as typeof globalThis & {
        __NEON_PILOT_APP_PERF__?: { interactionSamples?: Array<{ type: string; target: string | null }> };
      }
    ).__NEON_PILOT_APP_PERF__;
    expect(perf?.interactionSamples).toEqual([
      expect.objectContaining({
        type: 'scroll',
        target: expect.stringContaining('conversation-scroll'),
      }),
    ]);
    const target = perf?.interactionSamples?.[0]?.target ?? '';
    expect(target).toContain('conversation=conv-1');
    expect(target).toContain('tail=80');
    expect(target).toContain('total=600');
    expect(target).toContain('visible=75');
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

  it('starts a fresh conversation-open sample after a previous partial open', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(125).mockReturnValueOnce(200).mockReturnValueOnce(212);
    const { completeConversationOpenPhase, ensureConversationOpenStart } = await import('./perfDiagnostics');

    ensureConversationOpenStart('conv-1', 'route');
    completeConversationOpenPhase('conv-1', 'content');
    ensureConversationOpenStart('conv-1', 'route');
    completeConversationOpenPhase('conv-1', 'content');

    const perf = (globalThis as typeof globalThis & { __NEON_PILOT_APP_PERF__?: { conversationOpenSamples?: unknown[] } })
      .__NEON_PILOT_APP_PERF__;
    expect(perf?.conversationOpenSamples).toEqual([
      expect.objectContaining({ conversationId: 'conv-1', phase: 'content', durationMs: 25 }),
      expect.objectContaining({ conversationId: 'conv-1', phase: 'content', durationMs: 12 }),
    ]);
  });

  it('records input-to-frame lag after delayed interaction paint', async () => {
    let nowMs = 100;
    let animationFrame: FrameRequestCallback | null = null;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      animationFrame = callback;
      return 1;
    });
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => 1 as unknown as NodeJS.Timeout);

    const { startRendererBlockTelemetry } = await import('./perfDiagnostics');
    startRendererBlockTelemetry();

    const button = document.createElement('button');
    button.textContent = 'Load previous 10%';
    document.body.appendChild(button);
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    nowMs = 175;
    animationFrame?.(nowMs);

    const perf = (
      globalThis as typeof globalThis & {
        __NEON_PILOT_APP_PERF__?: {
          longTaskSamples?: Array<{ source: string; durationMs: number; meta?: Record<string, unknown> }>;
        };
      }
    ).__NEON_PILOT_APP_PERF__;
    expect(perf?.longTaskSamples).toEqual([
      expect.objectContaining({
        source: 'input-frame-lag',
        durationMs: 75,
        meta: expect.objectContaining({
          eventType: 'pointerdown',
          target: expect.stringContaining('Load previous 10%'),
        }),
      }),
    ]);
    expect(telemetryMocks.recordRendererTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'renderer_performance',
        name: 'input-frame-lag',
        durationMs: 75,
      }),
    );
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('only starts the event-loop lag polling fallback when explicitly enabled', async () => {
    globalThis.localStorage.setItem('neonPilot.pollEventLoopLag', '1');
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => 1 as unknown as NodeJS.Timeout);

    const { startRendererBlockTelemetry } = await import('./perfDiagnostics');
    startRendererBlockTelemetry();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 250);
  });
});
