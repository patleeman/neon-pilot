import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existsSync: vi.fn(() => true) }));
const core = vi.hoisted(() => ({
  resolveRuntimeResources: vi.fn(() => ({ promptEntries: ['/repo/prompts/default.md', '/repo/prompts/review.txt'] })),
}));
const registry = vi.hoisted(() => ({ listExtensionAssemblyProviderRegistrations: vi.fn(() => []) }));
const providerRuntime = vi.hoisted(() => ({
  invokePromptAssemblyProvider: vi.fn(),
  isRecord: (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
}));
const runtimeScope = vi.hoisted(() => ({ getAssemblyRuntimeScope: vi.fn(() => 'shared') }));

vi.mock('node:fs', () => fs);
vi.mock('@neon-pilot/core', () => core);
vi.mock('../extensions/extensionRegistry.js', () => registry);
vi.mock('../prompt-assembly/providerRuntime.js', () => providerRuntime);
vi.mock('../prompt-assembly/runtimeScope.js', () => runtimeScope);

import {
  buildPromptTemplatePlan,
  buildPromptTemplatePlanAsync,
  listPromptTemplateDefinitions,
  listPromptTemplateDefinitionsAsync,
  registerPromptTemplateRuntimeHook,
} from './promptTemplateInventory.js';

describe('prompt template inventory', () => {
  const ctx = { repoRoot: '/repo', runtimeScope: 'shared' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    registry.listExtensionAssemblyProviderRegistrations.mockReturnValue([]);
  });

  it('discovers configured prompt template files from runtime resources', () => {
    expect(listPromptTemplateDefinitions(ctx)).toEqual([
      expect.objectContaining({
        id: 'default',
        title: 'default',
        providerId: 'runtime-resources',
        location: { kind: 'file', path: '/repo/prompts/default.md' },
        priority: 0,
      }),
      expect.objectContaining({
        id: 'review',
        title: 'review',
        providerId: 'runtime-resources',
        location: { kind: 'file', path: '/repo/prompts/review.txt' },
        priority: 1,
      }),
    ]);
    expect(core.resolveRuntimeResources).toHaveBeenCalledWith('shared', { repoRoot: '/repo' });
  });

  it('runs hooks in priority/id order for discovery and injection and supports disposal', () => {
    const events: string[] = [];
    const disposeB = registerPromptTemplateRuntimeHook({
      id: 'b',
      priority: 2,
      afterPromptTemplateDiscovery: (templates) => {
        events.push('discover:b');
        return templates;
      },
      beforePromptTemplateInjection: (templates) => {
        events.push('inject:b');
        return templates;
      },
      afterPromptTemplateInjection: () => events.push('after:b'),
    });
    const disposeA = registerPromptTemplateRuntimeHook({
      id: 'a',
      priority: 1,
      afterPromptTemplateDiscovery: (templates) => {
        events.push('discover:a');
        return templates;
      },
      beforePromptTemplateInjection: (templates) => {
        events.push('inject:a');
        return templates;
      },
      afterPromptTemplateInjection: () => events.push('after:a'),
    });

    buildPromptTemplatePlan(ctx);
    expect(events).toEqual(['discover:a', 'discover:b', 'inject:a', 'inject:b', 'after:a', 'after:b']);

    disposeA();
    disposeB();
    events.length = 0;
    buildPromptTemplatePlan(ctx);
    expect(events).toEqual([]);
  });

  it('marks missing template files disabled and excludes duplicate enabled paths from injection', () => {
    fs.existsSync.mockImplementation((path) => path !== '/repo/prompts/default.md');
    const dispose = registerPromptTemplateRuntimeHook({
      id: 'duplicate',
      afterPromptTemplateDiscovery: (templates) => [...templates, { ...templates[1], id: 'review-copy', priority: 99 }],
    });

    const plan = buildPromptTemplatePlan(ctx);

    expect(plan.templates.find((template) => template.id === 'default')).toMatchObject({ enabled: false });
    expect(plan.diagnostics).toContainEqual({
      severity: 'error',
      code: 'missing-prompt-template',
      message: 'default prompt template is missing: /repo/prompts/default.md',
      sourceId: 'default',
    });
    expect(plan.templatePaths).toEqual(['/repo/prompts/review.txt']);
    dispose();
  });

  it('merges extension provider prompt templates, diagnostics, and default provider metadata', async () => {
    registry.listExtensionAssemblyProviderRegistrations.mockReturnValue([
      { id: 'provider-1', extensionId: 'ext-one', kind: 'promptTemplates', title: 'Ext One' },
      { id: 'provider-2', extensionId: 'ext-two', kind: 'other' },
    ]);
    providerRuntime.invokePromptAssemblyProvider.mockResolvedValue({
      items: [{ id: 'ext-template', title: 'Extension Template', location: { kind: 'file', path: '/ext/template.md' }, priority: 10 }],
      diagnostics: [{ severity: 'warning', code: 'provider-warning', message: 'careful' }],
    });

    const definitions = await listPromptTemplateDefinitionsAsync(ctx);
    const plan = await buildPromptTemplatePlanAsync(ctx);

    expect(providerRuntime.invokePromptAssemblyProvider).toHaveBeenCalledTimes(2);
    expect(definitions).toContainEqual(
      expect.objectContaining({
        id: 'ext-template',
        providerId: 'extension-provider:ext-one/provider-1',
        source: { kind: 'extension', label: 'Ext One', extensionId: 'ext-one' },
      }),
    );
    expect(plan.diagnostics).toContainEqual({ severity: 'warning', code: 'provider-warning', message: 'careful' });
  });
});
