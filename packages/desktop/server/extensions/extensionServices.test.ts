import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionProcessTerminationBlockedError } from './extensionProcessGuard.js';

const publishAppEvent = vi.fn();
const logError = vi.fn();
const logInfo = vi.fn();
const createBackendContext = vi.fn();
const loadExtensionBackend = vi.fn();
const runExtensionBackendExport = vi.fn();
const runExtensionBackendExportInWorker = vi.fn();
const runnerRun = vi.fn(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler());
const findExtensionEntry = vi.fn();
const listExtensionInstallSummaries = vi.fn();
const recordExtensionFailure = vi.fn();
const setExtensionHealthError = vi.fn();
const clearExtensionHealthError = vi.fn();
const clearExtensionFailureRecordsForOperation = vi.fn();
const setExtensionEnabled = vi.fn();

vi.mock('../shared/appEvents.js', () => ({ publishAppEvent }));
vi.mock('../shared/logging.js', () => ({ logError, logInfo }));
vi.mock('./extensionBackend.js', () => ({
  createBackendContext,
  loadExtensionBackend,
  runExtensionBackendExport,
  runExtensionBackendExportInWorker,
}));
vi.mock('./extensionBackendRunner.js', () => ({
  extensionBackendOperation: (type: string, label: string, options: { target?: string } = {}) => ({ type, label, ...options }),
  getExtensionBackendRunner: () => ({ run: runnerRun }),
}));
vi.mock('./extensionRegistry.js', () => ({
  findExtensionEntry,
  listExtensionInstallSummaries,
  recordExtensionFailure,
  setExtensionHealthError,
  clearExtensionHealthError,
  clearExtensionFailureRecordsForOperation,
  setExtensionEnabled,
}));

const {
  isExtensionServiceRunning,
  listRunningExtensionServices,
  runExtensionServiceHealthChecks,
  startExtensionServices,
  startServicesForExtension,
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
      runExtensionBackendExport,
      runExtensionBackendExportInWorker,
      runnerRun,
      findExtensionEntry,
      listExtensionInstallSummaries,
      recordExtensionFailure,
      setExtensionHealthError,
      clearExtensionHealthError,
      clearExtensionFailureRecordsForOperation,
      setExtensionEnabled,
    ]) {
      mock.mockReset();
    }
    createBackendContext.mockReturnValue({ ctx: true });
    runExtensionBackendExport.mockImplementation(
      async (
        extensionId: string,
        exportName: string,
        operation: unknown,
        invoke: (handler: (...args: unknown[]) => unknown) => unknown,
        options?: { missingExportMessage?: string },
      ) => {
        const backend = await loadExtensionBackend(extensionId);
        const handler = backend[exportName];
        if (typeof handler !== 'function') throw new Error(options?.missingExportMessage ?? `Missing export "${exportName}".`);
        return runnerRun(extensionId, { ...(operation as Record<string, unknown>), exportName }, () => invoke(handler));
      },
    );
    runExtensionBackendExportInWorker.mockImplementation(
      async (
        extensionId: string,
        exportName: string,
        operation: unknown,
        args: unknown[],
        serverContext?: unknown,
      ) => {
        const backend = await loadExtensionBackend(extensionId);
        const handler = backend[exportName];
        if (typeof handler !== 'function') throw new Error(`Missing service handler export "${exportName}".`);
        return runnerRun(extensionId, { ...(operation as Record<string, unknown>), exportName }, () =>
          handler(...args, createBackendContext(extensionId, serverContext)),
        );
      },
    );
  });

  it('starts enabled extension services, stores stop handles, and stops them', async () => {
    const stop = vi.fn();
    const startSync = vi.fn().mockResolvedValue({ ok: true });
    listExtensionInstallSummaries.mockReturnValue([
      { id: 'ext', status: 'enabled' },
      { id: 'off', status: 'disabled' },
    ]);
    findExtensionEntry.mockReturnValue({
      manifest: { backend: { services: [{ id: 'sync', handler: 'startSync', stopHandler: 'stopSync', worker: { enabled: true } }] } },
    });
    loadExtensionBackend.mockResolvedValue({ startSync, stopSync: stop });

    await expect(startExtensionServices({ server: true } as never)).resolves.toEqual([{ extensionId: 'ext', serviceId: 'sync', ok: true }]);
    expect(startSync).toHaveBeenCalledWith({ serviceId: 'sync' }, { ctx: true });
    expect(runnerRun).toHaveBeenCalledWith(
      'ext',
      { type: 'service-startup', label: 'service sync startup', exportName: 'startSync', target: 'sync' },
      expect.any(Function),
    );
    expect(isExtensionServiceRunning('ext', 'sync')).toBe(true);
    expect(listRunningExtensionServices()[0]).toMatchObject({ extensionId: 'ext', serviceId: 'sync', startedAt: expect.any(String) });
    expect(clearExtensionHealthError).toHaveBeenCalledWith('ext');
    expect(clearExtensionFailureRecordsForOperation).toHaveBeenCalledWith('ext', 'service sync startup');

    await stopExtensionServices('ext');
    expect(stop).toHaveBeenCalledOnce();
    expect(isExtensionServiceRunning('ext', 'sync')).toBe(false);
  });

  it('runs worker services through the worker runner and stops them with stopHandler', async () => {
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({
      manifest: {
        backend: {
          services: [{ id: 'sync', handler: 'startSync', stopHandler: 'stopSync', healthCheck: 'checkSync', worker: { enabled: true } }],
        },
      },
    });
    runExtensionBackendExportInWorker.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ running: true }).mockResolvedValueOnce({
      ok: true,
    });

    await expect(startExtensionServices({ server: true } as never)).resolves.toEqual([{ extensionId: 'ext', serviceId: 'sync', ok: true }]);
    await runExtensionServiceHealthChecks({ server: true } as never);
    await stopExtensionServices('ext');

    expect(runExtensionBackendExportInWorker).toHaveBeenCalledWith(
      'ext',
      'startSync',
      { type: 'service-startup', label: 'service sync startup', target: 'sync' },
      [{ serviceId: 'sync' }],
      { server: true },
    );
    expect(runExtensionBackendExportInWorker).toHaveBeenCalledWith(
      'ext',
      'checkSync',
      { type: 'service-health-check', label: 'service sync health check', target: 'sync' },
      [{ serviceId: 'sync' }],
      { server: true },
    );
    expect(runExtensionBackendExportInWorker).toHaveBeenCalledWith(
      'ext',
      'stopSync',
      { type: 'service-stop', label: 'service sync stop', target: 'sync' },
      [{ serviceId: 'sync' }],
      { server: true },
    );
    expect(runExtensionBackendExport).not.toHaveBeenCalled();
  });

  it('is idempotent for already-running services', async () => {
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({ manifest: { backend: { services: [{ id: 'sync', handler: 'startSync', worker: { enabled: true } }] } } });
    loadExtensionBackend.mockResolvedValue({ startSync: vi.fn() });

    await startExtensionServices();
    await startExtensionServices();

    expect(loadExtensionBackend).toHaveBeenCalledTimes(1);
  });

  it('starts services for only the requested enabled extension', async () => {
    listExtensionInstallSummaries.mockReturnValue([
      { id: 'target', status: 'enabled' },
      { id: 'other', status: 'enabled' },
    ]);
    findExtensionEntry.mockImplementation((extensionId: string) => ({
      manifest: { backend: { services: [{ id: 'sync', handler: `${extensionId}Start`, worker: { enabled: true } }] } },
    }));
    runExtensionBackendExportInWorker.mockResolvedValue({ ok: true });

    await expect(startServicesForExtension('target', { server: true } as never)).resolves.toEqual([
      { extensionId: 'target', serviceId: 'sync', ok: true },
    ]);

    expect(runExtensionBackendExportInWorker).toHaveBeenCalledOnce();
    expect(runExtensionBackendExportInWorker).toHaveBeenCalledWith(
      'target',
      'targetStart',
      { type: 'service-startup', label: 'service sync startup', target: 'sync' },
      [{ serviceId: 'sync' }],
      { server: true },
    );
  });

  it('records startup failures and publishes app notifications', async () => {
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({ manifest: { backend: { services: [{ id: 'sync', handler: 'missing', worker: { enabled: true } }] } } });
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

  it('clears service diagnostics after successful health checks', async () => {
    const stop = vi.fn();
    const startSync = vi.fn().mockResolvedValue({ ok: true });
    const checkSync = vi.fn().mockResolvedValue({ running: true });
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({
      manifest: {
        backend: {
          services: [
            { id: 'sync', handler: 'startSync', stopHandler: 'stopSync', healthCheck: 'checkSync', restart: 'on-failure', worker: { enabled: true } },
          ],
        },
      },
    });
    loadExtensionBackend.mockResolvedValue({ startSync, stopSync: stop, checkSync });

    await startExtensionServices();
    await runExtensionServiceHealthChecks();

    expect(clearExtensionHealthError).toHaveBeenCalledWith('ext');
    expect(clearExtensionFailureRecordsForOperation).toHaveBeenCalledWith('ext', 'service sync health check');
    expect(runnerRun).toHaveBeenCalledWith(
      'ext',
      { type: 'service-health-check', label: 'service sync health check', exportName: 'checkSync', target: 'sync' },
      expect.any(Function),
    );
    expect(recordExtensionFailure).not.toHaveBeenCalled();
  });

  it('runs health checks and restarts services that report stopped', async () => {
    const stop = vi.fn();
    const startSync = vi.fn().mockResolvedValue({ ok: true });
    const checkSync = vi.fn().mockResolvedValue({ running: false });
    listExtensionInstallSummaries.mockReturnValue([{ id: 'ext', status: 'enabled' }]);
    findExtensionEntry.mockReturnValue({
      manifest: {
        backend: {
          services: [
            { id: 'sync', handler: 'startSync', stopHandler: 'stopSync', healthCheck: 'checkSync', restart: 'on-failure', worker: { enabled: true } },
          ],
        },
      },
    });
    loadExtensionBackend.mockResolvedValue({ startSync, stopSync: stop, checkSync });

    await startExtensionServices();
    recordExtensionFailure.mockClear();
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
      manifest: { backend: { services: [{ id: 'sync', handler: 'startSync', stopHandler: 'stopSync', healthCheck: 'checkSync', worker: { enabled: true } }] } },
    });
    loadExtensionBackend.mockResolvedValue({
      startSync: vi.fn().mockResolvedValue({ ok: true }),
      stopSync: stop,
      checkSync: vi.fn(() => process.exit(1)),
    });
    runnerRun
      .mockImplementationOnce(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler())
      .mockRejectedValueOnce(
        new ExtensionProcessTerminationBlockedError('ext', 'service sync health check', 'Extension attempted to terminate the application.'),
      );

    await startExtensionServices();
    await runExtensionServiceHealthChecks();

    expect(setExtensionEnabled).toHaveBeenCalledWith('ext', false);
    expect(stop).toHaveBeenCalledOnce();
    expect(isExtensionServiceRunning('ext', 'sync')).toBe(false);
  });
});
