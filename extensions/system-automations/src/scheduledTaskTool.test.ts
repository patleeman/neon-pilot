import { beforeEach, describe, expect, it, vi } from 'vitest';

const automations = vi.hoisted(() => ({
  loadScheduledTasksForProfile: vi.fn(),
  resolveScheduledTaskForProfile: vi.fn(),
  getTaskCallbackBinding: vi.fn(),
  buildScheduledTaskThreadDetail: vi.fn(),
  createStoredAutomation: vi.fn(),
  updateStoredAutomation: vi.fn(),
  deleteStoredAutomation: vi.fn(),
  clearTaskCallbackBinding: vi.fn(),
  setTaskCallbackBinding: vi.fn(),
  invalidateAppTopics: vi.fn(),
  normalizeAutomationTargetTypeForSelection: vi.fn((value) => value),
  parseFutureHumanDateTime: vi.fn(),
  readSessionConversationId: vi.fn(),
  resolveScheduledTaskThreadBinding: vi.fn(),
  applyScheduledTaskThreadBinding: vi.fn(),
  pingDaemon: vi.fn(),
  startScheduledTaskRun: vi.fn(),
}));

const telemetry = vi.hoisted(() => ({ recordTelemetryEvent: vi.fn() }));

vi.mock('@neon-pilot/extensions/backend/automations', () => automations);
vi.mock('@neon-pilot/extensions/backend/telemetry', () => telemetry);

import { createScheduledTaskAgentExtension } from './scheduledTaskTool.js';

type ToolResult = { content: { type: string; text: string }[]; details?: Record<string, unknown>; isError?: boolean };

type RegisteredTool = {
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: unknown,
    onUpdate?: unknown,
    ctx?: ToolCtx,
  ) => Promise<ToolResult>;
};

type ToolCtx = { sessionManager?: { getSessionFile(): string | undefined } };

function registerTool(): RegisteredTool {
  let registered: RegisteredTool | undefined;
  createScheduledTaskAgentExtension({ getRuntimeScope: () => 'runtime' })({
    registerTool(tool: RegisteredTool) {
      registered = tool;
    },
  } as never);
  if (!registered) throw new Error('tool was not registered');
  return registered;
}

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    key: 'runtime:task-1',
    title: 'Task One',
    enabled: true,
    profile: 'runtime',
    filePath: '/__automations__/task-1.json',
    schedule: { type: 'cron', expression: '0 9 * * *' },
    targetType: 'background-agent',
    threadMode: 'none',
    timeoutSeconds: 60,
    prompt: 'Do work',
    ...overrides,
  };
}

describe('scheduledTaskTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    automations.buildScheduledTaskThreadDetail.mockReturnValue({ threadMode: 'none' });
    automations.invalidateAppTopics.mockResolvedValue(undefined);
    automations.clearTaskCallbackBinding.mockResolvedValue(undefined);
    automations.setTaskCallbackBinding.mockResolvedValue(undefined);
    automations.pingDaemon.mockResolvedValue(true);
  });

  it('lists valid tasks with runtime status and parse errors', async () => {
    automations.loadScheduledTasksForProfile.mockResolvedValue({
      tasks: [task()],
      parseErrors: [{ filePath: '/bad.json', error: 'bad json' }],
      runtimeState: { 'runtime:task-1': { running: true } },
    });

    const result = await registerTool().execute('call-1', { action: 'list' });

    expect(result.content[0].text).toContain('Scheduled tasks:');
    expect(result.content[0].text).toContain('- @task-1 [running] Task One · cron 0 9 * * * · job');
    expect(result.content[0].text).toContain('Parse errors: /bad.json: bad json');
    expect(result.details).toMatchObject({ action: 'list', count: 1, taskIds: ['task-1'], parseErrorCount: 1 });
  });

  it('formats task detail with thread and callback metadata', async () => {
    automations.resolveScheduledTaskForProfile.mockResolvedValue({
      task: task({ cwd: '/repo', modelRef: 'openai/gpt', conversationBehavior: 'followUp' }),
      runtime: { lastStatus: 'success', lastLogPath: '/log' },
    });
    automations.buildScheduledTaskThreadDetail.mockReturnValue({
      threadMode: 'existing',
      threadConversationId: 'conv-1',
      threadTitle: 'Planning',
    });
    automations.getTaskCallbackBinding.mockResolvedValue({
      conversationId: 'conv-callback',
      deliverOnSuccess: true,
      notifyOnSuccess: 'passive',
      deliverOnFailure: false,
      notifyOnFailure: 'none',
    });

    const result = await registerTool().execute('call-1', { action: 'get', taskId: ' task-1 ' });

    expect(automations.resolveScheduledTaskForProfile).toHaveBeenCalledWith('runtime', 'task-1');
    expect(result.content[0].text).toContain('threadConversationId: conv-1');
    expect(result.content[0].text).toContain('callbackConversationId: conv-callback');
    expect(result.content[0].text).toContain('callbackOnSuccess: passive');
    expect(result.content[0].text).toContain('callbackOnFailure: none');
  });

  it('saves a new one-time conversation automation with parsed time and thread binding', async () => {
    automations.loadScheduledTasksForProfile.mockResolvedValue({ tasks: [], parseErrors: [], runtimeState: {} });
    automations.parseFutureHumanDateTime.mockResolvedValue({
      dueAt: '2026-05-23T01:00:00.000Z',
      interpretation: 'tomorrow at 6pm',
      input: 'tomorrow 6pm',
    });
    automations.readSessionConversationId.mockResolvedValue('conv-1');
    automations.resolveScheduledTaskThreadBinding.mockResolvedValue({
      mode: 'existing',
      conversationId: 'conv-1',
      sessionFile: '/session.json',
    });
    automations.createStoredAutomation.mockResolvedValue(
      task({ schedule: { type: 'at', at: '2026-05-23T01:00:00.000Z' }, targetType: 'conversation' }),
    );
    automations.applyScheduledTaskThreadBinding.mockResolvedValue(
      task({ targetType: 'conversation', threadMode: 'existing', threadConversationId: 'conv-1' }),
    );

    const result = await registerTool().execute(
      'call-1',
      { action: 'save', taskId: 'task-1', at: 'tomorrow 6pm', targetType: 'conversation', prompt: 'Follow up' },
      undefined,
      undefined,
      { sessionManager: { getSessionFile: () => '/session.json' } },
    );

    expect(automations.createStoredAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1', at: '2026-05-23T01:00:00.000Z', targetType: 'conversation' }),
    );
    expect(automations.applyScheduledTaskThreadBinding).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ threadMode: 'existing', threadConversationId: 'conv-1' }),
    );
    expect(automations.clearTaskCallbackBinding).toHaveBeenCalledWith({ profile: 'runtime', taskId: 'task-1' });
    expect(result.content[0].text).toBe('Saved scheduled task @task-1 for tomorrow at 6pm.');
  });

  it('runs a task through the daemon and records telemetry', async () => {
    automations.resolveScheduledTaskForProfile.mockResolvedValue({ task: task(), runtime: undefined });
    automations.startScheduledTaskRun.mockResolvedValue({ accepted: true, runId: 'run-1' });

    const result = await registerTool().execute('call-1', { action: 'run', taskId: 'task-1' });

    expect(automations.startScheduledTaskRun).toHaveBeenCalledWith('task-1');
    expect(telemetry.recordTelemetryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'scheduled_task', name: 'run_tool_run', runId: 'run-1', status: 202 }),
      { extensionId: 'system-automations' },
    );
    expect(result.details).toMatchObject({ action: 'run', taskId: 'task-1', runId: 'run-1' });
  });

  it('returns tool errors for invalid inputs without throwing', async () => {
    await expect(registerTool().execute('call-1', { action: 'get' })).resolves.toMatchObject({
      isError: true,
      content: [{ text: 'taskId is required.' }],
    });
    automations.loadScheduledTasksForProfile.mockResolvedValue({ tasks: [], parseErrors: [], runtimeState: {} });
    await expect(registerTool().execute('call-1', { action: 'save', taskId: 'new-task' })).resolves.toMatchObject({
      isError: true,
      content: [{ text: 'Provide exactly one schedule for a new automation: cron or at.' }],
    });
  });
});
