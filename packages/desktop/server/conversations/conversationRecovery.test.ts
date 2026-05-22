import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ existsSync: vi.fn(() => true) }));
const daemon = vi.hoisted(() => ({ parsePendingOperation: vi.fn((value) => value) }));
const durableRuns = vi.hoisted(() => ({ getDurableRun: vi.fn() }));
const middleware = vi.hoisted(() => ({ logError: vi.fn() }));
const runs = vi.hoisted(() => ({
  createWebLiveConversationRunId: vi.fn((id: string) => `web:${id}`),
  syncWebLiveConversationRun: vi.fn(async () => undefined),
}));
const liveSessions = vi.hoisted(() => ({
  isLive: vi.fn(() => false),
  promptSession: vi.fn(async () => undefined),
  queuePromptContext: vi.fn(async () => undefined),
  registry: new Map<string, unknown>(),
  repairLiveSessionTranscriptTail: vi.fn(),
  resumeSession: vi.fn(async () => ({ id: 'resumed-id' })),
}));
const sessions = vi.hoisted(() => ({ readSessionBlocks: vi.fn(() => null) }));

vi.mock('node:fs', () => fs);
vi.mock('@neon-pilot/daemon', () => daemon);
vi.mock('../automation/durableRuns.js', () => durableRuns);
vi.mock('../middleware/index.js', () => middleware);
vi.mock('./conversationRuns.js', () => runs);
vi.mock('./liveSessions.js', () => liveSessions);
vi.mock('./sessions.js', () => sessions);

import { recoverConversationCapability } from './conversationRecovery.js';

describe('conversation recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveSessions.registry.clear();
    fs.existsSync.mockReturnValue(true);
  });

  function context() {
    return {
      getRuntimeScope: vi.fn(() => 'shared'),
      buildLiveSessionResourceOptions: vi.fn(() => ({ additionalSkillPaths: ['/skills'] })),
      buildLiveSessionExtensionFactories: vi.fn(() => [function Factory() {}]),
      flushLiveDeferredResumes: vi.fn(async () => undefined),
    };
  }

  it('recovers an already-live session without resuming from disk', async () => {
    liveSessions.isLive.mockReturnValueOnce(true);
    liveSessions.registry.set('live-1', { cwd: '/live', title: 'Live Title', session: { sessionFile: '/sessions/live.jsonl' } });
    const ctx = context();

    await expect(recoverConversationCapability(' live-1 ', ctx)).resolves.toEqual({
      conversationId: 'live-1',
      live: true,
      recovered: true,
      replayedPendingOperation: false,
      usedFallbackPrompt: false,
    });

    expect(liveSessions.resumeSession).not.toHaveBeenCalled();
    expect(liveSessions.repairLiveSessionTranscriptTail).toHaveBeenCalledWith('live-1');
    expect(runs.syncWebLiveConversationRun).toHaveBeenCalledWith({
      conversationId: 'live-1',
      sessionFile: '/sessions/live.jsonl',
      cwd: '/live',
      title: 'Live Title',
      profile: 'shared',
      state: 'waiting',
      pendingOperation: null,
    });
  });

  it('resumes a non-live conversation from durable checkpoint/session details and flushes deferred resumes', async () => {
    durableRuns.getDurableRun.mockResolvedValueOnce({
      run: {
        checkpoint: {
          payload: { sessionFile: '/checkpoint/session.jsonl', cwd: '/checkpoint-cwd', title: 'Checkpoint Title', profile: 'profile-a' },
        },
        manifest: { spec: { cwd: '/manifest-cwd' }, source: { filePath: '/manifest/session.jsonl' } },
      },
    });
    sessions.readSessionBlocks.mockReturnValueOnce({ meta: { file: '/session/detail.jsonl', cwd: '/detail-cwd', title: 'Detail Title' } });
    liveSessions.registry.set('resumed-id', { cwd: '/resumed-cwd' });
    const ctx = context();

    await expect(recoverConversationCapability('conv-1', ctx)).resolves.toMatchObject({
      conversationId: 'resumed-id',
      replayedPendingOperation: false,
    });

    expect(durableRuns.getDurableRun).toHaveBeenCalledWith('web:conv-1');
    expect(liveSessions.resumeSession).toHaveBeenCalledWith('/session/detail.jsonl', {
      additionalSkillPaths: ['/skills'],
      extensionFactories: [expect.any(Function)],
      cwdOverride: '/detail-cwd',
    });
    expect(ctx.flushLiveDeferredResumes).toHaveBeenCalledOnce();
    expect(runs.syncWebLiveConversationRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conversationId: 'resumed-id',
        cwd: '/resumed-cwd',
        title: 'Detail Title',
        profile: 'profile-a',
        state: 'waiting',
      }),
    );
  });

  it('replays pending operations with context messages and prompt submission', async () => {
    durableRuns.getDurableRun.mockResolvedValueOnce({
      run: {
        checkpoint: {
          payload: {
            sessionFile: '/checkpoint/session.jsonl',
            cwd: '/cwd',
            pendingOperation: {
              text: 'continue',
              behavior: 'followUp',
              images: [{ data: 'x' }],
              contextMessages: [{ customType: 'ctx', content: 'context' }],
            },
          },
        },
      },
    });
    const ctx = context();

    await expect(recoverConversationCapability('conv-1', ctx, { replayPendingOperation: true })).resolves.toMatchObject({
      replayedPendingOperation: true,
    });

    expect(daemon.parsePendingOperation).toHaveBeenCalledWith({
      text: 'continue',
      behavior: 'followUp',
      images: [{ data: 'x' }],
      contextMessages: [{ customType: 'ctx', content: 'context' }],
    });
    expect(liveSessions.queuePromptContext).toHaveBeenCalledWith('resumed-id', 'ctx', 'context');
    expect(liveSessions.promptSession).toHaveBeenCalledWith('resumed-id', 'continue', 'followUp', [{ data: 'x' }]);
    expect(runs.syncWebLiveConversationRun).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'running', pendingOperation: expect.any(Object) }),
    );
  });

  it('marks recovered pending operation failed when prompt replay rejects', async () => {
    const error = new Error('prompt failed');
    liveSessions.promptSession.mockRejectedValueOnce(error);
    durableRuns.getDurableRun.mockResolvedValueOnce({
      run: { checkpoint: { payload: { sessionFile: '/checkpoint/session.jsonl', cwd: '/cwd', pendingOperation: { text: 'continue' } } } },
    });

    await recoverConversationCapability('conv-1', context(), { replayPendingOperation: true });
    await Promise.resolve();

    expect(runs.syncWebLiveConversationRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'failed', lastError: 'prompt failed' }),
    );
    expect(middleware.logError).toHaveBeenCalledWith(
      'conversation recovery error',
      expect.objectContaining({ sessionId: 'resumed-id', message: 'prompt failed' }),
    );
  });

  it('validates conversation id, existing session file, and recoverable cwd', async () => {
    await expect(recoverConversationCapability('   ', context())).rejects.toThrow('conversationId required');
    durableRuns.getDurableRun.mockResolvedValueOnce({ run: { checkpoint: { payload: { sessionFile: '/missing.jsonl' } } } });
    fs.existsSync.mockReturnValueOnce(false);
    await expect(recoverConversationCapability('conv-1', context())).rejects.toThrow('Conversation not found.');

    durableRuns.getDurableRun.mockResolvedValueOnce({ run: { checkpoint: { payload: { sessionFile: '/session.jsonl' } } } });
    await expect(recoverConversationCapability('conv-1', context())).rejects.toThrow(
      'Could not determine the conversation working directory.',
    );
  });
});
