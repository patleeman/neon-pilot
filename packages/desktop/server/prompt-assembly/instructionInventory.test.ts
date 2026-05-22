import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existsSync: vi.fn(() => true), readFileSync: vi.fn((path: string) => `content:${path}`) }));
const core = vi.hoisted(() => ({
  getDurableAgentFilePath: vi.fn((vaultRoot: string) => `${vaultRoot}/AGENTS.md`),
  getDurableSkillsDir: vi.fn((vaultRoot: string) => `${vaultRoot}/skills`),
  getDurableTasksDir: vi.fn((syncRoot: string) => `${syncRoot}/tasks`),
  getStateRoot: vi.fn(() => '/state'),
  getSyncRoot: vi.fn((stateRoot: string) => `${stateRoot}/sync`),
  resolveRuntimeResources: vi.fn(() => ({
    repoRoot: '/repo',
    vaultRoot: '/vault',
    agentsFiles: ['/repo/AGENTS.md'],
    systemPromptFile: '/repo/SYSTEM.md',
    appendSystemFiles: ['/repo/APPEND.md'],
  })),
}));
const template = vi.hoisted(() => ({ renderSystemPromptTemplate: vi.fn(() => 'generated template') }));
const registry = vi.hoisted(() => ({ listExtensionAssemblyProviderRegistrations: vi.fn(() => []) }));
const providerRuntime = vi.hoisted(() => ({
  invokePromptAssemblyProvider: vi.fn(),
  isRecord: (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
}));
const runtimeScope = vi.hoisted(() => ({ getAssemblyRuntimeScope: vi.fn(() => 'shared') }));

vi.mock('node:fs', () => fs);
vi.mock('@neon-pilot/core', () => core);
vi.mock('../../../core/src/system-prompt-template.js', () => template);
vi.mock('../extensions/extensionRegistry.js', () => registry);
vi.mock('./providerRuntime.js', () => providerRuntime);
vi.mock('./runtimeScope.js', () => runtimeScope);

import { buildInstructionPlan, registerInstructionProvider } from './instructionInventory.js';

describe('instruction inventory', () => {
  const ctx = { repoRoot: '/repo', cwd: '/repo/work', runtimeScope: 'shared' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation((path: string) => `content:${path}`);
    template.renderSystemPromptTemplate.mockReturnValue('generated template');
    registry.listExtensionAssemblyProviderRegistrations.mockReturnValue([]);
  });

  it('builds ordered instruction layers from runtime files and generated template', async () => {
    const plan = await buildInstructionPlan(ctx);

    expect(plan.layers.map((layer) => layer.id)).toEqual([
      'system:/repo/SYSTEM.md',
      'agents:/repo/AGENTS.md',
      'runtime:generated-system-template',
      'append-system:/repo/APPEND.md',
    ]);
    expect(plan.finalSystemPrompt).toBe(
      'content:/repo/SYSTEM.md\n\ncontent:/repo/AGENTS.md\n\ngenerated template\n\ncontent:/repo/APPEND.md',
    );
    expect(template.renderSystemPromptTemplate).toHaveBeenCalledWith({
      repo_root: '/repo',
      vault_root: '/vault',
      agents_edit_target: '/vault/AGENTS.md',
      skills_dir: '/vault/skills',
      tasks_dir: '/state/sync/tasks',
      docs_dir: '/repo/docs',
      docs_index: '/repo/docs/README.md',
    });
  });

  it('skips missing/unreadable files and empty generated templates', async () => {
    fs.existsSync.mockImplementation((path) => path !== '/repo/SYSTEM.md');
    fs.readFileSync.mockImplementation((path: string) => {
      if (path === '/repo/APPEND.md') throw new Error('unreadable');
      return `content:${path}`;
    });
    template.renderSystemPromptTemplate.mockReturnValue('');

    const plan = await buildInstructionPlan(ctx);

    expect(plan.layers.map((layer) => layer.id)).toEqual(['agents:/repo/AGENTS.md']);
    expect(plan.finalSystemPrompt).toBe('content:/repo/AGENTS.md');
  });

  it('records provider failures and supports custom provider disposal', async () => {
    const dispose = registerInstructionProvider({
      id: 'custom',
      title: 'Custom provider',
      provide: () => {
        throw new Error('boom');
      },
    });

    const plan = await buildInstructionPlan(ctx);
    expect(plan.diagnostics).toContainEqual({
      severity: 'warning',
      code: 'instruction-provider-failed',
      message: 'Custom provider failed; prompt assembly continued without it: boom',
      sourceId: 'custom',
    });

    dispose();
    expect((await buildInstructionPlan(ctx)).diagnostics).toEqual([]);
  });

  it('merges extension instruction provider layers, diagnostics, and default metadata', async () => {
    registry.listExtensionAssemblyProviderRegistrations.mockReturnValue([
      { id: 'instructions', extensionId: 'ext', kind: 'instructions', title: 'Extension Instructions' },
    ]);
    providerRuntime.invokePromptAssemblyProvider.mockResolvedValue({
      items: [
        {
          id: 'ext-layer',
          title: 'Ext Layer',
          content: 'extension content',
          priority: 50,
          scope: 'runtime',
          mutable: false,
          risk: 'normal',
        },
      ],
      diagnostics: [{ severity: 'info', code: 'provider-info', message: 'hello' }],
    });

    const plan = await buildInstructionPlan(ctx);

    expect(providerRuntime.invokePromptAssemblyProvider).toHaveBeenCalledWith(
      expect.objectContaining({ resultKey: 'layers', validateItem: expect.any(Function) }),
    );
    expect(plan.layers).toContainEqual(
      expect.objectContaining({
        id: 'ext-layer',
        providerId: 'extension-provider:ext/instructions',
        source: { kind: 'extension', label: 'Extension Instructions', extensionId: 'ext' },
      }),
    );
    expect(plan.diagnostics).toContainEqual({ severity: 'info', code: 'provider-info', message: 'hello' });
  });
});
