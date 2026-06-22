import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = vi.hoisted(() => ({
  AuthStorage: { create: vi.fn((path: string) => ({ path })) },
  SettingsManager: { create: vi.fn(() => ({ applyOverrides: vi.fn(), getShellCommandPrefix: vi.fn(() => 'prefix') })) },
  createAgentSession: vi.fn(),
  createBashTool: vi.fn((cwd, options) => ({ name: 'bash', cwd, options })),
}));
const core = vi.hoisted(() => ({ resolveChildProcessEnv: vi.fn((env, existing) => ({ ...existing, ...env })) }));
const modelPrefs = vi.hoisted(() => ({
  readSavedModelPreferences: vi.fn(() => ({ currentServiceTier: 'auto' })),
  readSavedModelRef: vi.fn(() => 'provider/model'),
}));
const extensionRegistry = vi.hoisted(() => ({
  resolveModelProfile: vi.fn(async () => ({ kind: 'none' })),
}));
const modelRegistry = vi.hoisted(() => ({
  createRuntimeModelRegistry: vi.fn(() => ({ getAvailable: vi.fn(() => [{ id: 'model-1', provider: 'provider' }]) })),
}));
const launcher = vi.hoisted(() => ({
  formatProcessLaunchShellCommand: vi.fn(() => 'wrapped command'),
  resolveProcessLaunch: vi.fn((input) => ({ ...input, env: { ...input.env, WRAPPED: '1' } })),
}));
const tools = vi.hoisted(() => ({ buildToolInjectionPlanAsync: vi.fn(async () => ({ activeToolNames: ['web_search', 'artifact'] })) }));
const prefs = vi.hoisted(() => ({ applyConversationModelPreferencesToLiveSession: vi.fn(async () => undefined) }));
const loader = vi.hoisted(() => ({ makeLoader: vi.fn(async () => ({ loader: true })) }));
const liveModels = vi.hoisted(() => ({
  applyLiveSessionServiceTier: vi.fn(),
  repairSessionModelProvider: vi.fn(async () => undefined),
  resolveConversationPreferenceStateForSession: vi.fn(() => ({ currentServiceTier: 'flex' })),
}));
const persistence = vi.hoisted(() => ({
  ensureSessionFileExists: vi.fn(),
  patchSessionManagerPersistence: vi.fn(),
  resolveLiveSessionFile: vi.fn(() => '/sessions/s1.jsonl'),
}));

vi.mock('@earendil-works/pi-coding-agent', () => agent);
vi.mock('@neon-pilot/core', () => core);
vi.mock('../extensions/extensionHostClient.js', () => ({ getExtensionHostClient: () => extensionRegistry }));
vi.mock('../models/modelPreferences.js', () => modelPrefs);
vi.mock('../models/modelRegistry.js', () => modelRegistry);
vi.mock('../shared/processLauncher.js', () => launcher);
vi.mock('../tools/toolInventory.js', () => tools);
vi.mock('./conversationModelPreferences.js', () => prefs);
vi.mock('./liveSessionLoader.js', () => loader);
vi.mock('./liveSessionModels.js', () => liveModels);
vi.mock('./liveSessionPersistence.js', () => persistence);

import { createPreparedLiveAgentSession, makeAuth, makeRegistry, warmLiveSessionToolSelection } from './liveSessionFactory.js';

describe('live session factory', () => {
  const originalPath = process.env.PATH;
  const originalDs4CliBin = process.env.DS4_CLI_BIN;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(6)
      .mockReturnValueOnce(7)
      .mockReturnValueOnce(8);
    process.env.PERSONAL_AGENT_ACTIVE_PROFILE = '';
    process.env.PERSONAL_AGENT_PROFILE = '';
    process.env.PERSONAL_AGENT_REPO_ROOT = '/repo';
    process.env.PATH = originalPath;
    if (originalDs4CliBin === undefined) delete process.env.DS4_CLI_BIN;
    else process.env.DS4_CLI_BIN = originalDs4CliBin;
    extensionRegistry.resolveModelProfile.mockResolvedValue({ kind: 'none' });
    modelPrefs.readSavedModelRef.mockReturnValue('provider/model');
    modelRegistry.createRuntimeModelRegistry.mockReturnValue({ getAvailable: vi.fn(() => [{ id: 'model-1', provider: 'provider' }]) });
  });

  function session() {
    return {
      sessionId: 's1',
      sessionFile: '/sessions/s1.jsonl',
      model: { id: 'model-1' },
      thinkingLevel: 'medium',
      sessionManager: { id: 'manager' },
      settingsManager: { getShellCommandPrefix: vi.fn(() => 'prefix') },
      getActiveToolNames: vi.fn(() => ['bash']),
      setActiveTools: vi.fn(),
      _baseToolRegistry: new Map(),
      _refreshToolRegistry: vi.fn(),
    };
  }

  it('creates auth and model registry wrappers', () => {
    expect(makeAuth('/agent')).toEqual({ path: '/agent/auth.json' });
    const auth = { path: '/agent/auth.json' } as never;
    expect(makeRegistry(auth)).toEqual({ getAvailable: expect.any(Function) });
    expect(modelRegistry.createRuntimeModelRegistry).toHaveBeenCalledWith(auth);
  });

  it('warms and caches extension tool selection for the same runtime/model key', async () => {
    await expect(warmLiveSessionToolSelection('/settings.json')).resolves.toEqual(['web_search', 'artifact']);
    await expect(warmLiveSessionToolSelection('/settings.json')).resolves.toEqual(['web_search', 'artifact']);
    expect(tools.buildToolInjectionPlanAsync).toHaveBeenCalledTimes(1);

    vi.setSystemTime(61_000);
    await expect(warmLiveSessionToolSelection('/settings.json')).resolves.toEqual(['web_search', 'artifact']);
    expect(tools.buildToolInjectionPlanAsync).toHaveBeenCalledTimes(2);
  });

  it('creates prepared sessions with loader/settings/model/persistence/tool wiring', async () => {
    const s = session();
    agent.createAgentSession.mockResolvedValueOnce({ session: s });
    const sessionManager = { id: 'manager' };

    await expect(
      createPreparedLiveAgentSession({
        cwd: '/repo',
        agentDir: '/agent',
        settingsFile: '/settings.json',
        sessionManager: sessionManager as never,
        options: {
          agentDir: '/override-agent',
          allowedToolNames: ['bash'],
          initialModel: 'model-2',
          initialThinkingLevel: 'high',
          initialServiceTier: 'auto',
        },
        applyInitialPreferences: true,
      }),
    ).resolves.toMatchObject({ session: s, modelRegistry: expect.any(Object), perf: { totalMs: 8 } });

    const settingsManager = agent.SettingsManager.create.mock.results[0].value;
    expect(settingsManager.applyOverrides).toHaveBeenCalledWith({ transport: 'sse' });
    expect(loader.makeLoader).toHaveBeenCalledWith('/repo', expect.objectContaining({ agentDir: '/override-agent' }));
    expect(agent.createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/repo', agentDir: '/override-agent', sessionManager, settingsManager, tools: ['bash'] }),
    );
    expect(s._baseToolRegistry.get('bash')).toMatchObject({ name: 'bash', cwd: '/repo' });
    const spawnHook = s._baseToolRegistry.get('bash').options.spawnHook;
    expect(spawnHook({ command: 'echo hi', cwd: '/repo', env: { EXISTING: '1' } })).toMatchObject({
      command: expect.stringContaining('wrapped command'),
      env: expect.objectContaining({
        NEON_PILOT_SOURCE_CONVERSATION_ID: 's1',
        NEON_PILOT_SOURCE_SESSION_FILE: '/sessions/s1.jsonl',
        WRAPPED: '1',
      }),
    });
    expect(s._refreshToolRegistry).toHaveBeenCalledWith({ activeToolNames: ['bash'], includeAllExtensionTools: true });
    expect(persistence.patchSessionManagerPersistence).toHaveBeenCalledWith(s.sessionManager);
    expect(persistence.ensureSessionFileExists).toHaveBeenCalledWith(s.sessionManager);
    expect(liveModels.repairSessionModelProvider).toHaveBeenCalledWith(s, [{ id: 'model-1', provider: 'provider' }], expect.any(Object));
    expect(prefs.applyConversationModelPreferencesToLiveSession).toHaveBeenCalledWith(
      s,
      { model: 'model-2', thinkingLevel: 'high', serviceTier: 'auto' },
      expect.objectContaining({ currentServiceTier: 'auto' }),
      [{ id: 'model-1', provider: 'provider' }],
    );
    expect(liveModels.applyLiveSessionServiceTier).toHaveBeenCalledWith(s, 'flex');
    expect(s.setActiveTools).not.toHaveBeenCalled();
  });

  it('creates the Pi session with the selected provider-qualified initial model', async () => {
    const s = session();
    const ds4Model = { id: 'deepseek-v4-flash', provider: 'ds4' };
    const opencodeModel = { id: 'deepseek-v4-flash', provider: 'opencode-go' };
    modelRegistry.createRuntimeModelRegistry.mockReturnValue({
      getAvailable: vi.fn(() => [ds4Model, opencodeModel]),
    });
    modelPrefs.readSavedModelRef.mockReturnValue('ds4/deepseek-v4-flash');
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await createPreparedLiveAgentSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      sessionManager: {} as never,
      options: { initialModel: 'opencode-go/deepseek-v4-flash' },
      applyInitialPreferences: true,
    });

    expect(extensionRegistry.resolveModelProfile).toHaveBeenCalledWith({ provider: 'opencode-go', model: 'deepseek-v4-flash' });
    expect(agent.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ model: opencodeModel }));
    expect(liveModels.repairSessionModelProvider).toHaveBeenCalledWith(s, [ds4Model, opencodeModel], expect.any(Object));
    expect(prefs.applyConversationModelPreferencesToLiveSession).toHaveBeenCalledWith(
      s,
      { model: 'opencode-go/deepseek-v4-flash' },
      expect.any(Object),
      [ds4Model, opencodeModel],
    );
  });

  it('replaces edit and write with apply_patch when a Codex model is selected', async () => {
    const s = session();
    s.getActiveToolNames.mockReturnValue(['bash', 'read', 'edit', 'write']);
    tools.buildToolInjectionPlanAsync.mockResolvedValueOnce({ activeToolNames: ['apply_patch', 'artifact'] });
    const codexModel = { id: 'gpt-5.4', provider: 'openai-codex' };
    modelRegistry.createRuntimeModelRegistry.mockReturnValue({ getAvailable: vi.fn(() => [codexModel]) });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await createPreparedLiveAgentSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      sessionManager: {} as never,
      options: { initialModel: 'openai-codex/gpt-5.4' },
    });

    expect(tools.buildToolInjectionPlanAsync).toHaveBeenCalledWith({
      runtimeScope: 'shared',
      repoRoot: '/repo',
      modelRef: 'openai-codex/gpt-5.4',
    });
    expect(s.setActiveTools).toHaveBeenCalledWith(['bash', 'read', 'apply_patch', 'artifact']);
  });

  it('lets explicit allowed tools override selected model profile tools at session creation', async () => {
    const s = session();
    modelPrefs.readSavedModelRef.mockReturnValue('ds4/deepseek-v4-flash');
    extensionRegistry.resolveModelProfile.mockResolvedValue({
      kind: 'resolved',
      profile: { extensionId: 'system-ds4', id: 'ds4-compatible', match: ['ds4/*'], priority: 100, activeTools: ['bash', 'read', 'edit'] },
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await createPreparedLiveAgentSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      sessionManager: {} as never,
      options: { allowedToolNames: ['artifact'] },
    });

    expect(extensionRegistry.resolveModelProfile).toHaveBeenCalledWith({ provider: 'ds4', model: 'deepseek-v4-flash' });
    expect(loader.makeLoader).toHaveBeenCalledWith(
      '/repo',
      expect.objectContaining({ additionalSkillPaths: [], noSkills: true, progressiveDisclosure: true, skillDiscoveryPaths: [] }),
    );
    expect(agent.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ tools: ['artifact'] }));
    expect(s.setActiveTools).not.toHaveBeenCalled();
  });

  it('does not apply DS4 session interventions to opencode DeepSeek V4 Flash', async () => {
    const s = session();
    modelPrefs.readSavedModelRef.mockReturnValue('opencode-go/deepseek-v4-flash');
    extensionRegistry.resolveModelProfile.mockResolvedValue({
      kind: 'resolved',
      profile: { extensionId: 'system-ds4', id: 'ds4-compatible', match: ['ds4/*'], priority: 100, activeTools: ['bash', 'read', 'edit'] },
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await createPreparedLiveAgentSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      sessionManager: {} as never,
      options: { allowedToolNames: ['artifact'] },
    });

    expect(extensionRegistry.resolveModelProfile).toHaveBeenCalledWith({ provider: 'opencode-go', model: 'deepseek-v4-flash' });
    expect(loader.makeLoader).toHaveBeenCalledWith('/repo', expect.not.objectContaining({ progressiveDisclosure: true, noSkills: true }));
    expect(agent.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ tools: ['artifact'] }));
  });

  it('does not apply DS4 session interventions when saved defaults are DS4 but the composer starts opencode', async () => {
    const s = session();
    modelPrefs.readSavedModelRef.mockReturnValue('ds4/deepseek-v4-flash');
    extensionRegistry.resolveModelProfile.mockResolvedValue({
      kind: 'resolved',
      profile: { extensionId: 'system-ds4', id: 'ds4-compatible', match: ['ds4/*'], priority: 100, activeTools: ['bash', 'read', 'edit'] },
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await createPreparedLiveAgentSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      sessionManager: {} as never,
      options: { allowedToolNames: ['artifact'], initialModel: 'opencode-go/deepseek-v4-flash' },
    });

    expect(extensionRegistry.resolveModelProfile).toHaveBeenCalledWith({ provider: 'opencode-go', model: 'deepseek-v4-flash' });
    expect(loader.makeLoader).toHaveBeenCalledWith('/repo', expect.not.objectContaining({ progressiveDisclosure: true, noSkills: true }));
    expect(agent.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ tools: ['artifact'] }));
  });

  it('can run DS4 sessions in baseline mode without progressive tool and skill filtering', async () => {
    const previousMode = process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE;
    process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE = 'baseline';
    const s = session();
    modelPrefs.readSavedModelRef.mockReturnValue('ds4/deepseek-v4-flash');
    extensionRegistry.resolveModelProfile.mockResolvedValue({
      kind: 'resolved',
      profile: { extensionId: 'system-ds4', id: 'ds4-compatible', match: ['ds4/*'], priority: 100, activeTools: ['bash', 'read', 'edit'] },
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    try {
      await createPreparedLiveAgentSession({
        cwd: '/repo',
        agentDir: '/agent',
        settingsFile: '/settings.json',
        sessionManager: {} as never,
        options: { allowedToolNames: ['artifact'] },
      });

      expect(loader.makeLoader).toHaveBeenCalledWith('/repo', expect.not.objectContaining({ progressiveDisclosure: true, noSkills: true }));
      expect(agent.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ tools: ['artifact'] }));
      expect(s.setActiveTools).not.toHaveBeenCalled();
    } finally {
      if (previousMode === undefined) delete process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE;
      else process.env.NEON_PILOT_DS4_OPTIMIZATION_MODE = previousMode;
    }
  });

  it('can disable DS4 direct tool and progressive skill interventions independently', async () => {
    const previousTools = process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS;
    const previousSkills = process.env.NEON_PILOT_DS4_PROGRESSIVE_SKILLS;
    process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS = '0';
    process.env.NEON_PILOT_DS4_PROGRESSIVE_SKILLS = '0';
    const s = session();
    modelPrefs.readSavedModelRef.mockReturnValue('ds4/deepseek-v4-flash');
    extensionRegistry.resolveModelProfile.mockResolvedValue({
      kind: 'resolved',
      profile: { extensionId: 'system-ds4', id: 'ds4-compatible', match: ['ds4/*'], priority: 100, activeTools: ['bash', 'read', 'edit'] },
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    try {
      await createPreparedLiveAgentSession({
        cwd: '/repo',
        agentDir: '/agent',
        settingsFile: '/settings.json',
        sessionManager: {} as never,
        options: { allowedToolNames: ['artifact'] },
      });

      expect(loader.makeLoader).toHaveBeenCalledWith('/repo', expect.not.objectContaining({ progressiveDisclosure: true, noSkills: true }));
      expect(agent.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ tools: ['artifact'] }));
    } finally {
      if (previousTools === undefined) delete process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS;
      else process.env.NEON_PILOT_DS4_DIRECT_CORE_TOOLS = previousTools;
      if (previousSkills === undefined) delete process.env.NEON_PILOT_DS4_PROGRESSIVE_SKILLS;
      else process.env.NEON_PILOT_DS4_PROGRESSIVE_SKILLS = previousSkills;
    }
  });

  it('publishes the DS4 CLI path into host and bash environments for DS4 sessions', async () => {
    const tempRoot = path.join('/tmp', `neon-pilot-ds4-cli-${process.pid}`);
    const extensionPath = path.join(tempRoot, 'system-ds4');
    const cliBinDir = path.join(extensionPath, 'bin');
    rmSync(tempRoot, { recursive: true, force: true });
    mkdirSync(cliBinDir, { recursive: true });
    writeFileSync(path.join(cliBinDir, 'ds4'), '#!/bin/sh\n');

    const s = session();
    modelPrefs.readSavedModelRef.mockReturnValue('ds4/deepseek-v4-flash');
    extensionRegistry.resolveModelProfile.mockResolvedValue({
      kind: 'resolved',
      profile: { extensionId: 'system-ds4', id: 'ds4-compatible', match: ['ds4/*'], priority: 100, activeTools: ['bash'] },
    });
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    try {
      await createPreparedLiveAgentSession({
        cwd: '/repo',
        agentDir: '/agent',
        settingsFile: '/settings.json',
        sessionManager: {} as never,
        options: { additionalExtensionPaths: [extensionPath] },
      });

      expect(process.env.PATH?.split(path.delimiter)[0]).toBe(cliBinDir);
      expect(process.env.DS4_CLI_BIN).toBe(path.join(cliBinDir, 'ds4'));

      const spawnHook = s._baseToolRegistry.get('bash').options.spawnHook;
      expect(spawnHook({ command: 'ds4 status', cwd: '/repo', env: { PATH: '/usr/bin' } })).toMatchObject({
        env: expect.objectContaining({
          PATH: `${cliBinDir}${path.delimiter}/usr/bin`,
          DS4_CLI_BIN: path.join(cliBinDir, 'ds4'),
        }),
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not re-expand tools after a lifecycle hook has selected a single extension tool mode', async () => {
    const s = session();
    s.getActiveToolNames.mockReturnValue(['artifact']);
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await createPreparedLiveAgentSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      sessionManager: {} as never,
    });

    expect(s.setActiveTools).not.toHaveBeenCalled();
  });

  it('can skip initial preference application and session file ensure', async () => {
    const s = session();
    agent.createAgentSession.mockResolvedValueOnce({ session: s });

    await createPreparedLiveAgentSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      sessionManager: {} as never,
      ensureSessionFile: false,
    });

    expect(prefs.applyConversationModelPreferencesToLiveSession).not.toHaveBeenCalled();
    expect(persistence.ensureSessionFileExists).not.toHaveBeenCalled();
  });
});
