const { persistAppTelemetryEventMock } = vi.hoisted(() => ({
  persistAppTelemetryEventMock: vi.fn(),
}));

vi.mock('../traces/appTelemetry.js', () => ({
  persistAppTelemetryEvent: persistAppTelemetryEventMock,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerAppTelemetryRoutes } from './appTelemetry.js';

describe('app telemetry routes', () => {
  beforeEach(() => {
    persistAppTelemetryEventMock.mockReset();
  });

  it('accepts renderer telemetry events', () => {
    const routes: Record<string, (req: unknown, res: unknown) => void> = {};
    registerAppTelemetryRoutes({
      get: (_path: string, _handler: unknown) => {},
      post: (path: string, handler: unknown) => {
        routes[path] = handler;
      },
    });

    const json = vi.fn();
    routes['/api/telemetry/event'](
      {
        body: { category: 'navigation', name: 'route_view', route: '/apps', durationMs: 14, metadata: { referrerRoute: '/' } },
        headers: { 'user-agent': 'test-agent' },
      },
      { status: vi.fn().mockReturnThis(), json },
    );

    expect(persistAppTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'renderer',
        category: 'navigation',
        name: 'route_view',
        route: '/apps',
        durationMs: 14,
        metadata: expect.objectContaining({ referrerRoute: '/', userAgent: 'test-agent' }),
      }),
    );
    expect(json).toHaveBeenCalledWith({ ok: true });
  });

  it('accepts renderer telemetry events with varying payloads', () => {
    const routes: Record<string, (req: unknown, res: unknown) => void> = {};
    registerAppTelemetryRoutes({
      get: (_path: string, _handler: unknown) => {},
      post: (path: string, handler: unknown) => void (routes[path] = handler),
    });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    routes['/api/telemetry/event'](
      {
        body: {
          category: 'performance',
          name: 'render_time',
          durationMs: 120,
          count: 1,
          metadata: { component: 'Settings' },
        },
        headers: { 'user-agent': 'renderer/1.0' },
      },
      { status, json },
    );

    expect(persistAppTelemetryEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'renderer',
        category: 'performance',
        name: 'render_time',
        durationMs: 120,
        count: 1,
        metadata: expect.objectContaining({ component: 'Settings', userAgent: 'renderer/1.0' }),
      }),
    );
    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({ ok: true });
  });

  it('rejects events missing category or name', () => {
    const routes: Record<string, (req: unknown, res: unknown) => void> = {};
    registerAppTelemetryRoutes({
      get: (_path: string, _handler: unknown) => {},
      post: (path: string, handler: unknown) => void (routes[path] = handler),
    });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    routes['/api/telemetry/event']({ body: { category: 'navigation' }, headers: {} }, { status, json });

    expect(status).toHaveBeenCalledWith(400);
    expect(persistAppTelemetryEventMock).not.toHaveBeenCalled();
  });
});
