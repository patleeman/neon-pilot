import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/promptAssembly', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes prompt assembly inventory helpers through their host modules', async () => {
    const promptAssembly = await import('./promptAssembly.js');
    resolver.callServerModuleExport.mockResolvedValue({ ok: true });

    await promptAssembly.buildInstructionPlan({ conversationId: 'conv-1' });
    await promptAssembly.buildPromptAssemblyPlanAsync({ model: 'auto' });
    await promptAssembly.buildPromptTemplatePlanAsync({ template: 'default' });
    await promptAssembly.buildToolInjectionPlanAsync({ cwd: '/repo' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../prompt-assembly/instructionInventory.js',
      'buildInstructionPlan',
      { conversationId: 'conv-1' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      2,
      '../../prompt-assembly/promptAssembly.js',
      'buildPromptAssemblyPlanAsync',
      { model: 'auto' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../prompts/promptTemplateInventory.js',
      'buildPromptTemplatePlanAsync',
      { template: 'default' },
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(4, '../../tools/toolInventory.js', 'buildToolInjectionPlanAsync', {
      cwd: '/repo',
    });
  });
});
