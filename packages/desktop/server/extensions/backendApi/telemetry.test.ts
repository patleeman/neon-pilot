import { describe, expect, it, vi } from 'vitest';

import { recordTelemetryEvent } from './telemetry.js';

describe('backendApi/telemetry', () => {
  it('does not throw when telemetry persistence is unavailable', () => {
    expect(() => recordTelemetryEvent({ category: 'test', name: 'event' })).not.toThrow();
  });

  it('returns immediately without awaiting dynamic telemetry persistence', async () => {
    const unhandled = vi.fn();
    process.once('unhandledRejection', unhandled);
    recordTelemetryEvent({ source: 'agent', category: 'test', name: 'event', count: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).not.toHaveBeenCalled();
    process.removeListener('unhandledRejection', unhandled);
  });
});
