import { describe, expect, it, vi } from 'vitest';

import { createExtensionBackendCapabilityDispatcher } from './extensionBackendCapabilities.js';

describe('extension backend capability dispatcher', () => {
  it('dispatches extension-scoped event publish capability calls', async () => {
    const events = {
      publish: vi.fn(async () => undefined),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ events });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'events',
          operation: 'publish',
          input: { event: 'task:completed', payload: { taskId: 'task-1' } },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(events.publish).toHaveBeenCalledWith('ext', 'task:completed', { taskId: 'task-1' });
  });

  it('rejects malformed event publish capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ events: { publish: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'events',
        operation: 'publish',
        input: { event: 1, payload: {} },
      }),
    ).rejects.toThrow('Event name must be a string.');
  });

  it('dispatches extension registry capability calls', async () => {
    const extensions = {
      listActions: vi.fn(() => [{ extensionId: 'ext-a', extensionName: 'Ext A', actions: [{ id: 'run' }] }]),
      getStatus: vi.fn(() => ({ enabled: true, healthy: true })),
      setEnabled: vi.fn(() => undefined),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ extensions });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'extensions',
          operation: 'listActions',
        }),
      ),
    ).resolves.toEqual([{ extensionId: 'ext-a', extensionName: 'Ext A', actions: [{ id: 'run' }] }]);
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'extensions',
          operation: 'getStatus',
          input: { extensionId: 'ext-a' },
        }),
      ),
    ).resolves.toEqual({ enabled: true, healthy: true });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'extensions',
          operation: 'setEnabled',
          input: { extensionId: 'ext-a', enabled: false },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(extensions.listActions).toHaveBeenCalled();
    expect(extensions.getStatus).toHaveBeenCalledWith('ext-a');
    expect(extensions.setEnabled).toHaveBeenCalledWith('ext-a', false);
  });

  it('rejects malformed extension registry capability inputs', async () => {
    const extensions = { listActions: vi.fn(), getStatus: vi.fn(), setEnabled: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ extensions });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'extensions',
        operation: 'setEnabled',
        input: { extensionId: 'ext-a', enabled: 'false' },
      }),
    ).rejects.toThrow('Extension enabled must be a boolean.');
  });

  it('dispatches extension-scoped git capability calls', async () => {
    const git = {
      status: vi.fn(() => ({ porcelain: '## main' })),
      diff: vi.fn(() => ({ diff: 'diff --git a/file b/file' })),
      log: vi.fn(() => ({ log: 'abc123 commit' })),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ git });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'git',
          operation: 'status',
          input: { cwd: '/repo' },
        }),
      ),
    ).resolves.toEqual({ porcelain: '## main' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'git',
          operation: 'diff',
          input: { cwd: '/repo', path: 'file.ts', staged: true },
        }),
      ),
    ).resolves.toEqual({ diff: 'diff --git a/file b/file' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'git',
          operation: 'log',
          input: { cwd: '/repo', maxCount: 5 },
        }),
      ),
    ).resolves.toEqual({ log: 'abc123 commit' });

    expect(git.status).toHaveBeenCalledWith({ cwd: '/repo' });
    expect(git.diff).toHaveBeenCalledWith({ cwd: '/repo', path: 'file.ts', staged: true });
    expect(git.log).toHaveBeenCalledWith({ cwd: '/repo', maxCount: 5 });
  });

  it('rejects malformed git capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({
      git: { status: vi.fn(), diff: vi.fn(), log: vi.fn() },
    });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'git',
        operation: 'diff',
        input: { cwd: '/repo', staged: 'yes' },
      }),
    ).rejects.toThrow('Git staged must be a boolean when provided.');
  });

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

  it('dispatches extension-scoped notify capability calls', async () => {
    const notify = {
      toast: vi.fn(),
      system: vi.fn(() => true),
      setBadge: vi.fn(() => ({ badge: 3, aggregated: 5 })),
      clearBadge: vi.fn(),
      isSystemAvailable: vi.fn(() => true),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ notify });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'toast',
          input: { message: 'Saved', type: 'warning' },
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'system',
          input: { title: 'Title', message: 'Body', subtitle: 'Sub', persistent: true, actionPayload: { route: '/x' } },
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'setBadge',
          input: { count: 3 },
        }),
      ),
    ).resolves.toEqual({ badge: 3, aggregated: 5 });
    await expect(
      Promise.resolve(
        dispatch({
          id: 4,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'clearBadge',
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      Promise.resolve(
        dispatch({
          id: 5,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'notify',
          operation: 'isSystemAvailable',
        }),
      ),
    ).resolves.toBe(true);

    expect(notify.toast).toHaveBeenCalledWith('ext', 'Saved', 'warning');
    expect(notify.system).toHaveBeenCalledWith('ext', {
      message: 'Body',
      title: 'Title',
      subtitle: 'Sub',
      persistent: true,
      actionPayload: { route: '/x' },
    });
    expect(notify.setBadge).toHaveBeenCalledWith('ext', 3);
    expect(notify.clearBadge).toHaveBeenCalledWith('ext');
    expect(notify.isSystemAvailable).toHaveBeenCalled();
  });

  it('rejects malformed notify capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({
      notify: { toast: vi.fn(), system: vi.fn(), setBadge: vi.fn(), clearBadge: vi.fn(), isSystemAvailable: vi.fn() },
    });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'notify',
        operation: 'toast',
        input: { message: 'Saved', type: 'success' },
      }),
    ).rejects.toThrow('Notify type must be info, warning, or error when provided.');
  });

  it('rejects unsupported capabilities and malformed log inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });

    await expect(async () =>
      dispatch({ id: 1, kind: 'capabilityRequest', extensionId: 'ext', capability: 'database', operation: 'query' }),
    ).rejects.toThrow('Unsupported extension backend capability: database');

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

  it('dispatches extension-scoped secrets capability calls', async () => {
    const secrets = {
      get: vi.fn(() => 'stored-secret'),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ secrets });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'secrets',
          operation: 'get',
          input: { secretId: 'apiKey' },
        }),
      ),
    ).resolves.toBe('stored-secret');

    expect(secrets.get).toHaveBeenCalledWith('ext', 'apiKey');
  });

  it('rejects malformed secrets capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ secrets: { get: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'secrets',
        operation: 'get',
        input: { secretId: 1 },
      }),
    ).rejects.toThrow('Secret id must be a string.');
  });

  it('dispatches extension-scoped telemetry capability calls', async () => {
    const telemetry = {
      record: vi.fn(),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ telemetry });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'telemetry',
          operation: 'record',
          input: {
            category: 'extension',
            name: 'done',
            source: 'agent',
            sessionId: 'session-1',
            status: 200,
            durationMs: 12,
            metadata: { ok: true },
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(telemetry.record).toHaveBeenCalledWith('ext', {
      category: 'extension',
      name: 'done',
      source: 'agent',
      sessionId: 'session-1',
      status: 200,
      durationMs: 12,
      metadata: { ok: true },
    });
  });

  it('rejects malformed telemetry capability inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ telemetry: { record: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'telemetry',
        operation: 'record',
        input: { category: 'extension', name: 'done', source: 'ui' },
      }),
    ).rejects.toThrow('Telemetry source must be server, renderer, agent, or system when provided.');
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

  it('dispatches UI invalidation capability calls', async () => {
    const ui = { invalidate: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'ui',
          operation: 'invalidate',
          input: { topics: ['sessions', 'checkpoints'] },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(ui.invalidate).toHaveBeenCalledWith(['sessions', 'checkpoints']);
  });

  it('rejects malformed UI invalidation inputs', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ ui: { invalidate: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'ui',
        operation: 'invalidate',
        input: { topics: ['sessions', 1] },
      }),
    ).rejects.toThrow('UI topics must be a string or array of strings.');
  });
});
