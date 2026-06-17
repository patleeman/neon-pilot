import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./serverModuleResolver.js', () => resolver);

describe('backendApi/skills', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('routes skill inventory and MCP config helpers through their host modules', async () => {
    const skills = await import('./skills.js');
    resolver.callServerModuleExport.mockResolvedValue({ ok: true });

    await skills.buildSkillInjectionPlanAsync({ profile: 'assistant' });
    await skills.buildSkillInventoryAsync({ profile: 'assistant' });
    await skills.setSkillEnabled('skill-a', true);
    await skills.writeMergedMcpConfigFile({ outputPath: '/tmp/mcp.json' });

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(1, '../../skills/skillInventory.js', 'buildSkillInjectionPlanAsync', {
      profile: 'assistant',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../skills/skillInventory.js', 'buildSkillInventoryAsync', {
      profile: 'assistant',
    });
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      3,
      '../../skills/skillInventory.js',
      'setSkillEnabled',
      'skill-a',
      true,
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(4, '@neon-pilot/core', 'writeMergedMcpConfigFile', {
      outputPath: '/tmp/mcp.json',
    });
  });
});
