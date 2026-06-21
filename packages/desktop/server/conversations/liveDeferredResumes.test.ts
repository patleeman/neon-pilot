import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  activateDueDeferredResumesForSessionFileMock,
  backfillDeferredResumesToAttentionEventsMock,
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
  submitPromptSessionMock,
  queuePromptContextMock,
  syncWebLiveConversationRunMock,
  liveRegistry,
} = vi.hoisted(() => ({
  activateDueDeferredResumesForSessionFileMock: vi.fn(),
  backfillDeferredResumesToAttentionEventsMock: vi.fn(),
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
  submitPromptSessionMock: vi.fn(),
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
  backfillDeferredResumesToAttentionEvents: backfillDeferredResumesToAttentionEventsMock,
  completeDeferredResumeForSessionFile: completeDeferredResumeForSessionFileMock,
  listDeferredResumesForSessionFile: listDeferredResumesForSessionFileMock,
  retryDeferredResumeForSessionFile: retryDeferredResumeForSessionFileMock,
}));

vi.mock('@neon-pilot/core', () => ({
  activateDueAttentionEvents: activateDueAttentionEventsMock,
  completeAttentionEvents: completeAttentionEventsMock,
  getReadySessionAttentionEvents: getReadySessionAttentionEventsMock,
  loadAttentionEventsState: loadAttentionEventsStateMock,
  retryAttentionEvents: retryAttentionEventsMock,
  saveAttentionEventsState: saveAttentionEventsStateMock,
}));

vi.mock('@neon-pilot/daemon', () => ({
  completeDeferredResumeConversationRun: completeDeferredResumeConversationRunMock,
  markDeferredResumeConversationRunReady: markDeferredResumeConversationRunReadyMock,
  markDeferredResumeConversationRunRetryScheduled: markDeferredResumeConversationRunRetryScheduledMock,
  surfaceReadyDeferredResume: surfaceReadyDeferredResumeMock,
}));

vi.mock('./liveSessions.js', () => ({
  getLiveSessions: getLiveSessionsMock,
  promptSession: promptSessionMock,
  submitPromptSession: submitPromptSessionMock,
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
  backfillDeferredResumesToAttentionEventsMock.mockReset();
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
  submitPromptSessionMock.mockReset();
  queuePromptContextMock.mockReset();
  syncWebLiveConversationRunMock.mockReset();
  liveRegistry.clear();

  markDeferredResumeConversationRunReadyMock.mockResolvedValue(undefined);
  completeDeferredResumeConversationRunMock.mockResolvedValue(undefined);
  markDeferredResumeConversationRunRetryScheduledMock.mockResolvedValue(undefined);
  promptSessionMock.mockResolvedValue(undefined);
  submitPromptSessionMock.mockImplementation((_sessionId, text, behavior) => {
    const completion = promptSessionMock(_sessionId, text, behavior);
    return { acceptedAs: 'started', completion };
  });
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
      getRuntimeScope: () => 'datadog',
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
          text: expect.stringContaining('Continue from here.'),
        }),
      }),
    );
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', expect.stringContaining('Continue from here.'), undefined);
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'deferred_auto_resume',
      expect.stringContaining('This is NOT a new message from the user'),
    );
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'deferred_auto_resume',
      expect.stringContaining('Source: deferred resume requested earlier in this conversation'),
    );
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
      getRuntimeScope: () => 'datadog',
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
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', expect.stringContaining('Continue from here.'), undefined);
  });

  it('consumes a follow-up deferred resume as soon as it is accepted by the live queue', async () => {
    const ready = { ...createReadyResume(), behavior: 'followUp' as const };
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
    completeDeferredResumeForSessionFileMock.mockReturnValue(ready);

    let resolveCompletion: (() => void) | undefined;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    submitPromptSessionMock.mockReturnValue({ acceptedAs: 'queued', completion });

    const publishConversationSessionMetaChanged = vi.fn();
    const flush = createAttentionEventFlusher({
      getRuntimeScope: () => 'datadog',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged,
    });

    const flushPromise = flush();
    await vi.waitFor(() =>
      expect(completeDeferredResumeForSessionFileMock).toHaveBeenCalledWith({ sessionFile: '/tmp/session-1.jsonl', id: 'resume-1' }),
    );

    expect(publishConversationSessionMetaChanged).toHaveBeenCalledWith('conv-1');
    expect(completeDeferredResumeConversationRunMock).not.toHaveBeenCalled();

    resolveCompletion?.();
    await flushPromise;

    expect(completeDeferredResumeConversationRunMock).toHaveBeenCalledWith(expect.objectContaining({ deferredResumeId: 'resume-1' }));
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
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo-root',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    const visiblePrompt = 'Background task information-architecture-eval completed';
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'background_auto_resume',
      expect.stringContaining('Background task run-123 has finished.'),
    );
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', visiblePrompt, undefined);
    expect(syncWebLiveConversationRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingOperation: expect.objectContaining({
          text: visiblePrompt,
          contextMessages: [
            expect.objectContaining({
              customType: 'background_auto_resume',
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
      getRuntimeScope: () => 'shared',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    expect(promptSessionMock).toHaveBeenCalledTimes(1);
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', expect.stringContaining('Multiple wakeups are ready'), undefined);
    // Task payloads now go into context blocks, not the visible prompt
    expect(queuePromptContextMock).toHaveBeenCalledWith('conv-1', 'deferred_auto_resume', expect.stringContaining('Continue from here.'));
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'deferred_auto_resume',
      expect.stringContaining('Check the second thing.'),
    );
    expect(completeDeferredResumeForSessionFileMock).toHaveBeenCalledWith({ sessionFile: '/tmp/session-1.jsonl', id: 'resume-1' });
    expect(completeDeferredResumeForSessionFileMock).toHaveBeenCalledWith({ sessionFile: '/tmp/session-1.jsonl', id: 'resume-2' });
    expect(completeDeferredResumeConversationRunMock).toHaveBeenCalledTimes(2);
  });

  it('batches background run follow-up wakeups into one prompt', async () => {
    const first = {
      ...createReadyResume('run-resume-1'),
      prompt: 'Background task publish failed. status=failed',
      title: 'Background task publish failed',
      behavior: 'followUp' as const,
      delivery: { requireAck: false, mode: 'sequential' as const },
      source: { kind: 'background-run', id: 'run-1' },
    };
    const second = {
      ...createReadyResume('run-resume-2'),
      prompt: 'Background task publish retry failed. status=failed',
      title: 'Background task publish retry failed',
      behavior: 'followUp' as const,
      delivery: { requireAck: false, mode: 'sequential' as const },
      source: { kind: 'background-run', id: 'run-2' },
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
    completeDeferredResumeForSessionFileMock.mockImplementation(({ id }: { id: string }) => (id === 'run-resume-1' ? first : second));

    const flush = createAttentionEventFlusher({
      getRuntimeScope: () => 'shared',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    expect(promptSessionMock).toHaveBeenCalledTimes(1);
    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', expect.stringContaining('Multiple wakeups are ready'), undefined);
    expect(promptSessionMock.mock.calls[0]?.[1]).toContain('Background task publish failed');
    expect(promptSessionMock.mock.calls[0]?.[1]).toContain('Background task publish retry failed');
    expect(queuePromptContextMock).toHaveBeenCalledTimes(2);
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'background_auto_resume',
      expect.stringContaining('agent resumed automatically'),
    );
  });

  it('delivers scheduled task attention events with system wakeup context', async () => {
    const attentionEvent = {
      id: 'attention-1',
      sessionFile: '/tmp/session-1.jsonl',
      prompt: 'Scheduled task result is ready.',
      dueAt: '2026-04-15T10:00:00.000Z',
      createdAt: '2026-04-15T09:59:00.000Z',
      attempts: 0,
      status: 'ready' as const,
      readyAt: '2026-04-15T10:00:00.000Z',
      source: { kind: 'scheduled-task', id: 'watch-prod' },
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
      getRuntimeScope: () => 'shared',
      getStateRoot: () => '/state',
      resolveDaemonRoot: () => '/daemon',
      publishConversationSessionMetaChanged: vi.fn(),
    });

    await flush();

    expect(promptSessionMock).toHaveBeenCalledWith('conv-1', expect.stringContaining('Scheduled task result is ready.'), undefined);
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'deferred_auto_resume',
      expect.stringContaining('Source: scheduled task watch-prod'),
    );
    expect(queuePromptContextMock).toHaveBeenCalledWith(
      'conv-1',
      'deferred_auto_resume',
      expect.stringContaining('This is NOT a new message from the user'),
    );
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
      getRuntimeScope: () => 'datadog',
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
