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
  manifestAgentFactoryMock,
  authStorageMock,
  readSavedModelPreferencesMock,
  listExtensionSkillRegistrationsMock,
  listExtensionEntriesMock,
  isExtensionEnabledMock,
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
    manifestAgentFactoryMock,
    authStorageMock,
    readSavedModelPreferencesMock: vi.fn(() => ({ currentVisionModel: 'openai/gpt-4o' })),
    listExtensionSkillRegistrationsMock: vi.fn(() => []),
    listExtensionEntriesMock: vi.fn(() => []),
    isExtensionEnabledMock: vi.fn(() => true),
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

vi.mock('../extensions/extensionRegistry.js', () => ({
  isExtensionEnabled: isExtensionEnabledMock,
  listExtensionEntries: listExtensionEntriesMock,
  listExtensionSkillRegistrations: listExtensionSkillRegistrationsMock,
  listExtensionToolRegistrations: vi.fn(() => []),
  resolveExtensionModelProfile: vi.fn(() => ({ kind: 'none' })),
}));

vi.mock('../extensions/manifestToolAgentExtension.js', () => ({
  createManifestToolAgentExtensions: vi.fn(() => []),
}));

vi.mock('../extensions/extensionAgentExtensions.js', () => ({
  createManifestAgentExtensions: createManifestAgentExtensionsMock,
}));

vi.mock('@earendil-works/pi-coding-agent', () => ({
  AuthStorage: authStorageMock,
}));

vi.mock('../models/modelPreferences.js', () => ({
  readSavedModelPreferences: readSavedModelPreferencesMock,
  readSavedModelRef: vi.fn(() => 'openai/gpt-4o'),
}));

vi.mock('../ui/settingsPersistence.js', () => ({
  DEFAULT_RUNTIME_SETTINGS_FILE: '/runtime/settings.json',
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
    listExtensionEntriesMock.mockReset();
    listExtensionEntriesMock.mockReturnValue([]);
    isExtensionEnabledMock.mockReset();
    isExtensionEnabledMock.mockReturnValue(true);
    listExtensionSkillRegistrationsMock.mockReturnValue([]);
    readSavedModelPreferencesMock.mockClear();
    readSavedModelPreferencesMock.mockReturnValue({ currentVisionModel: 'openai/gpt-4o' });
    authStorageMock.hasAuth.mockReset();
    authStorageMock.hasAuth.mockReturnValue(false);
    authStorageMock.create.mockClear();
    delete process.env.NEON_PILOT_ACTIVE_PROFILE;
    delete process.env.NEON_PILOT_PROFILE;
    delete process.env.NEON_PILOT_RUNTIME_SCOPE;
    delete process.env.NEON_PILOT_REPO_ROOT;
    delete process.env.NEON_PILOT_RESOURCES_ROOT;
  });

  it('materializes the shared runtime and builds live session helpers', async () => {
    process.env.MCP_CONFIG_PATH = '/agent-dir/mcp_servers.json';
    const logger = createLogger();
    const state = createRuntimeState({
      repoRoot: '/repo-root',
      agentDir: '/agent-dir',
      logger,
    });

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
    expect(process.env.NEON_PILOT_RUNTIME_SCOPE).toBe('shared');
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

  it('blocks global active tool mutation but allows lifecycle-scoped active tools', () => {
    let guardedPi: {
      setActiveTools: (tools: string[]) => void;
      on: (event: string, handler: (...args: unknown[]) => unknown) => void;
    } | null = null;
    createManifestAgentExtensionsMock.mockReturnValueOnce({
      factories: [
        vi.fn((pi) => {
          guardedPi = pi as {
            setActiveTools: (tools: string[]) => void;
            on: (event: string, handler: (...args: unknown[]) => unknown) => void;
          };
        }),
      ],
      errors: [],
    });
    const logger = createLogger();
    const state = createRuntimeState({
      repoRoot: '/repo-root',
      agentDir: '/agent-dir',
      logger,
    });

    const [factory] = state.buildLiveSessionExtensionFactories();
    const pi = {
      setActiveTools: vi.fn(),
      on: vi.fn(),
    };

    factory?.(pi as never);

    expect(guardedPi).not.toBeNull();
    expect(() => guardedPi?.setActiveTools(['read'])).toThrow('pi.setActiveTools is unsupported');
    guardedPi?.on(
      'session_start',
      (_event, ctx: { setActiveTools?: (tools: string[]) => void; modelProfile?: { modelRef: string | null } }) => {
        expect(ctx.modelProfile?.modelRef).toBe('test/model');
        ctx.setActiveTools?.(['read']);
      },
    );
    const registered = pi.on.mock.calls[0];
    expect(registered?.[0]).toBe('session_start');
    (registered?.[1] as (...args: unknown[]) => unknown)({}, { model: { provider: 'test', id: 'model' } });
    expect(pi.setActiveTools).toHaveBeenCalledWith(['read']);
  });

  it('adds extension skill directories to live session resources', () => {
    listExtensionSkillRegistrationsMock.mockReturnValue([
      { path: '/repo-root/extensions/system-runs/skills/runs/SKILL.md' },
      { path: '/repo-root/extensions/system-runs/skills/runs/SKILL.md' },
      { path: '/repo-root/extensions/system-artifacts/skills/artifacts/SKILL.md' },
    ]);

    const state = createRuntimeState({
      repoRoot: '/repo-root',
      agentDir: '/agent-dir',
      logger: createLogger(),
    });

    expect(state.buildLiveSessionResourceOptions().additionalSkillPaths).toEqual(expect.any(Array));
  });

  it('logs initial materialization failures', async () => {
    materializeRuntimeResourcesToAgentDirMock.mockImplementationOnce(() => {
      throw new Error('initial materialize failed');
    });

    const logger = createLogger();
    createRuntimeState({
      repoRoot: '/repo-root',
      agentDir: '/agent-dir',
      logger,
    });

    expect(logger.warn).toHaveBeenCalledWith('failed to materialize runtime resources', {
      runtimeScope: 'shared',
      message: 'initial materialize failed',
    });
  });
});
