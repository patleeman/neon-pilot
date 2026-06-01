import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerThreads = vi.hoisted(() => ({
  messageHandler: undefined as undefined | ((message: unknown) => void),
  parentPort: {
    on: vi.fn((event: string, handler: (message: unknown) => void) => {
      if (event === 'message') workerThreads.messageHandler = handler;
    }),
    postMessage: vi.fn(),
  },
}));

vi.mock('node:worker_threads', () => ({ parentPort: workerThreads.parentPort }));

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function waitForPostMessage(message: unknown): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    if (workerThreads.parentPort.postMessage.mock.calls.some(([candidate]) => expect.objectContaining(message).asymmetricMatch(candidate))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(workerThreads.parentPort.postMessage).toHaveBeenCalledWith(message);
}

async function loadWorker(): Promise<void> {
  vi.resetModules();
  workerThreads.messageHandler = undefined;
  await import('./extensionBackendWorker.js');
}

describe('extensionBackendWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs backend exports with host-mediated log capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(input, ctx) {
  await ctx.log.warn('worker ran', { ok: input.ok });
  return { ok: input.ok };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 10,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-1' },
      exportName: 'doThing',
      args: [{ ok: true }],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'log',
      operation: 'warn',
      input: { message: 'worker ran', fields: { ok: true } },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });
    await flushPromises();

    expect(workerThreads.parentPort.postMessage).toHaveBeenCalledWith({ id: 10, ok: true, result: { ok: true } });
  });

  it('runs backend exports with serialized runtime context', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return {
    repoRoot: ctx.runtime.getRepoRoot(),
    runtimeDir: ctx.runtimeDir,
    runtimeSettingsFilePath: ctx.runtimeSettingsFilePath,
    profileSettingsFilePath: ctx.profileSettingsFilePath,
    resources: ctx.runtime.getLiveSessionResourceOptions(),
  };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 12,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-runtime' },
      exportName: 'doThing',
      args: [{}],
      context: {
        type: 'backend',
        runtimeScope: 'project',
        repoRoot: '/repo',
        runtimeDir: '/runtime',
        runtimeSettingsFilePath: '/runtime/settings.json',
        liveSessionResourceOptions: {
          additionalExtensionPaths: ['/ext'],
          additionalSkillPaths: ['/skills'],
          additionalPromptTemplatePaths: ['/prompts'],
          additionalThemePaths: ['/themes'],
        },
      },
    });

    await waitForPostMessage({
      id: 12,
      ok: true,
      result: {
        repoRoot: '/repo',
        runtimeDir: '/runtime',
        runtimeSettingsFilePath: '/runtime/settings.json',
        profileSettingsFilePath: '/runtime/settings.json',
        resources: {
          additionalExtensionPaths: ['/ext'],
          additionalSkillPaths: ['/skills'],
          additionalPromptTemplatePaths: ['/prompts'],
          additionalThemePaths: ['/themes'],
        },
      },
    });
  });

  it('runs backend exports with host-mediated event publish capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.events.publish({ event: 'task:completed', payload: { taskId: 'task-1' } });
  return { ok: true };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 15,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-events' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'events',
      operation: 'publish',
      input: { event: 'task:completed', payload: { taskId: 'task-1' } },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });
    await waitForPostMessage({ id: 15, ok: true, result: { ok: true } });
  });

  it('runs backend exports with host-mediated conversation metadata capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  const before = await ctx.conversations.metadata.get({ conversationId: 'conv-1', namespace: 'todos' });
  const after = await ctx.conversations.metadata.set({ conversationId: 'conv-1', namespace: 'todos', values: { count: 1 } });
  const matches = await ctx.conversations.metadata.query({ namespace: 'todos', where: [{ key: 'count', op: 'eq', value: 1 }], limit: 5 });
  return { before, after, matches };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 16,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-conversations' },
      exportName: 'doThing',
      args: [{}],
      context: { type: 'backend', runtimeScope: 'project' },
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'metadata.get',
      input: { conversationId: 'conv-1', namespace: 'todos', profile: 'project' },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { count: 0 } });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'metadata.set',
      input: { conversationId: 'conv-1', namespace: 'todos', values: { count: 1 }, profile: 'project' },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { count: 1 } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'metadata.query',
      input: { namespace: 'todos', where: [{ key: 'count', op: 'eq', value: 1 }], limit: 5, profile: 'project' },
    });
    workerThreads.messageHandler?.({
      id: 3,
      kind: 'capabilityResponse',
      ok: true,
      result: [{ conversationId: 'conv-1', metadata: { count: 1 } }],
    });

    await waitForPostMessage({
      id: 16,
      ok: true,
      result: {
        before: { count: 0 },
        after: { count: 1 },
        matches: [{ conversationId: 'conv-1', metadata: { count: 1 } }],
      },
    });
  });

  it('runs backend exports with host-mediated live conversation capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  const before = await ctx.conversations.get('conv-1');
  const tools = await ctx.conversations.setActiveTools('conv-1', ['exec_code']);
  const entry = await ctx.conversations.appendCustomEntry('conv-1', 'code-mode-state', { enabled: true });
  return { before, tools, entry };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 17,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-live-conversations' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'get',
      input: { conversationId: 'conv-1' },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { id: 'conv-1', toolNames: ['read'] } });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'setActiveTools',
      input: { conversationId: 'conv-1', toolNames: ['exec_code'] },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { conversationId: 'conv-1', toolNames: ['exec_code'] } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'appendCustomEntry',
      input: { conversationId: 'conv-1', customType: 'code-mode-state', data: { enabled: true } },
    });
    workerThreads.messageHandler?.({ id: 3, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 17,
      ok: true,
      result: {
        before: { id: 'conv-1', toolNames: ['read'] },
        tools: { conversationId: 'conv-1', toolNames: ['exec_code'] },
        entry: { ok: true },
      },
    });
  });

  it('runs backend exports with host-mediated extension registry capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  const actions = await ctx.extensions.listActions();
  const status = await ctx.extensions.getStatus('target-ext');
  await ctx.extensions.setEnabled('target-ext', false);
  return { actions, status };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 18,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-extensions' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'extensions',
      operation: 'listActions',
    });
    workerThreads.messageHandler?.({
      id: 1,
      kind: 'capabilityResponse',
      ok: true,
      result: [{ extensionId: 'target-ext', extensionName: 'Target', actions: [{ id: 'run' }] }],
    });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'extensions',
      operation: 'getStatus',
      input: { extensionId: 'target-ext' },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { enabled: true, healthy: true } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'extensions',
      operation: 'setEnabled',
      input: { extensionId: 'target-ext', enabled: false },
    });
    workerThreads.messageHandler?.({ id: 3, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({
      id: 18,
      ok: true,
      result: {
        actions: [{ extensionId: 'target-ext', extensionName: 'Target', actions: [{ id: 'run' }] }],
        status: { enabled: true, healthy: true },
      },
    });
  });

  it('runs backend exports with host-mediated git capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return await ctx.git.status({ cwd: '/repo' });
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 20,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-git' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'git',
      operation: 'status',
      input: { cwd: '/repo' },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { porcelain: '## main' } });
    await waitForPostMessage({ id: 20, ok: true, result: { porcelain: '## main' } });
  });

  it('runs backend exports with host-mediated workspace capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  const file = await ctx.workspace.readText({ cwd: '/repo', path: 'README.md', maxBytes: 100 });
  const written = await ctx.workspace.writeText({ cwd: '/repo', path: 'README.md', content: 'hello' });
  const entries = await ctx.workspace.list({ cwd: '/repo', path: '.', depth: 2 });
  return { file, written, entries };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 22,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-workspace' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'workspace',
      operation: 'readText',
      input: { cwd: '/repo', path: 'README.md', maxBytes: 100 },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { path: 'README.md', content: 'hello', sha256: 'abc' } });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'workspace',
      operation: 'writeText',
      input: { cwd: '/repo', path: 'README.md', content: 'hello' },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { path: 'README.md', bytes: 5 } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'workspace',
      operation: 'list',
      input: { cwd: '/repo', path: '.', depth: 2 },
    });
    workerThreads.messageHandler?.({ id: 3, kind: 'capabilityResponse', ok: true, result: [{ path: 'src', type: 'directory' }] });

    await waitForPostMessage({
      id: 22,
      ok: true,
      result: {
        file: { path: 'README.md', content: 'hello', sha256: 'abc' },
        written: { path: 'README.md', bytes: 5 },
        entries: [{ path: 'src', type: 'directory' }],
      },
    });
  });

  it('runs backend exports with host-mediated notification capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.notify.toast('Saved', 'info');
  const badge = await ctx.notify.setBadge(2);
  await ctx.notify.clearBadge();
  const available = await ctx.notify.isSystemAvailable();
  const delivered = await ctx.notify.system({ title: 'Title', message: 'Body' });
  return { badge, available, delivered };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 25,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-notify' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'toast',
      input: { message: 'Saved', type: 'info' },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'setBadge',
      input: { count: 2 },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { badge: 2, aggregated: 2 } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'clearBadge',
    });
    workerThreads.messageHandler?.({ id: 3, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({
      id: 4,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'isSystemAvailable',
    });
    workerThreads.messageHandler?.({ id: 4, kind: 'capabilityResponse', ok: true, result: true });

    await waitForPostMessage({
      id: 5,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'notify',
      operation: 'system',
      input: { title: 'Title', message: 'Body' },
    });
    workerThreads.messageHandler?.({ id: 5, kind: 'capabilityResponse', ok: true, result: true });

    await waitForPostMessage({
      id: 25,
      ok: true,
      result: { badge: { badge: 2, aggregated: 2 }, available: true, delivered: true },
    });
  });

  it('runs backend exports with host-mediated model list capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return await ctx.models.list();
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 28,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-models' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'models',
      operation: 'list',
    });
    workerThreads.messageHandler?.({
      id: 1,
      kind: 'capabilityResponse',
      ok: true,
      result: [{ id: 'model-1', provider: 'provider-a' }],
    });

    await waitForPostMessage({ id: 28, ok: true, result: [{ id: 'model-1', provider: 'provider-a' }] });
  });

  it('returns export execution errors when host capabilities fail', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.log.error('worker failed');
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 20,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-2' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });
    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'log',
      operation: 'error',
      input: { message: 'worker failed', fields: undefined },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: false, error: 'capability denied' });
    await waitForPostMessage({ id: 20, ok: false, error: 'capability denied' });
  });

  it('runs backend exports with host-mediated storage capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.storage.put('tasks/one', { done: false }, { expectedVersion: 1 });
  const value = await ctx.storage.get('tasks/one');
  const list = await ctx.storage.list('tasks/');
  const deleted = await ctx.storage.delete('tasks/one');
  return { value, list, deleted };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 30,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-3' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'put',
      input: { key: 'tasks/one', value: { done: false }, expectedVersion: 1 },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'get',
      input: { key: 'tasks/one' },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { done: false } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'list',
      input: { prefix: 'tasks/' },
    });
    workerThreads.messageHandler?.({
      id: 3,
      kind: 'capabilityResponse',
      ok: true,
      result: [{ key: 'tasks/one', value: { done: false } }],
    });

    await waitForPostMessage({
      id: 4,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'storage',
      operation: 'delete',
      input: { key: 'tasks/one' },
    });
    workerThreads.messageHandler?.({ id: 4, kind: 'capabilityResponse', ok: true, result: { ok: true, deleted: true } });

    await waitForPostMessage({
      id: 30,
      ok: true,
      result: {
        value: { done: false },
        list: [{ key: 'tasks/one', value: { done: false } }],
        deleted: { ok: true, deleted: true },
      },
    });
  });

  it('runs backend exports with host-mediated shell exec', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return await ctx.shell.exec({ command: 'git', args: ['status', '--short'], cwd: '/repo', timeoutMs: 1000 });
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 40,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-4' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'exec',
      input: { command: 'git', args: ['status', '--short'], cwd: '/repo', timeoutMs: 1000 },
    });
    workerThreads.messageHandler?.({
      id: 1,
      kind: 'capabilityResponse',
      ok: true,
      result: { command: 'git', args: ['status', '--short'], stdout: '', stderr: '', executionWrappers: [] },
    });

    await waitForPostMessage({
      id: 40,
      ok: true,
      result: { command: 'git', args: ['status', '--short'], stdout: '', stderr: '', executionWrappers: [] },
    });
  });

  it('runs backend exports with host-mediated secrets reads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return { secret: await ctx.secrets.get('apiKey') };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 50,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-5' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'secrets',
      operation: 'get',
      input: { secretId: 'apiKey' },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: 'stored-secret' });

    await waitForPostMessage({ id: 50, ok: true, result: { secret: 'stored-secret' } });
  });

  it('runs backend exports with host-mediated telemetry records', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.telemetry.record({ category: 'worker', name: 'done', count: 1 });
  return { ok: true };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 55,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-telemetry' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'telemetry',
      operation: 'record',
      input: { category: 'worker', name: 'done', count: 1 },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({ id: 55, ok: true, result: { ok: true } });
  });

  it('runs backend exports with host-mediated UI invalidation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  await ctx.ui.invalidate(['sessions', 'checkpoints']);
  return { ok: true };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 60,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-6' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'ui',
      operation: 'invalidate',
      input: { topics: ['sessions', 'checkpoints'] },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({ id: 60, ok: true, result: { ok: true } });
  });
});
