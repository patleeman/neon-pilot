import { describe, expect, it, vi } from 'vitest';

const { buildSkillInjectionPlanAsyncMock, callServerModuleExportMock, refreshRegisteredSkillRuntimeResourcesMock } = vi.hoisted(() => ({
  buildSkillInjectionPlanAsyncMock: vi.fn(async () => ({ skillPaths: ['/skills/current'], inlineSkills: [], diagnostics: [] })),
  callServerModuleExportMock: vi.fn(async () => ({ bundledServerCount: 1 })),
  refreshRegisteredSkillRuntimeResourcesMock: vi.fn(),
}));

vi.mock('../skills/skillInventory.js', () => ({
  buildSkillInjectionPlanAsync: buildSkillInjectionPlanAsyncMock,
}));

vi.mock('../app/runtimeState.js', () => ({
  refreshRegisteredSkillRuntimeResources: refreshRegisteredSkillRuntimeResourcesMock,
}));

vi.mock('./backendApi/serverModuleResolver.js', () => ({
  callServerModuleExport: callServerModuleExportMock,
}));

import { refreshHostSkillMcpConfig } from './extensionRuntimeCapability.js';

describe('refreshHostSkillMcpConfig', () => {
  it('writes fresh skill MCP config and invalidates runtime skill resources', async () => {
    await expect(refreshHostSkillMcpConfig({ runtimeScope: 'shared', repoRoot: '/repo', runtimeDir: '/runtime' })).resolves.toEqual({
      mcpConfigPath: '/runtime/mcp_servers.json',
    });

    expect(buildSkillInjectionPlanAsyncMock).toHaveBeenCalledWith({ runtimeScope: 'shared', repoRoot: '/repo' });
    expect(callServerModuleExportMock).toHaveBeenCalledWith(
      '@neon-pilot/core',
      'writeMergedMcpConfigFile',
      expect.objectContaining({
        outputPath: '/runtime/mcp_servers.json',
        skillDirs: ['/skills/current'],
      }),
    );
    expect(refreshRegisteredSkillRuntimeResourcesMock).toHaveBeenCalledWith({ runtimeScope: 'shared', runtimeDir: '/runtime' });
  });
});
