import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existsSync: vi.fn(() => true), readFileSync: vi.fn((path: string) => `content:${path}`) }));
const template = vi.hoisted(() => ({ renderSystemPromptTemplate: vi.fn(() => 'generated template') }));
const core = vi.hoisted(() => ({
  renderSystemPromptTemplate: template.renderSystemPromptTemplate,
  getDurableAgentFilePath: vi.fn((knowledgeRoot: string) => `${knowledgeRoot}/AGENTS.md`),
  getDurableSkillsDir: vi.fn((knowledgeRoot: string) => `${knowledgeRoot}/skills`),
  getDurableTasksDir: vi.fn((syncRoot: string) => `${syncRoot}/tasks`),
  getStateRoot: vi.fn(() => '/state'),
  getSyncRoot: vi.fn((stateRoot: string) => `${stateRoot}/sync`),
  readMachineSystemPromptTemplate: vi.fn(() => 'machine template'),
  resolveRuntimeResources: vi.fn(() => ({
    repoRoot: '/repo',
    knowledgeRoot: '/knowledge',
    agentsFiles: ['/repo/AGENTS.md'],
    systemPromptFile: '/repo/SYSTEM.md',
    appendSystemFiles: ['/repo/APPEND.md'],
  })),
}));
const extensionHostClient = vi.hoisted(() => ({
  listPromptAssemblyContributions: vi.fn(() => ({ assemblyProviders: [], contextProviders: [], hooks: [] })),
}));
const providerRuntime = vi.hoisted(() => ({
  invokePromptAssemblyProvider: vi.fn(),
  isRecord: (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
}));
const runtimeScope = vi.hoisted(() => ({ getAssemblyRuntimeScope: vi.fn(() => 'shared') }));

vi.mock('node:fs', () => fs);
vi.mock('@neon-pilot/core', () => core);
vi.mock('../extensions/extensionHostClient.js', () => ({ getExtensionHostClient: () => extensionHostClient }));
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
    extensionHostClient.listPromptAssemblyContributions.mockReturnValue({ assemblyProviders: [], contextProviders: [], hooks: [] });
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
    expect(template.renderSystemPromptTemplate).toHaveBeenCalledWith(
      {
        repo_root: '/repo',
        knowledge_root: '/knowledge',
        agents_edit_target: '/knowledge/AGENTS.md',
        skills_dir: '/knowledge/skills',
        tasks_dir: '/state/sync/tasks',
        docs_dir: '/repo/docs',
        docs_index: '/repo/docs/README.md',
      },
      'machine template',
    );
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
    extensionHostClient.listPromptAssemblyContributions.mockReturnValue({
      assemblyProviders: [{ id: 'instructions', extensionId: 'ext', kind: 'instructions', title: 'Extension Instructions' }],
      contextProviders: [],
      hooks: [],
    });
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
