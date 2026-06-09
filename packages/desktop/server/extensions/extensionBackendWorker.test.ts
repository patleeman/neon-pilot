import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

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
  for (let index = 0; index < 250; index += 1) {
    if (
      workerThreads.parentPort.postMessage.mock.calls.some(([candidate]) => expect.objectContaining(message).asymmetricMatch(candidate))
    ) {
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

  it('falls back to state-rooted runtime paths when worker context omits settings paths', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    const stateRoot = join(root, 'state');
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return {
    runtimeDir: ctx.runtimeDir,
    runtimeSettingsFilePath: ctx.runtimeSettingsFilePath,
    profileSettingsFilePath: ctx.profileSettingsFilePath,
  };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 121,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-runtime-fallback' },
      exportName: 'doThing',
      args: [{}],
      context: {
        type: 'backend',
        stateRoot,
        runtimeDir: '   ',
        runtimeSettingsFilePath: '   ',
      },
    });

    const runtimeDir = join(stateRoot, 'neon-pilot-runtime');
    await waitForPostMessage({
      id: 121,
      ok: true,
      result: {
        runtimeDir,
        runtimeSettingsFilePath: join(runtimeDir, 'settings.json'),
        profileSettingsFilePath: join(runtimeDir, 'settings.json'),
      },
    });
  });

  it('passes the active state root to worker settings capability requests', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    const stateRoot = join(root, 'state');
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing() {
  const bridge = globalThis[Symbol.for('neon-pilot.extensionHostCapabilityBridge')];
  return bridge('settings', 'read');
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 122,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-settings-state-root' },
      exportName: 'doThing',
      args: [{}],
      context: {
        type: 'backend',
        stateRoot,
      },
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'settings',
      operation: 'read',
      context: expect.objectContaining({ stateRoot }),
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { 'caffeinate.autoStart': true } });

    await waitForPostMessage({
      id: 122,
      ok: true,
      result: { 'caffeinate.autoStart': true },
    });
  });

  it('runs backend exports with host-mediated runtime refresh capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return ctx.runtime.refreshSkillMcpConfig();
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 13,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-runtime-refresh' },
      exportName: 'doThing',
      args: [{}],
      context: {
        type: 'backend',
        runtimeScope: 'project',
        repoRoot: '/repo',
        runtimeDir: '/runtime',
      },
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'runtime',
      operation: 'refreshSkillMcpConfig',
      input: {
        runtimeScope: 'project',
        repoRoot: '/repo',
        runtimeDir: '/runtime',
      },
    });

    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { mcpConfigPath: '/runtime/mcp_servers.json' } });
    await waitForPostMessage({ id: 13, ok: true, result: { mcpConfigPath: '/runtime/mcp_servers.json' } });
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

  it('streams host agent capability events into backend exports', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
import { streamAgentMessage } from '@neon-pilot/extensions/backend/agent';

export async function doThing(_input, ctx) {
  const result = await streamAgentMessage({ conversationId: 'agent-1', text: 'hello' }, ctx);
  const events = [];
  for await (const item of result.events) {
    events.push(item.data);
  }
  return events;
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 151,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-agent-stream' },
      exportName: 'doThing',
      args: [{}],
      context: {
        type: 'backend',
        toolContext: { cwd: '/repo' },
        agentToolContext: { cwd: '/repo', model: { id: 'mimo-v2.5', provider: 'opencode-go' } },
      },
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'agent',
      operation: 'streamMessage',
    });
    const request = workerThreads.parentPort.postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => {
        const candidate = message as { id?: number; capability?: string; operation?: string };
        return candidate.id === 1 && candidate.capability === 'agent' && candidate.operation === 'streamMessage';
      }) as { input?: { handleId?: string; input?: unknown } };
    expect(request.input).toMatchObject({ input: { conversationId: 'agent-1', text: 'hello' } });
    expect(request).toMatchObject({
      context: {
        toolContext: { cwd: '/repo' },
        agentToolContext: { cwd: '/repo', model: { id: 'mimo-v2.5', provider: 'opencode-go' } },
      },
    });
    const handleId = request.input?.handleId;
    expect(handleId).toEqual(expect.stringMatching(/^agent-stream-/));

    workerThreads.messageHandler?.({
      kind: 'capabilityEvent',
      extensionId: 'worker-ext',
      capability: 'agent',
      operation: 'streamEvent',
      input: { handleId, event: { type: 'text_delta', delta: 'hi' } },
    });
    workerThreads.messageHandler?.({
      kind: 'capabilityEvent',
      extensionId: 'worker-ext',
      capability: 'agent',
      operation: 'streamEnd',
      input: { handleId },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({ id: 151, ok: true, result: [{ type: 'text_delta', delta: 'hi' }] });
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
  const created = await ctx.conversations.create({ cwd: '/repo', title: 'Welcome', live: false });
  const tools = await ctx.conversations.setActiveTools('conv-1', ['exec_code']);
  const entry = await ctx.conversations.appendCustomEntry('conv-1', 'code-mode-state', { enabled: true });
  const block = await ctx.conversations.appendTranscriptBlock({
    conversationId: created.conversationId,
    blockType: 'onboarding_intro',
    title: 'Welcome',
    data: { source: 'worker-ext' },
  });
  const updated = await ctx.conversations.updateTranscriptBlock({
    conversationId: created.conversationId,
    blockType: 'onboarding_intro',
    blockId: block.blockId,
    title: 'Updated',
    data: { source: 'worker-ext', updated: true },
  });
  const workspaceBefore = await ctx.conversations.getWorkspace();
  const workspaceAfter = await ctx.conversations.updateWorkspace({ openConversationIds: ['conv-1', created.conversationId] });
  const rollback = await ctx.conversations.rollback('conv-1', 2);
  const ensured = await ctx.conversations.ensureLive('conv-1', { cwd: '/repo' });
  const sent = await ctx.conversations.sendMessage('conv-1', 'Go', { steer: true });
  const aborted = await ctx.conversations.abort('conv-1');
  const compacted = await ctx.conversations.compact('conv-1', 'short');
  const forked = await ctx.conversations.fork({ conversationId: 'conv-1', targetCwd: '/fork', title: 'Fork' });
  const titled = await ctx.conversations.setTitle('conv-1', 'New Title');
  return { before, created, tools, entry, block, updated, workspaceBefore, workspaceAfter, rollback, ensured, sent, aborted, compacted, forked, titled };
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
      operation: 'create',
      input: { cwd: '/repo', title: 'Welcome', live: false },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { id: 'conv-2', conversationId: 'conv-2' } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'setActiveTools',
      input: { conversationId: 'conv-1', toolNames: ['exec_code'] },
    });
    workerThreads.messageHandler?.({
      id: 3,
      kind: 'capabilityResponse',
      ok: true,
      result: { conversationId: 'conv-1', toolNames: ['exec_code'] },
    });

    await waitForPostMessage({
      id: 4,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'appendCustomEntry',
      input: { conversationId: 'conv-1', customType: 'code-mode-state', data: { enabled: true } },
    });
    workerThreads.messageHandler?.({ id: 4, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 5,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'appendTranscriptBlock',
      input: {
        conversationId: 'conv-2',
        blockType: 'onboarding_intro',
        title: 'Welcome',
        data: { source: 'worker-ext' },
      },
    });
    workerThreads.messageHandler?.({ id: 5, kind: 'capabilityResponse', ok: true, result: { blockId: 'block-1' } });

    await waitForPostMessage({
      id: 6,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'updateTranscriptBlock',
      input: {
        conversationId: 'conv-2',
        blockType: 'onboarding_intro',
        blockId: 'block-1',
        title: 'Updated',
        data: { source: 'worker-ext', updated: true },
      },
    });
    workerThreads.messageHandler?.({ id: 6, kind: 'capabilityResponse', ok: true, result: { blockId: 'block-1' } });

    await waitForPostMessage({
      id: 7,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'getWorkspace',
      input: { runtimeScope: 'shared', runtimeSettingsFilePath: expect.stringMatching(/neon-pilot-runtime\/settings\.json$/) },
    });
    workerThreads.messageHandler?.({
      id: 7,
      kind: 'capabilityResponse',
      ok: true,
      result: { openConversationIds: ['conv-1'], activeConversationId: 'conv-1' },
    });

    await waitForPostMessage({
      id: 8,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'updateWorkspace',
      input: {
        openConversationIds: ['conv-1', 'conv-2'],
        runtimeScope: 'shared',
        runtimeSettingsFilePath: expect.stringMatching(/neon-pilot-runtime\/settings\.json$/),
      },
    });
    workerThreads.messageHandler?.({
      id: 8,
      kind: 'capabilityResponse',
      ok: true,
      result: { openConversationIds: ['conv-1', 'conv-2'], activeConversationId: 'conv-2' },
    });

    await waitForPostMessage({
      id: 9,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'rollback',
      input: { conversationId: 'conv-1', count: 2 },
    });
    workerThreads.messageHandler?.({ id: 9, kind: 'capabilityResponse', ok: true, result: { rolledBackTo: 'entry-1' } });

    await waitForPostMessage({
      id: 10,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'ensureLive',
      input: { conversationId: 'conv-1', cwd: '/repo' },
    });
    workerThreads.messageHandler?.({ id: 10, kind: 'capabilityResponse', ok: true, result: { id: 'conv-1', conversationId: 'conv-1' } });

    await waitForPostMessage({
      id: 11,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'sendMessage',
      input: { conversationId: 'conv-1', text: 'Go', steer: true },
    });
    workerThreads.messageHandler?.({ id: 11, kind: 'capabilityResponse', ok: true, result: { accepted: true } });

    await waitForPostMessage({
      id: 12,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'abort',
      input: { conversationId: 'conv-1' },
    });
    workerThreads.messageHandler?.({ id: 12, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 13,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'compact',
      input: { conversationId: 'conv-1', customInstructions: 'short' },
    });
    workerThreads.messageHandler?.({ id: 13, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 14,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'fork',
      input: { conversationId: 'conv-1', targetCwd: '/fork', title: 'Fork' },
    });
    workerThreads.messageHandler?.({
      id: 14,
      kind: 'capabilityResponse',
      ok: true,
      result: { id: 'conv-fork', conversationId: 'conv-fork' },
    });

    await waitForPostMessage({
      id: 15,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'conversations',
      operation: 'setTitle',
      input: { conversationId: 'conv-1', title: 'New Title' },
    });
    workerThreads.messageHandler?.({ id: 15, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 17,
      ok: true,
      result: {
        before: { id: 'conv-1', toolNames: ['read'] },
        created: { id: 'conv-2', conversationId: 'conv-2' },
        tools: { conversationId: 'conv-1', toolNames: ['exec_code'] },
        entry: { ok: true },
        block: { blockId: 'block-1' },
        updated: { blockId: 'block-1' },
        workspaceBefore: { openConversationIds: ['conv-1'], activeConversationId: 'conv-1' },
        workspaceAfter: { openConversationIds: ['conv-1', 'conv-2'], activeConversationId: 'conv-2' },
        rollback: { rolledBackTo: 'entry-1' },
        ensured: { id: 'conv-1', conversationId: 'conv-1' },
        sent: { accepted: true },
        aborted: { ok: true },
        compacted: { ok: true },
        forked: { id: 'conv-fork', conversationId: 'conv-fork' },
        titled: { ok: true },
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
    workerThreads.messageHandler?.({
      id: 1,
      kind: 'capabilityResponse',
      ok: true,
      result: { path: 'README.md', content: 'hello', sha256: 'abc' },
    });

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

  it('runs backend exports with host-mediated filesystem root handles', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  const appRoot = await ctx.filesystem.app({ access: ['read', 'write', 'list'], reason: 'test app root' });
  await appRoot.writeText('state.json', '{"ok":true}');
  const text = await appRoot.readText('state.json', { maxBytes: 100 });
  const entries = await appRoot.list('.', { depth: 1, excludeNames: ['tmp'] });
  const temp = await appRoot.createTempWorkspace({ prefix: 'worker-' });
  return { root: appRoot.root, text, entries, tempRoot: temp.root };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 23,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-filesystem' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'filesystem',
      operation: 'requestRoot',
      input: { kind: 'app', access: ['read', 'write', 'list'], reason: 'test app root' },
    });
    workerThreads.messageHandler?.({
      id: 1,
      kind: 'capabilityResponse',
      ok: true,
      result: { handleId: 'fs-1', root: { kind: 'extension-storage', id: 'worker-ext:app', path: '/state/files' } },
    });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'filesystem',
      operation: 'writeText',
      input: { handleId: 'fs-1', path: 'state.json', data: '{"ok":true}' },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'filesystem',
      operation: 'readText',
      input: { handleId: 'fs-1', path: 'state.json', maxBytes: 100 },
    });
    workerThreads.messageHandler?.({ id: 3, kind: 'capabilityResponse', ok: true, result: '{"ok":true}' });

    await waitForPostMessage({
      id: 4,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'filesystem',
      operation: 'list',
      input: { handleId: 'fs-1', path: '.', depth: 1, excludeNames: ['tmp'] },
    });
    workerThreads.messageHandler?.({
      id: 4,
      kind: 'capabilityResponse',
      ok: true,
      result: [{ name: 'state.json', path: 'state.json', type: 'file', size: 11 }],
    });

    await waitForPostMessage({
      id: 5,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'filesystem',
      operation: 'createTempWorkspace',
      input: { handleId: 'fs-1', prefix: 'worker-' },
    });
    workerThreads.messageHandler?.({
      id: 5,
      kind: 'capabilityResponse',
      ok: true,
      result: { handleId: 'fs-2', root: { kind: 'temp', id: '/tmp/worker-1', path: '/tmp/worker-1' } },
    });

    await waitForPostMessage({
      id: 23,
      ok: true,
      result: {
        root: { kind: 'extension-storage', id: 'worker-ext:app', path: '/state/files' },
        text: '{"ok":true}',
        entries: [{ name: 'state.json', path: 'state.json', type: 'file', size: 11 }],
        tempRoot: { kind: 'temp', id: '/tmp/worker-1', path: '/tmp/worker-1' },
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

  it('runs backend exports with host-mediated model provider write capabilities', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  const provider = await ctx.models.saveProvider({ provider: 'ds4', baseUrl: 'http://127.0.0.1:8000/v1' });
  const model = await ctx.models.saveProviderModel({ provider: 'ds4', modelId: 'deepseek-v4-flash' });
  return { provider, model };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 29,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-model-writes' },
      exportName: 'doThing',
      args: [{}],
      context: {
        type: 'backend',
        runtimeScope: 'shared',
        repoRoot: '/repo',
        authFile: '/agent/auth.json',
        stateRoot: '/state',
      },
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'models',
      operation: 'saveProvider',
      input: {
        input: { provider: 'ds4', baseUrl: 'http://127.0.0.1:8000/v1' },
        runtimeScope: 'shared',
        repoRoot: '/repo',
        authFile: '/agent/auth.json',
        stateRoot: '/state',
      },
    });
    workerThreads.messageHandler?.({ id: 1, kind: 'capabilityResponse', ok: true, result: { provider: 'ds4' } });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'models',
      operation: 'saveProviderModel',
      input: {
        input: { provider: 'ds4', modelId: 'deepseek-v4-flash' },
        runtimeScope: 'shared',
        repoRoot: '/repo',
        authFile: '/agent/auth.json',
        stateRoot: '/state',
      },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { modelId: 'deepseek-v4-flash' } });

    await waitForPostMessage({
      id: 29,
      ok: true,
      result: { provider: { provider: 'ds4' }, model: { modelId: 'deepseek-v4-flash' } },
    });
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
      input: {
        command: 'git',
        args: ['status', '--short'],
        cwd: '/repo',
        timeoutMs: 1000,
        env: expect.objectContaining({ PATH: expect.stringContaining('/bin') }),
      },
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

  it('adds extension bin directories to worker shell env', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    const extensionRoot = join(root, 'system-ds4');
    const extensionBin = join(extensionRoot, 'bin');
    mkdirSync(extensionBin, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  return await ctx.shell.exec({ command: 'sh', args: ['-lc', 'ds4 help'], cwd: '/repo', env: { PATH: '/usr/bin' } });
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 400,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-shell-env' },
      exportName: 'doThing',
      args: [{}],
      context: {
        type: 'backend',
        repoRoot: '/repo',
        liveSessionResourceOptions: {
          additionalExtensionPaths: [extensionRoot],
          additionalSkillPaths: [],
          additionalPromptTemplatePaths: [],
          additionalThemePaths: [],
        },
      },
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'exec',
      input: {
        command: 'sh',
        args: ['-lc', 'ds4 help'],
        cwd: '/repo',
        env: { PATH: `${extensionBin}${delimiter}${process.env.NEON_PILOT_STATE_ROOT}/bin${delimiter}/usr/bin` },
      },
    });
  });

  it('runs backend exports with host-mediated shell spawn handles', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pa-ext-worker-'));
    mkdirSync(root, { recursive: true });
    const backendPath = join(root, 'backend.mjs');
    writeFileSync(
      backendPath,
      `
export async function doThing(_input, ctx) {
  const events = [];
  const handle = await ctx.shell.spawn({
    command: 'caffeinate',
    args: ['-dimsu'],
    onStdout: (chunk) => events.push(['stdout', chunk]),
    onStderr: (chunk) => events.push(['stderr', chunk]),
    onExit: (event) => events.push(['exit', event.code, event.signal]),
  });
  await handle.write('ping');
  await handle.resize(80, 24);
  await handle.kill();
  return { pid: handle.pid, usingPty: handle.usingPty, executionWrappers: handle.executionWrappers, events };
}
`,
    );

    await loadWorker();
    workerThreads.messageHandler?.({
      id: 41,
      type: 'runExport',
      extensionId: 'worker-ext',
      compiled: { path: backendPath, hash: 'hash-shell-spawn' },
      exportName: 'doThing',
      args: [{}],
      context: 'backend',
    });

    await waitForPostMessage({
      id: 1,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'spawn',
      input: {
        handleId: 'worker-shell-1',
        command: 'caffeinate',
        args: ['-dimsu'],
        env: expect.objectContaining({ PATH: expect.stringContaining('/bin') }),
        onStdout: true,
        onStderr: true,
        onExit: true,
      },
    });
    workerThreads.messageHandler?.({
      id: 1,
      kind: 'capabilityResponse',
      ok: true,
      result: { pid: 123, usingPty: false, executionWrappers: [{ id: 'sandbox' }] },
    });
    workerThreads.messageHandler?.({
      kind: 'capabilityEvent',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'stdout',
      input: { handleId: 'worker-shell-1', chunk: 'out' },
    });
    workerThreads.messageHandler?.({
      kind: 'capabilityEvent',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'stderr',
      input: { handleId: 'worker-shell-1', chunk: 'err' },
    });

    await waitForPostMessage({
      id: 2,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'write',
      input: { handleId: 'worker-shell-1', data: 'ping' },
    });
    workerThreads.messageHandler?.({ id: 2, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 3,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'resize',
      input: { handleId: 'worker-shell-1', cols: 80, rows: 24 },
    });
    workerThreads.messageHandler?.({ id: 3, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 4,
      kind: 'capabilityRequest',
      extensionId: 'worker-ext',
      capability: 'shell',
      operation: 'kill',
      input: { handleId: 'worker-shell-1' },
    });
    workerThreads.messageHandler?.({ id: 4, kind: 'capabilityResponse', ok: true, result: { ok: true } });

    await waitForPostMessage({
      id: 41,
      ok: true,
      result: {
        pid: 123,
        usingPty: false,
        executionWrappers: [{ id: 'sandbox' }],
        events: [
          ['stdout', 'out'],
          ['stderr', 'err'],
        ],
      },
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
