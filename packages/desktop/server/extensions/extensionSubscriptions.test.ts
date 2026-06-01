import { beforeEach, describe, expect, it, vi } from 'vitest';

const logError = vi.fn();
const logInfo = vi.fn();
const createBackendContext = vi.fn();
const loadExtensionBackend = vi.fn();
const runnerRun = vi.fn(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler());
const publishExtensionEvent = vi.fn();
const subscribeExtensionEvents = vi.fn();
const findExtensionEntry = vi.fn();
const isExtensionEnabled = vi.fn();
const listExtensionInstallSummaries = vi.fn();
const recordExtensionFailure = vi.fn();
const setExtensionEnabled = vi.fn();
const setExtensionHealthError = vi.fn();

let handlers: Array<{ extensionId: string; pattern: string; handler: (event: unknown) => void; unsubscribe: ReturnType<typeof vi.fn> }> =
  [];

vi.mock('../shared/logging.js', () => ({ logError, logInfo }));
vi.mock('./extensionBackend.js', () => ({ createBackendContext, loadExtensionBackend }));
vi.mock('./extensionBackendRunner.js', () => ({
  extensionBackendOperation: (type: string, label: string, options: { target?: string } = {}) => ({ type, label, ...options }),
  getExtensionBackendRunner: () => ({ run: runnerRun }),
}));
vi.mock('./extensionEventBus.js', () => ({
  publishExtensionEvent,
  subscribeExtensionEvents,
}));
vi.mock('./extensionRegistry.js', () => ({
  findExtensionEntry,
  isExtensionEnabled,
  listExtensionInstallSummaries,
  recordExtensionFailure,
  setExtensionEnabled,
  setExtensionHealthError,
}));

const { installExtensionSubscriptions, installSubscriptionsForExtension, publishExtensionHostEvent, uninstallExtensionSubscriptions } =
  await import('./extensionSubscriptions.js');

describe('extensionSubscriptions', () => {
  beforeEach(() => {
    vi.useRealTimers();
    uninstallExtensionSubscriptions('ext');
    uninstallExtensionSubscriptions('disabled');
    handlers = [];
    for (const mock of [
      logError,
      logInfo,
      createBackendContext,
      loadExtensionBackend,
      runnerRun,
      publishExtensionEvent,
      subscribeExtensionEvents,
      findExtensionEntry,
      isExtensionEnabled,
      listExtensionInstallSummaries,
      recordExtensionFailure,
      setExtensionEnabled,
      setExtensionHealthError,
    ]) {
      mock.mockReset();
    }
    createBackendContext.mockReturnValue({ ctx: true });
    isExtensionEnabled.mockReturnValue(true);
    subscribeExtensionEvents.mockImplementation((extensionId, pattern, handler) => {
      const unsubscribe = vi.fn();
      handlers.push({ extensionId, pattern, handler, unsubscribe });
      return { extensionId, pattern, unsubscribe };
    });
  });

  it('publishes host events with source normalization and typed fanout', async () => {
    await publishExtensionHostEvent('settings', { type: 'changed', ok: true });
    await publishExtensionHostEvent('custom:event', { type: 'ignored' });

    expect(publishExtensionEvent).toHaveBeenNthCalledWith(1, 'host', 'host:settings', { type: 'changed', ok: true });
    expect(publishExtensionEvent).toHaveBeenNthCalledWith(2, 'host', 'host:settings:changed', { type: 'changed', ok: true });
    expect(publishExtensionEvent).toHaveBeenNthCalledWith(3, 'host', 'custom:event', { type: 'ignored' });
  });

  it('installs subscriptions for enabled extensions and dispatches matching events to backend handlers', async () => {
    const handler = vi.fn();
    listExtensionInstallSummaries.mockReturnValue([
      { id: 'ext', status: 'enabled' },
      { id: 'disabled', status: 'disabled' },
    ]);
    findExtensionEntry.mockReturnValue({
      manifest: { contributes: { subscriptions: [{ id: 'sub', source: 'settings', pattern: 'changed', handler: 'onSettings' }] } },
    });
    loadExtensionBackend.mockResolvedValue({ onSettings: handler });

    await installExtensionSubscriptions({ server: true } as never);
    expect(subscribeExtensionEvents).toHaveBeenCalledWith('ext', 'host:settings:changed', expect.any(Function));

    handlers[0]?.handler({ event: 'host:settings:changed', payload: { x: 1 }, sourceExtensionId: 'host' });
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    expect(runnerRun).toHaveBeenCalledWith('ext', { type: 'subscription', label: 'subscription sub', target: 'sub' }, expect.any(Function));
    expect(handler).toHaveBeenCalledWith(
      { subscriptionId: 'sub', event: 'host:settings:changed', payload: { x: 1 }, sourceExtensionId: 'host' },
      { ctx: true },
    );
  });

  it('is idempotent and uninstalls subscriptions by extension', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: { contributes: { subscriptions: [{ id: 'sub', source: 'settings', handler: 'onSettings' }] } },
    });

    await installSubscriptionsForExtension('ext');
    await installSubscriptionsForExtension('ext');
    expect(subscribeExtensionEvents).toHaveBeenCalledTimes(1);

    uninstallExtensionSubscriptions('ext');
    expect(handlers[0]?.unsubscribe).toHaveBeenCalledOnce();
  });

  it('debounces subscription handlers and skips dispatch when extension has been disabled', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    findExtensionEntry.mockReturnValue({
      manifest: { contributes: { subscriptions: [{ id: 'sub', source: 'settings', handler: 'onSettings', debounceMs: 50 }] } },
    });
    loadExtensionBackend.mockResolvedValue({ onSettings: handler });

    await installSubscriptionsForExtension('ext');
    handlers[0]?.handler({ event: 'host:settings', payload: 1, sourceExtensionId: 'host' });
    handlers[0]?.handler({ event: 'host:settings', payload: 2, sourceExtensionId: 'host' });
    await vi.advanceTimersByTimeAsync(49);
    expect(handler).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    expect(handler.mock.calls[0][0].payload).toBe(2);

    isExtensionEnabled.mockReturnValue(false);
    handlers[0]?.handler({ event: 'host:settings', payload: 3, sourceExtensionId: 'host' });
    await vi.advanceTimersByTimeAsync(50);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('records backend handler failures', async () => {
    findExtensionEntry.mockReturnValue({
      manifest: { contributes: { subscriptions: [{ id: 'sub', source: 'settings', handler: 'missing' }] } },
    });
    loadExtensionBackend.mockResolvedValue({});

    await installSubscriptionsForExtension('ext');
    handlers[0]?.handler({ event: 'host:settings', payload: null, sourceExtensionId: 'host' });

    await vi.waitFor(() =>
      expect(recordExtensionFailure).toHaveBeenCalledWith({
        extensionId: 'ext',
        operation: 'subscription sub',
        error: 'Missing subscription handler export "missing".',
      }),
    );
    expect(logError).toHaveBeenCalledWith('extension subscription handler failed', {
      extensionId: 'ext',
      subscriptionId: 'sub',
      message: 'Missing subscription handler export "missing".',
    });
  });
});
