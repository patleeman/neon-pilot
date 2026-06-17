import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildSkillInventoryAsync = vi.fn();
const setSkillEnabled = vi.fn();

vi.mock(
  '@neon-pilot/extensions/backend/skills',
  () => ({
    buildSkillInventoryAsync,
    setSkillEnabled,
  }),
  { virtual: true },
);

const { listSkills, updateSkillEnabled } = await import('./backend.js');

describe('system-skills backend', () => {
  const refreshSkillMcpConfig = vi.fn();
  const ctx = {
    runtimeScope: 'scope',
    runtimeDir: '/runtime',
    runtime: { getRepoRoot: () => '/repo', refreshSkillMcpConfig },
  } as never;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MCP_CONFIG_PATH;
    buildSkillInventoryAsync.mockReset().mockResolvedValue([
      {
        id: 'knowledge-skill',
        title: 'Knowledge Skill',
        description: 'From knowledge',
        location: { kind: 'file', path: '/knowledge/skills/a/SKILL.md' },
        source: { kind: 'knowledge', label: 'Knowledge', extensionId: 'system-knowledge' },
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
    refreshSkillMcpConfig.mockReset();
    setSkillEnabled.mockReset();
  });

  it('lists normalized skills for the current runtime scope', async () => {
    await expect(listSkills({}, ctx)).resolves.toEqual({
      ok: true,
      skills: [
        {
          id: 'knowledge-skill',
          name: 'Knowledge Skill',
          description: 'From knowledge',
          path: '/knowledge/skills/a/SKILL.md',
          source: 'knowledge',
          sourceLabel: 'Knowledge',
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
    expect(buildSkillInventoryAsync).toHaveBeenCalledWith({ runtimeScope: 'scope', repoRoot: '/repo' });
  });

  it('updates skill enabled state and refreshes host-owned MCP config', async () => {
    await expect(updateSkillEnabled({ id: ' skill-a ', enabled: false }, ctx)).resolves.toEqual({
      ok: true,
      id: 'skill-a',
      enabled: false,
    });

    expect(setSkillEnabled).toHaveBeenCalledWith('skill-a', false);
    expect(refreshSkillMcpConfig).toHaveBeenCalledOnce();
  });

  it('defaults enabled to true and validates id', async () => {
    process.env.MCP_CONFIG_PATH = '/runtime/mcp_servers.json';

    await expect(updateSkillEnabled({ id: 'skill-a' }, ctx)).resolves.toMatchObject({ enabled: true });
    expect(process.env.MCP_CONFIG_PATH).toBe('/runtime/mcp_servers.json');
    await expect(updateSkillEnabled({ id: '   ' }, ctx)).rejects.toThrow('skill id is required');
  });
});
