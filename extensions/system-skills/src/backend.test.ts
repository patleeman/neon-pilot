import { beforeEach, describe, expect, it, vi } from 'vitest';

const writeMergedMcpConfigFile = vi.fn();
const buildSkillInjectionPlanAsync = vi.fn();
const buildSkillInventoryAsync = vi.fn();
const setSkillEnabled = vi.fn();

vi.mock('@neon-pilot/core', () => ({ writeMergedMcpConfigFile }));
vi.mock(
  '@neon-pilot/extensions/backend/skills',
  () => ({
    buildSkillInjectionPlanAsync,
    buildSkillInventoryAsync,
    setSkillEnabled,
  }),
  { virtual: true },
);

const { listSkills, updateSkillEnabled } = await import('./backend.js');

describe('system-skills backend', () => {
  const ctx = { runtimeScope: 'scope', profile: 'profile', runtimeDir: '/runtime' } as never;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MCP_CONFIG_PATH;
    buildSkillInventoryAsync.mockReset().mockResolvedValue([
      {
        id: 'vault-skill',
        title: 'Vault Skill',
        description: 'From vault',
        location: { kind: 'file', path: '/vault/skills/a/SKILL.md' },
        source: { kind: 'knowledge', label: 'Vault', extensionId: 'system-knowledge' },
        enabled: true,
        diagnostics: [],
      },
      {
        id: 'project-skill',
        title: 'Project Skill',
        description: 'From project',
        source: { kind: 'configured-folder', label: 'Project' },
        enabled: false,
        diagnostics: [{ severity: 'warning' }],
      },
    ]);
    buildSkillInjectionPlanAsync.mockReset().mockResolvedValue({ skillPaths: ['/vault/skills/a'] });
    setSkillEnabled.mockReset();
    writeMergedMcpConfigFile.mockReset().mockReturnValue({ bundledServerCount: 1 });
  });

  it('lists normalized skills for the current runtime scope', async () => {
    await expect(listSkills({}, ctx)).resolves.toEqual({
      ok: true,
      skills: [
        {
          id: 'vault-skill',
          name: 'Vault Skill',
          description: 'From vault',
          path: '/vault/skills/a/SKILL.md',
          source: 'vault',
          sourceLabel: 'Vault',
          extensionId: 'system-knowledge',
          enabled: true,
          diagnostics: [],
        },
        {
          id: 'project-skill',
          name: 'Project Skill',
          description: 'From project',
          path: '',
          source: 'project',
          sourceLabel: 'Project',
          extensionId: undefined,
          enabled: false,
          diagnostics: [{ severity: 'warning' }],
        },
      ],
    });
    expect(buildSkillInventoryAsync).toHaveBeenCalledWith({ runtimeScope: 'scope', repoRoot: process.cwd() });
  });

  it('updates skill enabled state and writes merged MCP config', async () => {
    await expect(updateSkillEnabled({ id: ' skill-a ', enabled: false }, ctx)).resolves.toEqual({
      ok: true,
      id: 'skill-a',
      enabled: false,
    });

    expect(setSkillEnabled).toHaveBeenCalledWith('skill-a', false);
    expect(writeMergedMcpConfigFile).toHaveBeenCalledWith({
      outputPath: '/runtime/mcp_servers.json',
      cwd: process.cwd(),
      env: expect.not.objectContaining({ MCP_CONFIG_PATH: '/runtime/mcp_servers.json' }),
      skillDirs: ['/vault/skills/a'],
    });
    expect(process.env.MCP_CONFIG_PATH).toBe('/runtime/mcp_servers.json');
  });

  it('defaults enabled to true, validates id, and clears MCP_CONFIG_PATH when no bundled servers exist', async () => {
    writeMergedMcpConfigFile.mockReturnValue({ bundledServerCount: 0 });
    process.env.MCP_CONFIG_PATH = '/runtime/mcp_servers.json';

    await expect(updateSkillEnabled({ id: 'skill-a' }, ctx)).resolves.toMatchObject({ enabled: true });
    expect(process.env.MCP_CONFIG_PATH).toBeUndefined();
    await expect(updateSkillEnabled({ id: '   ' }, ctx)).rejects.toThrow('skill id is required');
  });
});
