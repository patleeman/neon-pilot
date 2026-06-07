import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionHostClient = vi.hoisted(() => ({
  invokeAction: vi.fn(),
  listStaticContributions: vi.fn(),
}));
const toolInventory = vi.hoisted(() => ({
  buildToolInjectionPlanAsync: vi.fn(),
  listToolDefinitionsAsync: vi.fn(),
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
}));
vi.mock('./toolInventory.js', () => toolInventory);

import { invokeExtensionToolByName, listInvocableExtensionTools } from './toolGateway.js';

describe('tool gateway', () => {
  beforeEach(() => {
    extensionHostClient.invokeAction.mockReset();
    extensionHostClient.listStaticContributions.mockReset();
    toolInventory.buildToolInjectionPlanAsync.mockReset();
    toolInventory.listToolDefinitionsAsync.mockReset();

    extensionHostClient.listStaticContributions.mockResolvedValue({
      skills: [],
      modelDiscovery: [],
      tools: [
        {
          extensionId: 'ext',
          packageType: 'system',
          id: 'tool',
          name: 'example_tool',
          action: 'run',
          description: 'Example tool',
          inputSchema: {},
        },
      ],
    });
    toolInventory.buildToolInjectionPlanAsync.mockResolvedValue({ registrations: [{ extensionId: 'ext', id: 'tool' }] });
    toolInventory.listToolDefinitionsAsync.mockResolvedValue([
      {
        id: 'ext/tool',
        name: 'example_tool',
        description: 'Example tool',
        inputSchema: {},
        raw: {
          extensionId: 'ext',
          packageType: 'system',
          id: 'tool',
          name: 'example_tool',
          action: 'run',
          description: 'Example tool',
          inputSchema: {},
        },
        priority: 0,
      },
    ]);
    extensionHostClient.invokeAction.mockResolvedValue({ ok: true, result: { text: 'done' } });
  });

  it('uses serializable snapshots for non-streaming extension tool calls', async () => {
    await expect(
      invokeExtensionToolByName(
        {
          name: 'example_tool',
          input: { value: true },
          toolContext: { cwd: '/repo', conversationId: 'conversation-1', sessionId: 'session-1' },
        },
        { getRuntimeScope: () => 'shared', getRepoRoot: () => '/repo' },
      ),
    ).resolves.toEqual({
      content: [{ type: 'text', text: 'done' }],
      details: { text: 'done' },
    });

    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith({
      extensionId: 'ext',
      actionId: 'run',
      input: { value: true },
      serverContextSnapshot: { runtimeScope: 'shared', repoRoot: '/repo' },
      toolContextSnapshot: { cwd: '/repo', conversationId: 'conversation-1', sessionId: 'session-1' },
    });
  });

  it('uses snapshots plus update callback channel for streaming extension tool calls', async () => {
    const onUpdate = vi.fn();
    const signal = new AbortController().signal;
    const serverContext = { getRuntimeScope: () => 'shared' };
    const toolContext = { cwd: '/repo', onUpdate };

    await invokeExtensionToolByName({ name: 'example_tool', toolContext, signal }, serverContext);

    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith({
      extensionId: 'ext',
      actionId: 'run',
      input: {},
      serverContextSnapshot: { runtimeScope: 'shared' },
      toolContext: { onUpdate },
      toolContextSnapshot: { cwd: '/repo' },
      signal,
    });
  });

  it('only lists and invokes allowlisted extension tools when direct tools are supplied', async () => {
    toolInventory.listToolDefinitionsAsync.mockResolvedValueOnce([
      {
        id: 'system-writing-studio/get-canvas',
        name: 'writing_studio_get_canvas',
        description: 'Read Writing Studio canvas',
        inputSchema: {},
        raw: {
          extensionId: 'system-writing-studio',
          packageType: 'system',
          id: 'get-canvas',
          name: 'writing_studio_get_canvas',
          action: 'writingStudioGetCanvas',
          description: 'Read Writing Studio canvas',
          inputSchema: {},
        },
        priority: 0,
      },
      {
        id: 'system-runs/subagent',
        name: 'subagent',
        description: 'Start delegated agent work',
        inputSchema: { type: 'object' },
        raw: {
          extensionId: 'system-runs',
          packageType: 'system',
          id: 'subagent',
          name: 'subagent',
          action: 'subagent',
          description: 'Start delegated agent work',
          inputSchema: { type: 'object' },
        },
        priority: 0,
      },
    ]);

    await expect(
      listInvocableExtensionTools({
        modelRef: 'ds4/deepseek-v4-flash',
        repoRoot: '/repo',
        directToolNames: ['writing_studio_get_canvas', 'bash', 'read', 'edit'],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        name: 'writing_studio_get_canvas',
        source: expect.objectContaining({
          extensionId: 'system-writing-studio',
          toolId: 'get-canvas',
          action: 'writingStudioGetCanvas',
        }),
      }),
    ]);

    toolInventory.listToolDefinitionsAsync.mockResolvedValueOnce([
      {
        id: 'system-writing-studio/get-canvas',
        name: 'writing_studio_get_canvas',
        description: 'Read Writing Studio canvas',
        inputSchema: {},
        raw: {
          extensionId: 'system-writing-studio',
          packageType: 'system',
          id: 'get-canvas',
          name: 'writing_studio_get_canvas',
          action: 'writingStudioGetCanvas',
          description: 'Read Writing Studio canvas',
          inputSchema: {},
        },
        priority: 0,
      },
    ]);

    await expect(
      invokeExtensionToolByName({
        name: 'writing_studio_get_canvas',
        input: { documentId: 'doc-1' },
        runtime: {
          modelRef: 'ds4/deepseek-v4-flash',
          repoRoot: '/repo',
          directToolNames: ['writing_studio_get_canvas', 'bash', 'read', 'edit'],
        },
      }),
    ).resolves.toEqual({ content: [{ type: 'text', text: 'done' }], details: { text: 'done' } });

    expect(extensionHostClient.invokeAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        extensionId: 'system-writing-studio',
        actionId: 'writingStudioGetCanvas',
        input: { documentId: 'doc-1' },
      }),
    );
  });

  it('does not expose unrelated extension tools from a direct tool allowlist', async () => {
    toolInventory.listToolDefinitionsAsync.mockResolvedValue([
      {
        id: 'system-runs/subagent',
        name: 'subagent',
        description: 'Start delegated agent work',
        inputSchema: {},
        raw: {
          extensionId: 'system-runs',
          packageType: 'system',
          id: 'subagent',
          name: 'subagent',
          action: 'subagent',
          description: 'Start delegated agent work',
          inputSchema: {},
        },
        priority: 0,
      },
    ]);

    await expect(
      listInvocableExtensionTools({ modelRef: 'ds4/deepseek-v4-flash', repoRoot: '/repo', directToolNames: ['bash', 'read', 'edit'] }),
    ).resolves.toEqual([]);
    await expect(
      invokeExtensionToolByName({
        name: 'subagent',
        input: { prompt: 'check this' },
        runtime: { modelRef: 'ds4/deepseek-v4-flash', repoRoot: '/repo', directToolNames: ['bash', 'read', 'edit'] },
      }),
    ).rejects.toThrow('Tool is not available: subagent');
  });
});
