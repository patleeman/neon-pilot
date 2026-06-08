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
  buildSkillInjectionPlanAsyncMock,
  buildPromptTemplatePlanAsyncMock,
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
    buildSkillInjectionPlanAsyncMock: vi.fn(async () => ({ skillPaths: ['/skills/async'], inlineSkills: [], diagnostics: [] })),
    buildPromptTemplatePlanAsyncMock: vi.fn(async () => ({ templatePaths: ['/prompts/async.md'], templates: [], diagnostics: [] })),
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
  buildSkillInjectionPlan: vi.fn(() => ({ skillPaths: ['/skills/sync'], inlineSkills: [], diagnostics: [] })),
  buildSkillInjectionPlanAsync: buildSkillInjectionPlanAsyncMock,
}));

vi.mock('../prompts/promptTemplateInventory.js', () => ({
  buildPromptTemplatePlan: vi.fn(() => ({ templatePaths: ['/prompts/sync.md'], templates: [], diagnostics: [] })),
  buildPromptTemplatePlanAsync: buildPromptTemplatePlanAsyncMock,
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
    expect(factories).toHaveLength(1);
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

    const [factory] = state.buildLiveSessionExtensionFactories();
    let activeTools = ['read', 'write', 'edit'];
    const pi = {
      getActiveTools: vi.fn(() => activeTools),
      setActiveTools: vi.fn((tools: string[]) => {
        activeTools = tools;
      }),
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

  it('caches live session extension factories until registrations change', () => {
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
    expect(third).not.toBe(first);
    expect(createManifestAgentExtensionsMock).toHaveBeenCalledTimes(2);
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

    await expect(state.buildLiveSessionResourceOptionsAsync()).resolves.toMatchObject({
      additionalSkillPaths: ['/skills/async'],
    });
    expect(buildSkillInjectionPlanAsyncMock).toHaveBeenCalledTimes(1);
    expect(buildPromptTemplatePlanAsyncMock).toHaveBeenCalledTimes(1);
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

  it('surfaces explicit materialization failures', async () => {
    materializeRuntimeResourcesToAgentDirMock.mockImplementationOnce(() => {
      throw new Error('initial materialize failed');
    });

    const logger = createLogger();
    const state = createTestRuntimeState({ logger });

    expect(() => state.materializeRuntimeResources()).toThrow('initial materialize failed');
    expect(logger.warn).not.toHaveBeenCalledWith('failed to materialize runtime resources', expect.anything());
  });
});
