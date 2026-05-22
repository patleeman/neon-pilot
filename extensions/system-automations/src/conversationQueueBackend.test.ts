import { beforeEach, describe, expect, it, vi } from 'vitest';

const cancelDeferredResumeForSessionFile = vi.fn();
const cancelQueuedPrompt = vi.fn();
const deleteStoredAutomation = vi.fn();
const getSessionDeferredResumeEntries = vi.fn();
const listQueuedPromptPreviews = vi.fn();
const listStoredAutomations = vi.fn();
const loadAutomationRuntimeStateMap = vi.fn();
const loadDeferredResumeState = vi.fn();
const parseDeferredResumeDelayMs = vi.fn();
const parseFutureHumanDateTime = vi.fn();
const promptSession = vi.fn();
const queuePromptContext = vi.fn();
const scheduleDeferredResumeForSessionFile = vi.fn();
const getDurableRun = vi.fn();

vi.mock('@neon-pilot/extensions/backend/automations', () => ({
  cancelDeferredResumeForSessionFile,
  cancelQueuedPrompt,
  DEFAULT_DEFERRED_RESUME_PROMPT: 'Continue.',
  deleteStoredAutomation,
  getSessionDeferredResumeEntries,
  listQueuedPromptPreviews,
  listStoredAutomations,
  loadAutomationRuntimeStateMap,
  loadDeferredResumeState,
  parseDeferredResumeDelayMs,
  parseFutureHumanDateTime,
  promptSession,
  queuePromptContext,
  scheduleDeferredResumeForSessionFile,
}));
vi.mock('@neon-pilot/extensions/backend/runs', () => ({ getDurableRun }));

const { deferredResume } = await import('./conversationQueueBackend.js');

describe('conversationQueueBackend deferredResume', () => {
  beforeEach(() => {
    for (const mock of [
      cancelDeferredResumeForSessionFile,
      cancelQueuedPrompt,
      deleteStoredAutomation,
      getSessionDeferredResumeEntries,
      listQueuedPromptPreviews,
      listStoredAutomations,
      loadAutomationRuntimeStateMap,
      loadDeferredResumeState,
      parseDeferredResumeDelayMs,
      parseFutureHumanDateTime,
      promptSession,
      queuePromptContext,
      scheduleDeferredResumeForSessionFile,
      getDurableRun,
    ]) {
      mock.mockReset();
    }
    listQueuedPromptPreviews.mockResolvedValue({ steering: [{ id: 's1', text: 'Steer' }], followUp: [{ id: 'f1', text: 'Follow' }] });
    loadAutomationRuntimeStateMap.mockResolvedValue({});
    listStoredAutomations.mockResolvedValue([]);
    loadDeferredResumeState.mockResolvedValue({});
    getSessionDeferredResumeEntries.mockResolvedValue([]);
  });

  it('lists live queued prompts, conversation automations, and deferred resumes sorted by time', async () => {
    listStoredAutomations.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Task',
        prompt: 'Task prompt',
        targetType: 'conversation',
        threadSessionFile: '/s.json',
        schedule: { type: 'at', at: '2026-05-22T12:00:00.000Z' },
        conversationBehavior: 'steer',
      },
      { id: 'done', targetType: 'conversation', threadSessionFile: '/s.json', schedule: { type: 'at', at: '2026-05-21T12:00:00.000Z' } },
    ]);
    loadAutomationRuntimeStateMap.mockResolvedValue({ done: { oneTimeResolvedAt: '2026-05-21T12:01:00.000Z' } });
    getSessionDeferredResumeEntries.mockResolvedValue([
      {
        id: 'resume-1',
        sessionFile: '/s.json',
        prompt: 'Resume',
        dueAt: '2026-05-22T11:00:00.000Z',
        createdAt: '',
        attempts: 0,
        status: 'scheduled',
        kind: 'continue',
        title: 'Resume title',
        behavior: 'followUp',
      },
    ]);

    const result = await deferredResume(
      { action: 'list' },
      { profile: 'shared', toolContext: { sessionId: 'c1', sessionFile: '/s.json' } },
    );

    expect(result.text).toContain('Follow-up queue (4):');
    expect(result.items.map((item) => item.id)).toEqual(['live:followUp:f1', 'live:steer:s1', 'resume-1', 'task-1']);
  });

  it('adds after-turn follow-ups to the live queue and invalidates sessions/runs', async () => {
    const invalidate = vi.fn();

    await expect(
      deferredResume(
        { action: 'add', trigger: 'after_turn', prompt: 'Keep going', deliverAs: 'steer' },
        { profile: 'shared', toolContext: { sessionId: 'c1' }, ui: { invalidate } },
      ),
    ).resolves.toMatchObject({ action: 'add', trigger: 'after_turn', sessionId: 'c1', prompt: 'Keep going', deliverAs: 'steer' });
    expect(queuePromptContext).toHaveBeenCalledWith('c1', 'after_turn_auto_resume', expect.stringContaining('Keep going'));
    expect(promptSession).toHaveBeenCalledWith('c1', 'Keep going', 'steer');
    expect(invalidate).toHaveBeenCalledWith(['sessions', 'runs']);
  });

  it('adds time-based deferred resumes and blocks redundant background run polling without a reason', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-22T10:00:00.000Z').getTime());
    parseDeferredResumeDelayMs.mockReturnValue(60_000);
    scheduleDeferredResumeForSessionFile.mockResolvedValue({ id: 'resume-1', prompt: 'Check later', dueAt: '2026-05-22T10:01:00.000Z' });
    getDurableRun.mockResolvedValue({
      run: { status: { status: 'running' }, manifest: { spec: { metadata: { callbackConversation: {}, resumeParentOnExit: true } } } },
    });

    await expect(
      deferredResume(
        { action: 'add', trigger: 'delay', delay: '1m', prompt: 'Check run-abc later' },
        { profile: 'shared', toolContext: { sessionId: 'c1', sessionFile: '/s.json' } },
      ),
    ).rejects.toThrow('already delivers completion/failure');

    await expect(
      deferredResume(
        { action: 'add', trigger: 'delay', delay: '1m', prompt: 'Check run-abc later', reason: 'separate timed check' },
        { profile: 'shared', toolContext: { sessionId: 'c1', sessionFile: '/s.json' } },
      ),
    ).resolves.toMatchObject({ id: 'resume-1', dueAt: '2026-05-22T10:01:00.000Z' });
  });

  it('cancels live queue, automation, and deferred-resume items', async () => {
    cancelQueuedPrompt.mockResolvedValue(true);
    listStoredAutomations.mockResolvedValue([{ id: 'task-1', targetType: 'conversation', threadSessionFile: '/s.json', prompt: 'Task' }]);
    cancelDeferredResumeForSessionFile.mockResolvedValue({ id: 'resume-1', prompt: 'Resume' });

    await expect(
      deferredResume({ action: 'cancel', id: 'live:steer:s1' }, { profile: 'shared', toolContext: { sessionId: 'c1' } }),
    ).resolves.toMatchObject({ cancelled: true });
    await expect(
      deferredResume({ action: 'cancel', id: 'task-1' }, { profile: 'shared', toolContext: { sessionId: 'c1', sessionFile: '/s.json' } }),
    ).resolves.toMatchObject({ id: 'task-1', prompt: 'Task' });
    expect(deleteStoredAutomation).toHaveBeenCalledWith('task-1');
    listStoredAutomations.mockResolvedValue([]);
    await expect(
      deferredResume({ action: 'cancel', id: 'resume-1' }, { profile: 'shared', toolContext: { sessionId: 'c1', sessionFile: '/s.json' } }),
    ).resolves.toMatchObject({ id: 'resume-1', prompt: 'Resume' });
  });
});
