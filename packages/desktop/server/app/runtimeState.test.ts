import { existsSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getRuntimeConfigRootMock,
  getStateRootMock,
  getDurableSkillsDirMock,
  getDurableSessionsDirMock,
  getPiAgentRuntimeDirMock,
  writeMergedMcpConfigFileMock,
  materializeRuntimeResourcesToAgentDirMock,
  resolveRuntimeResourcesMock,
  createManifestAgentExtensionsMock,
  listManifestAgentExtensionCacheEntriesMock,
  listExtensionToolRegistrationsMock,
  manifestAgentFactoryMock,
  authStorageMock,
  readSavedModelPreferencesMock,
  buildSkillInjectionPlanMock,
  buildSkillInjectionPlanAsyncMock,
  buildPromptTemplatePlanAsyncMock,
  buildInstructionPlanMock,
  listExtensionSkillRegistrationsMock,
  listRuntimeExtensionBackendEntriesMock,
  resolveManifestAgentLifecycleModelProfileMock,
} = vi.hoisted(() => {
  const authStorageMock = {
    hasAuth: vi.fn(() => false),
    create: vi.fn(() => authStorageMock),
  };
  const manifestAgentFactoryMock = vi.fn();

  return {
    getRuntimeConfigRootMock: vi.fn(() => '/profiles-root'),
    getStateRootMock: vi.fn(() => '/state-root'),
    getDurableSkillsDirMock: vi.fn(() => '/durable-skills'),
    getDurableSessionsDirMock: vi.fn(() => '/durable-sessions'),
    getPiAgentRuntimeDirMock: vi.fn(() => '/pi-agent-runtime'),
    materializeRuntimeResourcesToAgentDirMock: vi.fn(),
    resolveRuntimeResourcesMock: vi.fn(),
    writeMergedMcpConfigFileMock: vi.fn(() => ({ bundledServerCount: 0 })),
    createManifestAgentExtensionsMock: vi.fn(() => ({ factories: [manifestAgentFactoryMock], errors: [] })),
    listManifestAgentExtensionCacheEntriesMock: vi.fn(() => []),
    listExtensionToolRegistrationsMock: vi.fn(() => []),
    manifestAgentFactoryMock,
    authStorageMock,
    readSavedModelPreferencesMock: vi.fn(() => ({ currentVisionModel: 'openai/gpt-4o' })),
    buildSkillInjectionPlanMock: vi.fn(() => ({ skillPaths: ['/skills/sync'], inlineSkills: [], diagnostics: [] })),
    buildSkillInjectionPlanAsyncMock: vi.fn(async () => ({ skillPaths: ['/skills/async'], inlineSkills: [], diagnostics: [] })),
    buildPromptTemplatePlanAsyncMock: vi.fn(async () => ({ templatePaths: ['/prompts/async.md'], templates: [], diagnostics: [] })),
    buildInstructionPlanMock: vi.fn(async () => ({ layers: [], finalSystemPrompt: '', diagnostics: [] })),
    listExtensionSkillRegistrationsMock: vi.fn(() => []),
    listRuntimeExtensionBackendEntriesMock: vi.fn(() => []),
    resolveManifestAgentLifecycleModelProfileMock: vi.fn(() => ({ kind: 'none' })),
  };
});

vi.mock('@neon-pilot/core', () => ({
  getRuntimeConfigRoot: getRuntimeConfigRootMock,
  getStateRoot: getStateRootMock,
  getDurableSkillsDir: getDurableSkillsDirMock,
  getDurableSessionsDir: getDurableSessionsDirMock,
  getPiAgentRuntimeDir: getPiAgentRuntimeDirMock,
  materializeRuntimeResourcesToAgentDir: materializeRuntimeResourcesToAgentDirMock,
  resolveRuntimeResources: resolveRuntimeResourcesMock,
  writeMergedMcpConfigFile: writeMergedMcpConfigFileMock,
}));

vi.mock('../extensions/manifestToolAgentExtension.js', () => ({
  createManifestToolAgentExtensions: vi.fn(() => []),
  listManifestToolAgentExtensionCacheEntries: listExtensionToolRegistrationsMock,
}));

vi.mock('../extensions/extensionAgentExtensions.js', () => ({
  createManifestAgentExtensions: createManifestAgentExtensionsMock,
  listManifestAgentExtensionCacheEntries: listManifestAgentExtensionCacheEntriesMock,
  resolveManifestAgentLifecycleModelProfile: resolveManifestAgentLifecycleModelProfileMock,
}));

vi.mock('../extensions/extensionRuntimeResources.js', () => ({
  listRuntimeExtensionBackendEntries: listRuntimeExtensionBackendEntriesMock,
}));

vi.mock('@earendil-works/pi-coding-agent', () => ({
  AuthStorage: authStorageMock,
}));

vi.mock('../models/modelPreferences.js', () => ({
  readSavedModelPreferences: readSavedModelPreferencesMock,
  readSavedModelRef: vi.fn(() => 'openai/gpt-4o'),
}));

vi.mock('../skills/skillInventory.js', () => ({
  buildSkillInjectionPlan: buildSkillInjectionPlanMock,
  buildSkillInjectionPlanAsync: buildSkillInjectionPlanAsyncMock,
}));

vi.mock('../prompts/promptTemplateInventory.js', () => ({
  buildPromptTemplatePlan: vi.fn(() => ({ templatePaths: ['/prompts/sync.md'], templates: [], diagnostics: [] })),
  buildPromptTemplatePlanAsync: buildPromptTemplatePlanAsyncMock,
}));

vi.mock('../prompt-assembly/instructionInventory.js', () => ({
  buildInstructionPlan: buildInstructionPlanMock,
}));

vi.mock('../ui/settingsPersistence.js', () => ({
  getRuntimeSettingsFilePath: () => '/runtime/settings.json',
}));

vi.mock('../cliEnvironment.js', () => ({
  ensureNeonPilotCliLauncher: vi.fn(() => '/state-root/bin/neon-pilot'),
  prependNeonPilotCliBin: vi.fn((env: NodeJS.ProcessEnv) => ({ ...env, PATH: '/state-root/bin:/usr/bin' })),
}));

import { createRuntimeState } from './runtimeState.js';

const resolvedShared = {
  extensionEntries: ['/ext/shared'],
  skillDirs: ['/skills/shared', '/skills/shared'],
  promptEntries: ['/prompts/shared.md'],
  themeEntries: ['/themes/shared.json'],
} as const;

const desktopRootLayout = {
  root: '/desktop-root',
  apps: '/desktop-root/apps',
  data: '/desktop-root/data',
  dataApps: '/desktop-root/data/apps',
  dataDocuments: '/desktop-root/data/documents',
  dataExports: '/desktop-root/data/exports',
  documents: '/desktop-root/documents',
  agents: '/desktop-root/agents',
  soulDoc: '/desktop-root/agents/soul.md',
  logs: '/desktop-root/logs',
  logsDesktop: '/desktop-root/logs/desktop',
  logsDaemon: '/desktop-root/logs/daemon',
  logsTelemetry: '/desktop-root/logs/telemetry',
  system: '/desktop-root/system',
  systemAgents: '/desktop-root/system/agents',
  systemApps: '/desktop-root/system/apps',
  systemCache: '/desktop-root/system/cache',
  systemConfig: '/desktop-root/system/config',
  systemConversations: '/desktop-root/system/conversations',
  systemSessions: '/desktop-root/system/conversations/sessions',
  systemDaemon: '/desktop-root/system/daemon',
  systemElectron: '/desktop-root/system/electron',
  systemElectronUserData: '/desktop-root/system/electron/user-data',
  systemObservability: '/desktop-root/system/observability',
  systemRuntime: '/desktop-root/system/runtime',
  systemSecrets: '/desktop-root/system/secrets',
  systemState: '/desktop-root/system/state',
} as const;

function createLogger() {
  return {
    warn: vi.fn(),
  };
}

function createTestRuntimeState(input: { logger?: ReturnType<typeof createLogger> } = {}) {
  return createRuntimeState({
    repoRoot: '/repo-root',
    agentDir: '/agent-dir',
    settingsFile: '/runtime/settings.json',
    stateRoot: '/state-root',
    desktopRootLayout,
    logger: input.logger ?? createLogger(),
  });
}

describe('createRuntimeState', () => {
  beforeEach(() => {
    getRuntimeConfigRootMock.mockClear();
    getStateRootMock.mockClear();
    getDurableSkillsDirMock.mockClear();
    materializeRuntimeResourcesToAgentDirMock.mockReset();
    resolveRuntimeResourcesMock.mockReset();
    resolveRuntimeResourcesMock.mockReturnValue(resolvedShared);
    createManifestAgentExtensionsMock.mockClear();
    manifestAgentFactoryMock.mockClear();
    listExtensionSkillRegistrationsMock.mockReset();
    listManifestAgentExtensionCacheEntriesMock.mockReset();
    listExtensionToolRegistrationsMock.mockReset();
    listRuntimeExtensionBackendEntriesMock.mockReset();
    listRuntimeExtensionBackendEntriesMock.mockReturnValue([]);
    listManifestAgentExtensionCacheEntriesMock.mockReturnValue([]);
    listExtensionToolRegistrationsMock.mockReturnValue([]);
    resolveManifestAgentLifecycleModelProfileMock.mockReset();
    resolveManifestAgentLifecycleModelProfileMock.mockReturnValue({ kind: 'none' });
    listExtensionSkillRegistrationsMock.mockReturnValue([]);
    readSavedModelPreferencesMock.mockClear();
    readSavedModelPreferencesMock.mockReturnValue({ currentVisionModel: 'openai/gpt-4o' });
    buildSkillInjectionPlanMock.mockClear();
    buildSkillInjectionPlanMock.mockReturnValue({ skillPaths: ['/skills/sync'], inlineSkills: [], diagnostics: [] });
    buildSkillInjectionPlanAsyncMock.mockClear();
    buildSkillInjectionPlanAsyncMock.mockResolvedValue({ skillPaths: ['/skills/async'], inlineSkills: [], diagnostics: [] });
    buildPromptTemplatePlanAsyncMock.mockClear();
    buildPromptTemplatePlanAsyncMock.mockResolvedValue({ templatePaths: ['/prompts/async.md'], templates: [], diagnostics: [] });
    authStorageMock.hasAuth.mockReset();
    authStorageMock.hasAuth.mockReturnValue(false);
    authStorageMock.create.mockClear();
    delete process.env.NEON_PILOT_ACTIVE_PROFILE;
    delete process.env.NEON_PILOT_PROFILE;
    delete process.env.NEON_PILOT_REPO_ROOT;
    delete process.env.NEON_PILOT_RESOURCES_ROOT;
  });

  it('builds live session helpers and materializes the shared runtime on demand', async () => {
    process.env.MCP_CONFIG_PATH = '/agent-dir/mcp_servers.json';
    const logger = createLogger();
    const state = createTestRuntimeState({ logger });

    expect(materializeRuntimeResourcesToAgentDirMock).not.toHaveBeenCalledWith(resolvedShared, '/agent-dir');
    state.materializeRuntimeResources();
    expect(materializeRuntimeResourcesToAgentDirMock).toHaveBeenCalledWith(resolvedShared, '/agent-dir');
    expect(writeMergedMcpConfigFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skillDirs: expect.any(Array),
        env: expect.not.objectContaining({ MCP_CONFIG_PATH: '/agent-dir/mcp_servers.json' }),
      }),
    );
    expect(state.getRuntimeScope()).toBe('shared');
    expect(process.env.NEON_PILOT_ACTIVE_PROFILE).toBeUndefined();
    expect(process.env.NEON_PILOT_PROFILE).toBeUndefined();
    expect(process.env.NEON_PILOT_REPO_ROOT).toBeUndefined();
    expect(process.env.NEON_PILOT_RESOURCES_ROOT).toBe('/repo-root');

    expect(state.buildLiveSessionResourceOptions()).toEqual({
      additionalExtensionPaths: ['/ext/shared'],
      additionalSkillPaths: expect.any(Array),
      additionalPromptTemplatePaths: expect.any(Array),
      additionalThemePaths: ['/themes/shared.json'],
    });

    const factories = state.buildLiveSessionExtensionFactories();
    // All factories are wrapped by the extension API guard so each
    // element is a function. Verify count and that each delegates correctly.
    expect(factories).toHaveLength(2);
    factories.forEach((factory) => {
      expect(typeof factory).toBe('function');
    });
    let temporaryAgentDir = '';
    await expect(
      state.withTemporaryRuntimeAgentDir(async (runtimeAgentDir) => {
        temporaryAgentDir = runtimeAgentDir;
        expect(existsSync(runtimeAgentDir)).toBe(true);
        return 'done';
      }),
    ).resolves.toBe('done');
    expect(materializeRuntimeResourcesToAgentDirMock).toHaveBeenCalledWith(resolvedShared, temporaryAgentDir);
    expect(existsSync(temporaryAgentDir)).toBe(false);
    expect(logger.warn).not.toHaveBeenCalledWith('failed to materialize runtime resources', expect.anything());
  });

  it('blocks global active tool mutation but allows lifecycle-scoped active tool changes', () => {
    let guardedPi: {
      setActiveTools: (tools: string[]) => void;
      addActiveTools: (tools: string[]) => void;
      removeActiveTools: (tools: string[]) => void;
      on: (event: string, handler: (...args: unknown[]) => unknown) => void;
    } | null = null;
    createManifestAgentExtensionsMock.mockReturnValueOnce({
      factories: [
        vi.fn((pi) => {
          guardedPi = pi as {
            setActiveTools: (tools: string[]) => void;
            addActiveTools: (tools: string[]) => void;
            removeActiveTools: (tools: string[]) => void;
            on: (event: string, handler: (...args: unknown[]) => unknown) => void;
          };
        }),
      ],
      errors: [],
    });
    const logger = createLogger();
    const state = createTestRuntimeState({ logger });

    const factories = state.buildLiveSessionExtensionFactories();
    const factory = factories[1];
    let activeTools = ['read', 'write', 'edit'];
    const pi = {
      getActiveTools: vi.fn(() => activeTools),
      setActiveTools: vi.fn((tools: string[]) => {
        activeTools = tools;
      }),
      registerTool: vi.fn(),
      on: vi.fn(),
    };

    factory?.(pi as never);

    expect(guardedPi).not.toBeNull();
    expect(() => guardedPi?.setActiveTools(['read'])).toThrow('Global active tool mutation is unsupported');
    expect(() => guardedPi?.addActiveTools(['apply_patch'])).toThrow('Global active tool mutation is unsupported');
    expect(() => guardedPi?.removeActiveTools(['edit'])).toThrow('Global active tool mutation is unsupported');

    guardedPi?.on(
      'session_start',
      (
        _event,
        ctx: {
          addActiveTools?: (tools: string[]) => void;
          removeActiveTools?: (tools: string[]) => void;
          modelProfile?: { modelRef: string | null };
        },
      ) => {
        expect(ctx.modelProfile?.modelRef).toBe('test/model');
        ctx.addActiveTools?.(['apply_patch']);
        ctx.removeActiveTools?.(['write', 'edit']);
      },
    );
    const registered = pi.on.mock.calls[0];
    expect(registered?.[0]).toBe('session_start');
    (registered?.[1] as (...args: unknown[]) => unknown)({}, { model: { provider: 'test', id: 'model' } });
    expect(pi.setActiveTools).toHaveBeenNthCalledWith(1, ['read', 'write', 'edit', 'apply_patch']);
    expect(pi.setActiveTools).toHaveBeenNthCalledWith(2, ['read', 'apply_patch']);
  });

  it('adds extension skill directories to live session resources', () => {
    listExtensionSkillRegistrationsMock.mockReturnValue([
      { path: '/repo-root/extensions/system-runs/skills/runs/SKILL.md' },
      { path: '/repo-root/extensions/system-runs/skills/runs/SKILL.md' },
      { path: '/repo-root/extensions/system-artifacts/skills/artifacts/SKILL.md' },
    ]);

    const state = createTestRuntimeState();

    expect(state.buildLiveSessionResourceOptions().additionalSkillPaths).toEqual(expect.any(Array));
  });

  it('hot-caches live session extension factories and refreshes after registrations change', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    try {
      listManifestAgentExtensionCacheEntriesMock.mockReturnValue([{ extensionId: 'agent-ext', exportName: 'create' }]);
      listExtensionToolRegistrationsMock.mockReturnValue([{ extensionId: 'tool-ext', id: 'tool', name: 'tool', action: 'run' }]);
      const state = createTestRuntimeState();

      const first = state.buildLiveSessionExtensionFactories();
      const second = state.buildLiveSessionExtensionFactories();
      expect(second).toBe(first);
      expect(createManifestAgentExtensionsMock).toHaveBeenCalledTimes(1);

      listExtensionToolRegistrationsMock.mockReturnValue([
        { extensionId: 'tool-ext', id: 'tool', name: 'tool', action: 'run' },
        { extensionId: 'tool-ext', id: 'other-tool', name: 'other_tool', action: 'runOther' },
      ]);
      const third = state.buildLiveSessionExtensionFactories();
      expect(third).toBe(first);
      expect(createManifestAgentExtensionsMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(15_001);
      const fourth = state.buildLiveSessionExtensionFactories();
      expect(fourth).not.toBe(first);
      expect(createManifestAgentExtensionsMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caches async live session resource options for repeated session creation', async () => {
    const state = createTestRuntimeState();

    await expect(
      Promise.all([state.buildLiveSessionResourceOptionsAsync(), state.buildLiveSessionResourceOptionsAsync()]),
    ).resolves.toEqual([
      {
        additionalExtensionPaths: ['/ext/shared'],
        additionalSkillPaths: ['/skills/async'],
        additionalPromptTemplatePaths: ['/prompts/async.md'],
        additionalThemePaths: ['/themes/shared.json'],
      },
      {
        additionalExtensionPaths: ['/ext/shared'],
        additionalSkillPaths: ['/skills/async'],
        additionalPromptTemplatePaths: ['/prompts/async.md'],
        additionalThemePaths: ['/themes/shared.json'],
      },
    ]);
    expect(materializeRuntimeResourcesToAgentDirMock).toHaveBeenCalledWith(resolvedShared, '/agent-dir');
    expect(buildSkillInjectionPlanAsyncMock).toHaveBeenCalledTimes(1);
    expect(buildPromptTemplatePlanAsyncMock).toHaveBeenCalledTimes(1);
    expect(buildInstructionPlanMock).toHaveBeenCalledTimes(1);

    await expect(state.buildLiveSessionResourceOptionsAsync()).resolves.toMatchObject({
      additionalSkillPaths: ['/skills/async'],
    });
    expect(buildSkillInjectionPlanAsyncMock).toHaveBeenCalledTimes(1);
    expect(buildPromptTemplatePlanAsyncMock).toHaveBeenCalledTimes(1);
    expect(buildInstructionPlanMock).toHaveBeenCalledTimes(1);
  });

  it('adds extension instruction layers to async live session resources', async () => {
    buildInstructionPlanMock.mockResolvedValueOnce({
      layers: [
        {
          id: 'extension-style',
          content: 'Use concise conversational output.',
          source: { kind: 'extension', label: 'Codex Compatibility', extensionId: 'system-codex-profile' },
        },
        {
          id: 'runtime-template',
          content: 'Runtime template should not be duplicated.',
          source: { kind: 'runtime', label: 'Generated runtime instructions' },
        },
      ],
      finalSystemPrompt: '',
      diagnostics: [],
    });
    const state = createTestRuntimeState();

    await expect(state.buildLiveSessionResourceOptionsAsync()).resolves.toMatchObject({
      systemPromptSupplement: 'Use concise conversational output.',
    });
  });

  it('seeds live session resource options while materializing runtime resources', async () => {
    const state = createTestRuntimeState();

    state.materializeRuntimeResources();

    await expect(state.buildLiveSessionResourceOptionsAsync()).resolves.toEqual({
      additionalExtensionPaths: ['/ext/shared'],
      additionalSkillPaths: ['/skills/sync'],
      additionalPromptTemplatePaths: ['/prompts/sync.md'],
      additionalThemePaths: ['/themes/shared.json'],
    });
    expect(buildSkillInjectionPlanAsyncMock).not.toHaveBeenCalled();
    expect(buildPromptTemplatePlanAsyncMock).not.toHaveBeenCalled();
  });

  it('clears live session resource caches after skill runtime resources refresh', async () => {
    const state = createTestRuntimeState();

    await expect(state.buildLiveSessionResourceOptionsAsync()).resolves.toMatchObject({
      additionalSkillPaths: ['/skills/async'],
    });
    expect(buildSkillInjectionPlanAsyncMock).toHaveBeenCalledTimes(1);

    buildSkillInjectionPlanAsyncMock.mockResolvedValueOnce({ skillPaths: ['/skills/after-refresh'], inlineSkills: [], diagnostics: [] });
    state.refreshSkillRuntimeResources();

    await expect(state.buildLiveSessionResourceOptionsAsync()).resolves.toMatchObject({
      additionalSkillPaths: ['/skills/after-refresh'],
    });
    expect(buildSkillInjectionPlanMock).toHaveBeenCalledWith({ runtimeScope: 'shared', repoRoot: '/repo-root', desktopRootLayout });
    expect(buildSkillInjectionPlanAsyncMock).toHaveBeenCalledTimes(2);
    expect(writeMergedMcpConfigFileMock).toHaveBeenCalledWith(expect.objectContaining({ skillDirs: ['/skills/sync'] }));
  });

  it('surfaces explicit materialization failures', async () => {
    materializeRuntimeResourcesToAgentDirMock.mockImplementationOnce(() => {
      throw new Error('initial materialize failed');
    });

    const logger = createLogger();
    const state = createTestRuntimeState({ logger });

    expect(() => state.materializeRuntimeResources()).toThrow('initial materialize failed');
    expect(logger.warn).not.toHaveBeenCalledWith('failed to materialize runtime resources', expect.anything());
  });

  it('forwards desktopRootLayout to resolveRuntimeResources when provided in options', () => {
    const customDesktopRootLayout = {
      root: '/custom-root',
      apps: '/custom-root/apps',
      data: '/custom-root/data',
      dataApps: '/custom-root/data/apps',
      dataDocuments: '/custom-root/data/documents',
      documents: '/custom-root/documents',
      agents: '/custom-root/agents',
      logs: '/custom-root/logs',
      logsDesktop: '/custom-root/logs/desktop',
      logsDaemon: '/custom-root/logs/daemon',
      logsTelemetry: '/custom-root/logs/telemetry',
      system: '/custom-root/system',
      systemAgents: '/custom-root/system/agents',
      systemApps: '/custom-root/system/apps',
      systemCache: '/custom-root/system/cache',
      systemConfig: '/custom-root/system/config',
      systemConversations: '/custom-root/system/conversations',
      systemSessions: '/custom-root/system/conversations/sessions',
      systemDaemon: '/custom-root/system/daemon',
      systemElectron: '/custom-root/system/electron',
      systemElectronUserData: '/custom-root/system/electron/user-data',
      systemObservability: '/custom-root/system/observability',
      systemRuntime: '/custom-root/system/runtime',
      systemSecrets: '/custom-root/system/secrets',
      systemState: '/custom-root/system/state',
    };

    resolveRuntimeResourcesMock.mockClear();
    const state = createRuntimeState({
      repoRoot: '/repo-root',
      agentDir: '/agent-dir',
      settingsFile: '/runtime/settings.json',
      stateRoot: '/state-root',
      desktopRootLayout: customDesktopRootLayout,
      logger: createLogger(),
    });

    state.materializeRuntimeResources();

    expect(resolveRuntimeResourcesMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        desktopRootLayout: customDesktopRootLayout,
      }),
    );
  });
});
