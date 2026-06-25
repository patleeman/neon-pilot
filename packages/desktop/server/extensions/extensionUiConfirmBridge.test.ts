import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishAppEvent = vi.fn();

vi.mock('../shared/appEvents.js', () => ({ publishAppEvent }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'confirm-request-1' }));

const { listPendingExtensionUiConfirms, requestExtensionUiConfirm, resolveExtensionUiConfirm } =
  await import('./extensionUiConfirmBridge.js');

describe('extensionUiConfirmBridge', () => {
  beforeEach(() => {
    publishAppEvent.mockReset();
    vi.useFakeTimers();
  });

  it('publishes a timed confirmation request and resolves confirmed responses', async () => {
    const promise = requestExtensionUiConfirm({
      extensionId: 'system-skill-search',
      title: 'Install community skill',
      message: 'Install Reviewer?',
      confirmLabel: 'Install',
      timeoutMs: 30_000,
      details: [{ label: 'Source', value: 'Community Skills' }],
    });

    expect(publishAppEvent).toHaveBeenCalledWith({
      type: 'extension_ui_confirm',
      requestId: 'confirm-request-1',
      extensionId: 'system-skill-search',
      title: 'Install community skill',
      message: 'Install Reviewer?',
      confirmLabel: 'Install',
      timeoutMs: 30_000,
      details: [{ label: 'Source', value: 'Community Skills' }],
    });
    expect(listPendingExtensionUiConfirms()).toEqual([
      expect.objectContaining({
        type: 'extension_ui_confirm',
        requestId: 'confirm-request-1',
        message: 'Install Reviewer?',
      }),
    ]);
    expect(resolveExtensionUiConfirm('confirm-request-1', 'confirmed')).toBe(true);
    await expect(promise).resolves.toEqual({ status: 'confirmed', confirmed: true });
    expect(listPendingExtensionUiConfirms()).toEqual([]);
  });

  it('resolves timeout and clears stale responses', async () => {
    const promise = requestExtensionUiConfirm({
      extensionId: 'system-skill-search',
      message: 'Install Reviewer?',
      timeoutMs: 5_000,
    });

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(promise).resolves.toEqual({ status: 'timeout', confirmed: false });
    expect(resolveExtensionUiConfirm('confirm-request-1', 'confirmed')).toBe(false);
  });
});
