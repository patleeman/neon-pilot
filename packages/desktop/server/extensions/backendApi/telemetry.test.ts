import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({
  callServerModuleExport: vi.fn(async () => undefined),
}));

vi.mock('./serverModuleResolver.js', () => resolver);

import { queryAppTelemetryEvents, readTraceTelemetryEvents, recordTelemetryEvent } from './telemetry.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/telemetry', () => {
  const bridge = vi.fn();

  beforeEach(() => {
    resolver.callServerModuleExport.mockClear();
    resolver.callServerModuleExport.mockResolvedValue(undefined);
    bridge.mockReset();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('does not throw when telemetry persistence is unavailable', () => {
    expect(() => recordTelemetryEvent({ category: 'test', name: 'event' })).not.toThrow();
  });

  it('does not persist telemetry without extension context', async () => {
    recordTelemetryEvent({ source: 'agent', category: 'test', name: 'event', count: 1 });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });

  it('asserts telemetry write permission before persisting extension telemetry', async () => {
    recordTelemetryEvent(
      { source: 'agent', category: 'test', name: 'event', count: 1, metadata: { ok: true } },
      { extensionId: 'telemetry-ext' },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../extensions/extensionPermissions.js',
      'assertExtensionPermission',
      'telemetry-ext',
      'telemetry:write',
      'telemetry.record',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../traces/appTelemetry.js',
      'persistAppTelemetryEvent',
      expect.objectContaining({
        source: 'agent',
        category: 'test',
        name: 'event',
        count: 1,
        metadata: { ok: true, extensionId: 'telemetry-ext' },
      }),
    );
  });

  it('returns immediately without awaiting dynamic telemetry persistence', async () => {
    const unhandled = vi.fn();
    process.once('unhandledRejection', unhandled);
    recordTelemetryEvent({ source: 'agent', category: 'test', name: 'event', count: 1 }, { extensionId: 'telemetry-ext' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).not.toHaveBeenCalled();
    process.removeListener('unhandledRejection', unhandled);
  });

  it('reads trace telemetry through the trusted host capability bridge', async () => {
    bridge.mockResolvedValue([{ id: 'trace-1' }]);
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await expect(readTraceTelemetryEvents({ since: '2026-05-22T00:00:00.000Z', limit: 10 })).resolves.toEqual([{ id: 'trace-1' }]);

    expect(bridge).toHaveBeenCalledWith('telemetry', 'readTrace', {
      since: '2026-05-22T00:00:00.000Z',
      limit: 10,
    });
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });

  it('reads app telemetry through the trusted host capability bridge', async () => {
    bridge.mockResolvedValue([{ id: 'app-1' }]);
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await expect(queryAppTelemetryEvents({ since: '2026-05-22T00:00:00.000Z', limit: 20 })).resolves.toEqual([{ id: 'app-1' }]);

    expect(bridge).toHaveBeenCalledWith('telemetry', 'queryApp', {
      since: '2026-05-22T00:00:00.000Z',
      limit: 20,
    });
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });

  it('fails closed when no trusted host capability bridge is active', async () => {
    await expect(readTraceTelemetryEvents({ since: '2026-05-22T00:00:00.000Z', limit: 10 })).rejects.toThrow(
      'Telemetry reads require an active extension host capability bridge.',
    );
    await expect(queryAppTelemetryEvents({ since: '2026-05-22T00:00:00.000Z', limit: 10 })).rejects.toThrow(
      'Telemetry reads require an active extension host capability bridge.',
    );
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });

  it('clamps telemetry read limits before bridge dispatch', async () => {
    bridge.mockResolvedValue([]);
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;

    await readTraceTelemetryEvents({ since: '2026-05-22T00:00:00.000Z', limit: 1_000_000 });
    await queryAppTelemetryEvents({ since: '2026-05-22T00:00:00.000Z', limit: Number.NaN });

    expect(bridge).toHaveBeenNthCalledWith(1, 'telemetry', 'readTrace', {
      since: '2026-05-22T00:00:00.000Z',
      limit: 100_000,
    });
    expect(bridge).toHaveBeenNthCalledWith(2, 'telemetry', 'queryApp', {
      since: '2026-05-22T00:00:00.000Z',
      limit: 200,
    });
  });
});
