import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishAppEvent = vi.fn();
const logError = vi.fn();
const logInfo = vi.fn();
const createBackendContext = vi.fn();
const loadExtensionBackend = vi.fn();
const findExtensionEntry = vi.fn();
const listExtensionInstallSummaries = vi.fn();
const recordExtensionFailure = vi.fn();
const setExtensionHealthError = vi.fn();
const setExtensionEnabled = vi.fn();

vi.mock('../shared/appEvents.js', () => ({ publishAppEvent }));
vi.mock('../shared/logging.js', () => ({ logError, logInfo }));
vi.mock('./extensionBackend.js', () => ({ createBackendContext, loadExtensionBackend }));
vi.mock('./extensionRegistry.js', () => ({
  findExtensionEntry,
  listExtensionInstallSummaries,
  recordExtensionFailure,
  setExtensionHealthError,
  setExtensionEnabled,
}));

const {
  isExtensionServiceRunning,
  listRunningExtensionServices,
  runExtensionServiceHealthChecks,
  startExtensionServices,
  stopAllExtensionServices,
  stopExtensionServices,
} = await import('./extensionServices.js');

describe('extensionServices', () => {
  beforeEach(async () => {
    await stopAllExtensionServices();
    for (const mock of [
      publishAppEvent,
      logError,
      logInfo,
      createBackendContext,
      loadExtensionBackend,
      findExtensionEntry,
      listExtensionInstallSummaries,
      recordExtensionFailure,
      setExtensionHealthError,
      setExtensionEnabled,
    ]) {
      mock.mockReset();
    }
    createBackendContext.mockReturnValue({ ctx: true });
  });

  it('starts enabled extension services, stores stop handles, and stops them', async () => {
    const stop = vi.fn();
    const startSync = vi.fn().mockResolvedValue(stop);
    listExtensionInstallSummaries.mockReturnValue([
      { id: 'ext', status: 'enabled' },
      { id: 'off', status: 'disabled' },
    ]);
    findExtensionEntry.mockReturnValue({ manifest: { backend: { services: [{ id: 'sync', handler: 'startSync' }] } } });
    loadExtensionBackend.mockResolvedValue({ startSync });

    await expect(startExtensionServices({ server: true } as never)).resolves.toEqual([{ extensionId: 'ext', serviceId: 'sync', ok: true }]);
    expect(startSync).toHaveBeenCalledWith({ serviceId: 'sync' }, { ctx: true });
    expect(isExtensionServiceRunning('ext', 'sync')).toBe(true);
    expect(listRunningExtensionServices()[0]).toMatchObject({ extensionId: 'ext', serviceId: 'sync', startedAt: expect.any(String) });

    await stopExtensionServices('ext');
    expect(stop).toHaveBeenCalledOnce();
    expect(isExtensionServiceRunning('ext', 'sync')).toBe(false);
  });

  it('is idempotent for already-running services', async () => {
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({ manifest: { backend: { services: [{ id: 'sync', handler: 'startSync' }] } } });
    loadExtensionBackend.mockResolvedValue({ startSync: vi.fn() });

    await startExtensionServices();
    await startExtensionServices();

    expect(loadExtensionBackend).toHaveBeenCalledTimes(1);
  });

  it('records startup failures and publishes app notifications', async () => {
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({ manifest: { backend: { services: [{ id: 'sync', handler: 'missing' }] } } });
    loadExtensionBackend.mockResolvedValue({});

    await expect(startExtensionServices()).resolves.toEqual([
      { extensionId: 'ext', serviceId: 'sync', ok: false, error: 'Missing service handler export "missing".' },
    ]);
    expect(setExtensionHealthError).toHaveBeenCalledWith('ext', 'Missing service handler export "missing".');
    expect(recordExtensionFailure).toHaveBeenCalledWith({
      extensionId: 'ext',
      operation: 'service sync startup',
      error: 'Missing service handler export "missing".',
    });
    expect(publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'ext',
      message: 'Extension service failed: Missing service handler export "missing".',
      severity: 'error',
    });
  });

  it('runs health checks and restarts services that report stopped', async () => {
    const stop = vi.fn();
    const startSync = vi.fn().mockResolvedValue(stop);
    const checkSync = vi.fn().mockResolvedValue({ running: false });
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({
      manifest: { backend: { services: [{ id: 'sync', handler: 'startSync', healthCheck: 'checkSync', restart: 'on-failure' }] } },
    });
    loadExtensionBackend.mockResolvedValue({ startSync, checkSync });

    await startExtensionServices();
    await runExtensionServiceHealthChecks();

    expect(recordExtensionFailure).toHaveBeenCalledWith({
      extensionId: 'ext',
      operation: 'service sync health check',
      error: 'Service health check reported stopped.',
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(startSync).toHaveBeenCalledTimes(2);
  });

  it('quarantines services that try to terminate the process during health checks', async () => {
    const stop = vi.fn();
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({
      manifest: { backend: { services: [{ id: 'sync', handler: 'startSync', healthCheck: 'checkSync' }] } },
    });
    loadExtensionBackend.mockResolvedValue({
      startSync: vi.fn().mockResolvedValue(stop),
      checkSync: vi.fn(() => process.exit(1)),
    });

    await startExtensionServices();
    await runExtensionServiceHealthChecks();

    expect(setExtensionEnabled).toHaveBeenCalledWith('ext', false);
    expect(stop).toHaveBeenCalledOnce();
    expect(isExtensionServiceRunning('ext', 'sync')).toBe(false);
  });
});
