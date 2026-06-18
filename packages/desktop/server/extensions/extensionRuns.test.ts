import { beforeEach, describe, expect, it, vi } from 'vitest';

const pingDaemon = vi.fn();
const startBackgroundRun = vi.fn();
const cancelDurableRun = vi.fn();
const getDurableRun = vi.fn();
const getDurableRunLog = vi.fn();
const listDurableRuns = vi.fn();
const getExecution = vi.fn();
const getExecutionLog = vi.fn();
const listConversationExecutions = vi.fn();
const listExecutions = vi.fn();
const invalidateAppTopics = vi.fn();

vi.mock('@neon-pilot/daemon', () => ({ pingDaemon, startBackgroundRun }));
vi.mock('../automation/durableRuns.js', () => ({ cancelDurableRun, getDurableRun, getDurableRunLog, listDurableRuns }));
vi.mock('../executions/executionService.js', () => ({ getExecution, getExecutionLog, listConversationExecutions, listExecutions }));
vi.mock('../middleware/index.js', () => ({ invalidateAppTopics }));
vi.mock('./extensionPermissions.js', () => ({
  assertExtensionPermission: vi.fn((extensionId: string, permission: string, capability: string) => {
    throw new Error(`Extension "${extensionId}" requires permission ${permission} to use ${capability}.`);
  }),
}));

const { createExtensionExecutionsCapability, createExtensionRunsCapability } = await import('./extensionRuns.js');

describe('extensionRuns', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pingDaemon.mockReset().mockResolvedValue(true);
    startBackgroundRun.mockReset().mockResolvedValue({ accepted: true, runId: 'run-1', logPath: '/logs/run-1.log' });
    cancelDurableRun.mockReset().mockResolvedValue({ cancelled: true });
    getDurableRun.mockReset();
    getDurableRunLog.mockReset();
    listDurableRuns.mockReset().mockResolvedValue({ runs: [] });
    getExecution.mockReset();
    getExecutionLog.mockReset();
    listConversationExecutions.mockReset().mockResolvedValue({ executions: ['conversation-exec'] });
    listExecutions.mockReset().mockResolvedValue({ executions: ['all-exec'] });
    invalidateAppTopics.mockReset();
  });

  it('starts no-session agent runs with normalized task slugs and default cwd', async () => {
    const cwd = process.cwd();
    const runs = createExtensionRunsCapability('system-test');

    await expect(runs.start({ prompt: 'Do work', source: 'Fancy Source!' })).resolves.toEqual({
      runId: 'run-1',
      executionId: 'run-1',
      logPath: '/logs/run-1.log',
    });
    expect(startBackgroundRun).toHaveBeenCalledWith({
      taskSlug: 'ext-Fancy-Source',
      cwd,
      agent: { prompt: 'Do work', noSession: true },
      source: { type: 'app', id: 'extension:system-test' },
    });
    expect(invalidateAppTopics).toHaveBeenCalledWith('executions', 'runs');
  });

  it('requires prompts and a responding daemon before starting runs', async () => {
    const runs = createExtensionRunsCapability('ext');
    await expect(runs.start({ prompt: '   ' })).rejects.toThrow('prompt is required');

    pingDaemon.mockResolvedValue(false);
    await expect(runs.start({ prompt: 'go' })).rejects.toThrow('Daemon is not responding');
  });

  it('surfaces rejected run starts', async () => {
    startBackgroundRun.mockResolvedValue({ accepted: false, reason: 'busy' });

    await expect(createExtensionRunsCapability('ext').start({ prompt: 'go', taskSlug: '***' })).rejects.toThrow('busy');
    expect(startBackgroundRun).toHaveBeenCalledWith(expect.objectContaining({ taskSlug: 'ext-ext' }));
  });

  it('wraps durable run get, list, logs, and cancel behavior', async () => {
    const runs = createExtensionRunsCapability('ext');
    getDurableRun.mockResolvedValue({ run: { runId: 'r1' } });
    getDurableRunLog.mockResolvedValue({ log: 'hello' });
    listDurableRuns.mockResolvedValue({ runs: [{ runId: 'r1' }] });

    await expect(runs.get('r1')).resolves.toEqual({ run: { runId: 'r1' } });
    await expect(runs.readLog('r1', 20)).resolves.toEqual({ log: 'hello' });
    await expect(runs.list()).resolves.toEqual({ runs: [{ runId: 'r1' }] });
    await expect(runs.cancel('r1')).resolves.toEqual({ cancelled: true });
    expect(invalidateAppTopics).toHaveBeenCalledWith('executions', 'runs');

    getDurableRun.mockResolvedValue(null);
    await expect(runs.get('missing')).rejects.toThrow('Run not found');
    getDurableRunLog.mockResolvedValue(null);
    await expect(runs.readLog('missing')).rejects.toThrow('Run not found');
    cancelDurableRun.mockResolvedValue({ cancelled: false, reason: 'already done' });
    await expect(runs.cancel('r1')).rejects.toThrow('already done');
  });

  it('adapts runs to the executions capability', async () => {
    const executions = createExtensionExecutionsCapability('ext');
    getExecution.mockResolvedValue({ execution: { id: 'e1' } });
    getExecutionLog.mockResolvedValue({ log: 'execution log' });

    await expect(executions.start({ prompt: 'go', cwd: '/tmp' })).resolves.toEqual({
      id: 'run-1',
      runId: 'run-1',
      logPath: '/logs/run-1.log',
    });
    await expect(executions.get('e1')).resolves.toEqual({ id: 'e1' });
    await expect(executions.readLog('e1')).resolves.toEqual({ log: 'execution log' });
    await expect(executions.list({ conversationId: ' c1 ' })).resolves.toEqual(['conversation-exec']);
    await expect(executions.list()).resolves.toEqual(['all-exec']);
    await expect(executions.cancel('e1')).resolves.toEqual({ cancelled: true });

    getExecution.mockResolvedValue(null);
    await expect(executions.get('missing')).rejects.toThrow('Execution not found');
    getExecutionLog.mockResolvedValue(null);
    await expect(executions.readLog('missing')).rejects.toThrow('Execution not found');
    cancelDurableRun.mockResolvedValue({ cancelled: false });
    await expect(executions.cancel('e1')).rejects.toThrow('Could not cancel execution');
  });

  it('requires execution permissions when manifest enforcement is enabled', async () => {
    const executions = createExtensionExecutionsCapability('execution-helper-ext', { enforceManifestPermissions: true });

    await expect(executions.list()).rejects.toThrow(
      'Extension "execution-helper-ext" requires permission executions:read to use executions.list.',
    );
    await expect(executions.start({ prompt: 'go' })).rejects.toThrow(
      'Extension "execution-helper-ext" requires permission executions:start to use executions.start.',
    );
    await expect(executions.cancel('run-1')).rejects.toThrow(
      'Extension "execution-helper-ext" requires permission executions:cancel to use executions.cancel.',
    );
  });
});
