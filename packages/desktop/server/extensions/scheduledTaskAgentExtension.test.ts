import { mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { getTaskCallbackBinding } from '@neon-pilot/core';
import { closeAutomationDbs, saveAutomationRuntimeStateMap } from '@neon-pilot/daemon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createScheduledTaskAgentExtension } from '../../../../extensions/system-automations/src/scheduledTaskTool.js';

const { pingDaemonMock, startScheduledTaskRunMock } = vi.hoisted(() => ({
  pingDaemonMock: vi.fn(),
  startScheduledTaskRunMock: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/automations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@neon-pilot/extensions/backend/automations')>();
  return {
    ...actual,
    applyScheduledTaskThreadBinding: async (_taskId: string, input: { threadMode?: string; threadConversationId?: string }) => ({
      id: _taskId,
      title: _taskId,
      filePath: `/__automations__/${_taskId}.automation.md`,
      profile: 'shared',
      enabled: true,
      schedule: { type: 'at', at: '2027-04-11T09:00:00.000Z' },
      prompt: 'Check back in tomorrow.',
      targetType: 'conversation',
      conversationBehavior: 'followUp',
      timeoutSeconds: 600,
      threadMode: input.threadMode,
      threadConversationId: input.threadConversationId,
    }),
    buildScheduledTaskThreadDetail: async (task: {
      targetType?: string;
      threadMode?: string;
      threadConversationId?: string;
      conversationBehavior?: string;
    }) => ({
      threadMode: task.targetType === 'conversation' ? (task.threadMode ?? 'existing') : 'none',
      threadConversationId: task.threadConversationId,
      conversationBehavior: task.conversationBehavior,
    }),
    pingDaemon: pingDaemonMock,
    resolveScheduledTaskThreadBinding: async (input: { mode?: string; conversationId?: string; currentConversationId?: string }) => ({
      mode: input.mode ?? 'existing',
      conversationId: input.conversationId ?? input.currentConversationId ?? 'conv-123',
      sessionFile: '/tmp/session.jsonl',
    }),
    startScheduledTaskRun: startScheduledTaskRunMock,
  };
});

const tempDirs: string[] = [];
const originalEnv = process.env;

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join('/tmp', prefix));
  tempDirs.push(dir);
  return dir;
}

function registerScheduledTaskTool() {
  let registeredTool:
    | {
        execute: (
          ...args: unknown[]
        ) => Promise<{ isError?: boolean; content: Array<{ text?: string }>; details?: Record<string, unknown> }>;
      }
    | undefined;

  createScheduledTaskAgentExtension({
    getRuntimeScope: () => 'assistant',
  })({
    registerTool: (tool: unknown) => {
      if ((tool as { name?: string }).name !== 'scheduled_task') return;
      registeredTool = tool as {
        execute: (
          ...args: unknown[]
        ) => Promise<{ isError?: boolean; content: Array<{ text?: string }>; details?: Record<string, unknown> }>;
      };
    },
  } as never);

  if (!registeredTool) {
    throw new Error('Scheduled task tool was not registered.');
  }

  return registeredTool;
}

function createToolContext(sessionFile = '') {
  return {
    sessionManager: {
      getSessionFile: () => sessionFile,
    },
  };
}

function writeSessionFile(conversationId: string): string {
  const dir = createTempDir('neon-pilot-web-task-session-');
  const sessionFile = join(dir, `${conversationId}.jsonl`);
  writeFileSync(
    sessionFile,
    JSON.stringify({ type: 'session', id: conversationId, timestamp: '2027-04-10T09:00:00.000Z', cwd: '/tmp/workspace' }) + '\n',
    'utf-8',
  );
  return sessionFile;
}

beforeEach(() => {
  const stateRoot = createTempDir('neon-pilot-web-task-state-');
  process.env = {
    ...originalEnv,
    NEON_PILOT_STATE_ROOT: stateRoot,
    NEON_PILOT_DAEMON_SOCKET_PATH: join(stateRoot, 'd.sock'),
  };
  process.env.NEON_PILOT_KNOWLEDGE_ROOT = join(process.env.NEON_PILOT_STATE_ROOT, 'sync');
  pingDaemonMock.mockReset();
  startScheduledTaskRunMock.mockReset();
  pingDaemonMock.mockResolvedValue(true);
});

afterEach(async () => {
  vi.restoreAllMocks();
  closeAutomationDbs();
  process.env = originalEnv;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('scheduled task agent extension', () => {
  it('saves and retrieves scheduled task definitions', async () => {
    const taskTool = registerScheduledTaskTool();

    const saved = await taskTool.execute('tool-1', {
      action: 'save',
      taskId: 'daily-status',
      cron: '0 9 * * 1-5',
      model: 'openai-codex/gpt-5.4',
      prompt: 'Summarize yesterday and plan today.',
    });

    expect(saved.isError).not.toBe(true);
    expect(saved.content[0]?.text).toMatch(/(?:Saved|Updated) scheduled task @daily-status/);

    expect(saved.details?.filePath).toBe('/__automations__/daily-status.automation.md');

    const fetched = await taskTool.execute('tool-2', {
      action: 'get',
      taskId: 'daily-status',
    });

    expect(fetched.isError).not.toBe(true);
    expect(fetched.content[0]?.text).toContain('Task @daily-status');
    expect(fetched.content[0]?.text).toContain('Summarize yesterday and plan today.');
  }, 15000);

  it('saves callback-enabled tasks and clears callback bindings on update', async () => {
    const taskTool = registerScheduledTaskTool();
    const sessionFile = writeSessionFile('conv-123');

    const saved = await taskTool.execute(
      'tool-1',
      {
        action: 'save',
        taskId: 'activity-digest',
        at: '2027-04-10T09:00:00.000Z',
        targetType: 'background-agent',
        model: 'openai-codex/gpt-5.4',
        cwd: '/tmp/workspace',
        timeoutSeconds: 45,
        prompt: 'Summarize recent activity.',
        deliverResultToConversation: true,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        requireAck: false,
        autoResumeIfOpen: false,
      },
      undefined,
      undefined,
      createToolContext(sessionFile),
    );

    expect(saved.isError).not.toBe(true);
    expect(getTaskCallbackBinding({ profile: 'assistant', taskId: 'activity-digest' })).toEqual(
      expect.objectContaining({
        conversationId: 'conv-123',
        deliverOnSuccess: false,
        deliverOnFailure: true,
        requireAck: false,
        autoResumeIfOpen: false,
      }),
    );

    const fetched = await taskTool.execute('tool-2', {
      action: 'get',
      taskId: 'activity-digest',
    });

    expect(fetched.content[0]?.text).toContain('schedule: at 2027-04-10T09:00:00.000Z');
    expect(fetched.content[0]?.text).toContain('model: openai-codex/gpt-5.4');
    expect(fetched.content[0]?.text).toContain('cwd: /tmp/workspace');
    expect(fetched.content[0]?.text).toContain('callbackConversationId: conv-123');
    expect(fetched.content[0]?.text).toContain('callbackOnSuccess: none');
    expect(fetched.content[0]?.text).toContain('callbackOnFailure: disruptive');

    const updated = await taskTool.execute('tool-3', {
      action: 'save',
      taskId: 'activity-digest',
      prompt: 'Summarize recent activity again.',
      deliverResultToConversation: false,
    });

    expect(updated.content[0]?.text).toContain('Updated scheduled task @activity-digest');
    expect(getTaskCallbackBinding({ profile: 'assistant', taskId: 'activity-digest' })).toBeUndefined();
  });

  it('saves conversation-target tasks on the current thread and clears stale callbacks', async () => {
    const taskTool = registerScheduledTaskTool();
    const sessionFile = writeSessionFile('conv-123');

    await taskTool.execute(
      'tool-1',
      {
        action: 'save',
        taskId: 'thread-check',
        at: '2027-04-10T09:00:00.000Z',
        prompt: 'Summarize recent activity.',
        deliverResultToConversation: true,
      },
      undefined,
      undefined,
      createToolContext(sessionFile),
    );

    const saved = await taskTool.execute(
      'tool-2',
      {
        action: 'save',
        taskId: 'thread-check',
        targetType: 'conversation',
        threadConversationId: 'conv-123',
        at: '2027-04-11T09:00:00.000Z',
        deliverAs: 'followUp',
        model: 'openai-codex/gpt-5.5',
        prompt: 'Check back in tomorrow.',
      },
      undefined,
      undefined,
      createToolContext(sessionFile),
    );

    expect(saved.isError).not.toBe(true);
    expect(getTaskCallbackBinding({ profile: 'assistant', taskId: 'thread-check' })).toBeUndefined();

    const fetched = await taskTool.execute('tool-3', {
      action: 'get',
      taskId: 'thread-check',
    });

    expect(fetched.content[0]?.text).toContain('target: thread');
    expect(fetched.content[0]?.text).toContain('threadMode: dedicated');
    expect(fetched.content[0]?.text).toContain('deliverAs: followUp');
    expect(fetched.content[0]?.text).toContain('model: openai-codex/gpt-5.5');
  });

  it('lists and validates scheduled task definitions', async () => {
    const taskTool = registerScheduledTaskTool();

    await taskTool.execute('tool-1', {
      action: 'save',
      taskId: 'daily-status',
      cron: '0 9 * * 1-5',
      prompt: 'Summarize yesterday and plan today.',
    });

    const listed = await taskTool.execute('tool-2', { action: 'list' });
    expect(listed.isError).not.toBe(true);
    expect(listed.content[0]?.text).toContain('@daily-status');

    const validated = await taskTool.execute('tool-3', { action: 'validate' });
    expect(validated.isError).not.toBe(true);
    expect(validated.content[0]?.text).toMatch(/Validated \d+ scheduled tasks?\./);
  });

  it('reports an empty schedule when no tasks exist', async () => {
    const taskTool = registerScheduledTaskTool();

    const listed = await taskTool.execute('tool-1', { action: 'list' });
    const validated = await taskTool.execute('tool-2', { action: 'validate', taskId: 'broken' });

    expect(listed.isError).not.toBe(true);
    expect(listed.content[0]?.text).toContain('No scheduled tasks found.');
    expect(validated.isError).toBe(true);
    expect(validated.content[0]?.text).toContain('Task not found: broken');
  });

  it('shows runtime details, validates a specific task, runs it, and deletes it', async () => {
    const taskTool = registerScheduledTaskTool();

    await taskTool.execute('tool-1', {
      action: 'save',
      taskId: 'daily-status',
      cron: '0 9 * * 1-5',
      prompt: 'Summarize yesterday and plan today.',
    });

    saveAutomationRuntimeStateMap({
      'daily-status': {
        id: 'daily-status',
        filePath: '/__automations__/daily-status.automation.md',
        scheduleType: 'cron',
        running: true,
        lastStatus: 'failed',
        lastRunAt: '2026-04-10T00:00:00.000Z',
        lastLogPath: '/tmp/run.log',
      } as never,
    });

    const listed = await taskTool.execute('tool-2', { action: 'list' });
    const fetched = await taskTool.execute('tool-3', { action: 'get', taskId: 'daily-status' });
    const validated = await taskTool.execute('tool-4', { action: 'validate', taskId: 'daily-status' });

    expect(listed.content[0]?.text).toContain('@daily-status [running]');
    expect(fetched.content[0]?.text).toContain('lastStatus: failed');
    expect(fetched.content[0]?.text).toContain('lastRunAt: 2026-04-10T00:00:00.000Z');
    expect(fetched.content[0]?.text).toContain('lastLogPath: /tmp/run.log');
    expect(validated.isError).not.toBe(true);
    expect(validated.content[0]?.text).toContain('Task @daily-status is valid.');

    startScheduledTaskRunMock.mockResolvedValue({
      accepted: true,
      runId: 'run-task-123',
    } as never);

    const started = await taskTool.execute('tool-5', { action: 'run', taskId: 'daily-status' });
    const deleted = await taskTool.execute('tool-6', { action: 'delete', taskId: 'daily-status' });

    expect(startScheduledTaskRunMock).toHaveBeenCalledWith('daily-status');
    expect(started.content[0]?.text).toContain('Started scheduled task @daily-status as run run-task-123.');
    expect(deleted.content[0]?.text).toContain('Deleted scheduled task @daily-status.');
  });

  it('returns tool errors for missing conversations, invalid conversation callbacks, unknown tasks, and rejected runs', async () => {
    const taskTool = registerScheduledTaskTool();
    const sessionFile = writeSessionFile('conv-999');

    const missingConversation = await taskTool.execute(
      'tool-1',
      {
        action: 'save',
        taskId: 'notify-me',
        cron: '0 9 * * 1-5',
        targetType: 'background-agent',
        prompt: 'Ping me.',
        deliverResultToConversation: true,
      },
      undefined,
      undefined,
      createToolContext(''),
    );
    const invalidConversationCallback = await taskTool.execute(
      'tool-2',
      {
        action: 'save',
        taskId: 'thread-ping',
        at: '2027-04-10T09:00:00.000Z',
        targetType: 'conversation',
        prompt: 'Ping this thread later.',
        deliverResultToConversation: true,
      },
      undefined,
      undefined,
      createToolContext(sessionFile),
    );
    const missingTask = await taskTool.execute('tool-3', { action: 'validate', taskId: 'missing-task' });

    await taskTool.execute('tool-4', {
      action: 'save',
      taskId: 'run-me',
      cron: '0 9 * * 1-5',
      prompt: 'Run me.',
    });

    startScheduledTaskRunMock.mockResolvedValue({
      accepted: false,
      reason: 'daemon busy',
    } as never);

    const rejectedRun = await taskTool.execute('tool-5', { action: 'run', taskId: 'run-me' });

    expect(missingConversation.isError).toBe(true);
    expect(missingConversation.content[0]?.text).toContain('deliverResultToConversation requires an active persisted conversation.');
    expect(invalidConversationCallback.isError).toBeUndefined();
    expect(invalidConversationCallback.content[0]?.text).toContain('Saved scheduled task @thread-ping');
    expect(missingTask.isError).toBe(true);
    expect(missingTask.content[0]?.text).toContain('Task not found: missing-task');
    expect(rejectedRun.isError).toBe(true);
    expect(rejectedRun.content[0]?.text).toContain('daemon busy');
  });
});
