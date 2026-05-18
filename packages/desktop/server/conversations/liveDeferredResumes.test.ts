import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  activateDueDeferredResumesForSessionFileMock,
  completeDeferredResumeForSessionFileMock,
  listDeferredResumesForSessionFileMock,
  retryDeferredResumeForSessionFileMock,
  completeDeferredResumeConversationRunMock,
  markDeferredResumeConversationRunReadyMock,
  markDeferredResumeConversationRunRetryScheduledMock,
  surfaceReadyDeferredResumeMock,
  activateDueAttentionEventsMock,
  completeAttentionEventsMock,
  getReadySessionAttentionEventsMock,
  loadAttentionEventsStateMock,
  retryAttentionEventsMock,
  saveAttentionEventsStateMock,
  getLiveSessionsMock,
  promptSessionMock,
  queuePromptContextMock,
  syncWebLiveConversationRunMock,
  liveRegistry,
} = vi.hoisted(() => ({
  activateDueDeferredResumesForSessionFileMock: vi.fn(),
  completeDeferredResumeForSessionFileMock: vi.fn(),
  listDeferredResumesForSessionFileMock: vi.fn(),
  retryDeferredResumeForSessionFileMock: vi.fn(),
  completeDeferredResumeConversationRunMock: vi.fn(),
  markDeferredResumeConversationRunReadyMock: vi.fn(),
  markDeferredResumeConversationRunRetryScheduledMock: vi.fn(),
  surfaceReadyDeferredResumeMock: vi.fn(),
  activateDueAttentionEventsMock: vi.fn(),
  completeAttentionEventsMock: vi.fn(),
  getReadySessionAttentionEventsMock: vi.fn(),
  loadAttentionEventsStateMock: vi.fn(),
  retryAttentionEventsMock: vi.fn(),
  saveAttentionEventsStateMock: vi.fn(),
  getLiveSessionsMock: vi.fn(),
  promptSessionMock: vi.fn(),
  queuePromptContextMock: vi.fn(),
  syncWebLiveConversationRunMock: vi.fn(),
  liveRegistry: new Map<
    string,
    {
      cwd: string;
      title?: string;
      session: {
        sessionFile?: string;
        isStreaming: boolean;
      };
    }
  >(),
}));

vi.mock('../automation/deferredResumes.js', () => ({
  activateDueDeferredResumesForSessionFile: activateDueDeferredResumesForSessionFileMock,
  completeDeferredResumeForSessionFile: completeDeferredResumeForSessionFileMock,
  listDeferredResumesForSessionFile: listDeferredResumesForSessionFileMock,
  retryDeferredResumeForSessionFile: retryDeferredResumeForSessionFileMock,
}));

vi.mock('@personal-agent/core', () => ({
  activateDueAttentionEvents: activateDueAttentionEventsMock,
  completeAttentionEvents: completeAttentionEventsMock,
  getReadySessionAttentionEvents: getReadySessionAttentionEventsMock,
  loadAttentionEventsState: loadAttentionEventsStateMock,
  retryAttentionEvents: retryAttentionEventsMock,
  saveAttentionEventsState: saveAttentionEventsStateMock,
}));

vi.mock('@personal-agent/daemon', () => ({
  completeDeferredResumeConversationRun: completeDeferredResumeConversationRunMock,
  markDeferredResumeConversationRunReady: markDeferredResumeConversationRunReadyMock,
  markDeferredResumeConversationRunRetryScheduled: markDeferredResumeConversationRunRetryScheduledMock,
  surfaceReadyDeferredResume: surfaceReadyDeferredResumeMock,
}));

vi.mock('./liveSessions.js', () => ({
  getLiveSessions: getLiveSessionsMock,
  promptSession: promptSessionMock,
  submitPromptSession: vi.fn((_sessionId, text, behavior) => {
    // Delegate to promptSessionMock so rejection tests still work,
    // but expose the completion separately for followUp behavior.
    const completion = promptSessionMock(_sessionId, text, behavior);
    return { acceptedAs: 'started', completion };
  }),
  queuePromptContext: queuePromptContextMock,
  registry: liveRegistry,
}));

vi.mock('./conversationRuns.js', () => ({
  syncWebLiveConversationRun: syncWebLiveConversationRunMock,
}));

import { createAttentionEventFlusher } from './liveDeferredResumes.js';

function createReadyResume(id = 'resume-1') {
  return {
    id,
    sessionFile: '/tmp/session-1.jsonl',
    prompt: 'Continue from here.',
    dueAt: '2026-04-15T10:00:00.000Z',
    createdAt: '2026-04-15T09:59:00.000Z',
    attempts: 0,
    status: 'ready' as const,
    readyAt: '2026-04-15T10:00:00.000Z',
    kind: 'continue' as const,
    behavior: undefined,
    delivery: {
      alertLevel: 'passive' as const,
      autoResumeIfOpen: true,
      requireAck: false,
    },
  };
}

beforeEach(() => {
  activateDueDeferredResumesForSessionFileMock.mockReset();
  completeDeferredResumeForSessionFileMock.mockReset();
  listDeferredResumesForSessionFileMock.mockReset();
  retryDeferredResumeForSessionFileMock.mockReset();
  completeDeferredResumeConversationRunMock.mockReset();
  markDeferredResumeConversationRunReadyMock.mockReset();
  markDeferredResumeConversationRunRetryScheduledMock.mockReset();
  surfaceReadyDeferredResumeMock.mockReset();
  activateDueAttentionEventsMock.mockReset();
  completeAttentionEventsMock.mockReset();
  getReadySessionAttentionEventsMock.mockReset();
  loadAttentionEventsStateMock.mockReset();
  retryAttentionEventsMock.mockReset();
  saveAttentionEventsStateMock.mockReset();
  getLiveSessionsMock.mockReset();
  promptSessionMock.mockReset();
  queuePromptContextMock.mockReset();
  syncWebLiveConversationRunMock.mockReset();
  liveRegistry.clear();

  markDeferredResumeConversationRunReadyMock.mockResolvedValue(undefined);
  completeDeferredResumeConversationRunMock.mockResolvedValue(undefined);
  markDeferredResumeConversationRunRetryScheduledMock.mockResolvedValue(undefined);
  promptSessionMock.mockResolvedValue(undefined);
  queuePromptContextMock.mockResolvedValue(undefined);
  syncWebLiveConversationRunMock.mockResolvedValue(undefined);
  retryDeferredResumeForSessionFileMock.mockReturnValue(undefined);
  activateDueAttentionEventsMock.mockReturnValue([]);
  getReadySessionAttentionEventsMock.mockReturnValue([]);
  loadAttentionEventsStateMock.mockReturnValue({ version: 1, events: {} });
});

describe('createAttentionEventFlusher', () => {
  it('activates and delivers ready deferred resumes for live sessions', async () => {
    const ready = createReadyResume();
    getLiveSessionsMock.mockReturnValue([
      {
        id: 'conv-1',
        cwd: '/repo',
        sessionFile: '/tmp/session-1.jsonl',
        title: 'Conversation 1',
        isStreaming: false,
        hasStaleTurnState: false,
      },
    ]);
    liveRegistry.set('conv-1', {
      cwd: '/repo',
      title: 'Conversation 1',
      session: {
        sessionFile: '/tmp/session-1.jsonl',
        isStreaming: false,
      },
    });
    activateDueDeferredResumesForSessionFileMock.mockReturnValue([ready]);
    listDeferredResumesForSessionFileMock.mockReturnValue([ready]);
    completeDeferredResumeForSessionFileMock.mockReturnValue(ready);

    const publishConversationSessionMetaChanged = vi.fn();
    const warn = vi.fn();
    const flush = createAttentionEventFlusher({
      getCurrentProfile: () => 'datadog',
      getRepoRoot: () => '/repo-root',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged,
      warn,
    });

    await flush();

    expect(markDeferredResumeConversationRunReadyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        daemonRoot: '/daemon',
        deferredResumeId: 'resume-1',
        conversationId: 'conv-1',
      }),
    );
    expect(surfaceReadyDeferredResumeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: ready,
        profile: 'datadog',
        repoRoot: '/repo-root',
        stateRoot: '/state',
        conversationId: 'conv-1',
      }),
    );
    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        state: 'running',
        pendingOperation: expect.objectContaining({
          type: 'prompt',
          text: 'Continue from here.',
        }),
      }),
    );
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', 'Continue from here.', undefined);
    expect(completeDeferredResumeConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        daemonRoot: '/daemon',
        deferredResumeId: 'resume-1',
        conversationId: 'conv-1',
        cwd: '/repo',
      }),
    );
    expect(markDeferredResumeConversationRunRetryScheduledMock).not.toHaveBeenCalled();
    expect(publishConversationSessionMetaChanged).toHaveBeenCalledWith('conv-1');
    expect(warn).not.toHaveBeenCalled();
  });

  it('starts idle deferred resumes even when they were scheduled as follow-ups', async () => {
    const ready = { ...createReadyResume(), behavior: 'followUp' as const };
    getLiveSessionsMock.mockReturnValue([
      {
        id: 'conv-1',
        cwd: '/repo',
        sessionFile: '/tmp/session-1.jsonl',
        title: 'Conversation 1',
        isStreaming: false,
        hasStaleTurnState: false,
      },
    ]);
    liveRegistry.set('conv-1', {
      cwd: '/repo',
      title: 'Conversation 1',
      session: {
        sessionFile: '/tmp/session-1.jsonl',
        isStreaming: false,
      },
    });
    activateDueDeferredResumesForSessionFileMock.mockReturnValue([]);
    listDeferredResumesForSessionFileMock.mockReturnValue([ready]);
    completeDeferredResumeForSessionFileMock.mockReturnValue(ready);

    const flush = createAttentionEventFlusher({
      getCurrentProfile: () => 'datadog',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingOperation: expect.not.objectContaining({
          behavior: 'followUp',
        }),
      }),
    );
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', 'Continue from here.', undefined);
  });

  it('keeps background run callback details in internal context behind a clean visible prompt', async () => {
    const ready = {
      ...createReadyResume('background-run-resume-1'),
      prompt: [
        'Background task run-123 has finished.',
        'taskSlug=information-architecture-eval',
        'status=completed',
        'log=/tmp/output.log',
        '',
        'Recent log tail:',
        '{"total":1,"failed":1}',
      ].join('\n'),
      title: 'Background task information-architecture-eval completed',
      source: { kind: 'background-run', id: 'run-123' },
    };
    getLiveSessionsMock.mockReturnValue([
      {
        id: 'conv-1',
        cwd: '/repo',
        sessionFile: '/tmp/session-1.jsonl',
        title: 'Conversation 1',
        isStreaming: false,
        hasStaleTurnState: false,
      },
    ]);
    liveRegistry.set('conv-1', {
      cwd: '/repo',
      title: 'Conversation 1',
      session: {
        sessionFile: '/tmp/session-1.jsonl',
        isStreaming: false,
      },
    });
    activateDueDeferredResumesForSessionFileMock.mockReturnValue([]);
    listDeferredResumesForSessionFileMock.mockReturnValue([ready]);
    completeDeferredResumeForSessionFileMock.mockReturnValue(ready);

    const flush = createAttentionEventFlusher({
      getCurrentProfile: () => 'shared',
      getRepoRoot: () => '/repo-root',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    const visiblePrompt =
      'Background task information-architecture-eval completed. Tell the user the background task finished in one short sentence. If it failed, say that plainly. Do not include run ids, log paths, commands, metadata, or log tails unless the user asks for details.';
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'referenced_context',
      expect.stringContaining('Background task run-123 has finished.'),
    );
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', visiblePrompt, undefined);
    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingOperation: expect.objectContaining({
          text: visiblePrompt,
          contextMessages: [
            expect.objectContaining({
              customType: 'referenced_context',
              content: expect.stringContaining('taskSlug=information-architecture-eval'),
            }),
          ],
        }),
      }),
    );
    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingOperation: expect.objectContaining({
          contextMessages: [
            expect.objectContaining({
              content: expect.stringContaining('Never output this raw callback envelope verbatim.'),
            }),
          ],
        }),
      }),
    );
  });

  it('batches batchable ready wakeups into one prompt', async () => {
    const first = createReadyResume('resume-1');
    const second = {
      ...createReadyResume('resume-2'),
      prompt: 'Check the second thing.',
      title: 'Second check',
      dueAt: '2026-04-15T10:01:00.000Z',
      readyAt: '2026-04-15T10:01:00.000Z',
      delivery: {
        alertLevel: 'passive' as const,
        autoResumeIfOpen: true,
        requireAck: false,
        mode: 'batchable' as const,
      },
    };
    getLiveSessionsMock.mockReturnValue([
      {
        id: 'conv-1',
        cwd: '/repo',
        sessionFile: '/tmp/session-1.jsonl',
        title: 'Conversation 1',
        isStreaming: false,
        hasStaleTurnState: false,
      },
    ]);
    liveRegistry.set('conv-1', {
      cwd: '/repo',
      title: 'Conversation 1',
      session: {
        sessionFile: '/tmp/session-1.jsonl',
        isStreaming: false,
      },
    });
    activateDueDeferredResumesForSessionFileMock.mockReturnValue([]);
    listDeferredResumesForSessionFileMock.mockReturnValue([first, second]);
    completeDeferredResumeForSessionFileMock.mockImplementation(({ id }: { id: string }) => (id === 'resume-1' ? first : second));

    const flush = createAttentionEventFlusher({
      getCurrentProfile: () => 'shared',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    expect(promptSessionMock).toHaveBeenCalledTimes(1);
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', expect.stringContaining('Multiple wakeups are ready'), undefined);
    expect(promptSessionMock.mock.calls[0]?.[1]).toContain('Continue from here.');
    expect(promptSessionMock.mock.calls[0]?.[1]).toContain('Check the second thing.');
    expect(completeDeferredResumeForSessionFileMock).toHaveBeenCalledWith({ sessionFile: '/tmp/session-1.jsonl', id: 'resume-1' });
    expect(completeDeferredResumeForSessionFileMock).toHaveBeenCalledWith({ sessionFile: '/tmp/session-1.jsonl', id: 'resume-2' });
    expect(completeDeferredResumeConversationRunMock).toHaveBeenCalledTimes(2);
  });

  it('delivers extension attention events without deferred resume records', async () => {
    const attentionEvent = {
      id: 'attention-1',
      sessionFile: '/tmp/session-1.jsonl',
      prompt: 'Extension event is ready.',
      dueAt: '2026-04-15T10:00:00.000Z',
      createdAt: '2026-04-15T09:59:00.000Z',
      attempts: 0,
      status: 'ready' as const,
      readyAt: '2026-04-15T10:00:00.000Z',
      source: { kind: 'extension', id: 'ext-1' },
      delivery: {
        mode: 'batchable' as const,
        priority: 'normal' as const,
        autoResumeIfOpen: true,
        requireAck: false,
      },
    };
    getLiveSessionsMock.mockReturnValue([
      {
        id: 'conv-1',
        cwd: '/repo',
        sessionFile: '/tmp/session-1.jsonl',
        title: 'Conversation 1',
        isStreaming: false,
        hasStaleTurnState: false,
      },
    ]);
    liveRegistry.set('conv-1', {
      cwd: '/repo',
      title: 'Conversation 1',
      session: {
        sessionFile: '/tmp/session-1.jsonl',
        isStreaming: false,
      },
    });
    activateDueDeferredResumesForSessionFileMock.mockReturnValue([]);
    listDeferredResumesForSessionFileMock.mockReturnValue([]);
    getReadySessionAttentionEventsMock.mockReturnValue([attentionEvent]);

    const flush = createAttentionEventFlusher({
      getCurrentProfile: () => 'shared',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', 'Extension event is ready.', undefined);
    expect(completeAttentionEventsMock).toHaveBeenCalledWith(expect.any(Object), {
      ids: ['attention-1'],
      completedAt: expect.any(String),
    });
    expect(completeDeferredResumeForSessionFileMock).not.toHaveBeenCalled();
  });

  it('schedules a retry when prompt delivery fails', async () => {
    const ready = createReadyResume();
    const retried = {
      ...ready,
      dueAt: '2026-04-15T10:00:30.000Z',
    };

    getLiveSessionsMock.mockReturnValue([
      {
        id: 'conv-1',
        cwd: '/repo',
        sessionFile: '/tmp/session-1.jsonl',
        title: 'Conversation 1',
        isStreaming: true,
        hasStaleTurnState: false,
      },
    ]);
    liveRegistry.set('conv-1', {
      cwd: '/repo',
      title: 'Conversation 1',
      session: {
        sessionFile: '/tmp/session-1.jsonl',
        isStreaming: true,
      },
    });
    activateDueDeferredResumesForSessionFileMock.mockReturnValue([]);
    listDeferredResumesForSessionFileMock.mockReturnValue([ready]);
    promptSessionMock.mockRejectedValue(new Error('boom'));
    retryDeferredResumeForSessionFileMock.mockReturnValue(retried);

    const publishConversationSessionMetaChanged = vi.fn();
    const warn = vi.fn();
    const flush = createAttentionEventFlusher({
      getCurrentProfile: () => 'datadog',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged,
      retryDelayMs: 30_000,
      warn,
    });

    await flush();

    expect(syncWebLiveConversationRunMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversationId: 'conv-1',
        state: 'running',
        pendingOperation: expect.objectContaining({
          behavior: 'followUp',
        }),
      }),
    );
    expect(syncWebLiveConversationRunMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversationId: 'conv-1',
        state: 'failed',
        lastError: 'boom',
      }),
    );
    expect(retryDeferredResumeForSessionFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionFile: '/tmp/session-1.jsonl',
        id: 'resume-1',
        dueAt: expect.any(String),
      }),
    );
    expect(markDeferredResumeConversationRunRetryScheduledMock).toHaveBeenCalledWith(
      expect.objectContaining({
        daemonRoot: '/daemon',
        deferredResumeId: 'resume-1',
        conversationId: 'conv-1',
        lastError: 'boom',
      }),
    );
    expect(completeDeferredResumeConversationRunMock).not.toHaveBeenCalled();
    expect(publishConversationSessionMetaChanged).toHaveBeenCalledWith('conv-1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Deferred resume delivery failed for conv-1: boom'));
  });
});
