import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ clearTaskCallbackBinding: vi.fn() }));
const daemon = vi.hoisted(() => ({
  createStoredAutomation: vi.fn(),
  deleteStoredAutomation: vi.fn(),
  ensureAutomationThread: vi.fn(),
  listAutomationActivityEntries: vi.fn(),
  normalizeAutomationTargetTypeForSelection: vi.fn((value) => (value === 'conversation' ? 'conversation' : 'background-agent')),
  startScheduledTaskRun: vi.fn(),
  updateStoredAutomation: vi.fn(),
}));
const scheduledTasks = vi.hoisted(() => ({
  loadScheduledTasksForProfile: vi.fn(),
  toScheduledTaskMetadata: vi.fn((task) => ({
    id: task.id,
    title: task.title,
    scheduleType: task.schedule.type,
    targetType: task.targetType,
    enabled: task.enabled,
    cron: task.schedule.type === 'cron' ? task.schedule.expression : undefined,
    at: task.schedule.type === 'at' ? task.schedule.at : undefined,
    model: task.modelRef,
    thinkingLevel: task.thinkingLevel,
    cwd: task.cwd,
    timeoutSeconds: task.timeoutSeconds,
    catchUpWindowSeconds: task.catchUpWindowSeconds,
    promptBody: task.prompt,
  })),
}));
const threads = vi.hoisted(() => ({
  applyScheduledTaskThreadBinding: vi.fn(),
  buildScheduledTaskThreadDetail: vi.fn(),
  resolveScheduledTaskThreadBinding: vi.fn(),
}));
const taskService = vi.hoisted(() => ({ findTaskForProfile: vi.fn() }));
const health = vi.hoisted(() => ({ readScheduledTaskSchedulerHealth: vi.fn() }));
const middleware = vi.hoisted(() => ({ invalidateAppTopics: vi.fn() }));
const permissions = vi.hoisted(() => ({
  granted: new Set<string>(),
  assertExtensionAnyPermission: vi.fn((extensionId: string, candidates: string[], capability: string) => {
    if (!candidates.some((permission) => permissions.granted.has(permission))) {
      throw new Error(`Extension "${extensionId}" requires permission ${candidates[0]} to use ${capability}.`);
    }
  }),
  assertExtensionPermission: vi.fn((extensionId: string, permission: string, capability: string) => {
    if (!permissions.granted.has(permission)) {
      throw new Error(`Extension "${extensionId}" requires permission ${permission} to use ${capability}.`);
    }
  }),
}));

vi.mock('@neon-pilot/core', () => core);
vi.mock('@neon-pilot/daemon', () => daemon);
vi.mock('../automation/scheduledTasks.js', () => scheduledTasks);
vi.mock('../automation/scheduledTaskThreads.js', () => threads);
vi.mock('../automation/taskService.js', () => taskService);
vi.mock('../automation/scheduledTaskCapability.js', () => health);
vi.mock('../middleware/index.js', () => middleware);
vi.mock('./extensionPermissions.js', () => permissions);

import { createExtensionAutomationsCapability } from './extensionAutomations.js';

const context = { getRuntimeScope: () => 'shared' };

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: 'Task One',
    legacyFilePath: '/tasks/task-1.json',
    schedule: { type: 'cron', expression: '0 9 * * *' },
    targetType: 'background-agent',
    enabled: true,
    prompt: 'Line one\nLine two',
    profile: 'shared',
    threadMode: 'none',
    timeoutSeconds: 60,
    ...overrides,
  };
}

describe('extensionAutomations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threads.buildScheduledTaskThreadDetail.mockReturnValue({ threadMode: 'none' });
    threads.resolveScheduledTaskThreadBinding.mockReturnValue({ mode: 'none' });
    daemon.listAutomationActivityEntries.mockReturnValue([]);
    health.readScheduledTaskSchedulerHealth.mockReturnValue({});
    permissions.granted.clear();
  });

  it('requires server route context', async () => {
    await expect(createExtensionAutomationsCapability().list()).rejects.toThrow(
      'Extension automations capability requires server route context.',
    );
  });

  it('lists tasks with runtime state and ensures dedicated threads', async () => {
    const dedicated = task({ threadMode: 'dedicated', threadConversationId: undefined });
    const ensured = { ...dedicated, threadConversationId: 'conv-1' };
    scheduledTasks.loadScheduledTasksForProfile.mockReturnValue({
      tasks: [dedicated],
      runtimeState: { 'task-1': { running: true, lastStatus: 'success' } },
      runtimeEntries: [],
    });
    daemon.ensureAutomationThread.mockReturnValue(ensured);
    threads.buildScheduledTaskThreadDetail.mockReturnValue({ threadConversationId: 'conv-1', threadTitle: 'Thread' });

    await expect(createExtensionAutomationsCapability(context).list()).resolves.toEqual([
      expect.objectContaining({
        id: 'task-1',
        running: true,
        cron: '0 9 * * *',
        prompt: 'Line one',
        threadConversationId: 'conv-1',
        lastStatus: 'success',
      }),
    ]);
    expect(daemon.ensureAutomationThread).toHaveBeenCalledWith('task-1');
  });

  it('requires automation read permission for extension-bound reads', async () => {
    scheduledTasks.loadScheduledTasksForProfile.mockReturnValue({ tasks: [], runtimeState: {}, runtimeEntries: [] });

    await expect(createExtensionAutomationsCapability(context, 'automation-helper-ext').list()).rejects.toThrow(
      'Extension "automation-helper-ext" requires permission automations:read to use automations.list.',
    );

    permissions.granted.add('automations:read');

    await expect(createExtensionAutomationsCapability(context, 'automation-helper-ext').list()).resolves.toEqual([]);
  });

  it('creates a conversation automation with thread binding and invalidates visible thread state', async () => {
    threads.resolveScheduledTaskThreadBinding.mockReturnValue({ mode: 'existing', conversationId: 'conv-1', sessionFile: '/session.json' });
    const created = task({ targetType: 'conversation' });
    daemon.createStoredAutomation.mockReturnValue(created);
    threads.applyScheduledTaskThreadBinding.mockReturnValue({ ...created, threadConversationId: 'conv-1' });
    taskService.findTaskForProfile.mockReturnValue({ task: { ...created, threadConversationId: 'conv-1' }, runtime: undefined });

    const result = await createExtensionAutomationsCapability(context).create({
      title: 'New',
      targetType: 'conversation',
      threadConversationId: 'conv-1',
      prompt: 'Go',
    });

    expect(daemon.createStoredAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New', targetType: 'conversation', prompt: 'Go' }),
    );
    expect(threads.applyScheduledTaskThreadBinding).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ threadMode: 'existing', threadConversationId: 'conv-1' }),
    );
    expect(middleware.invalidateAppTopics).toHaveBeenCalledWith('tasks', 'sessions', 'workspace');
    expect(result).toMatchObject({ ok: true, task: { id: 'task-1', targetType: 'conversation' } });
  });

  it('requires automation write permission for extension-bound mutations', async () => {
    await expect(createExtensionAutomationsCapability(context, 'automation-helper-ext').create({ title: 'New' })).rejects.toThrow(
      'Extension "automation-helper-ext" requires permission automations:write to use automations.create.',
    );

    permissions.granted.add('automations:write');
    const created = task();
    daemon.createStoredAutomation.mockReturnValue(created);
    threads.applyScheduledTaskThreadBinding.mockReturnValue(created);
    taskService.findTaskForProfile.mockReturnValue({ task: created, runtime: undefined });

    threads.resolveScheduledTaskThreadBinding.mockReturnValue({ mode: 'existing', conversationId: 'conv-1', sessionFile: '/session.json' });
    await expect(
      createExtensionAutomationsCapability(context, 'automation-helper-ext').create({ title: 'New', threadConversationId: 'conv-1' }),
    ).resolves.toMatchObject({
      ok: true,
      task: { id: 'task-1' },
    });
  });

  it('deletes tasks, clears callbacks, and invalidates task topics', async () => {
    taskService.findTaskForProfile.mockReturnValue({ task: task(), runtime: undefined });
    daemon.deleteStoredAutomation.mockReturnValue(true);

    await expect(createExtensionAutomationsCapability(context).delete('task-1')).resolves.toEqual({ ok: true, deleted: true });
    expect(daemon.deleteStoredAutomation).toHaveBeenCalledWith('task-1');
    expect(core.clearTaskCallbackBinding).toHaveBeenCalledWith({ profile: 'shared', taskId: 'task-1' });
    expect(middleware.invalidateAppTopics).toHaveBeenCalledWith('tasks', 'sessions', 'workspace');
  });

  it('runs tasks and reads available logs', async () => {
    const dir = join(tmpdir(), `extension-automations-${process.pid}`);
    const logPath = join(dir, 'task.log');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(logPath, 'hello log');
    taskService.findTaskForProfile.mockReturnValue({ task: task(), runtime: { lastLogPath: logPath } });
    daemon.startScheduledTaskRun.mockResolvedValue({ accepted: true, runId: 'run-1' });

    try {
      await expect(createExtensionAutomationsCapability(context).run('task-1')).resolves.toEqual({
        ok: true,
        accepted: true,
        runId: 'run-1',
      });
      await expect(createExtensionAutomationsCapability(context).readLog('task-1')).resolves.toEqual({ log: 'hello log', path: logPath });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires automation run permission for extension-bound task execution', async () => {
    taskService.findTaskForProfile.mockReturnValue({ task: task(), runtime: undefined });

    await expect(createExtensionAutomationsCapability(context, 'automation-helper-ext').run('task-1')).rejects.toThrow(
      'Extension "automation-helper-ext" requires permission automations:run to use automations.run.',
    );

    permissions.granted.add('automations:run');
    daemon.startScheduledTaskRun.mockResolvedValue({ accepted: true, runId: 'run-1' });

    await expect(createExtensionAutomationsCapability(context, 'automation-helper-ext').run('task-1')).resolves.toEqual({
      ok: true,
      accepted: true,
      runId: 'run-1',
    });
  });
});
