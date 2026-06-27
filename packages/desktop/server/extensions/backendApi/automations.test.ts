import { beforeEach, describe, expect, it, vi } from 'vitest';

const daemon = vi.hoisted(() => ({ callDaemonExport: vi.fn() }));
const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));

vi.mock('./daemonBridge.js', () => daemon);
vi.mock('./serverModuleResolver.js', () => resolver);

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

describe('backendApi/automations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE];
  });

  it('parses deferred resume delays and normalizes automation targets', async () => {
    const automations = await import('./automations.js');

    expect(automations.parseDeferredResumeDelayMs('now + 15 min')).toBe(900_000);
    expect(automations.parseDeferredResumeDelayMs('4hrs')).toBe(14_400_000);
    expect(automations.parseDeferredResumeDelayMs('2 days')).toBe(172_800_000);
    expect(automations.parseDeferredResumeDelayMs('soon')).toBeUndefined();
    expect(automations.normalizeAutomationTargetTypeForSelection('conversation')).toBe('conversation');
    expect(automations.normalizeAutomationTargetTypeForSelection('other')).toBe('background-agent');
  });

  it('forwards automation state and scheduling helpers to server modules', async () => {
    const automations = await import('./automations.js');
    resolver.callServerModuleExport.mockResolvedValueOnce({ dueAt: '2026-05-23T00:00:00Z' });
    await expect(automations.parseFutureHumanDateTime('tomorrow')).resolves.toEqual({ dueAt: '2026-05-23T00:00:00Z' });
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../automation/humanDateTime.js',
      'parseFutureHumanDateTime',
      'tomorrow',
    );

    resolver.callServerModuleExport.mockResolvedValueOnce({ tasks: [], parseErrors: [] });
    await expect(automations.loadScheduledTasksForProfile('shared')).resolves.toEqual({ tasks: [], parseErrors: [] });
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../automation/scheduledTasks.js',
      'loadScheduledTasksForProfile',
      'shared',
    );

    resolver.callServerModuleExport.mockResolvedValueOnce({ id: 'task-1' });
    await expect(automations.applyScheduledTaskThreadBinding('task-1', { threadMode: 'none' })).resolves.toEqual({ id: 'task-1' });
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../automation/scheduledTaskThreads.js',
      'applyScheduledTaskThreadBinding',
      'task-1',
      { threadMode: 'none' },
    );
  });

  it('forwards live session queue helpers to conversation modules', async () => {
    const automations = await import('./automations.js');
    resolver.callServerModuleExport.mockResolvedValueOnce([{ id: 'preview-1' }]);
    await expect(automations.listQueuedPromptPreviews('session-1')).resolves.toEqual([{ id: 'preview-1' }]);
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../conversations/liveSessions.js',
      'listQueuedPromptPreviews',
      'session-1',
    );

    resolver.callServerModuleExport.mockResolvedValueOnce(true);
    await expect(automations.cancelQueuedPrompt('session-1', 'followUp', 'preview-1')).resolves.toBe(true);
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../conversations/liveSessions.js',
      'cancelQueuedPrompt',
      'session-1',
      'followUp',
      'preview-1',
    );

    resolver.callServerModuleExport.mockResolvedValueOnce(undefined);
    await expect(automations.promptSession('session-1', 'Continue', 'followUp')).resolves.toBeUndefined();
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '../../conversations/liveSessions.js',
      'promptSession',
      'session-1',
      'Continue',
      'followUp',
      undefined,
      undefined,
      expect.objectContaining({ source: { type: 'extension', id: 'system-automations', name: 'Automations' } }),
    );
  });

  it('spreads app invalidation topics so renderers receive normal topic names', async () => {
    const automations = await import('./automations.js');
    resolver.callServerModuleExport.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    await automations.invalidateAppTopics(['tasks', 'runs', 'sessions']);
    await automations.invalidateAppTopics('tasks');

    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(
      1,
      '../../shared/appEvents.js',
      'invalidateAppTopics',
      'tasks',
      'runs',
      'sessions',
    );
    expect(resolver.callServerModuleExport).toHaveBeenNthCalledWith(2, '../../shared/appEvents.js', 'invalidateAppTopics', 'tasks');
  });

  it('uses the trusted host UI capability bridge for app invalidation when available', async () => {
    const bridge = vi.fn(async () => undefined);
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const automations = await import('./automations.js');

    await automations.invalidateAppTopics(['tasks', 'sessions', 'workspace']);

    expect(bridge).toHaveBeenCalledWith('ui', 'invalidate', { topics: ['tasks', 'sessions', 'workspace'] });
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
  });

  it('uses the trusted host automations capability bridge for privileged task helpers', async () => {
    const bridge = vi.fn(async (_capability: string, operation: string) => {
      if (operation === 'loadScheduledTasksForProfile') return { tasks: [], parseErrors: [] };
      if (operation === 'createStoredAutomation') return { id: 'task-1' };
      if (operation === 'deleteStoredAutomation') return true;
      if (operation === 'startScheduledTaskRun') return { accepted: true, runId: 'run-1' };
      return undefined;
    });
    (globalThis as Record<symbol, unknown>)[EXTENSION_HOST_CAPABILITY_BRIDGE] = bridge;
    const automations = await import('./automations.js');

    await expect(automations.loadScheduledTasksForProfile('runtime')).resolves.toEqual({ tasks: [], parseErrors: [] });
    await expect(automations.createStoredAutomation({ title: 'Task' })).resolves.toEqual({ id: 'task-1' });
    await expect(automations.deleteStoredAutomation('task-1')).resolves.toBe(true);
    await expect(automations.startScheduledTaskRun('task-1')).resolves.toEqual({ accepted: true, runId: 'run-1' });

    expect(bridge).toHaveBeenNthCalledWith(1, 'automations', 'loadScheduledTasksForProfile', { args: ['runtime'] });
    expect(bridge).toHaveBeenNthCalledWith(2, 'automations', 'createStoredAutomation', { args: [{ title: 'Task' }] });
    expect(bridge).toHaveBeenNthCalledWith(3, 'automations', 'deleteStoredAutomation', { args: ['task-1', undefined] });
    expect(bridge).toHaveBeenNthCalledWith(4, 'automations', 'startScheduledTaskRun', { args: ['task-1'] });
    expect(resolver.callServerModuleExport).not.toHaveBeenCalled();
    expect(daemon.callDaemonExport).not.toHaveBeenCalled();
  });

  it('uses core helpers for deferred resume and task callback state', async () => {
    const automations = await import('./automations.js');
    resolver.callServerModuleExport.mockResolvedValueOnce([{ id: 'resume-1' }]);
    await expect(automations.getSessionDeferredResumeEntries({ entries: [] }, '/session.json')).resolves.toEqual([{ id: 'resume-1' }]);
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith(
      '@neon-pilot/core',
      'getSessionDeferredResumeEntries',
      { entries: [] },
      '/session.json',
    );

    resolver.callServerModuleExport.mockResolvedValueOnce({ conversationId: 'conv-1' });
    await expect(automations.getTaskCallbackBinding({ profile: 'shared', taskId: 'task-1' })).resolves.toEqual({
      conversationId: 'conv-1',
    });
    expect(resolver.callServerModuleExport).toHaveBeenLastCalledWith('@neon-pilot/core', 'getTaskCallbackBinding', {
      profile: 'shared',
      taskId: 'task-1',
    });
  });

  it('treats daemon ping failures as false and starts scheduled runs through daemon bridge', async () => {
    const automations = await import('./automations.js');
    daemon.callDaemonExport.mockRejectedValueOnce(new Error('offline'));
    await expect(automations.pingDaemon()).resolves.toBe(false);

    daemon.callDaemonExport.mockResolvedValueOnce(true);
    await expect(automations.pingDaemon()).resolves.toBe(true);

    daemon.callDaemonExport.mockResolvedValueOnce({ accepted: true, runId: 'run-1' });
    await expect(automations.startScheduledTaskRun('task-1')).resolves.toEqual({ accepted: true, runId: 'run-1' });
    expect(daemon.callDaemonExport).toHaveBeenLastCalledWith('startScheduledTaskRun', 'task-1');
  });
});
