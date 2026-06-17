import { beforeEach, describe, expect, it, vi } from 'vitest';

const runs = vi.hoisted(() => ({
  cancelDurableRun: vi.fn(),
  getDurableRun: vi.fn(),
  pingDaemon: vi.fn(),
  startBackgroundRun: vi.fn(),
}));
const settingsApi = vi.hoisted(() => ({ readExtensionSettings: vi.fn() }));

vi.mock('@neon-pilot/extensions/backend/runs', () => runs);
vi.mock('@neon-pilot/extensions/backend/settings', () => settingsApi);

import {
  cancelWorkflow,
  listSavedWorkflows,
  listWorkflowTemplates,
  listWorkflows,
  normalizeAllowedTools,
  normalizeWorkflowSettings,
  resolveAgentModel,
  runSavedWorkflow,
  saveWorkflow,
  workflow,
} from './backend.js';

function createMemoryDb() {
  const runsTable = new Map<string, Record<string, unknown>>();
  const nodesTable = new Map<string, Record<string, unknown>>();
  const savedTable = new Map<string, Record<string, unknown>>();
  const eventsTable: Record<string, unknown>[] = [];
  return {
    exec: vi.fn(),
    prepare(sql: string) {
      return {
        run: (...params: unknown[]) => {
          if (sql.startsWith('INSERT INTO workflow_runs')) {
            runsTable.set(String(params[0]), {
              id: params[0],
              name: params[1],
              description: params[2],
              status: params[3],
              cwd: params[4],
              parent_conversation_id: params[5],
              block_id: params[6],
              script: params[7],
              args_json: params[8],
              result_text: params[9],
              error: params[10],
              active_phase: params[11],
              model: params[12],
              agent_defaults_json: params[13],
              settings_json: params[14],
              created_at: params[15],
              updated_at: params[16],
              completed_at: params[17],
            });
          } else if (sql.startsWith('DELETE FROM workflow_runs')) {
            runsTable.delete(String(params[0]));
          } else if (sql.startsWith('INSERT INTO workflow_nodes')) {
            nodesTable.set(String(params[0]), {
              id: params[0],
              workflow_id: params[1],
              phase: params[2],
              role: params[3],
              prompt: params[4],
              status: params[5],
              run_id: params[6],
              model: params[7],
              allowed_tools_json: params[8],
              result_text: params[9],
              error: params[10],
              created_at: params[11],
              updated_at: params[12],
              completed_at: params[13],
            });
          } else if (sql.startsWith('DELETE FROM workflow_nodes')) {
            nodesTable.delete(String(params[0]));
          } else if (sql.startsWith('INSERT INTO workflow_events')) {
            eventsTable.push({
              id: params[0],
              workflow_id: params[1],
              event_type: params[2],
              message: params[3],
              data_json: params[4],
              created_at: params[5],
            });
          } else if (sql.startsWith('INSERT INTO saved_workflows')) {
            savedTable.set(String(params[0]), {
              id: params[0],
              name: params[1],
              description: params[2],
              script: params[3],
              args_json: params[4],
              cwd: params[5],
              model: params[6],
              agent_defaults_json: params[7],
              created_at: params[8],
              updated_at: params[9],
            });
          } else if (sql.startsWith('DELETE FROM saved_workflows')) {
            savedTable.delete(String(params[0]));
          }
          return { changes: 1, lastInsertRowid: 1 };
        },
        get: (...params: unknown[]) => {
          if (sql.includes('FROM workflow_runs')) return runsTable.get(String(params[0]));
          if (sql.includes('FROM workflow_nodes')) return nodesTable.get(String(params[0]));
          if (sql.includes('FROM saved_workflows')) return savedTable.get(String(params[0]));
          return undefined;
        },
        all: (...params: unknown[]) => {
          if (sql.includes('FROM workflow_nodes')) return Array.from(nodesTable.values()).filter((row) => row.workflow_id === params[0]);
          if (sql.includes('FROM workflow_events')) return eventsTable.filter((row) => row.workflow_id === params[0]);
          if (sql.includes('FROM workflow_runs')) return Array.from(runsTable.values());
          if (sql.includes('FROM saved_workflows')) return Array.from(savedTable.values());
          return [];
        },
      };
    },
    close: vi.fn(),
    pragma: vi.fn(),
    transaction: (fn: (...args: unknown[]) => void) => fn,
    dump: () => ({
      runs: Array.from(runsTable.values()),
      nodes: Array.from(nodesTable.values()),
      saved: Array.from(savedTable.values()),
      events: eventsTable,
    }),
  };
}

function createCtx(settings: unknown = {}) {
  const db = createMemoryDb();
  return {
    db,
    ctx: {
      runtime: { getRepoRoot: () => '/repo' },
      storage: { get: vi.fn(async () => settings) },
      database: { open: vi.fn(async () => db) },
      toolContext: { conversationId: 'conv-1', cwd: '/repo', sessionFile: '/sessions/conv-1.json' },
      conversations: {
        appendTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
        updateTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
      },
    } as never,
  };
}

function createStoredRun(id: string, name: string, createdAt: string) {
  return {
    id,
    name,
    description: null,
    status: 'completed',
    cwd: '/repo',
    parent_conversation_id: null,
    block_id: null,
    script: 'return workflow.finish("done");',
    args_json: 'null',
    result_text: 'done',
    error: null,
    active_phase: null,
    model: null,
    agent_defaults_json: '{}',
    settings_json: '{}',
    created_at: createdAt,
    updated_at: createdAt,
    completed_at: createdAt,
  };
}

function createStoredSavedWorkflow(id: string, name: string, updatedAt: string) {
  return {
    id,
    name,
    description: null,
    script: 'return workflow.finish("done");',
    args_json: 'null',
    cwd: '/repo',
    model: null,
    agent_defaults_json: '{}',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: updatedAt,
  };
}

describe('dynamic workflows backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsApi.readExtensionSettings.mockResolvedValue({});
    runs.pingDaemon.mockResolvedValue(true);
    runs.cancelDurableRun.mockResolvedValue({ ok: true });
    runs.startBackgroundRun.mockResolvedValue({ accepted: true, runId: 'run-1' });
    runs.getDurableRun.mockResolvedValue({ run: { status: { status: 'completed' }, result: { summary: 'agent done' } } });
  });

  it('normalizes settings with Claude-like caps', () => {
    expect(normalizeWorkflowSettings({ maxConcurrentAgents: 99, maxTotalAgents: 5000, workflowTimeoutMinutes: 99999 })).toMatchObject({
      maxConcurrentAgents: 16,
      maxTotalAgents: 1000,
      workflowTimeoutMinutes: 1440,
    });
  });

  it('resolves model precedence', () => {
    expect(
      resolveAgentModel({
        agentModel: 'agent/model',
        agentDefaultsModel: 'defaults/model',
        toolModel: 'tool/model',
        settingsModel: 'settings/model',
        conversationModel: 'conversation/model',
      }),
    ).toBe('agent/model');
    expect(resolveAgentModel({ settingsModel: 'opencode-go/deepseek-v4-flash', conversationModel: 'conversation/model' })).toBe(
      'opencode-go/deepseek-v4-flash',
    );
  });

  it('normalizes allowed tools', () => {
    expect(normalizeAllowedTools(' bash, read, bash ', ['edit'])).toEqual(['bash', 'read']);
    expect(normalizeAllowedTools('', ['edit'])).toEqual(['edit']);
    expect(normalizeAllowedTools([], ['edit'])).toEqual([]);
  });

  it('runs a workflow agent with the configured cheap model', async () => {
    settingsApi.readExtensionSettings.mockResolvedValue({
      'dynamicWorkflows.defaultAgentModel': 'opencode-go/deepseek-v4-flash',
      'dynamicWorkflows.defaultAgentAllowedTools': 'bash,read',
    });
    const { ctx, db } = createCtx();
    const result = await workflow(
      {
        name: 'Fanout',
        script: `const result = await workflow.agent({ role: "audit", prompt: "inspect auth" }); return workflow.finish(result.summary);`,
      },
      ctx,
    );
    expect(result).toMatchObject({ details: { status: 'completed' } });
    expect(runs.startBackgroundRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: expect.objectContaining({ model: 'opencode-go/deepseek-v4-flash', allowedTools: ['bash', 'read'] }),
      }),
    );
    expect(db.dump().nodes[0]).toMatchObject({ model: 'opencode-go/deepseek-v4-flash', status: 'completed' });
  });

  it('starts tool-invoked workflows asynchronously to avoid backend worker timeouts', async () => {
    const { ctx, db } = createCtx();
    const toolCtx = {
      ...(ctx as Record<string, unknown>),
      agentToolContext: { model: { id: 'conversation/model' } },
    } as never;

    const result = await workflow(
      {
        name: 'Async fanout',
        script: `const result = await workflow.agent({ role: "audit", prompt: "inspect auth" }); return workflow.finish(result.summary);`,
      },
      toolCtx,
    );

    expect(result).toMatchObject({ details: { status: 'running' } });
    expect(result.content[0].text).toContain('started');
    expect(result.content[0].text).toContain('Workflows page');
    await vi.waitFor(() => expect(runs.startBackgroundRun).toHaveBeenCalled());
    await vi.waitFor(() => expect(db.dump().runs[0]).toMatchObject({ status: 'completed', result_text: 'agent done' }));
  });

  it('allows explicit waitForCompletion for synchronous workflow callers', async () => {
    const { ctx } = createCtx();
    const toolCtx = {
      ...(ctx as Record<string, unknown>),
      agentToolContext: { model: { id: 'conversation/model' } },
    } as never;

    const result = await workflow({ name: 'Sync tool', waitForCompletion: true, script: `return workflow.finish("done");` }, toolCtx);

    expect(result).toMatchObject({ details: { status: 'completed', result: 'done' } });
  });

  it('lets per-agent model override workflow defaults', async () => {
    settingsApi.readExtensionSettings.mockResolvedValue({ 'dynamicWorkflows.defaultAgentModel': 'settings/model' });
    const { ctx } = createCtx();
    await workflow(
      {
        name: 'Override',
        model: 'tool/model',
        agentDefaults: { model: 'defaults/model' },
        script: `await workflow.agent({ prompt: "work", model: "agent/model" });`,
      },
      ctx,
    );
    expect(runs.startBackgroundRun).toHaveBeenCalledWith(
      expect.objectContaining({ agent: expect.objectContaining({ model: 'agent/model' }) }),
    );
  });

  it('preserves explicit empty allowed tools for workflow agents', async () => {
    const { ctx, db } = createCtx();
    await workflow(
      {
        name: 'No tools',
        script: `await workflow.agent({ prompt: "work without tools", allowedTools: [] });`,
      },
      ctx,
    );
    expect(runs.startBackgroundRun).toHaveBeenCalledWith(expect.objectContaining({ agent: expect.objectContaining({ allowedTools: [] }) }));
    expect(db.dump().nodes[0]).toMatchObject({ allowed_tools_json: '[]' });
  });

  it('does not expose Node globals to workflow scripts', async () => {
    const { ctx } = createCtx();
    const result = await workflow({ name: 'Blocked', script: `return workflow.finish(typeof process + ":" + typeof require);` }, ctx);
    expect(result.content[0].text).toContain('undefined:undefined');
  });

  it('explains empty results when a script forgets to return from the async body', async () => {
    const { ctx } = createCtx();
    const result = await workflow(
      {
        name: 'IIFE',
        script: `(async () => { return { ok: true }; })()`,
      },
      ctx,
    );

    expect(result).toMatchObject({ details: { status: 'completed' } });
    expect(result.content[0].text).toContain('Workflow completed without a result.');
    expect(result.content[0].text).toContain('do not wrap it in an async IIFE');
    expect(result.content[0].text).not.toContain('\n\nnull');
  });

  it('caps chat output while storing the full workflow result', async () => {
    const { ctx, db } = createCtx();
    const long = 'x'.repeat(12000);
    const result = await workflow({ name: 'Long result', script: `return workflow.finish(${JSON.stringify(long)});` }, ctx);

    expect(result.content[0].text.length).toBeLessThan(9000);
    expect(result.content[0].text).toContain('Result truncated for chat');
    expect(result.details).toMatchObject({ fullResultStored: true });
    expect(String(db.dump().runs[0]?.result_text).length).toBe(12000);
  });

  it('lets workflow.phase set the active phase without a callback', async () => {
    const { ctx, db } = createCtx();
    const result = await workflow(
      {
        name: 'Phase',
        script: `await workflow.phase("verify"); workflow.log("phase set"); return workflow.finish("done");`,
      },
      ctx,
    );
    expect(result).toMatchObject({ details: { status: 'completed', result: 'done' } });
    expect(db.dump().runs[0]).toMatchObject({ active_phase: 'verify', result_text: 'done' });
    expect(db.dump().events.some((event) => event.event_type === 'phase.start' && event.message === 'verify')).toBe(true);
  });

  it('uses extension storage when the action context has no sqlite database capability', async () => {
    const storage = new Map<string, unknown>();
    const ctx = {
      runtime: { getRepoRoot: () => '/repo' },
      storage: {
        get: vi.fn(async (key: string) => storage.get(key)),
        put: vi.fn(async (key: string, value: unknown) => storage.set(key, value)),
      },
      toolContext: { conversationId: 'conv-1', cwd: '/repo' },
      conversations: {
        appendTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
        updateTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
      },
    } as never;

    await expect(listWorkflows({}, ctx)).resolves.toMatchObject({ workflows: [] });
    const result = await workflow({ name: 'Storage', script: `return workflow.finish("stored");` }, ctx);
    expect(result).toMatchObject({ details: { status: 'completed', result: 'stored' } });
    await expect(listWorkflows({}, ctx)).resolves.toMatchObject({
      workflows: [expect.objectContaining({ name: 'Storage', resultText: 'stored' })],
    });
  });

  it('keeps storage fallback workflow lists ordered like sqlite queries', async () => {
    const storage = new Map<string, unknown>([
      [
        'dynamic-workflows.store',
        {
          runs: [
            createStoredRun('older', 'Older', '2026-01-01T00:00:00.000Z'),
            createStoredRun('newest', 'Newest', '2026-01-03T00:00:00.000Z'),
            createStoredRun('middle', 'Middle', '2026-01-02T00:00:00.000Z'),
          ],
          saved: [
            createStoredSavedWorkflow('saved-older', 'Saved older', '2026-01-01T00:00:00.000Z'),
            createStoredSavedWorkflow('saved-newest', 'Saved newest', '2026-01-03T00:00:00.000Z'),
            createStoredSavedWorkflow('saved-middle', 'Saved middle', '2026-01-02T00:00:00.000Z'),
          ],
          nodes: [
            { id: 'node-newer', workflow_id: 'newest', prompt: 'second', status: 'completed', created_at: '2026-01-03T00:00:02.000Z' },
            { id: 'node-older', workflow_id: 'newest', prompt: 'first', status: 'completed', created_at: '2026-01-03T00:00:01.000Z' },
          ],
          events: [
            { id: 'event-newer', workflow_id: 'newest', event_type: 'log', message: 'second', created_at: '2026-01-03T00:00:02.000Z' },
            { id: 'event-older', workflow_id: 'newest', event_type: 'log', message: 'first', created_at: '2026-01-03T00:00:01.000Z' },
          ],
        },
      ],
    ]);
    const ctx = {
      runtime: { getRepoRoot: () => '/repo' },
      storage: {
        get: vi.fn(async (key: string) => storage.get(key)),
        put: vi.fn(async (key: string, value: unknown) => storage.set(key, value)),
      },
      toolContext: { conversationId: 'conv-1', cwd: '/repo' },
      conversations: {
        appendTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
        updateTranscriptBlock: vi.fn(async () => ({ blockId: 'block-1' })),
      },
    } as never;

    await expect(listWorkflows({ limit: 2 }, ctx)).resolves.toMatchObject({
      workflows: [
        { id: 'newest', name: 'Newest' },
        { id: 'middle', name: 'Middle' },
      ],
    });
    await expect(listSavedWorkflows({}, ctx)).resolves.toMatchObject({
      workflows: [
        { id: 'saved-newest', name: 'Saved newest' },
        { id: 'saved-middle', name: 'Saved middle' },
        { id: 'saved-older', name: 'Saved older' },
      ],
    });
  });

  it('lists built-in workflow templates', async () => {
    await expect(listWorkflowTemplates()).resolves.toMatchObject({
      templates: expect.arrayContaining([
        expect.objectContaining({
          id: 'fanout-review',
          agentDefaults: expect.objectContaining({ model: 'opencode-go/deepseek-v4-flash' }),
        }),
      ]),
    });
  });

  it('saves and reruns reusable workflows', async () => {
    const { ctx } = createCtx();
    await saveWorkflow(
      {
        id: 'saved-smoke',
        name: 'Saved smoke',
        description: 'Reusable smoke workflow',
        args: { subject: 'saved' },
        script: `return workflow.finish("saved:" + args.subject);`,
      },
      ctx,
    );

    await expect(listSavedWorkflows({}, ctx)).resolves.toMatchObject({
      workflows: [expect.objectContaining({ id: 'saved-smoke', name: 'Saved smoke', args: { subject: 'saved' } })],
    });
    const result = await runSavedWorkflow({ id: 'saved-smoke' }, ctx);
    expect(result).toMatchObject({ details: { status: 'completed', result: 'saved:saved' } });
  });

  it('cancels running workflow nodes', async () => {
    const { ctx, db } = createCtx();
    const workflowResult = await workflow(
      {
        name: 'Cancelable',
        script: `await workflow.agent({ role: "worker", prompt: "work" }); return workflow.finish("done");`,
      },
      ctx,
    );
    const workflowId = workflowResult.details.workflowId;
    const nodeId = db.dump().nodes[0]?.id;
    db.prepare('DELETE FROM workflow_nodes WHERE id = ?').run(nodeId);
    db.prepare(
      'INSERT INTO workflow_nodes (id, workflow_id, phase, role, prompt, status, run_id, model, allowed_tools_json, result_text, error, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      nodeId,
      workflowId,
      null,
      'worker',
      'work',
      'running',
      'run-1',
      null,
      '[]',
      null,
      null,
      new Date().toISOString(),
      new Date().toISOString(),
      null,
    );

    await expect(cancelWorkflow({ workflowId }, ctx)).resolves.toMatchObject({ ok: true, cancelledNodes: 1 });
    expect(runs.cancelDurableRun).toHaveBeenCalledWith('run-1');
    expect(db.dump().runs[0]).toMatchObject({ status: 'cancelled' });
    expect(db.dump().nodes[0]).toMatchObject({ status: 'cancelled' });
  });

  it('cancels started subagent runs when the parent workflow times out', async () => {
    vi.useFakeTimers();
    try {
      settingsApi.readExtensionSettings.mockResolvedValue({ 'dynamicWorkflows.workflowTimeoutMinutes': 1 });
      runs.getDurableRun.mockResolvedValue({ run: { status: { status: 'running' } } });
      const { ctx, db } = createCtx();
      const resultPromise = workflow(
        {
          name: 'Timeout',
          script: `await workflow.agent({ role: "worker", prompt: "slow work" }); return workflow.finish("done");`,
        },
        ctx,
      );

      await vi.waitFor(() => expect(runs.startBackgroundRun).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(resultPromise).resolves.toMatchObject({ isError: true, details: { status: 'failed' } });
      expect(runs.cancelDurableRun).toHaveBeenCalledWith('run-1');
      expect(db.dump().nodes[0]).toMatchObject({ status: 'cancelled', run_id: 'run-1' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects missing script input', async () => {
    const { ctx } = createCtx();
    await expect(workflow({ name: 'Nope', args: { items: ['src/a.ts'] }, agentDefaults: { allowedTools: ['read'] } }, ctx)).rejects.toThrow(
      'script is required. Pass JavaScript statements',
    );
  });
});
