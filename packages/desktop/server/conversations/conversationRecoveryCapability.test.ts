import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createWebLiveConversationRunIdMock,
  existsSyncMock,
  getDurableRunMock,
  isLiveSessionMock,
  listRecoverableWebLiveConversationRunsMock,
  liveRegistry,
  logErrorMock,
  parsePendingOperationMock,
  promptSessionMock,
  queuePromptContextMock,
  readConversationSessionMetaMock,
  repairLiveSessionTranscriptTailMock,
  resumeSessionMock,
  syncWebLiveConversationRunMock,
} = vi.hoisted(() => ({
  createWebLiveConversationRunIdMock: vi.fn(),
  existsSyncMock: vi.fn(),
  getDurableRunMock: vi.fn(),
  isLiveSessionMock: vi.fn(),
  listRecoverableWebLiveConversationRunsMock: vi.fn(),
  liveRegistry: new Map<string, unknown>(),
  logErrorMock: vi.fn(),
  parsePendingOperationMock: vi.fn(),
  promptSessionMock: vi.fn(),
  queuePromptContextMock: vi.fn(),
  readConversationSessionMetaMock: vi.fn(),
  repairLiveSessionTranscriptTailMock: vi.fn(),
  resumeSessionMock: vi.fn(),
  syncWebLiveConversationRunMock: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: existsSyncMock,
  };
});

vi.mock('@neon-pilot/daemon', () => ({
  parsePendingOperation: parsePendingOperationMock,
}));

vi.mock('../automation/durableRuns.js', () => ({
  getDurableRun: getDurableRunMock,
}));

vi.mock('./conversationRuns.js', () => ({
  createWebLiveConversationRunId: createWebLiveConversationRunIdMock,
  listRecoverableWebLiveConversationRuns: listRecoverableWebLiveConversationRunsMock,
  syncWebLiveConversationRun: syncWebLiveConversationRunMock,
}));

vi.mock('./liveSessions.js', () => ({
  isLive: isLiveSessionMock,
  promptSession: promptSessionMock,
  queuePromptContext: queuePromptContextMock,
  repairLiveSessionTranscriptTail: repairLiveSessionTranscriptTailMock,
  registry: liveRegistry,
  resumeSession: resumeSessionMock,
}));

vi.mock('./conversationService.js', () => ({
  readConversationSessionMeta: readConversationSessionMetaMock,
  resolveConversationSessionFile: vi.fn(() => undefined),
}));

vi.mock('../middleware/index.js', () => ({
  logError: logErrorMock,
}));

import { recoverConversationCapability, type RecoverConversationCapabilityContext } from './conversationRecovery.js';

function createContext(): RecoverConversationCapabilityContext {
  return {
    getRuntimeScope: () => 'assistant',
    buildLiveSessionResourceOptions: () => ({ additionalExtensionPaths: ['extensions'] }),
    buildLiveSessionResourceOptionsAsync: async () => ({ additionalExtensionPaths: ['async-extensions'] }),
    buildLiveSessionExtensionFactories: () => ['factory'] as never,
    flushLiveDeferredResumes: vi.fn().mockResolvedValue(undefined),
  };
}

describe('recoverConversationCapability', () => {
  beforeEach(() => {
    liveRegistry.clear();
    existsSyncMock.mockReset();
    getDurableRunMock.mockReset();
    isLiveSessionMock.mockReset();
    listRecoverableWebLiveConversationRunsMock.mockReset();
    logErrorMock.mockReset();
    parsePendingOperationMock.mockReset();
    promptSessionMock.mockReset();
    queuePromptContextMock.mockReset();
    readConversationSessionMetaMock.mockReset();
    repairLiveSessionTranscriptTailMock.mockReset();
    resumeSessionMock.mockReset();
    syncWebLiveConversationRunMock.mockReset();
    createWebLiveConversationRunIdMock.mockReset();

    syncWebLiveConversationRunMock.mockResolvedValue({ runId: 'run-1' });
    promptSessionMock.mockResolvedValue(undefined);
    repairLiveSessionTranscriptTailMock.mockReturnValue({
      recoverable: false,
      repaired: false,
      reason: null,
    });
  });

  afterEach(() => {
    liveRegistry.clear();
  });

  it('repairs but does not prompt when a live conversation ends with a recoverable tail', async () => {
    isLiveSessionMock.mockReturnValueOnce(true);
    repairLiveSessionTranscriptTailMock.mockReturnValueOnce({
      recoverable: true,
      repaired: true,
      reason: 'assistant_error',
    });
    liveRegistry.set('conversation-live', {
      cwd: '/repo/live',
      title: 'Live title',
      session: { sessionFile: '/sessions/live.json' },
    });
    readConversationSessionMetaMock.mockReturnValueOnce({
      cwd: '/repo/live',
      title: 'Live title',
    });

    const result = await recoverConversationCapability('conversation-live', createContext());

    expect(repairLiveSessionTranscriptTailMock).toHaveBeenCalledWith('conversation-live');
    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation-live',
        sessionFile: '/sessions/live.json',
        cwd: '/repo/live',
        title: 'Live title',
        profile: 'assistant',
        state: 'waiting',
        pendingOperation: null,
      }),
    );
    expect(promptSessionMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      conversationId: 'conversation-live',
      live: true,
      recovered: true,
      replayedPendingOperation: false,
      usedFallbackPrompt: false,
      perf: expect.any(Object),
    });
  });

  it('does not replay pending operations while passively resuming a stored conversation', async () => {
    isLiveSessionMock.mockReturnValueOnce(false);
    createWebLiveConversationRunIdMock.mockReturnValueOnce('web-run:conversation-1');
    getDurableRunMock.mockResolvedValueOnce({
      run: {
        checkpoint: {
          payload: {
            pendingOperation: { type: 'prompt', text: 'ignored' },
            profile: ' reviewer ',
          },
        },
        manifest: {
          source: { filePath: ' /sessions/from-run.json ' },
          spec: { cwd: ' /manifest-cwd ' },
        },
      },
    });
    readConversationSessionMetaMock.mockReturnValueOnce({
      file: '/sessions/stored.json',
      cwd: '/repo/stored',
      title: 'Stored title',
    });
    existsSyncMock.mockReturnValueOnce(true);
    resumeSessionMock.mockResolvedValueOnce({ id: 'conversation-1-live' });
    liveRegistry.set('conversation-1-live', {
      cwd: '/repo/resumed',
      title: 'Stored title',
      session: {},
    });

    const result = await recoverConversationCapability('conversation-1', createContext());

    expect(parsePendingOperationMock).not.toHaveBeenCalled();
    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation-1-live',
        state: 'waiting',
        pendingOperation: null,
      }),
    );
    expect(queuePromptContextMock).not.toHaveBeenCalled();
    expect(promptSessionMock).not.toHaveBeenCalled();
    expect(result.replayedPendingOperation).toBe(false);
  });

  it('replays pending operations after explicitly resuming a stored conversation', async () => {
    const pendingOperation = {
      type: 'prompt' as const,
      text: 'Continue the deployment review.',
      behavior: 'followUp' as const,
      contextMessages: [{ customType: 'referenced_context', content: 'Remember the staging note.' }],
      enqueuedAt: '2026-04-21T12:05:00.000Z',
    };

    isLiveSessionMock.mockReturnValueOnce(false);
    createWebLiveConversationRunIdMock.mockReturnValueOnce('web-run:conversation-1');
    getDurableRunMock.mockResolvedValueOnce({
      run: {
        checkpoint: {
          payload: {
            pendingOperation: { type: 'prompt', text: 'ignored' },
            profile: ' reviewer ',
          },
        },
        manifest: {
          source: { filePath: ' /sessions/from-run.json ' },
          spec: { cwd: ' /manifest-cwd ' },
        },
      },
    });
    parsePendingOperationMock.mockReturnValueOnce(pendingOperation);
    readConversationSessionMetaMock.mockReturnValueOnce({
      file: '/sessions/stored.json',
      cwd: '/repo/stored',
      title: 'Stored title',
    });
    existsSyncMock.mockReturnValueOnce(true);
    resumeSessionMock.mockResolvedValueOnce({ id: 'conversation-1-live' });
    repairLiveSessionTranscriptTailMock.mockReturnValueOnce({
      recoverable: true,
      repaired: true,
      reason: 'assistant_error',
    });
    liveRegistry.set('conversation-1-live', {
      cwd: '/repo/resumed',
      title: 'Stored title',
      session: {},
    });

    const context = createContext();
    const result = await recoverConversationCapability('conversation-1', context, { replayPendingOperation: true });

    expect(createWebLiveConversationRunIdMock).toHaveBeenCalledWith('conversation-1');
    expect(resumeSessionMock).toHaveBeenCalledWith('/sessions/stored.json', {
      additionalExtensionPaths: ['async-extensions'],
      extensionFactories: ['factory'],
      cwdOverride: '/repo/stored',
    });
    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith({
      conversationId: 'conversation-1-live',
      sessionFile: '/sessions/stored.json',
      cwd: '/repo/resumed',
      title: 'Stored title',
      profile: 'reviewer',
      state: 'running',
      pendingOperation,
    });
    expect(queuePromptContextMock).toHaveBeenCalledWith('conversation-1-live', 'referenced_context', 'Remember the staging note.');
    expect(promptSessionMock).toHaveBeenCalledWith(
      'conversation-1-live',
      'Continue the deployment review.',
      'followUp',
      undefined,
      undefined,
    );
    expect(result).toEqual({
      conversationId: 'conversation-1-live',
      live: true,
      recovered: true,
      replayedPendingOperation: true,
      usedFallbackPrompt: false,
      perf: expect.any(Object),
    });
  });
});
