import { describe, expect, it, vi } from 'vitest';

import { createExtensionBackendCapabilityDispatcher } from './extensionBackendCapabilities.js';

describe('extension backend capability dispatcher', () => {
  it('dispatches extension-scoped conversation metadata capability calls', async () => {
    const conversations = {
      metadata: {
        get: vi.fn(async () => ({ items: [] })),
        set: vi.fn(async () => ({ items: [{ id: 'todo-1' }] })),
        query: vi.fn(async () => [{ conversationId: 'conv-1', metadata: { items: [] } }]),
      },
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'system-todo',
          capability: 'conversations',
          operation: 'metadata.get',
          input: { conversationId: 'conv-1', namespace: 'todos', profile: 'shared' },
        }),
      ),
    ).resolves.toEqual({ items: [] });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'system-todo',
          capability: 'conversations',
          operation: 'metadata.set',
          input: { conversationId: 'conv-1', values: { items: [{ id: 'todo-1' }] }, profile: 'shared' },
        }),
      ),
    ).resolves.toEqual({ items: [{ id: 'todo-1' }] });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'system-todo',
          capability: 'conversations',
          operation: 'metadata.query',
          input: { namespace: 'todos', where: [{ key: 'status', op: 'eq', value: 'open' }], limit: 5, profile: 'shared' },
        }),
      ),
    ).resolves.toEqual([{ conversationId: 'conv-1', metadata: { items: [] } }]);

    expect(conversations.metadata.get).toHaveBeenCalledWith('system-todo', {
      conversationId: 'conv-1',
      namespace: 'todos',
      profile: 'shared',
    });
    expect(conversations.metadata.set).toHaveBeenCalledWith('system-todo', {
      conversationId: 'conv-1',
      values: { items: [{ id: 'todo-1' }] },
      profile: 'shared',
    });
    expect(conversations.metadata.query).toHaveBeenCalledWith('system-todo', {
      namespace: 'todos',
      where: [{ key: 'status', op: 'eq', value: 'open' }],
      limit: 5,
      profile: 'shared',
    });
  });

  it('rejects malformed conversation metadata capability inputs', async () => {
    const conversations = { metadata: { get: vi.fn(), set: vi.fn(), query: vi.fn() } };
    const dispatch = createExtensionBackendCapabilityDispatcher({ conversations });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'system-todo',
        capability: 'conversations',
        operation: 'metadata.set',
        input: { conversationId: 'conv-1', values: [] },
      }),
    ).rejects.toThrow('Conversation metadata values must be an object when provided.');
  });

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

  it('dispatches extension-scoped workspace capability calls', async () => {
    const workspace = {
      readText: vi.fn(async () => ({ path: 'README.md', content: 'hello', sha256: 'abc' })),
      writeText: vi.fn(async () => ({ path: 'README.md', bytes: 5 })),
      list: vi.fn(async () => [{ path: 'src', type: 'directory' }]),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ workspace });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'workspace',
          operation: 'readText',
          input: { cwd: '/repo', path: 'README.md', maxBytes: 100 },
        }),
      ),
    ).resolves.toEqual({ path: 'README.md', content: 'hello', sha256: 'abc' });
    await expect(
      Promise.resolve(
        dispatch({
          id: 2,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'workspace',
          operation: 'writeText',
          input: { cwd: '/repo', path: 'README.md', content: 'hello' },
        }),
      ),
    ).resolves.toEqual({ path: 'README.md', bytes: 5 });
    await expect(
      Promise.resolve(
        dispatch({
          id: 3,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'workspace',
          operation: 'list',
          input: { cwd: '/repo', path: '.', depth: 2 },
        }),
      ),
    ).resolves.toEqual([{ path: 'src', type: 'directory' }]);

    expect(workspace.readText).toHaveBeenCalledWith('ext', { cwd: '/repo', path: 'README.md', maxBytes: 100 });
    expect(workspace.writeText).toHaveBeenCalledWith('ext', { cwd: '/repo', path: 'README.md', content: 'hello' });
    expect(workspace.list).toHaveBeenCalledWith('ext', { cwd: '/repo', path: '.', depth: 2 });
  });

  it('rejects malformed workspace capability inputs', async () => {
    const workspace = { readText: vi.fn(), writeText: vi.fn(), list: vi.fn() };
    const dispatch = createExtensionBackendCapabilityDispatcher({ workspace });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'workspace',
        operation: 'readText',
        input: { cwd: '/repo', path: 1 },
      }),
    ).rejects.toThrow('Workspace path must be a string.');
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

  it('dispatches read-only model capability calls', async () => {
    const models = {
      list: vi.fn(async () => [{ id: 'model-1', provider: 'provider-a' }]),
    };
    const dispatch = createExtensionBackendCapabilityDispatcher({ models });

    await expect(
      Promise.resolve(
        dispatch({
          id: 1,
          kind: 'capabilityRequest',
          extensionId: 'ext',
          capability: 'models',
          operation: 'list',
        }),
      ),
    ).resolves.toEqual([{ id: 'model-1', provider: 'provider-a' }]);

    expect(models.list).toHaveBeenCalled();
  });

  it('rejects unsupported model capability operations', async () => {
    const dispatch = createExtensionBackendCapabilityDispatcher({ models: { list: vi.fn() } });

    await expect(async () =>
      dispatch({
        id: 1,
        kind: 'capabilityRequest',
        extensionId: 'ext',
        capability: 'models',
        operation: 'saveProvider',
        input: {},
      }),
    ).rejects.toThrow('Unsupported models capability operation: saveProvider');
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
