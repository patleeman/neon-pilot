import { beforeEach, describe, expect, it, vi } from 'vitest';

const runs = vi.hoisted(() => ({
  listDurableRuns: vi.fn(),
  getDurableRun: vi.fn(),
  getDurableRunLog: vi.fn(),
  pingDaemon: vi.fn(),
  startBackgroundRun: vi.fn(),
  rerunDurableRun: vi.fn(),
  followUpDurableRun: vi.fn(),
  cancelDurableRun: vi.fn(),
  createStoredAutomation: vi.fn(),
  applyScheduledTaskThreadBinding: vi.fn(),
  setTaskCallbackBinding: vi.fn(),
  invalidateAppTopics: vi.fn(),
  parseDeferredResumeDelayMs: vi.fn(),
}));

const telemetry = vi.hoisted(() => ({ recordTelemetryEvent: vi.fn() }));

vi.mock('@neon-pilot/extensions/backend/runs', () => runs);
vi.mock('@neon-pilot/extensions/backend/telemetry', () => telemetry);

import { createRunAgentExtension } from './runTool.js';

function registerTools() {
  type RegisteredTool = { execute: (...args: Parameters<ReturnType<typeof vi.fn>>) => Promise<unknown> };
  const registered: Record<string, RegisteredTool> = {};
  createRunAgentExtension({ getRuntimeScope: () => 'runtime', repoRoot: '/repo', runtimeConfigRoot: '/runtime' })({
    registerTool(tool: { name: string; execute: RegisteredTool['execute'] }) {
      registered[tool.name] = { execute: tool.execute };
    },
  } as never);
  return registered;
}

const ctx = {
  cwd: '/work',
  sessionManager: {
    getSessionId: () => 'conversation-1',
    getSessionFile: () => '/sessions/conversation-1.json',
  },
};

describe('runTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runs.pingDaemon.mockResolvedValue(true);
    runs.invalidateAppTopics.mockResolvedValue(undefined);
  });

  it('lists durable runs with summary details', async () => {
    runs.listDurableRuns.mockResolvedValue({
      summary: { total: 2 },
      runs: [
        { runId: 'run-1', status: { status: 'running' }, manifest: { kind: 'shell', source: { type: 'tool' } } },
        { runId: 'run-2', status: { status: 'failed' }, manifest: { kind: 'agent', source: { type: 'scheduled-task', id: 'task-1' } } },
      ],
    });

    const result = await registerTools().background_bash.execute('call-1', { action: 'list' }, undefined, undefined, ctx);

    expect(result.content[0].text).toContain('Durable runs (2):');
    expect(result.content[0].text).toContain('- run-1 [running] shell · source tool');
    expect(result.details).toMatchObject({ action: 'list', runCount: 2, runIds: ['run-1', 'run-2'] });
  });

  it('normalizes log tail and reports missing runs as tool errors', async () => {
    runs.getDurableRunLog.mockResolvedValue(null);

    const result = await registerTools().background_bash.execute(
      'call-1',
      { action: 'logs', runId: ' run-1 ', tail: 'many' },
      undefined,
      undefined,
      ctx,
    );

    expect(runs.getDurableRunLog).toHaveBeenCalledWith('run-1', 120);
    expect(result).toMatchObject({ isError: true, details: { action: 'logs' } });
    expect(result.content[0].text).toBe('Run not found: run-1');
  });

  it('starts background commands with callback metadata when delivery is requested', async () => {
    runs.startBackgroundRun.mockResolvedValue({ accepted: true, runId: 'run-1', logPath: '/logs/run-1.log' });

    const result = await registerTools().background_bash.execute(
      'call-1',
      { action: 'start', taskSlug: 'build', command: 'pnpm test', deliverResultToConversation: true },
      undefined,
      undefined,
      ctx,
    );

    expect(runs.startBackgroundRun).toHaveBeenCalledWith(
      expect.objectContaining({
        taskSlug: 'build',
        cwd: '/work',
        shellCommand: 'pnpm test',
        callbackConversation: expect.objectContaining({ conversationId: 'conversation-1', sessionFile: '/sessions/conversation-1.json' }),
        checkpointPayload: { resumeParentOnExit: true },
      }),
    );
    expect(result.details).toMatchObject({ action: 'start', runId: 'run-1', deliverResultToConversation: true });
    expect(telemetry.recordTelemetryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'start', status: 202 }),
      { extensionId: 'system-runs' },
    );
  });

  it('validates scheduled subagent trigger combinations and loop iteration counts', async () => {
    const tool = registerTools().subagent;

    await expect(
      tool.execute(
        'call-1',
        { action: 'start', taskSlug: 'agent', prompt: 'work', defer: '1h', cron: '* * * * *' },
        undefined,
        undefined,
        ctx,
      ),
    ).resolves.toMatchObject({ isError: true, content: [{ text: 'Use only one scheduling trigger: defer, cron, or at.' }] });

    await expect(
      tool.execute(
        'call-1',
        { action: 'start', taskSlug: 'agent', prompt: 'work', loop: true, loopMaxIterations: 0 },
        undefined,
        undefined,
        ctx,
      ),
    ).resolves.toMatchObject({ isError: true, content: [{ text: 'loopMaxIterations must be a positive integer.' }] });
  });
});
