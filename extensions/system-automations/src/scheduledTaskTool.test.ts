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
  promptSnippet?: string;
  promptGuidelines?: string[];
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
    automations.deleteStoredAutomation.mockResolvedValue(true);
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

  it('instructs chat turns to use the tool for automation creation', () => {
    const tool = registerTool();

    expect(tool.promptSnippet).toContain('create');
    expect(tool.promptSnippet).toContain('call scheduled_task directly');
    expect(tool.promptGuidelines).toEqual(
      expect.arrayContaining([
        expect.stringContaining('action="save"'),
        expect.stringContaining('targetType="conversation"'),
        expect.stringContaining('threadMode="current"'),
        expect.stringContaining('natural schedule text'),
        expect.stringContaining('taskId and threadConversationId can both be omitted'),
        expect.stringContaining('Reply exactly: <text>'),
        expect.stringContaining('do not inspect files, databases, admin commands, or shell output'),
        expect.stringContaining('Only set deliverResultToConversation for background-agent'),
        expect.stringContaining('do not use shell commands'),
      ]),
    );
    expect(tool.description).toContain('threadMode="current"');
    expect(tool.description).toContain('omit taskId and threadConversationId');
    expect(tool.description).toContain('Do not use shell commands, databases, files, or admin tools');
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

    const result = await registerTool().execute('call-1', { action: 'get', taskId: ' @task-1 ' });

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
    expect(automations.invalidateAppTopics).toHaveBeenCalledWith(['tasks', 'sessions', 'workspace']);
    expect(result.content[0].text).toBe('Saved scheduled task @task-1 for tomorrow at 6pm.');
  });

  it('saves a current-thread conversation automation without requiring the model to choose a task id', async () => {
    automations.loadScheduledTasksForProfile.mockResolvedValue({ tasks: [], parseErrors: [], runtimeState: {} });
    automations.parseFutureHumanDateTime.mockResolvedValue({
      dueAt: '2026-05-23T13:30:00.000Z',
      interpretation: 'tomorrow at 9:30 AM',
      input: 'tomorrow at 9:30 AM',
    });
    automations.readSessionConversationId.mockResolvedValue('conv-natural');
    automations.resolveScheduledTaskThreadBinding.mockResolvedValue({
      mode: 'existing',
      conversationId: 'conv-natural',
      sessionFile: '/session-natural.json',
    });
    automations.createStoredAutomation.mockResolvedValue(
      task({
        id: 'qa-natural-chat-automation-a1b2c3d4',
        title: 'QA Natural Chat Automation',
        schedule: { type: 'at', at: '2026-05-23T13:30:00.000Z' },
        targetType: 'conversation',
      }),
    );
    automations.applyScheduledTaskThreadBinding.mockResolvedValue(
      task({
        id: 'qa-natural-chat-automation-a1b2c3d4',
        title: 'QA Natural Chat Automation',
        targetType: 'conversation',
        threadMode: 'existing',
        threadConversationId: 'conv-natural',
      }),
    );

    const result = await registerTool().execute(
      'call-1',
      {
        action: 'save',
        title: 'QA Natural Chat Automation',
        at: 'tomorrow at 9:30 AM',
        targetType: 'conversation',
        threadMode: 'current',
        prompt: 'Reply exactly QA natural fired.',
      },
      undefined,
      undefined,
      { sessionManager: { getSessionFile: () => '/session-natural.json' } },
    );

    expect(automations.createStoredAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: undefined,
        title: 'QA Natural Chat Automation',
        at: '2026-05-23T13:30:00.000Z',
        targetType: 'conversation',
        prompt: 'Reply exactly QA natural fired.',
      }),
    );
    expect(automations.applyScheduledTaskThreadBinding).toHaveBeenCalledWith(
      'qa-natural-chat-automation-a1b2c3d4',
      expect.objectContaining({
        threadMode: 'existing',
        threadConversationId: 'conv-natural',
        threadSessionFile: '/session-natural.json',
      }),
    );
    expect(automations.clearTaskCallbackBinding).toHaveBeenCalledWith({
      profile: 'runtime',
      taskId: 'qa-natural-chat-automation-a1b2c3d4',
    });
    expect(result.content[0].text).toBe('Saved scheduled task @qa-natural-chat-automation-a1b2c3d4 for tomorrow at 9:30 AM.');
    expect(result.details).toMatchObject({ action: 'save', taskId: 'qa-natural-chat-automation-a1b2c3d4' });
  });

  it('saves a background-agent automation with callback delivery to the current conversation', async () => {
    automations.loadScheduledTasksForProfile.mockResolvedValue({ tasks: [], parseErrors: [], runtimeState: {} });
    automations.readSessionConversationId.mockResolvedValue('conv-1');
    automations.resolveScheduledTaskThreadBinding.mockResolvedValue({
      mode: 'existing',
      conversationId: 'conv-1',
      sessionFile: '/session.json',
    });
    automations.createStoredAutomation.mockResolvedValue(
      task({ id: 'agent-check', schedule: { type: 'cron', expression: '*/15 * * * *' }, targetType: 'background-agent' }),
    );
    automations.applyScheduledTaskThreadBinding.mockResolvedValue(
      task({ id: 'agent-check', targetType: 'background-agent', threadMode: 'existing', threadConversationId: 'conv-1' }),
    );

    const result = await registerTool().execute(
      'call-1',
      {
        action: 'save',
        taskId: 'agent-check',
        cron: '*/15 * * * *',
        targetType: 'background-agent',
        threadMode: 'existing',
        deliverResultToConversation: true,
        prompt: 'Check the order feed',
      },
      undefined,
      undefined,
      { sessionManager: { getSessionFile: () => '/session.json' } },
    );

    expect(automations.createStoredAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agent-check',
        cron: '*/15 * * * *',
        targetType: 'background-agent',
        prompt: 'Check the order feed',
      }),
    );
    expect(automations.applyScheduledTaskThreadBinding).toHaveBeenCalledWith(
      'agent-check',
      expect.objectContaining({ threadMode: 'existing', threadConversationId: 'conv-1', threadSessionFile: '/session.json' }),
    );
    expect(automations.setTaskCallbackBinding).toHaveBeenCalledWith({
      profile: 'runtime',
      taskId: 'agent-check',
      conversationId: 'conv-1',
      sessionFile: '/session.json',
      deliverOnSuccess: true,
      deliverOnFailure: true,
      notifyOnSuccess: 'disruptive',
      notifyOnFailure: 'disruptive',
      requireAck: true,
      autoResumeIfOpen: true,
    });
    expect(automations.invalidateAppTopics).toHaveBeenCalledWith(['tasks', 'sessions', 'workspace']);
    expect(result.details).toMatchObject({ action: 'save', taskId: 'agent-check', targetType: 'background-agent' });
  });

  it('deletes an automation, clears callbacks, and invalidates task and conversation topics', async () => {
    const result = await registerTool().execute('call-1', { action: 'delete', taskId: 'task-1' });

    expect(automations.deleteStoredAutomation).toHaveBeenCalledWith('task-1');
    expect(automations.clearTaskCallbackBinding).toHaveBeenCalledWith({ profile: 'runtime', taskId: 'task-1' });
    expect(automations.invalidateAppTopics).toHaveBeenCalledWith(['tasks', 'sessions', 'workspace']);
    expect(result.details).toMatchObject({ action: 'delete', taskId: 'task-1' });
  });

  it('reports a missing task when delete does not remove anything', async () => {
    automations.deleteStoredAutomation.mockResolvedValue(false);

    const result = await registerTool().execute('call-1', { action: 'delete', taskId: 'task-missing' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Task not found: task-missing');
    expect(automations.clearTaskCallbackBinding).not.toHaveBeenCalled();
    expect(automations.invalidateAppTopics).not.toHaveBeenCalled();
  });

  it('ignores background-agent callback delivery flags for conversation automations', async () => {
    automations.loadScheduledTasksForProfile.mockResolvedValue({ tasks: [], parseErrors: [], runtimeState: {} });
    automations.parseFutureHumanDateTime.mockResolvedValue({
      dueAt: '2026-05-23T01:00:00.000Z',
      interpretation: 'tomorrow at 6pm',
      input: 'tomorrow 6pm',
    });
    automations.readSessionConversationId.mockResolvedValue('conv-callback');
    automations.resolveScheduledTaskThreadBinding.mockResolvedValue({
      mode: 'existing',
      conversationId: 'conv-callback',
      sessionFile: '/session.json',
    });
    automations.createStoredAutomation.mockResolvedValue(task({ id: 'conversation-check', targetType: 'conversation' }));
    automations.applyScheduledTaskThreadBinding.mockResolvedValue(
      task({
        id: 'conversation-check',
        targetType: 'conversation',
        threadMode: 'existing',
        threadConversationId: 'conv-callback',
      }),
    );

    const result = await registerTool().execute(
      'call-1',
      {
        action: 'save',
        taskId: 'conversation-check',
        at: 'tomorrow 6pm',
        targetType: 'conversation',
        deliverResultToConversation: true,
        prompt: 'Follow up in this thread',
      },
      undefined,
      undefined,
      { sessionManager: { getSessionFile: () => '/session.json' } },
    );

    expect(result.content[0].text).toBe('Saved scheduled task @conversation-check for tomorrow at 6pm.');
    expect(automations.setTaskCallbackBinding).not.toHaveBeenCalled();
    expect(automations.clearTaskCallbackBinding).toHaveBeenCalledWith({ profile: 'runtime', taskId: 'conversation-check' });
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
    expect(automations.invalidateAppTopics).toHaveBeenCalledWith(['tasks', 'runs', 'sessions', 'workspace']);
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
