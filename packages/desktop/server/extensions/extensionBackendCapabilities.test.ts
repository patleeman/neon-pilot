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
      dispatch({ id: 1, kind: 'capabilityRequest', extensionId: 'ext', capability: 'secrets', operation: 'get' }),
    ).rejects.toThrow('Unsupported extension backend capability: secrets');

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

  it('dispatches extension-scoped storage capability calls', async () => {
    const storage = {
      get: vi.fn(() => ({ saved: true })),
      put: vi.fn(() => ({ ok: true })),
      delete: vi.fn(() => ({ ok: true, deleted: true })),
      list: vi.fn(() => [{ key: 'tasks/one', value: 1 }]),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ storage });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'get',
          input: { key: 'tasks/one' },
        }),
      ),
    ).resolves.toEqual({ saved: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'put',
          input: { key: 'tasks/one', value: { done: true }, expectedVersion: 3 },
        }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'delete',
          input: { key: 'tasks/one' },
        }),
      ),
    ).resolves.toEqual({ ok: true, deleted: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'storage',
          operation: 'list',
          input: { prefix: 'tasks/' },
        }),
      ),
    ).resolves.toEqual([{ key: 'tasks/one', value: 1 }]);

    expect(storage.get).toHaveBeenCalledWith('ext', 'tasks/one');
    expect(storage.put).toHaveBeenCalledWith('ext', 'tasks/one', { done: true }, { expectedVersion: 3 });
    expect(storage.delete).toHaveBeenCalledWith('ext', 'tasks/one');
    expect(storage.list).toHaveBeenCalledWith('ext', 'tasks/');
  });

  it('dispatches shell exec capability calls', async () => {
    const shell = {
      exec: vi.fn(async () => ({ stdout: 'done', stderr: '' })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'shell',
          operation: 'exec',
          input: {
            command: 'git',
            args: ['status', '--short'],
            cwd: '/repo',
            timeoutMs: 1000,
            maxBuffer: 2048,
            env: { A: 'B' },
          },
        }),
      ),
    ).resolves.toEqual({ stdout: 'done', stderr: '' });

    expect(shell.exec).toHaveBeenCalledWith({
      command: 'git',
      args: ['status', '--short'],
      cwd: '/repo',
      timeoutMs: 1000,
      maxBuffer: 2048,
      env: { A: 'B' },
    });
  });

  it('rejects malformed shell capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ shell: { exec: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'shell',
        operation: 'exec',
        input: { command: 'git', args: ['status', 1] },
      }),
    ).rejects.toThrow('Shell args must be an array of strings when provided.');
  });
});
