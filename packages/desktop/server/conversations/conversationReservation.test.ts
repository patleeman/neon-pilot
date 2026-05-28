import { beforeEach, describe, expect, it, vi } from 'vitest';

const crypto = vi.hoisted(() => ({ randomUUID: vi.fn(() => 'session-uuid') }));
const fs = vi.hoisted(() => ({ mkdirSync: vi.fn(), writeFileSync: vi.fn() }));
const core = vi.hoisted(() => ({ getDurableSessionsDir: vi.fn(() => '/durable/sessions') }));
const cwd = vi.hoisted(() => ({ resolveNeutralChatCwd: vi.fn(() => '/neutral/chat') }));
const service = vi.hoisted(() => ({ readConversationSessionMetaByFile: vi.fn(() => ({ id: 'catalog-id' })) }));

vi.mock('node:crypto', () => crypto);
vi.mock('node:fs', () => fs);
vi.mock('@neon-pilot/core', () => core);
vi.mock('./conversationCwd.js', () => cwd);
vi.mock('./conversationService.js', () => service);

import { reserveConversationSession } from './conversationReservation.js';

describe('reserveConversationSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    crypto.randomUUID.mockReturnValue('session-uuid');
    service.readConversationSessionMetaByFile.mockReturnValue({ id: 'catalog-id' });
  });

  it('creates a durable empty session and returns the catalog conversation id', () => {
    const result = reserveConversationSession({ cwd: '/Users/patrick/project' });

    expect(fs.mkdirSync).toHaveBeenCalledWith('/durable/sessions/--Users-patrick-project--', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/durable/sessions/--Users-patrick-project--/session-uuid.jsonl',
      expect.stringContaining('"id":"session-uuid"'),
      { flag: 'wx' },
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/durable/sessions/--Users-patrick-project--/session-uuid.jsonl',
      expect.stringContaining('"cwd":"/Users/patrick/project"'),
      { flag: 'wx' },
    );
    expect(service.readConversationSessionMetaByFile).toHaveBeenCalledWith(
      '/durable/sessions/--Users-patrick-project--/session-uuid.jsonl',
    );
    expect(result).toMatchObject({
      id: 'catalog-id',
      sessionFile: '/durable/sessions/--Users-patrick-project--/session-uuid.jsonl',
      cwd: '/Users/patrick/project',
      perf: expect.objectContaining({
        totalMs: expect.any(Number),
      }),
    });
  });

  it('uses the neutral chat cwd when no cwd is provided', () => {
    reserveConversationSession({ profile: 'shared' });

    expect(cwd.resolveNeutralChatCwd).toHaveBeenCalledWith('shared');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/durable/sessions/--neutral-chat--', { recursive: true });
  });

  it('falls back to the generated session id when the catalog has not indexed the session yet', () => {
    service.readConversationSessionMetaByFile.mockReturnValue(null);

    expect(reserveConversationSession({ cwd: '/repo' }).id).toBe('session-uuid');
  });
});
