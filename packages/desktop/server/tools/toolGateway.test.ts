import { beforeEach, describe, expect, it, vi } from 'vitest';

const extensionHostClient = vi.hoisted(() => ({
  invokeAction: vi.fn(),
}));
const extensionRegistry = vi.hoisted(() => ({
  listExtensionToolRegistrations: vi.fn(),
}));
const toolInventory = vi.hoisted(() => ({
  buildToolInjectionPlan: vi.fn(),
}));

vi.mock('../extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
}));
vi.mock('../extensions/extensionRegistry.js', () => extensionRegistry);
vi.mock('./toolInventory.js', () => toolInventory);

import { invokeExtensionToolByName } from './toolGateway.js';

describe('tool gateway', () => {
  beforeEach(() => {
    extensionHostClient.invokeAction.mockReset();
    extensionRegistry.listExtensionToolRegistrations.mockReset();
    toolInventory.buildToolInjectionPlan.mockReset();

    extensionRegistry.listExtensionToolRegistrations.mockReturnValue([
      {
        extensionId: 'ext',
        id: 'tool',
        name: 'example_tool',
        action: 'run',
        description: 'Example tool',
        inputSchema: {},
      },
    ]);
    toolInventory.buildToolInjectionPlan.mockReturnValue({ registrations: [{ extensionId: 'ext', id: 'tool' }] });
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
});
