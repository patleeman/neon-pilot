import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishAppEvent = vi.fn();

vi.mock('../shared/appEvents.js', () => ({ publishAppEvent }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'request-1' }));

const { acknowledgeHostCommand, executeHostCommandInRenderer } = await import('./extensionCommandBridge.js');

describe('extensionCommandBridge', () => {
  beforeEach(() => {
    publishAppEvent.mockReset();
    vi.useFakeTimers();
  });

  it('publishes renderer commands and resolves true when acknowledged as handled', async () => {
    const promise = executeHostCommandInRenderer({ command: 'open', args: { route: '/x' }, sourceExtensionId: 'ext' });

    expect(publishAppEvent).toHaveBeenCalledWith({
      type: 'extension_command',
      command: 'open',
      args: { route: '/x' },
      sourceExtensionId: 'ext',
      requestId: 'request-1',
    });
    expect(acknowledgeHostCommand('request-1', true)).toBe(true);
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false when acknowledged as unhandled', async () => {
    const promise = executeHostCommandInRenderer({ command: 'missing' });

    expect(acknowledgeHostCommand('request-1', false)).toBe(true);
    await expect(promise).resolves.toBe(false);
    expect(acknowledgeHostCommand('request-1', true)).toBe(false);
  });

  it('resolves false and clears pending acknowledgements on timeout', async () => {
    const promise = executeHostCommandInRenderer({ command: 'slow' });

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(promise).resolves.toBe(false);
    expect(acknowledgeHostCommand('request-1', true)).toBe(false);
  });
});
