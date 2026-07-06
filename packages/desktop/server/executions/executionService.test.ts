import type { ScannedDurableRun } from '@neon-pilot/daemon';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cancelDurableRunMock, followUpDurableRunMock, getDurableRunLogMock, getDurableRunMock, listDurableRunsMock, rerunDurableRunMock } =
  vi.hoisted(() => ({
    cancelDurableRunMock: vi.fn(),
    followUpDurableRunMock: vi.fn(),
    getDurableRunLogMock: vi.fn(),
    getDurableRunMock: vi.fn(),
    listDurableRunsMock: vi.fn(),
    rerunDurableRunMock: vi.fn(),
  }));

vi.mock('../automation/durableRuns.js', () => ({
  cancelDurableRun: cancelDurableRunMock,
  followUpDurableRun: followUpDurableRunMock,
  getDurableRun: getDurableRunMock,
  getDurableRunLog: getDurableRunLogMock,
  listDurableRuns: listDurableRunsMock,
  rerunDurableRun: rerunDurableRunMock,
}));

import { isExecutionActive, listExecutions, projectExecution } from './executionService.js';

function run(overrides: Partial<ScannedDurableRun>): ScannedDurableRun {
  return {
    runId: 'run-123',
    paths: {
      root: '/runs/run-123',
      manifestPath: '/runs/run-123/manifest.json',
      statusPath: '/runs/run-123/status.json',
      checkpointPath: '/runs/run-123/checkpoint.json',
      eventsPath: '/runs/run-123/events.jsonl',
      outputLogPath: '/runs/run-123/output.log',
      resultPath: '/runs/run-123/result.json',
    },
    manifest: {
      version: 1,
      id: 'run-123',
      kind: 'raw-shell',
      resumePolicy: 'manual',
      createdAt: '2026-05-15T00:00:00.000Z',
      spec: { shellCommand: 'pnpm test', cwd: '/repo' },
      source: { type: 'tool', id: 'conversation-1', filePath: '/sessions/conversation-1.jsonl' },
    },
    status: {
      version: 1,
      runId: 'run-123',
      status: 'running',
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:01:00.000Z',
      activeAttempt: 1,
      startedAt: '2026-05-15T00:00:01.000Z',
    },
    problems: [],
    recoveryAction: 'none',
    ...overrides,
  };
}

describe('Execution projection', () => {
  beforeEach(() => {
    cancelDurableRunMock.mockReset();
    followUpDurableRunMock.mockReset();
    getDurableRunLogMock.mockReset();
    getDurableRunMock.mockReset();
    listDurableRunsMock.mockReset();
    rerunDurableRunMock.mockReset();
  });

  it('projects shell durable runs as primary background command executions', () => {
    expect(projectExecution(run({}))).toMatchObject({
      id: 'run-123',
      kind: 'background-command',
      visibility: 'primary',
      conversationId: 'conversation-1',
      sessionFile: '/sessions/conversation-1.jsonl',
      title: 'pnpm test',
      command: 'pnpm test',
      cwd: '/repo',
      status: 'running',
      capabilities: { canCancel: true, hasLog: true },
    });
  });

  it('projects daemon target-shaped raw shell runs as conversation background commands', () => {
    expect(
      projectExecution(
        run({
          manifest: {
            version: 1,
            id: 'run-target-shell',
            kind: 'raw-shell',
            resumePolicy: 'manual',
            createdAt: '2026-05-15T00:00:00.000Z',
            spec: {
              target: { type: 'shell', command: 'pnpm run release:publish', cwd: '/repo' },
              metadata: {
                taskSlug: 'publish-release',
                callbackConversation: { conversationId: 'conversation-1', sessionFile: '/sessions/conversation-1.jsonl' },
              },
            },
            source: { type: 'system', id: 'background-command' },
          },
        }),
      ),
    ).toMatchObject({
      kind: 'background-command',
      visibility: 'primary',
      conversationId: 'conversation-1',
      sessionFile: '/sessions/conversation-1.jsonl',
      title: 'publish-release',
      command: 'pnpm run release:publish',
      cwd: '/repo',
      status: 'running',
    });
  });

  it('projects agent background runs as primary subagent executions', () => {
    expect(
      projectExecution(
        run({
          manifest: {
            version: 1,
            id: 'run-agent',
            kind: 'background-run',
            resumePolicy: 'manual',
            createdAt: '2026-05-15T00:00:00.000Z',
            spec: { agent: { prompt: 'Review the current diff', model: 'gpt-5.5' }, cwd: '/repo' },
            source: { type: 'tool', id: 'conversation-1' },
          },
        }),
      ),
    ).toMatchObject({
      kind: 'subagent',
      visibility: 'primary',
      conversationId: 'conversation-1',
      prompt: 'Review the current diff',
      model: 'gpt-5.5',
    });
  });

  it('treats only non-terminal execution statuses as active', () => {
    expect(isExecutionActive(projectExecution(run({ status: { ...run({}).status, status: 'queued' } })))).toBe(true);
    expect(isExecutionActive(projectExecution(run({ status: { ...run({}).status, status: 'waiting' } })))).toBe(true);
    expect(isExecutionActive(projectExecution(run({ status: { ...run({}).status, status: 'running' } })))).toBe(true);
    expect(isExecutionActive(projectExecution(run({ status: { ...run({}).status, status: 'recovering' } })))).toBe(true);
    expect(isExecutionActive(projectExecution(run({ status: { ...run({}).status, status: 'completed' } })))).toBe(false);
    expect(isExecutionActive(projectExecution(run({ status: { ...run({}).status, status: 'cancelled' } })))).toBe(false);
    expect(isExecutionActive(projectExecution(run({ status: { ...run({}).status, status: 'unknown' } })))).toBe(false);
  });

  it('exposes execution actions only for explicit active or terminal statuses', () => {
    expect(projectExecution(run({ status: { ...run({}).status, status: 'queued' } })).capabilities).toMatchObject({
      canCancel: true,
      canRerun: false,
    });
    expect(projectExecution(run({ status: { ...run({}).status, status: 'completed' } })).capabilities).toMatchObject({
      canCancel: false,
      canRerun: true,
    });
    expect(projectExecution(run({ status: { ...run({}).status, status: 'unknown' } })).capabilities).toMatchObject({
      canCancel: false,
      canRerun: false,
    });
  });

  it('projects durable worker identity metadata onto executions', () => {
    const workerRun = run({
      runId: 'run-worker',
      manifest: {
        version: 1,
        id: 'run-worker',
        kind: 'background-run',
        resumePolicy: 'manual',
        createdAt: '2026-05-15T00:00:00.000Z',
        spec: {
          agent: { prompt: 'Review the current diff', model: 'gpt-5.5' },
          cwd: '/repo',
          metadata: {
            taskSlug: 'code-review',
            agentRole: 'worker',
            workerName: 'Focused Analyst 1a2b',
            callbackConversation: { conversationId: 'conversation-1', sessionFile: '/sessions/conversation-1.jsonl' },
          },
        },
        source: { type: 'tool', id: 'conversation-1' },
      },
    });

    expect(projectExecution(workerRun)).toMatchObject({
      id: 'run-worker',
      kind: 'subagent',
      workerRole: 'worker',
      workerName: 'Focused Analyst 1a2b',
      title: 'Focused Analyst 1a2b',
      conversationId: 'conversation-1',
      prompt: 'Review the current diff',
      model: 'gpt-5.5',
    });
  });

  it('leaves worker fields absent when a run has no worker metadata', () => {
    const plainRun = run({
      manifest: {
        version: 1,
        id: 'run-plain',
        kind: 'background-run',
        resumePolicy: 'manual',
        createdAt: '2026-05-15T00:00:00.000Z',
        spec: { agent: { prompt: 'Review the current diff' }, cwd: '/repo' },
        source: { type: 'tool', id: 'conversation-1' },
      },
    });
    const projected = projectExecution(plainRun);
    expect(projected).not.toHaveProperty('workerRole');
    expect(projected).not.toHaveProperty('workerName');
    expect(projected.title).not.toBe('');
  });

  it('does not allow non-background run metadata to spoof worker identity', () => {
    const conversationRun = run({
      runId: 'run-conversation',
      manifest: {
        version: 1,
        id: 'run-conversation',
        kind: 'conversation',
        resumePolicy: 'manual',
        createdAt: '2026-05-15T00:00:00.000Z',
        spec: {
          metadata: {
            agentRole: 'worker',
            workerName: 'Focused Analyst 1a2b',
          },
        },
        source: { type: 'web-live-session', id: 'conversation-live-conversation-1' },
      },
    });

    const projected = projectExecution(conversationRun);
    expect(projected.kind).toBe('conversation');
    expect(projected).not.toHaveProperty('workerRole');
    expect(projected).not.toHaveProperty('workerName');
    expect(projected.title).not.toBe('Focused Analyst 1a2b');
  });

  it('allows subagent follow-up only after terminal completion', () => {
    const backgroundRun = run({
      manifest: {
        version: 1,
        id: 'run-agent',
        kind: 'background-run',
        resumePolicy: 'manual',
        createdAt: '2026-05-15T00:00:00.000Z',
        spec: { agent: { prompt: 'Review the current diff', model: 'gpt-5.5' }, cwd: '/repo' },
        source: { type: 'tool', id: 'conversation-1' },
      },
    });

    expect(projectExecution({ ...backgroundRun, status: { ...backgroundRun.status, status: 'running' } }).capabilities.canFollowUp).toBe(
      false,
    );
    expect(projectExecution({ ...backgroundRun, status: { ...backgroundRun.status, status: 'completed' } }).capabilities.canFollowUp).toBe(
      true,
    );
    expect(projectExecution({ ...backgroundRun, status: { ...backgroundRun.status, status: 'unknown' } }).capabilities.canFollowUp).toBe(
      false,
    );
  });

  it('filters idle live conversation bookkeeping rows from execution lists', async () => {
    const idleLiveRun = run({
      runId: 'conversation-live-idle',
      manifest: {
        version: 1,
        id: 'conversation-live-idle',
        kind: 'conversation',
        resumePolicy: 'continue',
        createdAt: '2026-05-15T00:00:00.000Z',
        spec: {},
        source: { type: 'web-live-session', id: 'conversation-live-idle' },
      },
      status: { ...run({}).status!, runId: 'conversation-live-idle', status: 'waiting' },
      checkpoint: {
        version: 1,
        runId: 'conversation-live-idle',
        updatedAt: '2026-05-15T00:01:00.000Z',
        payload: { conversationId: 'idle' },
      },
    });
    const pendingLiveRun = run({
      runId: 'conversation-live-pending',
      manifest: {
        version: 1,
        id: 'conversation-live-pending',
        kind: 'conversation',
        resumePolicy: 'continue',
        createdAt: '2026-05-15T00:00:00.000Z',
        spec: {},
        source: { type: 'web-live-session', id: 'conversation-live-pending' },
      },
      status: { ...run({}).status!, runId: 'conversation-live-pending', status: 'waiting' },
      checkpoint: {
        version: 1,
        runId: 'conversation-live-pending',
        updatedAt: '2026-05-15T00:01:00.000Z',
        payload: {
          conversationId: 'pending',
          pendingOperation: { type: 'prompt', text: 'continue' },
        },
      },
    });

    listDurableRunsMock.mockResolvedValue({ runs: [idleLiveRun, pendingLiveRun, run({ runId: 'run-shell' })] });

    await expect(listExecutions()).resolves.toMatchObject({
      executions: expect.arrayContaining([
        expect.objectContaining({ id: 'conversation-live-pending' }),
        expect.objectContaining({ id: 'run-shell' }),
      ]),
    });
    const result = await listExecutions();
    expect(result.executions.map((execution) => execution.id)).not.toContain('conversation-live-idle');
  });
});
