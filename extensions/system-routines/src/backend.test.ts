import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runAgentTaskMock } = vi.hoisted(() => ({ runAgentTaskMock: vi.fn() }));
vi.mock('@neon-pilot/extensions/backend/agent', () => ({ runAgentTask: runAgentTaskMock }));

import { deleteRoutine, getState, moveRoutine, registerHookPoint, runHook, saveRoutine } from './backend.js';

function seededRoutineState() {
  const timestamp = new Date().toISOString();
  return {
    version: 1,
    hookPoints: [],
    routines: [
      {
        id: 'checkpoint-review-code',
        hookId: 'checkpoint',
        position: 'before',
        type: 'decision',
        name: 'Review code changes',
        instruction:
          'Use /skill:autoreview to review the current diff. Choose exactly one outcome based on whether checkpointing should continue.',
        enabled: true,
        order: 0,
        failureBehavior: 'block',
        outcomes: [
          { id: 'pass', label: 'Pass', target: 'Continue checkpoint', behavior: 'continue' },
          { id: 'issues_found', label: 'Issues found', target: 'Block checkpoint and report issues', behavior: 'block' },
          { id: 'needs_validation', label: 'Needs validation', target: 'Warn and continue', behavior: 'warn' },
          { id: 'unclear', label: 'Unclear', target: 'Ask user before continuing', behavior: 'ask' },
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'checkpoint-report',
        hookId: 'checkpoint',
        position: 'after',
        type: 'instruction',
        name: 'Report checkpoint',
        instruction: 'Summarize the checkpoint result, included files, and follow-up work.',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    runs: [],
  };
}

function createCtx(options: { seeded?: boolean } = { seeded: true }) {
  const store = new Map<string, unknown>();
  if (options.seeded !== false) store.set('routines-state-v1', seededRoutineState());
  return {
    storage: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
        return { ok: true };
      }),
    },
    ui: { invalidate: vi.fn(), confirm: vi.fn(async () => ({ confirmed: true, status: 'confirmed' as const })) },
    extensions: { callAction: vi.fn(async () => ({ skills: [] })) },
  } as never;
}

beforeEach(() => {
  runAgentTaskMock.mockReset();
});

describe('system-routines backend', () => {
  it('starts with no routines until the user adds one', async () => {
    const result = (await getState({}, createCtx({ seeded: false }))) as {
      hooks: Array<{ id: string; summary: string }>;
      routines: unknown[];
    };
    expect(result.hooks.find((hook) => hook.id === 'checkpoint')?.summary).toBe('No routines');
    expect(result.routines).toEqual([]);
  });

  it('summarizes saved checkpoint routines', async () => {
    const result = (await getState({}, createCtx())) as { hooks: Array<{ id: string; summary: string }>; routines: unknown[] };
    expect(result.hooks.find((hook) => hook.id === 'checkpoint')?.summary).toContain('Review code changes');
    expect(result.routines.length).toBeGreaterThan(0);
  });

  it('rejects choose-path routines without usable paths', async () => {
    const ctx = createCtx();

    await expect(
      saveRoutine(
        {
          id: 'empty-decision',
          hookId: 'checkpoint',
          position: 'before',
          type: 'decision',
          name: 'Empty decision',
          instruction: 'Choose one',
          enabled: true,
          order: 0,
          failureBehavior: 'block',
          outcomes: [],
        },
        ctx,
      ),
    ).rejects.toThrow('at least one path');

    await expect(
      saveRoutine(
        {
          id: 'duplicate-decision',
          hookId: 'checkpoint',
          position: 'before',
          type: 'decision',
          name: 'Duplicate decision',
          instruction: 'Choose one',
          enabled: true,
          order: 0,
          failureBehavior: 'block',
          outcomes: [
            { id: 'pass', label: 'Pass', target: 'Continue', behavior: 'continue' },
            { id: 'pass', label: 'Pass again', target: 'Continue again', behavior: 'continue' },
          ],
        },
        ctx,
      ),
    ).rejects.toThrow('must be unique');
  });

  it('blocks a hook when a decision routine returns a blocking enum outcome', async () => {
    runAgentTaskMock.mockResolvedValue({ text: 'OUTCOME: issues_found\nBug found.' });
    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, createCtx())) as {
      blocked: boolean;
      status: string;
      run: { steps: Array<{ outcome?: string; status: string }> };
    };
    expect(result.blocked).toBe(true);
    expect(result.status).toBe('blocked');
    expect(result.run.steps[0]).toMatchObject({ outcome: 'issues_found', status: 'blocked' });
  });

  it('continues a hook when decision routine returns pass', async () => {
    runAgentTaskMock.mockResolvedValueOnce({ text: 'OUTCOME: pass' }).mockResolvedValueOnce({ text: 'reported' });
    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, createCtx())) as {
      blocked: boolean;
      status: string;
    };
    expect(result.blocked).toBe(false);
    expect(result.status).toBe('passed');
  });

  it('uses a host approval for ask decision outcomes before continuing', async () => {
    const ctx = createCtx() as {
      ui: { confirm: ReturnType<typeof vi.fn> };
    };
    runAgentTaskMock.mockResolvedValue({ text: 'OUTCOME: unclear' });

    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, ctx as never)) as {
      blocked: boolean;
      status: string;
      run: { steps: Array<{ outcome?: string; status: string; message?: string }> };
    };

    expect(ctx.ui.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Routine needs approval',
        message: 'Ask user before continuing',
        confirmLabel: 'Continue',
        cancelLabel: 'Stop',
      }),
    );
    expect(result.blocked).toBe(false);
    expect(result.status).toBe('passed');
    expect(result.run.steps[0]).toMatchObject({ outcome: 'unclear', status: 'passed', message: 'Approved: Ask user before continuing' });
  });

  it('blocks ask decision outcomes when approval is declined', async () => {
    const ctx = createCtx() as {
      ui: { confirm: ReturnType<typeof vi.fn> };
    };
    ctx.ui.confirm.mockResolvedValueOnce({ confirmed: false, status: 'declined' });
    runAgentTaskMock.mockResolvedValue({ text: 'OUTCOME: unclear' });

    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, ctx as never)) as {
      blocked: boolean;
      status: string;
      run: { steps: Array<{ outcome?: string; status: string; message?: string }> };
    };

    expect(result.blocked).toBe(true);
    expect(result.status).toBe('blocked');
    expect(result.run.steps[0]).toMatchObject({ outcome: 'unclear', status: 'blocked', message: 'Declined: Ask user before continuing' });
  });

  it('does not run nested routines under blocked decision outcomes', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'blocking-decision',
        hookId: 'background.command',
        position: 'before',
        type: 'decision',
        name: 'Block command',
        instruction: 'Choose a route.',
        enabled: true,
        order: 0,
        failureBehavior: 'block',
        outcomes: [{ id: 'stop', label: 'Stop', target: 'Stop this command', behavior: 'block' }],
      },
      ctx,
    );
    await saveRoutine(
      {
        id: 'blocked-child',
        hookId: 'background.command',
        position: 'before',
        parentRoutineId: 'blocking-decision',
        parentOutcomeId: 'stop',
        type: 'instruction',
        name: 'Should not run',
        instruction: 'This must not execute.',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock.mockResolvedValue({ text: 'OUTCOME: stop' });

    const result = (await runHook({ hookId: 'background.command', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      run: { steps: Array<{ routineName: string; status: string }> };
    };

    expect(runAgentTaskMock).toHaveBeenCalledTimes(1);
    expect(result.run.steps.map((step) => step.routineName)).toEqual(['Block command']);
    expect(result.run.steps[0]?.status).toBe('blocked');
  });

  it('runs a branch target only once during a hook run', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'branch-decision',
        hookId: 'background.command',
        position: 'before',
        type: 'decision',
        name: 'Choose branch',
        instruction: 'Choose a route.',
        enabled: true,
        order: 0,
        failureBehavior: 'block',
        outcomes: [{ id: 'branch', label: 'Branch', target: 'Run follow-up', behavior: 'branch', nextRoutineId: 'branch-target' }],
      },
      ctx,
    );
    await saveRoutine(
      {
        id: 'branch-target',
        hookId: 'background.command',
        position: 'before',
        type: 'instruction',
        name: 'Branch target',
        instruction: 'Run once.',
        enabled: true,
        order: 1,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock.mockResolvedValueOnce({ text: 'OUTCOME: branch' }).mockResolvedValueOnce({ text: 'target ran' });

    const result = (await runHook({ hookId: 'background.command', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      run: { steps: Array<{ routineName: string }> };
    };

    expect(runAgentTaskMock).toHaveBeenCalledTimes(2);
    expect(result.run.steps.map((step) => step.routineName)).toEqual(['Choose branch', 'Branch target']);
  });

  it('downgrades deleted branch targets so runs are not silent no-ops', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'branch-decision',
        hookId: 'background.command',
        position: 'before',
        type: 'decision',
        name: 'Choose branch',
        instruction: 'Choose a route.',
        enabled: true,
        order: 0,
        failureBehavior: 'block',
        outcomes: [{ id: 'branch', label: 'Branch', target: 'Run follow-up', behavior: 'branch', nextRoutineId: 'branch-target' }],
      },
      ctx,
    );
    await saveRoutine(
      {
        id: 'branch-target',
        hookId: 'background.command',
        position: 'before',
        type: 'instruction',
        name: 'Branch target',
        instruction: 'Run once.',
        enabled: true,
        order: 1,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );

    const stateAfterDelete = (await deleteRoutine({ routineId: 'branch-target' }, ctx)) as {
      routines: Array<{ id: string; outcomes: Array<{ id: string; behavior: string; nextRoutineId?: string }> }>;
    };
    const branchOutcome = stateAfterDelete.routines.find((routine) => routine.id === 'branch-decision')?.outcomes[0];
    expect(branchOutcome).toMatchObject({ id: 'branch', behavior: 'warn' });
    expect(branchOutcome?.nextRoutineId).toBeUndefined();

    runAgentTaskMock.mockResolvedValueOnce({ text: 'OUTCOME: branch' });
    const result = (await runHook({ hookId: 'background.command', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      status: string;
      run: { steps: Array<{ routineName: string; status: string }> };
    };

    expect(result.status).toBe('warned');
    expect(result.run.steps).toEqual([expect.objectContaining({ routineName: 'Choose branch', status: 'warned' })]);
  });

  it('marks routine prompts as automated and points back to Routines', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'automation-source-test',
        hookId: 'checkpoint',
        position: 'before',
        type: 'instruction',
        name: 'Source marker',
        instruction: 'Check the source marker.',
        enabled: true,
        order: -1,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock.mockResolvedValue({ text: 'ok' });

    await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, ctx);

    expect(runAgentTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('This message was generated by Neon Pilot Routines, not typed by the user.'),
      }),
      ctx,
    );
    expect(runAgentTaskMock.mock.calls[0]?.[0].prompt).toContain('Routine ID: automation-source-test');
    expect(runAgentTaskMock.mock.calls[0]?.[0].prompt).toContain('Open Routines: /routines');
    expect(runAgentTaskMock.mock.calls[0]?.[0].prompt).toContain('Hook: checkpoint (before)');
  });

  it('passes routine model settings and retries with fallback model', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'model-routine',
        hookId: 'checkpoint',
        position: 'before',
        type: 'instruction',
        name: 'Model routine',
        instruction: 'Use configured model',
        enabled: true,
        order: -1,
        failureBehavior: 'continue',
        modelRef: 'primary/model',
        fallbackModelRef: 'backup/model',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({ text: 'backup ok', model: 'model', provider: 'backup' });

    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      run: { steps: Array<{ routineName: string; fallbackUsed?: boolean; provider?: string }> };
    };

    expect(runAgentTaskMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ modelRef: 'primary/model' }), ctx);
    expect(runAgentTaskMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ modelRef: 'backup/model' }), ctx);
    expect(result.run.steps.find((step) => step.routineName === 'Model routine')).toMatchObject({ fallbackUsed: true, provider: 'backup' });
  });

  it('stores sanitized routine model errors in run history', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'quota-error-routine',
        hookId: 'background.command',
        position: 'before',
        type: 'instruction',
        name: 'Quota check',
        instruction: 'Check command.',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock.mockRejectedValue(
      new Error(
        'Codex error: {"type":"error","error":{"type":"usage_limit_reached","message":"The usage limit has been reached"},"status_code":429,"headers":{"X-Codex-Active-Limit":"codex_bengalfox"}}',
      ),
    );

    const result = (await runHook({ hookId: 'background.command', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      run: { steps: Array<{ message?: string }> };
    };

    expect(result.run.steps[0]?.message).toBe('Routine model call failed (429): The usage limit has been reached');
    expect(result.run.steps[0]?.message).not.toContain('headers');
    expect(result.run.steps[0]?.message).not.toContain('X-Codex');
  });

  it('runs only routines nested under the judge output route', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'nested-pass',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'pass',
        type: 'instruction',
        name: 'Pass instruction',
        instruction: 'Run only on pass',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    await saveRoutine(
      {
        id: 'nested-issues',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'issues_found',
        type: 'instruction',
        name: 'Issues instruction',
        instruction: 'Run only on issues',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    runAgentTaskMock.mockResolvedValueOnce({ text: 'OUTCOME: pass' }).mockResolvedValueOnce({ text: 'pass child ran' });

    const result = (await runHook({ hookId: 'checkpoint', position: 'before', context: { cwd: '/repo' } }, ctx)) as {
      run: { steps: Array<{ routineName: string }> };
    };

    expect(result.run.steps.map((step) => step.routineName)).toContain('Pass instruction');
    expect(result.run.steps.map((step) => step.routineName)).not.toContain('Issues instruction');
  });

  it('deletes nested route routines when their judge is deleted', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'nested-pass',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'pass',
        type: 'instruction',
        name: 'Pass instruction',
        instruction: 'Run only on pass',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );
    const state = (await deleteRoutine({ routineId: 'checkpoint-review-code' }, ctx)) as { routines: Array<{ id: string }> };
    expect(state.routines.some((routine) => routine.id === 'checkpoint-review-code')).toBe(false);
    expect(state.routines.some((routine) => routine.id === 'nested-pass')).toBe(false);
  });

  it('saves custom routines', async () => {
    const ctx = createCtx();
    const saved = (await saveRoutine(
      { hookId: 'checkpoint', position: 'after', type: 'stop', name: 'Stop always', instruction: 'No', enabled: true },
      ctx,
    )) as { hooks: Array<{ id: string; summary: string }>; routines: Array<{ name: string }> };
    expect(saved.hooks.find((hook) => hook.id === 'checkpoint')?.summary).toContain('Stop always');
    expect(saved.routines.some((routine) => routine.name === 'Stop always')).toBe(true);
  });

  it('waits for routine state invalidation before save completes', async () => {
    const ctx = createCtx() as {
      ui: { invalidate: ReturnType<typeof vi.fn> };
    };
    let invalidated = false;
    ctx.ui.invalidate = vi.fn(async () => {
      await Promise.resolve();
      invalidated = true;
    });

    await saveRoutine(
      { hookId: 'checkpoint', position: 'after', type: 'stop', name: 'Stop always', instruction: 'No', enabled: true },
      ctx as never,
    );

    expect(ctx.ui.invalidate).toHaveBeenCalledWith(['routines']);
    expect(invalidated).toBe(true);
  });

  it('lets extensions register hook points', async () => {
    const ctx = createCtx();
    await registerHookPoint({ id: 'example.before', title: 'Example', group: 'Extensions', ownerExtensionId: 'example' }, ctx);
    const state = (await getState({}, ctx)) as { hooks: Array<{ id: string; title: string }> };
    expect(state.hooks).toContainEqual(expect.objectContaining({ id: 'example.before', title: 'Example' }));
  });

  it('repairs routines with invalid parents so they remain visible', async () => {
    const ctx = createCtx();
    await (ctx as { storage: { put: (key: string, value: unknown) => Promise<unknown> } }).storage.put('routines-state-v1', {
      version: 1,
      hookPoints: [],
      runs: [],
      routines: [
        {
          id: 'orphaned-routine',
          hookId: 'checkpoint',
          position: 'before',
          parentRoutineId: 'missing-judge',
          parentOutcomeId: 'pass',
          type: 'instruction',
          name: 'Orphaned routine',
          instruction: 'Still visible',
          enabled: true,
          order: 0,
          failureBehavior: 'continue',
          outcomes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const state = (await getState({}, ctx)) as { routines: Array<{ id: string; parentRoutineId?: string; parentOutcomeId?: string }> };
    const repaired = state.routines.find((routine) => routine.id === 'orphaned-routine');
    expect(repaired?.parentRoutineId).toBeUndefined();
    expect(repaired?.parentOutcomeId).toBeUndefined();
  });

  it('repairs invalid nested routes before returning saved state', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'nested-pass',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'pass',
        type: 'instruction',
        name: 'Pass instruction',
        instruction: 'Run only on pass',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [],
      },
      ctx,
    );

    const state = (await saveRoutine(
      {
        id: 'checkpoint-review-code',
        hookId: 'checkpoint',
        position: 'before',
        type: 'decision',
        name: 'Review code changes',
        instruction: 'Choose one.',
        enabled: true,
        order: 0,
        failureBehavior: 'block',
        outcomes: [{ id: 'renamed', label: 'Renamed', target: 'Continue', behavior: 'continue' }],
      },
      ctx,
    )) as { routines: Array<{ id: string; parentRoutineId?: string; parentOutcomeId?: string }> };

    const repaired = state.routines.find((routine) => routine.id === 'nested-pass');
    expect(repaired?.id).toBe('nested-pass');
    expect(repaired?.parentRoutineId).toBeUndefined();
    expect(repaired?.parentOutcomeId).toBeUndefined();
  });

  it('normalizes malformed run history before returning state', async () => {
    const ctx = createCtx();
    await (ctx as { storage: { put: (key: string, value: unknown) => Promise<unknown> } }).storage.put('routines-state-v1', {
      version: 1,
      hookPoints: [],
      routines: [],
      runs: [
        { id: 'bad-run', hookId: 'checkpoint', position: 'before', status: 'passed', startedAt: 'bad-date' },
        { id: 'bad-step-run', hookId: 'checkpoint', position: 'before', steps: [{ routineId: 'r1', routineName: 'Routine' }] },
      ],
    });

    const state = (await getState({}, ctx)) as {
      runs: Array<{
        id: string;
        status: string;
        steps: Array<{ routineId: string; routineName: string; status: string; skillRefs: string[] }>;
      }>;
    };

    expect(state.runs.find((run) => run.id === 'bad-run')).toMatchObject({ status: 'skipped', steps: [] });
    expect(state.runs.find((run) => run.id === 'bad-step-run')?.steps[0]).toMatchObject({
      routineId: 'r1',
      routineName: 'Routine',
      status: 'passed',
      skillRefs: [],
    });
  });

  it('moves routines into judge routes', async () => {
    const ctx = createCtx();
    const initial = (await getState({}, ctx)) as { routines: Array<{ id: string; name: string; position: string; order: number }> };
    const report = initial.routines.find((routine) => routine.name === 'Report checkpoint');
    expect(report).toBeTruthy();

    const moved = (await moveRoutine(
      { routineId: report?.id, position: 'before', parentRoutineId: 'checkpoint-review-code', parentOutcomeId: 'pass' },
      ctx,
    )) as {
      routines: Array<{ id: string; name: string; position: string; parentRoutineId?: string; parentOutcomeId?: string }>;
    };
    expect(moved.routines.find((routine) => routine.id === report?.id)).toMatchObject({
      parentRoutineId: 'checkpoint-review-code',
      parentOutcomeId: 'pass',
    });
  });

  it('rejects moves that would nest a routine inside its own child route', async () => {
    const ctx = createCtx();
    await saveRoutine(
      {
        id: 'child-judge',
        hookId: 'checkpoint',
        position: 'before',
        parentRoutineId: 'checkpoint-review-code',
        parentOutcomeId: 'pass',
        type: 'decision',
        name: 'Child judge',
        instruction: 'Choose one',
        enabled: true,
        order: 0,
        failureBehavior: 'continue',
        outcomes: [{ id: 'ok', label: 'OK', target: 'Continue', behavior: 'continue' }],
      },
      ctx,
    );

    await expect(
      moveRoutine({ routineId: 'checkpoint-review-code', position: 'before', parentRoutineId: 'child-judge', parentOutcomeId: 'ok' }, ctx),
    ).rejects.toThrow('own nested paths');
  });

  it('moves routines between lanes and reorders the target lane', async () => {
    const ctx = createCtx();
    const initial = (await getState({}, ctx)) as { routines: Array<{ id: string; name: string; position: string; order: number }> };
    const report = initial.routines.find((routine) => routine.name === 'Report checkpoint');
    const review = initial.routines.find((routine) => routine.name === 'Review code changes');
    expect(report).toBeTruthy();
    expect(review).toBeTruthy();

    const moved = (await moveRoutine({ routineId: report?.id, position: 'before', targetRoutineId: review?.id }, ctx)) as {
      routines: Array<{ id: string; name: string; position: string; order: number }>;
    };
    const before = moved.routines
      .filter((routine) => routine.position === 'before')
      .sort((left, right) => left.order - right.order)
      .map((routine) => routine.name);
    expect(before.slice(0, 2)).toEqual(['Report checkpoint', 'Review code changes']);
  });
});
