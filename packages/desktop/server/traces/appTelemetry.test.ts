import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ writeAppTelemetryEvent: vi.fn() }));
vi.mock('@neon-pilot/core', () => core);

async function loadModule() {
  vi.resetModules();
  return import('./appTelemetry.js');
}

describe('app telemetry persistence queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('queues telemetry events and flushes them asynchronously', async () => {
    const telemetry = await loadModule();

    telemetry.persistAppTelemetryEvent({ source: 'ui', category: 'click', name: 'send' });
    expect(core.writeAppTelemetryEvent).not.toHaveBeenCalled();

    await vi.runOnlyPendingTimersAsync();
    expect(core.writeAppTelemetryEvent).toHaveBeenCalledWith({ source: 'ui', category: 'click', name: 'send' });
  });

  it('flushes in batches and schedules additional flushes for remaining events', async () => {
    const telemetry = await loadModule();
    for (let index = 0; index < 101; index += 1) {
      telemetry.persistAppTelemetryEvent({ source: 'ui', category: 'batch', name: String(index) });
    }

    await vi.runOnlyPendingTimersAsync();
    expect(core.writeAppTelemetryEvent).toHaveBeenCalledTimes(100);
    expect(core.writeAppTelemetryEvent).not.toHaveBeenCalledWith({ source: 'ui', category: 'batch', name: '100' });

    await vi.runOnlyPendingTimersAsync();
    expect(core.writeAppTelemetryEvent).toHaveBeenCalledTimes(101);
    expect(core.writeAppTelemetryEvent).toHaveBeenLastCalledWith({ source: 'ui', category: 'batch', name: '100' });
  });

  it('drops older queued events when the queue is full and records the drop', async () => {
    const telemetry = await loadModule();
    for (let index = 0; index < 1000; index += 1) {
      telemetry.persistAppTelemetryEvent({ source: 'ui', category: 'overflow', name: `old-${index}` });
    }
    telemetry.persistAppTelemetryEvent({ source: 'ui', category: 'overflow', name: 'new' });

    await vi.runAllTimersAsync();

    expect(core.writeAppTelemetryEvent).toHaveBeenCalledWith({
      source: 'system',
      category: 'telemetry',
      name: 'queue_drop',
      count: 1000,
    });
    expect(core.writeAppTelemetryEvent).not.toHaveBeenCalledWith({ source: 'ui', category: 'overflow', name: 'old-0' });
    expect(core.writeAppTelemetryEvent).toHaveBeenCalledWith({ source: 'ui', category: 'overflow', name: 'old-500' });
    expect(core.writeAppTelemetryEvent).toHaveBeenCalledWith({ source: 'ui', category: 'overflow', name: 'new' });
  });

  it('does not let telemetry writer failures escape explicit flushes', async () => {
    const telemetry = await loadModule();
    core.writeAppTelemetryEvent.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    telemetry.persistAppTelemetryEvent({ source: 'ui', category: 'flush', name: 'one' });

    expect(() => telemetry.flushAppTelemetryQueue()).toThrow('disk full');
    telemetry.persistAppTelemetryEvent({ source: 'ui', category: 'flush', name: 'two' });
    expect(() => telemetry.persistAppTelemetryEvent({ source: 'ui', category: 'flush', name: 'three' })).not.toThrow();
  });
});
