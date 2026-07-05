import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listExtensionInstallSummaries: vi.fn(),
  buildMergedMcpConfigDocument: vi.fn(),
  readBundledSkillMcpManifests: vi.fn(),
  readMcpConfigDocument: vi.fn(),
  buildInstructionPlan: vi.fn(),
  buildPromptAssemblyPlanAsync: vi.fn(),
  buildPromptTemplatePlanAsync: vi.fn(),
  buildToolInjectionPlanAsync: vi.fn(),
  buildSkillInventoryAsync: vi.fn(),
  setSkillEnabled: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/extensions', () => ({
  listExtensionInstallSummaries: mocks.listExtensionInstallSummaries,
}));

vi.mock('@neon-pilot/extensions/backend/mcp', () => ({
  buildMergedMcpConfigDocument: mocks.buildMergedMcpConfigDocument,
  readBundledSkillMcpManifests: mocks.readBundledSkillMcpManifests,
  readMcpConfigDocument: mocks.readMcpConfigDocument,
}));

vi.mock('@neon-pilot/extensions/backend/promptAssembly', () => ({
  buildInstructionPlan: mocks.buildInstructionPlan,
  buildPromptAssemblyPlanAsync: mocks.buildPromptAssemblyPlanAsync,
  buildPromptTemplatePlanAsync: mocks.buildPromptTemplatePlanAsync,
  buildToolInjectionPlanAsync: mocks.buildToolInjectionPlanAsync,
}));

vi.mock('@neon-pilot/extensions/backend/skills', () => ({
  buildSkillInventoryAsync: mocks.buildSkillInventoryAsync,
  setSkillEnabled: mocks.setSkillEnabled,
}));

const { inspectAgentRuntime, updateRuntimeCapability, updateSkillEnabled } = await import('./backend.js');

describe('system-prompt-assembly backend', () => {
  const setEnabled = vi.fn();
  const invalidate = vi.fn();
  const refreshSkillMcpConfig = vi.fn();
  const ctx = {
    runtimeScope: 'runtime-scope',
    runtime: {
      getRepoRoot: () => '/repo',
      getLiveSessionResourceOptions: () => ({ cwd: '/repo/workspace', additionalSkillPaths: ['/skills'] }),
      refreshSkillMcpConfig,
    },
    extensions: { setEnabled },
    ui: { invalidate },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildPromptAssemblyPlanAsync.mockResolvedValue({
      context: { blocks: [{ title: 'Pinned file' }, { kind: 'workspace' }] },
      diagnostics: [{ severity: 'warning', message: 'plan warning' }],
    });
    mocks.buildSkillInventoryAsync.mockResolvedValue([
      {
        id: 'skill-a',
        title: 'Skill A',
        description: 'Useful skill',
        source: { kind: 'configured-folder', extensionId: 'system-skill-search' },
        enabled: true,
        priority: 20,
        providerId: 'skills',
        location: { kind: 'file', path: '/skills/a/SKILL.md' },
        diagnostics: [],
      },
    ]);
    mocks.buildToolInjectionPlanAsync.mockResolvedValue({
      tools: [
        {
          id: 'tool-a',
          name: 'tool_a',
          title: 'Tool A',
          description: 'Useful tool',
          source: { extensionId: 'system-tools' },
          enabled: true,
          active: false,
          priority: 10,
          providerId: 'tools',
          action: 'runTool',
          diagnostics: [],
        },
      ],
    });
    mocks.buildPromptTemplatePlanAsync.mockResolvedValue({
      templates: [
        {
          id: 'template-a',
          title: 'Template A',
          enabled: false,
          source: { extensionId: 'system-prompt-assembly' },
          location: '/templates/a.md',
          diagnostics: [],
        },
      ],
    });
    mocks.buildInstructionPlan.mockResolvedValue({
      layers: [
        {
          id: 'instruction-a',
          providerId: 'repo',
          title: 'Repo instructions',
          source: { extensionId: 'system-prompt-assembly' },
          scope: 'workspace',
          priority: 5,
          risk: 'low',
          mutable: false,
          content: 'Use tests.',
          diagnostics: [{ severity: 'error', message: 'bad instruction' }],
        },
        {
          id: 'runtime-template',
          providerId: 'runtime-template',
          title: 'Runtime template',
          source: { extensionId: 'system-prompt-assembly' },
          content: 'hidden',
        },
      ],
    });
    mocks.listExtensionInstallSummaries.mockResolvedValue([
      {
        id: 'system-required',
        name: 'Required Extension',
        enabled: true,
        required: true,
        packageType: 'system',
        manifest: { contributes: { views: [{ location: 'main' }] }, backend: { agentExtension: 'default' } },
      },
      {
        id: 'user-extension',
        name: 'User Extension',
        enabled: false,
        packageType: 'user',
        manifest: { contributes: {} },
      },
    ]);
    mocks.buildMergedMcpConfigDocument.mockResolvedValue({
      baseConfigPath: '/repo/.mcp.json',
      baseConfigExists: true,
      searchedPaths: ['/repo/.mcp.json'],
      document: { mcpServers: { configured: {}, bundled: {} } },
      baseServerNames: ['configured'],
    });
    mocks.readBundledSkillMcpManifests.mockResolvedValue([
      { skillName: 'Skill A', skillDir: '/skills/a', manifestPath: '/skills/a/mcp.json', serverNames: ['bundled'] },
    ]);
    mocks.readMcpConfigDocument.mockResolvedValue({
      path: '/repo/.mcp.json',
      searchedPaths: ['/repo/.mcp.json'],
      servers: [
        { name: 'configured', transport: 'stdio', command: 'node' },
        { name: 'bundled', transport: 'http', url: 'http://localhost:3000', oauthClientInfo: {} },
      ],
    });
  });

  it('refreshes skill MCP config after direct skill toggles', async () => {
    await expect(updateSkillEnabled({ id: ' skill-a ', enabled: false }, ctx)).resolves.toEqual({
      ok: true,
      id: 'skill-a',
      enabled: false,
    });

    expect(mocks.setSkillEnabled).toHaveBeenCalledWith('skill-a', false);
    expect(refreshSkillMcpConfig).toHaveBeenCalledOnce();
  });

  it('refreshes skill MCP config after runtime skill capability toggles', async () => {
    await expect(updateRuntimeCapability({ id: 'skill-a', kind: 'skill', enabled: false }, ctx)).resolves.toEqual({
      ok: true,
      id: 'skill-a',
      kind: 'skill',
      enabled: false,
    });

    expect(mocks.setSkillEnabled).toHaveBeenCalledWith('skill-a', false);
    expect(refreshSkillMcpConfig).toHaveBeenCalledOnce();
  });

  it('aggregates runtime capabilities from public backend seams', async () => {
    const result = await inspectAgentRuntime({ modelRef: 'model-a' }, ctx);

    expect(mocks.buildPromptAssemblyPlanAsync).toHaveBeenCalledWith({
      runtimeScope: 'runtime-scope',
      repoRoot: '/repo',
      cwd: '/repo/workspace',
      modelRef: 'model-a',
    });
    expect(result).toMatchObject({
      ok: true,
      runtimeScope: 'runtime-scope',
      repoRoot: '/repo',
      cwd: '/repo/workspace',
      counts: {
        extension: 2,
        instruction: 1,
        skill: 1,
        tool: 1,
        'prompt-template': 1,
        'mcp-server': 2,
        context: 2,
      },
    });
    expect(result.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'instruction-a', kind: 'instruction', status: 'error' }),
        expect.objectContaining({ id: 'mcp:configured', kind: 'mcp-server', source: expect.objectContaining({ kind: 'config' }) }),
        expect.objectContaining({
          id: 'mcp:bundled',
          kind: 'mcp-server',
          source: expect.objectContaining({ kind: 'skill', root: '/skills/a/mcp.json' }),
          metadata: expect.objectContaining({ hasOAuth: true, skillName: 'Skill A' }),
        }),
        expect.objectContaining({ id: 'context:0', kind: 'context', title: 'Pinned file' }),
      ]),
    );
    expect(result.diagnostics).toEqual([{ severity: 'warning', message: 'plan warning' }]);
  });

  it('rejects disabling required extensions and toggles non-required extensions', async () => {
    await expect(updateRuntimeCapability({ id: 'system-required', kind: 'extension', enabled: false }, ctx)).rejects.toThrow(
      'Cannot disable system-required',
    );
    expect(setEnabled).not.toHaveBeenCalled();

    await expect(updateRuntimeCapability({ id: 'user-extension', kind: 'extension', enabled: true }, ctx)).resolves.toEqual({
      ok: true,
      id: 'user-extension',
      kind: 'extension',
      enabled: true,
    });
    expect(setEnabled).toHaveBeenCalledWith('user-extension', true);
    expect(invalidate).toHaveBeenCalledWith(['extensions']);
  });
});
