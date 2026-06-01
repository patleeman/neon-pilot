import { describe, expect, it, vi } from 'vitest';

import { createExtensionBackendCapabilityDispatcher } from './extensionBackendCapabilities.js';

describe('extension backend capability dispatcher', () => {
  it('dispatches extension-scoped log capability calls', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ log });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'log',
          operation: 'warn',
          input: { message: 'careful', fields: { detail: 'test' } },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith('extension:ext careful', { detail: 'test' });
    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('rejects unsupported capabilities and malformed log inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });

    await expect(async () =>
      dispatch({ id: 1, kind: 'capabilityRequest', extensionId: 'ext', capability: 'storage', operation: 'get' }),
    ).rejects.toThrow('Unsupported extension backend capability: storage');

    await expect(async () =>
      dispatch({
        id: 2,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'log',
        operation: 'info',
        input: {},
      }),
    ).rejects.toThrow('Log capability input must include a string message.');
  });
});
