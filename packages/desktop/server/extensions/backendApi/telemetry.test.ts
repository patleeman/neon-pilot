import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({
  callServerModuleExport: vi.fn(async () => undefined),
}));

vi.mock('./serverModuleResolver.js', () => resolver);

import { recordTelemetryEvent } from './telemetry.js';

describe('backendApi/telemetry', () => {
  beforeEach(() => {
    resolver.callServerModuleExport.mockClear();
    resolver.callServerModuleExport.mockResolvedValue(undefined);
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
});
