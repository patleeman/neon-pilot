import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildToolInjectionPlan = vi.fn();
const extensionHostClient = { invokeAction: vi.fn() };
const listExtensionToolRegistrations = vi.fn();
vi.mock('../tools/toolInventory.js', () => ({ buildToolInjectionPlan }));
vi.mock('./extensionHostClient.js', () => ({ getExtensionHostClient: () => extensionHostClient }));
vi.mock('./extensionRegistry.js', () => ({ listExtensionToolRegistrations }));

const { createManifestToolAgentExtensions } = await import('./manifestToolAgentExtension.js');

function baseOptions(overrides: Partial<Parameters<typeof createManifestToolAgentExtensions>[0]> = {}) {
  return {
    getRuntimeScope: () => 'shared',
    getCurrentModelRef: () => 'openai/gpt-text',
    getPreferredVisionModel: () => 'vision-model',
    repoRoot: '/repo',
    runtimeConfigRoot: '/runtime-config',
    stateRoot: '/state',
    serverContext: { getRuntimeScope: () => 'shared' },
    ...overrides,
  };
}

function tool(overrides: Record<string, unknown> = {}) {
  return {
    extensionId: 'ext',
    id: 'tool',
    name: 'ext_tool',
    action: 'doThing',
    title: 'Tool title',
    description: 'Tool description',
    inputSchema: { type: 'object' },
    priority: 0,
    ...overrides,
  };
}

function registerTools() {
  const registered: Array<Record<string, unknown>> = [];
  const factories = createManifestToolAgentExtensions(baseOptions());
  for (const factory of factories)
    factory({ registerTool: (registration: unknown) => registered.push(registration as Record<string, unknown>) } as never);
  return registered;
}

describe('manifestToolAgentExtension', () => {
  beforeEach(() => {
    buildToolInjectionPlan.mockReset().mockReturnValue({ registrations: [{ extensionId: 'ext', id: 'tool' }] });
    extensionHostClient.invokeAction.mockReset().mockResolvedValue({ ok: true, result: { text: 'done', details: { ok: true } } });
    listExtensionToolRegistrations.mockReset().mockReturnValue([tool()]);
  });

  it('registers active manifest tools and invokes extension actions with session context', async () => {
    const registered = registerTools();
    const onUpdate = vi.fn();
    const signal = new AbortController().signal;
    const ctx = {
      sessionManager: {
        getSessionId: () => 'conversation-1',
        getCwd: () => '/repo',
        getSessionFile: () => '/session.json',
      },
    };

    await expect(registered[0].execute?.('call-1', { x: 1 }, signal, onUpdate, ctx)).resolves.toEqual({
      content: [{ type: 'text', text: 'done' }],
      details: { extensionId: 'ext', toolId: 'tool', action: 'doThing', result: { ok: true } },
    });

    expect(registered[0]).toMatchObject({
      name: 'ext_tool',
      label: 'Tool title',
      description: 'Tool description',
      promptSnippet: 'Tool description',
      parameters: { type: 'object' },
    });
    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith({
      extensionId: 'ext',
      actionId: 'doThing',
      input: { x: 1 },
      serverContextSnapshot: { runtimeScope: 'shared' },
      toolContext: { onUpdate: expect.any(Function) },
      toolContextSnapshot: {
        conversationId: 'conversation-1',
        sessionId: 'conversation-1',
        cwd: '/repo',
        sessionFile: '/session.json',
        preferredVisionModel: 'vision-model',
      },
      signal,
      agentToolContext: {
        conversationId: 'conversation-1',
        sessionId: 'conversation-1',
        cwd: '/repo',
        sessionFile: '/session.json',
        toolContext: {
          conversationId: 'conversation-1',
          sessionId: 'conversation-1',
          cwd: '/repo',
          sessionFile: '/session.json',
          preferredVisionModel: 'vision-model',
        },
      },
    });
  });

  it('filters inactive, native, and model-condition-mismatched tools', () => {
    buildToolInjectionPlan.mockReturnValue({ registrations: [{ extensionId: 'ext', id: 'active' }] });
    listExtensionToolRegistrations.mockReturnValue([
      tool({ id: 'active', when: { providers: ['openai'] } }),
      tool({ id: 'inactive' }),
      tool({ id: 'native', nativeRegistration: true }),
      tool({ id: 'wrong-model', when: { models: ['anthropic/claude'] } }),
    ]);

    const registered = registerTools();

    expect(registered).toHaveLength(1);
    expect(registered[0].name).toBe('ext_tool');
  });

  it('uses overridable replacement names and prompt guidelines only for allowed replacements', () => {
    listExtensionToolRegistrations.mockReturnValue([
      tool({ id: 'tool', name: 'better_read', replaces: 'read' }),
      tool({ id: 'other', name: 'bad_replace', replaces: 'conversation' }),
    ]);
    buildToolInjectionPlan.mockReturnValue({
      registrations: [
        { extensionId: 'ext', id: 'tool' },
        { extensionId: 'ext', id: 'other' },
      ],
    });

    const registered = registerTools();

    expect(registered[0]).toMatchObject({ name: 'read', promptGuidelines: ['This tool replaces the built-in "read" tool.'] });
    expect(registered[1]).toMatchObject({ name: 'bad_replace' });
    expect(registered[1].promptGuidelines).toBeUndefined();
  });

  it('returns backend invocation errors as tool errors', async () => {
    extensionHostClient.invokeAction.mockResolvedValue({ ok: false, error: 'boom' });
    const registered = registerTools();

    await expect(
      registered[0].execute?.('call', {}, undefined, undefined, { sessionManager: { getSessionId: () => 'c' } }),
    ).resolves.toEqual({
      content: [{ type: 'text', text: 'boom' }],
      details: { extensionId: 'ext', toolId: 'tool', action: 'doThing', error: 'boom' },
      isError: true,
    });
  });

  it('preserves extension content arrays, isError, terminate, and streaming updates', async () => {
    extensionHostClient.invokeAction.mockImplementation(async (request) => {
      request.toolContext.onUpdate({
        content: [
          { type: 'text', text: 'progress' },
          { type: 'image', text: 'ignored' },
        ],
      });
      return {
        ok: true,
        result: { content: [{ type: 'image', data: 'abc', mimeType: 'image/png' }], details: { d: 1 }, isError: true, terminate: true },
      };
    });
    const registered = registerTools();
    const onUpdate = vi.fn();

    await expect(
      registered[0].execute?.('call', {}, undefined, onUpdate, { sessionManager: { getSessionId: () => 'c' } }),
    ).resolves.toEqual({
      content: [{ type: 'image', data: 'abc', mimeType: 'image/png' }],
      details: { extensionId: 'ext', toolId: 'tool', action: 'doThing', result: { d: 1 } },
      isError: true,
      terminate: true,
    });
    expect(onUpdate).toHaveBeenCalledWith({
      content: [
        { type: 'text', text: 'progress' },
        { type: 'text', text: 'ignored' },
      ],
      details: undefined,
    });
  });

  it('always exposes probe_image regardless of model image support', () => {
    listExtensionToolRegistrations.mockReturnValue([tool({ id: 'tool', name: 'probe_image' })]);

    expect(registerTools()).toHaveLength(1);
  });
});
