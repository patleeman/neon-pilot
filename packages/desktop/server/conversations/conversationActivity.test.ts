import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listConversationActivity } from './conversationActivity.js';

const mocks = vi.hoisted(() => ({
  listConversationExecutions: vi.fn(),
  readConversationSessionMeta: vi.fn(),
  listQueuedPromptPreviews: vi.fn(),
}));

vi.mock('../executions/executionService.js', () => ({
  listConversationExecutions: mocks.listConversationExecutions,
}));

vi.mock('./conversationService.js', () => ({
  readConversationSessionMeta: mocks.readConversationSessionMeta,
}));

vi.mock('./liveSessions.js', () => ({
  listQueuedPromptPreviews: mocks.listQueuedPromptPreviews,
}));

describe('conversation activity projection', () => {
  beforeEach(() => {
    mocks.listConversationExecutions.mockReset();
    mocks.readConversationSessionMeta.mockReset();
    mocks.listQueuedPromptPreviews.mockReset();
    mocks.listConversationExecutions.mockResolvedValue({ executions: [] });
    mocks.readConversationSessionMeta.mockReturnValue(null);
    mocks.listQueuedPromptPreviews.mockImplementation(() => {
      throw new Error('not live');
    });
  });

  it('combines active executions, deferred resumes, scheduled tasks, and queued prompts', async () => {
    mocks.listConversationExecutions.mockResolvedValue({
      executions: [
        {
          id: 'run-1',
          kind: 'subagent',
          visibility: 'primary',
          conversationId: 'conversation-1',
          title: 'Review diff',
          status: 'running',
          updatedAt: '2026-06-11T12:00:00.000Z',
          capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
        },
      ],
    });
    mocks.readConversationSessionMeta.mockReturnValue({
      id: 'conversation-1',
      deferredResumes: [
        {
          id: 'resume-1',
          status: 'scheduled',
          kind: 'manual',
          dueAt: '2026-06-11T13:00:00.000Z',
          createdAt: '2026-06-11T11:00:00.000Z',
          updatedAt: '2026-06-11T11:30:00.000Z',
          promptPreview: 'Check back later',
        },
      ],
    });
    mocks.listQueuedPromptPreviews.mockReturnValue({
      steering: [{ id: 'steer-1', text: 'Change direction', imageCount: 0, restorable: true }],
      followUp: [{ id: 'follow-1', text: 'Then summarize', imageCount: 1, restorable: false }],
    });

    await expect(
      listConversationActivity('conversation-1', {
        tasks: [
          {
            id: 'task-1',
            title: 'Nightly review',
            prompt: 'Review',
            enabled: true,
            running: false,
            cron: '0 8 * * *',
            threadConversationId: 'conversation-1',
          } as never,
        ],
      }),
    ).resolves.toMatchObject({
      conversationId: 'conversation-1',
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'execution:run-1', kind: 'execution', status: 'running', active: true }),
        expect.objectContaining({ id: 'deferred-resume:resume-1', kind: 'deferred-resume', status: 'scheduled', active: true }),
        expect.objectContaining({ id: 'scheduled-task:task-1', kind: 'scheduled-task', status: 'scheduled', active: true }),
        expect.objectContaining({ id: 'queued-prompt:steer:steer-1', kind: 'queued-prompt', status: 'queued', active: true }),
        expect.objectContaining({ id: 'queued-prompt:followUp:follow-1', kind: 'queued-prompt', actions: [] }),
      ]),
    });
  });

  it('filters by active and visibility after provider normalization', async () => {
    mocks.listConversationExecutions.mockResolvedValue({
      executions: [
        {
          id: 'done-1',
          kind: 'background-command',
          visibility: 'primary',
          conversationId: 'conversation-1',
          title: 'Done',
          status: 'completed',
          capabilities: { canCancel: false, canRerun: true, canFollowUp: false, hasLog: true, hasResult: true },
        },
      ],
    });
    mocks.readConversationSessionMeta.mockReturnValue({
      deferredResumes: [
        {
          id: 'resume-1',
          status: 'completed',
          kind: 'manual',
          createdAt: '2026-06-11T11:00:00.000Z',
          updatedAt: '2026-06-11T11:30:00.000Z',
        },
      ],
    });

    await expect(listConversationActivity('conversation-1', { active: true, visibility: 'primary' })).resolves.toMatchObject({
      items: [],
      primary: [],
      system: [],
    });
  });
});
