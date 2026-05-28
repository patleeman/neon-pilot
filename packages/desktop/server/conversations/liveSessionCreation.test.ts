import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = vi.hoisted(() => ({
  sessionManagers: [] as Array<{
    kind: string;
    cwd: string;
    sessionFile?: string;
    persistentSessionDir?: string;
    getCwd: ReturnType<typeof vi.fn>;
  }>,
  SessionManager: {
    create: vi.fn((cwd: string, persistentSessionDir: string) => {
      const manager = { kind: 'create', cwd, persistentSessionDir, getCwd: vi.fn(() => cwd) };
      agent.sessionManagers.push(manager);
      return manager;
    }),
    forkFrom: vi.fn((sessionFile: string, cwd: string, persistentSessionDir: string) => {
      const manager = { kind: 'fork', cwd, sessionFile, persistentSessionDir, getCwd: vi.fn(() => cwd) };
      agent.sessionManagers.push(manager);
      return manager;
    }),
    open: vi.fn((sessionFile: string, _unused: unknown, cwd?: string) => {
      const manager = { kind: 'open', cwd: cwd ?? '/from-manager', sessionFile, getCwd: vi.fn(() => cwd ?? '/from-manager') };
      agent.sessionManagers.push(manager);
      return manager;
    }),
  },
}));
const factory = vi.hoisted(() => ({ createPreparedLiveAgentSession: vi.fn() }));
const loader = vi.hoisted(() => ({ queuePrewarmLiveSessionLoader: vi.fn() }));
const persistence = vi.hoisted(() => ({
  resolveLiveSessionFile: vi.fn((session: { sessionId: string }) => `/sessions/${session.sessionId}.json`),
}));
const sessions = vi.hoisted(() => ({ readSessionMetaByFile: vi.fn(() => null as null | { cwd?: string }) }));

vi.mock('@earendil-works/pi-coding-agent', () => ({ SessionManager: agent.SessionManager }));
vi.mock('./liveSessionFactory.js', () => factory);
vi.mock('./liveSessionLoader.js', () => loader);
vi.mock('./liveSessionPersistence.js', () => persistence);
vi.mock('./sessions.js', () => sessions);

import { createLiveSession, createLiveSessionFromExisting, resumeLiveSession } from './liveSessionCreation.js';

describe('live session creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agent.sessionManagers.length = 0;
    vi.useFakeTimers();
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(40)
      .mockReturnValueOnce(45)
      .mockReturnValueOnce(50);
  });

  it('creates a prepared live session, wires it, resolves session file, and schedules prewarm', async () => {
    factory.createPreparedLiveAgentSession.mockResolvedValueOnce({ session: { sessionId: 's1' }, perf: { totalMs: 20, setupMs: 7 } });
    const wireSession = vi.fn();

    const result = await createLiveSession({
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      persistentSessionDir: '/persist',
      options: { agentDir: '/override-agent' } as never,
      wireSession,
    });

    expect(agent.SessionManager.create).toHaveBeenCalledWith('/repo', '/persist');
    expect(factory.createPreparedLiveAgentSession).toHaveBeenCalledWith({
      cwd: '/repo',
      agentDir: '/override-agent',
      sessionManager: agent.sessionManagers[0],
      settingsFile: '/settings.json',
      options: { agentDir: '/override-agent' },
      applyInitialPreferences: true,
    });
    expect(wireSession).toHaveBeenCalledWith('s1', { sessionId: 's1' }, '/repo');
    expect(result).toEqual({
      id: 's1',
      sessionFile: '/sessions/s1.json',
      perf: {
        sessionManagerMs: 10,
        preparedMs: 30,
        wireMs: 10,
        resolveSessionFileMs: 5,
        totalMs: 50,
        'prepared.totalMs': 20,
        'prepared.setupMs': 7,
      },
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(loader.queuePrewarmLiveSessionLoader).toHaveBeenCalledWith('/repo', { agentDir: '/override-agent' });
  });

  it('creates a live session from an existing session file and immediately prewarms', async () => {
    factory.createPreparedLiveAgentSession.mockResolvedValueOnce({ session: { sessionId: 'forked' } });
    const wireSession = vi.fn();

    const result = await createLiveSessionFromExisting({
      sessionFile: '/sessions/source.json',
      cwd: '/repo',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      persistentSessionDir: '/persist',
      options: {} as never,
      wireSession,
    });

    expect(agent.SessionManager.forkFrom).toHaveBeenCalledWith('/sessions/source.json', '/repo', '/persist');
    expect(factory.createPreparedLiveAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionManager: agent.sessionManagers[0] }),
    );
    expect(factory.createPreparedLiveAgentSession.mock.calls[0][0]).not.toHaveProperty('applyInitialPreferences');
    expect(wireSession).toHaveBeenCalledWith('forked', { sessionId: 'forked' }, '/repo');
    expect(loader.queuePrewarmLiveSessionLoader).toHaveBeenCalledWith('/repo', {});
    expect(result).toEqual({ id: 'forked', sessionFile: '/sessions/forked.json' });
  });

  it('returns an existing live session when resuming an already wired file', async () => {
    await expect(
      resumeLiveSession({
        sessionFile: '/sessions/existing.json',
        agentDir: '/agent',
        settingsFile: '/settings.json',
        findLiveSessionByFile: vi.fn(() => ({ id: 'already-live' })),
        wireSession: vi.fn(),
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'already-live' }));
    expect(factory.createPreparedLiveAgentSession).not.toHaveBeenCalled();
  });

  it('resumes from cwd override first, metadata second, and manager cwd as fallback', async () => {
    factory.createPreparedLiveAgentSession.mockResolvedValue({ session: { sessionId: 'resumed' } });
    const wireSession = vi.fn();

    await resumeLiveSession({
      sessionFile: '/sessions/override.json',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      options: { cwdOverride: ' /override ', agentDir: '/option-agent' } as never,
      findLiveSessionByFile: vi.fn(() => null),
      wireSession,
    });
    expect(agent.SessionManager.open).toHaveBeenLastCalledWith('/sessions/override.json', undefined, '/override');
    expect(factory.createPreparedLiveAgentSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cwd: '/override',
        agentDir: '/option-agent',
        ensureSessionFile: false,
        options: { agentDir: '/option-agent' },
      }),
    );
    expect(wireSession).toHaveBeenLastCalledWith('resumed', { sessionId: 'resumed' }, '/override');

    sessions.readSessionMetaByFile.mockReturnValueOnce({ cwd: '/metadata' });
    await resumeLiveSession({
      sessionFile: '/sessions/meta.json',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      findLiveSessionByFile: vi.fn(() => null),
      wireSession,
    });
    expect(agent.SessionManager.open).toHaveBeenLastCalledWith('/sessions/meta.json', undefined, '/metadata');
    expect(wireSession).toHaveBeenLastCalledWith('resumed', { sessionId: 'resumed' }, '/metadata');

    await resumeLiveSession({
      sessionFile: '/sessions/fallback.json',
      agentDir: '/agent',
      settingsFile: '/settings.json',
      options: { cwdOverride: '  ' } as never,
      findLiveSessionByFile: vi.fn(() => null),
      wireSession,
    });
    expect(agent.SessionManager.open).toHaveBeenLastCalledWith('/sessions/fallback.json', undefined, undefined);
    expect(wireSession).toHaveBeenLastCalledWith('resumed', { sessionId: 'resumed' }, '/from-manager');
  });
});
