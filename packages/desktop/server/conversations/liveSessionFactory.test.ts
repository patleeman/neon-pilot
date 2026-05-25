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
const modelRegistry = vi.hoisted(() => ({
  createRuntimeModelRegistry: vi.fn(() => ({ getAvailable: vi.fn(() => [{ id: 'model-1', provider: 'provider' }]) })),
}));
const launcher = vi.hoisted(() => ({
  formatProcessLaunchShellCommand: vi.fn(() => 'wrapped command'),
  resolveProcessLaunch: vi.fn((input) => ({ ...input, env: { ...input.env, WRAPPED: '1' } })),
}));
const tools = vi.hoisted(() => ({ buildToolInjectionPlan: vi.fn(() => ({ activeToolNames: ['web_search', 'artifact'] })) }));
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

  it('warms and caches extension tool selection for the same runtime/model key', () => {
    expect(warmLiveSessionToolSelection('/settings.json')).toEqual(['web_search', 'artifact']);
    expect(warmLiveSessionToolSelection('/settings.json')).toEqual(['web_search', 'artifact']);
    expect(tools.buildToolInjectionPlan).toHaveBeenCalledTimes(1);

    vi.setSystemTime(61_000);
    expect(warmLiveSessionToolSelection('/settings.json')).toEqual(['web_search', 'artifact']);
    expect(tools.buildToolInjectionPlan).toHaveBeenCalledTimes(2);
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
      command: 'wrapped command',
      env: expect.objectContaining({
        NEON_PILOT_SOURCE_CONVERSATION_ID: 's1',
        NEON_PILOT_SOURCE_SESSION_FILE: '/sessions/s1.jsonl',
        WRAPPED: '1',
      }),
    });
    expect(s._refreshToolRegistry).toHaveBeenCalledWith({ activeToolNames: ['bash'], includeAllExtensionTools: true });
    expect(persistence.patchSessionManagerPersistence).toHaveBeenCalledWith(s.sessionManager);
    expect(persistence.ensureSessionFileExists).toHaveBeenCalledWith(s.sessionManager);
    expect(liveModels.repairSessionModelProvider).toHaveBeenCalledWith(s, [{ id: 'model-1', provider: 'provider' }]);
    expect(prefs.applyConversationModelPreferencesToLiveSession).toHaveBeenCalledWith(
      s,
      { model: 'model-2', thinkingLevel: 'high', serviceTier: 'auto' },
      expect.objectContaining({ currentServiceTier: 'auto' }),
      [{ id: 'model-1', provider: 'provider' }],
    );
    expect(liveModels.applyLiveSessionServiceTier).toHaveBeenCalledWith(s, 'flex');
    expect(s.setActiveTools).toHaveBeenCalledWith(['bash', 'web_search', 'artifact']);
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
