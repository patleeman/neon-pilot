import { beforeEach, describe, expect, it, vi } from 'vitest';

const inProcess = vi.hoisted(() => ({ getDaemonClientTransportOverride: vi.fn() }));
const core = vi.hoisted(() => ({ resolveNeonPilotRuntimeChannelConfig: vi.fn(() => ({ companionPort: 4567 })) }));
const events = vi.hoisted(() => ({
  createDaemonEvent: vi.fn((input) => ({ id: 'event-1', version: 1, timestamp: '2026-05-22T00:00:00.000Z', payload: {}, ...input })),
}));
const appEvents = vi.hoisted(() => ({ publishAppEvent: vi.fn() }));
const logging = vi.hoisted(() => ({ logWarn: vi.fn() }));

vi.mock('./in-process-client.js', () => inProcess);
vi.mock('@neon-pilot/core', () => core);
vi.mock('./events.js', () => events);
vi.mock('../shared/appEvents.js', () => appEvents);
vi.mock('../shared/logging.js', () => logging);
vi.mock('../config.js', () => ({ loadDaemonConfig: vi.fn(() => ({ ipc: { socketPath: '/sock' } })) }));
vi.mock('../paths.js', () => ({ resolveDaemonPaths: vi.fn((socketPath) => ({ socketPath })) }));

import {
  emitDaemonEvent,
  emitDaemonEventNonFatal,
  followUpDurableRun,
  getCompanionUrl,
  getDaemonStatus,
  pingDaemon,
  startBackgroundRun,
  stopDaemon,
} from './client.js';

describe('daemon client transport paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inProcess.getDaemonClientTransportOverride.mockReturnValue(undefined);
  });

  it('uses the in-process transport override for daemon operations', async () => {
    const transport = {
      ping: vi.fn(async () => true),
      getStatus: vi.fn(async () => ({ running: true })),
      stop: vi.fn(async () => undefined),
      startBackgroundRun: vi.fn(async () => ({ accepted: true, runId: 'run-1' })),
      followUpDurableRun: vi.fn(async () => ({ accepted: true })),
      emitEvent: vi.fn(async () => true),
    };
    inProcess.getDaemonClientTransportOverride.mockReturnValue(transport);
    const config = { ipc: { socketPath: '/custom.sock' } } as never;

    await expect(pingDaemon(config)).resolves.toBe(true);
    await expect(getDaemonStatus(config)).resolves.toEqual({ running: true });
    await stopDaemon(config);
    await expect(startBackgroundRun({ taskSlug: 'slug', cwd: '/repo' } as never, config)).resolves.toEqual({
      accepted: true,
      runId: 'run-1',
    });
    await expect(followUpDurableRun('run-1', ' continue ', config)).resolves.toEqual({ accepted: true });
    await expect(emitDaemonEvent({ type: 'test.event', source: 'test' }, config)).resolves.toBe(true);

    expect(transport.ping).toHaveBeenCalledWith(config);
    expect(transport.stop).toHaveBeenCalledWith(config);
    expect(transport.startBackgroundRun).toHaveBeenCalledWith({ taskSlug: 'slug', cwd: '/repo' }, config);
    expect(transport.followUpDurableRun).toHaveBeenCalledWith('run-1', 'continue', config);
    expect(transport.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event-1', type: 'test.event', source: 'test' }),
      config,
    );
  });

  it('returns false for ping when the transport throws', async () => {
    inProcess.getDaemonClientTransportOverride.mockReturnValue({
      ping: vi.fn(async () => {
        throw new Error('down');
      }),
    });
    await expect(pingDaemon()).resolves.toBe(false);
  });

  it('computes companion url locally when no transport companion method exists', async () => {
    await expect(getCompanionUrl({ ipc: { socketPath: '/sock' }, companion: { enabled: false } } as never)).resolves.toBeNull();
    await expect(getCompanionUrl({ ipc: { socketPath: '/sock' }, companion: { host: '::1', port: 9999 } } as never)).resolves.toBe(
      'http://[::1]:9999',
    );
    await expect(getCompanionUrl({ ipc: { socketPath: '/sock' }, companion: {} } as never)).resolves.toBe('http://0.0.0.0:4567');
  });

  it('emits non-fatal warnings and notifications when daemon events are dropped or unavailable', async () => {
    const transport = { emitEvent: vi.fn(async () => false) };
    inProcess.getDaemonClientTransportOverride.mockReturnValue(transport);
    await emitDaemonEventNonFatal({ type: 'drop.event', source: 'test' });
    expect(logging.logWarn).toHaveBeenCalledWith('daemon queue is full; dropped event', { type: 'drop.event' });
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'core',
      message: 'Daemon queue dropped event: drop.event',
      severity: 'warning',
    });

    transport.emitEvent.mockRejectedValueOnce(Object.assign(new Error('missing socket'), { code: 'ENOENT' }));
    await emitDaemonEventNonFatal({ type: 'down.event', source: 'test' }, { ipc: { socketPath: '/daemon.sock' } } as never);
    expect(logging.logWarn).toHaveBeenLastCalledWith('daemon unavailable; continuing without background event', {
      message: 'daemon is not running; background events are disabled. Start it with: pa daemon start (socket: /daemon.sock)',
    });
    expect(appEvents.publishAppEvent).toHaveBeenLastCalledWith({
      type: 'notification',
      extensionId: 'core',
      message: 'Daemon unavailable: missing socket',
      severity: 'warning',
    });
  });
});
