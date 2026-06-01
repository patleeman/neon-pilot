import { beforeEach, describe, expect, it, vi } from 'vitest';

const registry = vi.hoisted(() => ({
  listExtensionToolRegistrations: vi.fn(() => []),
}));
const extensionHostClient = vi.hoisted(() => ({
  listPromptAssemblyContributions: vi.fn(() => ({ assemblyProviders: [], contextProviders: [], hooks: [] })),
  listStaticContributions: vi.fn(() => ({ skills: [], tools: [], modelDiscovery: [] })),
}));
const providerRuntime = vi.hoisted(() => ({
  invokePromptAssemblyProvider: vi.fn(),
  isRecord: (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
}));

vi.mock('../extensions/extensionRegistry.js', () => registry);
vi.mock('../extensions/extensionHostClient.js', () => ({ getExtensionHostClient: () => extensionHostClient }));
vi.mock('../prompt-assembly/providerRuntime.js', () => providerRuntime);

import {
  buildToolInjectionPlan,
  buildToolInjectionPlanAsync,
  listToolDefinitions,
  listToolDefinitionsAsync,
  registerToolRuntimeHook,
} from './toolInventory.js';

describe('tool inventory', () => {
  const ctx = { provider: 'openai', modelRef: 'openai/gpt-4.1' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    extensionHostClient.listPromptAssemblyContributions.mockReturnValue({ assemblyProviders: [], contextProviders: [], hooks: [] });
    extensionHostClient.listStaticContributions.mockReturnValue({ skills: [], tools: [], modelDiscovery: [] });
    registry.listExtensionToolRegistrations.mockReturnValue([]);
  });

  function tool(overrides: Record<string, unknown> = {}) {
    return {
      extensionId: 'ext',
      packageType: 'system',
      id: 'read-file',
      name: 'read_file',
      action: 'readFile',
      description: 'Read a file',
      inputSchema: { type: 'object' },
      priority: 1,
      ...overrides,
    };
  }

  it('converts extension tool registrations to sorted tool definitions', () => {
    registry.listExtensionToolRegistrations.mockReturnValue([tool({ id: 'low', priority: 1 }), tool({ id: 'high', priority: 10 })]);

    expect(listToolDefinitions(ctx).map((definition) => definition.id)).toEqual(['ext/high', 'ext/low']);
    expect(listToolDefinitions(ctx)[0]).toMatchObject({
      providerId: 'extension:ext',
      source: { kind: 'extension', label: 'ext', extensionId: 'ext' },
    });
  });

  it('runs runtime hooks in order and supports disposal', () => {
    const events: string[] = [];
    const disposeB = registerToolRuntimeHook({
      id: 'b',
      priority: 2,
      afterToolDiscovery: (tools) => {
        events.push('discover:b');
        return tools;
      },
      beforeToolInjection: (tools) => {
        events.push('inject:b');
        return tools;
      },
      afterToolInjection: () => events.push('after:b'),
    });
    const disposeA = registerToolRuntimeHook({
      id: 'a',
      priority: 1,
      afterToolDiscovery: (tools) => {
        events.push('discover:a');
        return tools;
      },
      beforeToolInjection: (tools) => {
        events.push('inject:a');
        return tools;
      },
      afterToolInjection: () => events.push('after:a'),
    });
    registry.listExtensionToolRegistrations.mockReturnValue([tool()]);

    buildToolInjectionPlan(ctx);
    expect(events).toEqual(['discover:a', 'discover:b', 'inject:a', 'inject:b', 'after:a', 'after:b']);
    disposeA();
    disposeB();
  });

  it('applies model/provider conditions, validation, replacement policy, and duplicate shadowing', () => {
    registry.listExtensionToolRegistrations.mockReturnValue([
      tool({ id: 'bash-replacer', name: 'safe_bash', replaces: 'bash', priority: 20, promptGuidelines: ['Use safe bash.'] }),
      tool({ id: 'bash-low', name: 'other_bash', replaces: 'bash', priority: 1 }),
      tool({ id: 'bad-replacer', name: 'replace_model', replaces: 'model', priority: 5 }),
      tool({ id: 'provider-mismatch', name: 'anthropic_only', when: { providers: ['anthropic'] }, priority: 5 }),
      tool({ id: 'invalid', name: '', description: '', action: undefined, priority: 5 }),
    ]);

    const plan = buildToolInjectionPlan(ctx);

    expect(plan.activeToolNames).toEqual(['bash']);
    expect(plan.promptGuidelines).toEqual(['Use safe bash.']);
    expect(plan.tools.find((candidate) => candidate.id === 'ext/bash-low')).toMatchObject({
      active: false,
      reason: 'shadowed by higher-priority bash provider',
    });
    expect(plan.tools.find((candidate) => candidate.id === 'ext/bad-replacer')).toMatchObject({
      enabled: false,
      reason: 'disabled by diagnostics or replacement policy',
    });
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({ code: 'non-overridable-replacement', sourceId: 'ext/bad-replacer' }));
    expect(plan.tools.find((candidate) => candidate.id === 'ext/provider-mismatch')).toMatchObject({
      enabled: false,
      reason: 'model/provider condition did not match',
    });
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-tool-name' }),
        expect.objectContaining({ code: 'missing-tool-description' }),
        expect.objectContaining({ code: 'missing-tool-action' }),
      ]),
    );
  });

  it('does not apply extension-specific secret policy in core tool inventory', () => {
    registry.listExtensionToolRegistrations.mockReturnValue([
      tool({ extensionId: 'system-exa-search', id: 'exa', name: 'web_search', priority: 10 }),
    ]);
    expect(buildToolInjectionPlan(ctx).activeToolNames).toEqual(['web_search']);
  });

  it('merges async provider tools, diagnostics, and raw registrations for action-backed tools', async () => {
    extensionHostClient.listStaticContributions.mockReturnValue({ skills: [], tools: [], modelDiscovery: [] });
    extensionHostClient.listPromptAssemblyContributions.mockReturnValue({
      assemblyProviders: [{ id: 'provider', extensionId: 'ext-provider', packageType: 'system', kind: 'tools', title: 'Tools' }],
      contextProviders: [],
      hooks: [],
    });
    providerRuntime.invokePromptAssemblyProvider.mockResolvedValue({
      items: [{ id: 'provided', name: 'provided_tool', action: 'run', description: 'Provided tool', inputSchema: {}, priority: 3 }],
      diagnostics: [{ severity: 'warning', code: 'provider-warning', message: 'careful' }],
    });

    const definitions = await listToolDefinitionsAsync(ctx);
    const plan = await buildToolInjectionPlanAsync(ctx);

    expect(definitions).toContainEqual(expect.objectContaining({ id: 'provided', providerId: 'extension-provider:ext-provider/provider' }));
    expect(plan.activeToolNames).toEqual(['provided_tool']);
    expect(plan.registrations[0]).toMatchObject({ extensionId: 'ext-provider', id: 'provided', name: 'provided_tool', action: 'run' });
    expect(plan.diagnostics).toContainEqual({ severity: 'warning', code: 'provider-warning', message: 'careful' });
  });
});
