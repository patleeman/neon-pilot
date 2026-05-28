import { beforeEach, describe, expect, it, vi } from 'vitest';

const agent = vi.hoisted(() => ({
  managers: [] as Array<{
    cwd: string;
    persistentSessionDir: string;
    sessionId: string;
    sessionFile: string;
    getSessionFile: () => string;
    getSessionId: () => string;
  }>,
  SessionManager: {
    create: vi.fn((cwd: string, persistentSessionDir: string) => {
      const sessionId = `session-${agent.managers.length + 1}`;
      const manager = {
        cwd,
        persistentSessionDir,
        sessionId,
        sessionFile: `${persistentSessionDir}/${sessionId}.jsonl`,
        getSessionFile: () => `${persistentSessionDir}/${sessionId}.jsonl`,
        getSessionId: () => sessionId,
      };
      agent.managers.push(manager);
      return manager;
    }),
  },
}));
const core = vi.hoisted(() => ({ getDurableSessionsDir: vi.fn(() => '/durable/sessions') }));
const cwd = vi.hoisted(() => ({ resolveNeutralChatCwd: vi.fn(() => '/neutral/chat') }));
const persistence = vi.hoisted(() => ({ ensureSessionFileExists: vi.fn() }));
const service = vi.hoisted(() => ({ readConversationSessionMetaByFile: vi.fn(() => ({ id: 'catalog-id' })) }));

vi.mock('@earendil-works/pi-coding-agent', () => ({ SessionManager: agent.SessionManager }));
vi.mock('@neon-pilot/core', () => core);
vi.mock('./conversationCwd.js', () => cwd);
vi.mock('./liveSessionPersistence.js', () => persistence);
vi.mock('./conversationService.js', () => service);

import { reserveConversationSession } from './conversationReservation.js';

describe('reserveConversationSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agent.managers.length = 0;
    service.readConversationSessionMetaByFile.mockReturnValue({ id: 'catalog-id' });
  });

  it('creates a durable empty session and returns the catalog conversation id', () => {
    const result = reserveConversationSession({ cwd: '/Users/patrick/project' });

    expect(agent.SessionManager.create).toHaveBeenCalledWith('/Users/patrick/project', '/durable/sessions/--Users-patrick-project--');
    expect(persistence.ensureSessionFileExists).toHaveBeenCalledWith(agent.managers[0]);
    expect(service.readConversationSessionMetaByFile).toHaveBeenCalledWith('/durable/sessions/--Users-patrick-project--/session-1.jsonl');
    expect(result).toMatchObject({
      id: 'catalog-id',
      sessionFile: '/durable/sessions/--Users-patrick-project--/session-1.jsonl',
      cwd: '/Users/patrick/project',
      perf: expect.objectContaining({
        totalMs: expect.any(Number),
      }),
    });
  });

  it('uses the neutral chat cwd when no cwd is provided', () => {
    reserveConversationSession({ profile: 'shared' });

    expect(cwd.resolveNeutralChatCwd).toHaveBeenCalledWith('shared');
    expect(agent.SessionManager.create).toHaveBeenCalledWith('/neutral/chat', '/durable/sessions/--neutral-chat--');
  });

  it('falls back to the manager session id when the catalog has not indexed the session yet', () => {
    service.readConversationSessionMetaByFile.mockReturnValue(null);

    expect(reserveConversationSession({ cwd: '/repo' }).id).toBe('session-1');
  });
});
